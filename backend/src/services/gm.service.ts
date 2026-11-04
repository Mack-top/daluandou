import { transaction, execute } from '../db/index.js';
import { nowIso } from '../lib/clock.js';
import { badRequest, forbidden, unauthorized } from '../lib/errors.js';
import { verifyPassword } from '../lib/password.js';
import { bumpCatalogVersion } from '../repositories/catalog-meta.repository.js';
import { listFeatureToggles } from '../repositories/catalog.repository.js';
import {
  applyResourceDelta,
  listPlayersForAdmin,
  requirePlayer,
  revokeAllSessions,
} from '../repositories/player.repository.js';
import {
  findActiveBan,
  findGmByUsername,
  insertGmAuditLog,
  insertPlayerBan,
  liftPlayerBans,
  listGmAuditLogs,
  touchGmLogin,
} from '../repositories/gm.repository.js';
import { insertSystemMail } from '../repositories/system-mail.repository.js';
import { CURRENCIES, type Currency, type GmAccountRow, type Reward } from '../domain/types.js';
import { insertSecurityLog } from '../repositories/log.repository.js';
import { clearLoginFailures, isLoginLocked, issueGmSession, recordLoginFailure, revokeGmSession } from '../middleware/gm-auth.js';

/* ------------------------------ GM 登录（v11） ------------------------------ */

export type GmLoginResult = { token: string; gm: { id: string; username: string; role: GmAccountRow['role'] } };

export function gmLogin(username: unknown, password: unknown, ip = ''): GmLoginResult {
  if (typeof username !== 'string' || !username.trim()) throw badRequest('缺少 GM 用户名');
  if (typeof password !== 'string' || !password) throw badRequest('缺少 GM 口令');
  const name = username.trim();

  const lockSeconds = isLoginLocked(name);
  if (lockSeconds > 0) {
    insertSecurityLog({ event: 'login_fail', detail: { scope: 'gm', username: name, reason: 'locked' }, ip });
    throw forbidden(`失败次数过多，请 ${lockSeconds} 秒后再试`);
  }

  // 统一错误口径：不区分「账号不存在/口令错误/已停用」，避免账号枚举
  const gm = findGmByUsername(name);
  if (!gm || !verifyPassword(password, gm.password_hash) || gm.status !== 'active') {
    recordLoginFailure(name);
    // 审计表外键指向 gm_accounts，账号不存在时没有可审计主体，仅留安全日志
    if (gm) {
      insertGmAuditLog({
        gmId: gm.id,
        action: 'login',
        targetType: 'system',
        targetId: name,
        payload: { reason: 'bad_credentials' },
        result: 'failed',
        ip,
      });
    }
    insertSecurityLog({ event: 'login_fail', detail: { scope: 'gm', username: name }, ip });
    throw unauthorized('GM 用户名或口令不正确');
  }

  clearLoginFailures(name);
  touchGmLogin(gm.id);
  const token = issueGmSession(gm.id);
  insertGmAuditLog({ gmId: gm.id, action: 'login', targetType: 'system', targetId: name, payload: {}, result: 'ok', ip });
  return { token, gm: { id: gm.id, username: gm.username, role: gm.role } };
}

export function gmLogout(token: string, gm: GmAccountRow, ip = ''): void {
  revokeGmSession(token);
  insertGmAuditLog({ gmId: gm.id, action: 'login', targetType: 'system', targetId: gm.username, payload: { op: 'logout' }, result: 'ok', ip });
}

/* ------------------------------ 发邮件 / 发补偿 ------------------------------ */

function validateAttachments(attachments: unknown): Array<{ kind: string; amount: number; itemId?: string; label?: string }> {
  if (!Array.isArray(attachments) || attachments.length === 0) {
    throw badRequest('邮件附件不能为空');
  }
  return attachments.map(item => {
    const reward = item as Partial<Reward>;
    if (!reward.kind || (reward.kind !== 'item' && !CURRENCIES.includes(reward.kind as Currency))) {
      throw badRequest(`附件类型非法：${String(reward.kind)}`);
    }
    if (!Number.isInteger(reward.amount) || Number(reward.amount) <= 0) {
      throw badRequest('附件数量必须为正整数');
    }
    if (reward.kind === 'item' && typeof reward.itemId !== 'string') {
      throw badRequest('物品附件缺少 itemId');
    }
    return reward as { kind: string; amount: number; itemId?: string; label?: string };
  });
}

/** 批量收件人分块：SQLite 单写者，每块 500 人提交一次，避免长事务阻塞在线写（设计 §2.7）。 */
const MAIL_CHUNK_SIZE = 500;

function chunked<T>(items: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let index = 0; index < items.length; index += size) {
    chunks.push(items.slice(index, index + size));
  }
  return chunks;
}

/** GM 个性化邮件（批量）：逐玩家一行写 player_system_mails + 审计（含发放人数）。 */
export function gmSendMail(input: {
  gm: GmAccountRow;
  playerIds: string[];
  title: string;
  body?: string;
  attachments: unknown;
  expireDays?: number;
  ip?: string;
}): { sent: number } {
  const attachments = validateAttachments(input.attachments);
  if (!input.title?.trim()) throw badRequest('邮件标题不能为空');
  if (!Array.isArray(input.playerIds) || input.playerIds.length === 0) {
    throw badRequest('收件人列表不能为空');
  }
  const expireDays = input.expireDays ?? 7;
  if (!Number.isInteger(expireDays) || expireDays < 0 || expireDays > 30) {
    throw badRequest('有效期必须为 0-30 的整数天（0 = 永不过期）');
  }
  const expireAt = expireDays > 0 ? new Date(Date.now() + expireDays * 86_400_000).toISOString() : null;
  const playerIds = [...new Set(input.playerIds)];

  let sent = 0;
  for (const chunk of chunked(playerIds, MAIL_CHUNK_SIZE)) {
    transaction(() => {
      for (const playerId of chunk) {
        requirePlayer(playerId); // 不存在则 404，本块回滚
        insertSystemMail({
          playerId,
          title: input.title.trim(),
          body: input.body ?? '',
          attachments,
          source: 'gm',
          createdBy: input.gm.id,
          expireAt,
        });
        sent += 1;
      }
    });
  }
  insertGmAuditLog({
    gmId: input.gm.id,
    action: 'send_mail',
    targetType: 'system',
    targetId: null,
    payload: { count: sent, title: input.title, attachments, expireAt },
    result: 'ok',
    ip: input.ip,
  });
  return { sent };
}

/**
 * GM 补偿（批量）：按设计 §2.7 以 source='compensation' 的系统邮件下发，
 * 玩家领取时走 claimSystemMail → applyRewards（货币过 applyResourceDelta 流水 + 物品过 grantItem）。
 */
export function gmSendCompensation(input: {
  gm: GmAccountRow;
  playerIds: string[];
  reason: string;
  attachments: unknown;
  expireDays?: number;
  ip?: string;
}): { sent: number } {
  if (!input.reason?.trim()) throw badRequest('补偿原因不能为空');
  const attachments = validateAttachments(input.attachments);
  if (!Array.isArray(input.playerIds) || input.playerIds.length === 0) {
    throw badRequest('收件人列表不能为空');
  }
  const playerIds = [...new Set(input.playerIds)];

  let sent = 0;
  for (const chunk of chunked(playerIds, MAIL_CHUNK_SIZE)) {
    transaction(() => {
      for (const playerId of chunk) {
        requirePlayer(playerId);
        insertSystemMail({
          playerId,
          title: '运营补偿',
          body: input.reason.trim(),
          attachments,
          source: 'compensation',
          createdBy: input.gm.id,
          expireAt: null,
        });
        sent += 1;
      }
    });
  }
  insertGmAuditLog({
    gmId: input.gm.id,
    action: 'send_compensation',
    targetType: 'system',
    targetId: null,
    payload: { count: sent, reason: input.reason, attachments },
    result: 'ok',
    ip: input.ip,
  });
  return { sent };
}

/** GM 直接发放资源（grant_resource）：同走 applyResourceDelta，写入流水与审计。 */
export function gmGrantResource(input: {
  gm: GmAccountRow;
  playerId: string;
  currency: unknown;
  amount: unknown;
  ip?: string;
}): void {
  if (typeof input.currency !== 'string' || !CURRENCIES.includes(input.currency as Currency)) {
    throw badRequest(`货币类型非法：${String(input.currency)}`);
  }
  if (typeof input.amount !== 'number' || !Number.isInteger(input.amount)) {
    throw badRequest('发放数量必须为整数');
  }
  transaction(() => {
    requirePlayer(input.playerId);
    applyResourceDelta(
      input.playerId,
      { [input.currency as Currency]: input.amount } as Partial<Record<Currency, number>>,
      'gm.grant',
      input.gm.id,
    );
  });
  insertGmAuditLog({
    gmId: input.gm.id,
    action: 'grant_resource',
    targetType: 'player',
    targetId: input.playerId,
    payload: { currency: input.currency, amount: input.amount },
    result: 'ok',
    ip: input.ip,
  });
}

/* ------------------------------ 封禁 / 解封 ------------------------------ */

export function gmBanPlayer(input: {
  gm: GmAccountRow;
  playerId: string;
  reason?: string;
  days?: number | null;
  ip?: string;
}): { banId: string; revokedSessions: number } {
  const reason = input.reason?.trim();
  if (!reason) throw badRequest('封禁原因不能为空');
  const days = input.days ?? null;
  if (days !== null && (!Number.isInteger(days) || days <= 0 || days > 3650)) {
    throw badRequest('封禁天数必须为 1-3650 的整数，或不传表示永久');
  }

  // 封禁 = 事务（封禁行 + 会话撤销原子）；审计写在事务外（审计失败不回滚业务）
  const outcome = transaction(() => {
    requirePlayer(input.playerId);
    const expiresAt = days ? new Date(Date.now() + days * 86_400_000).toISOString() : null;
    const banId = insertPlayerBan({ playerId: input.playerId, reason, bannedBy: input.gm.id, expiresAt });
    const revokedSessions = revokeAllSessions(input.playerId);
    return { banId, expiresAt, revokedSessions };
  });

  insertGmAuditLog({
    gmId: input.gm.id,
    action: 'ban',
    targetType: 'player',
    targetId: input.playerId,
    payload: { reason, days, expiresAt: outcome.expiresAt, revokedSessions: outcome.revokedSessions },
    result: 'ok',
    ip: input.ip,
  });
  return { banId: outcome.banId, revokedSessions: outcome.revokedSessions };
}

export function gmUnbanPlayer(input: { gm: GmAccountRow; playerId: string; ip?: string }): { lifted: number } {
  requirePlayer(input.playerId);
  const lifted = liftPlayerBans(input.playerId);
  insertGmAuditLog({
    gmId: input.gm.id,
    action: 'unban',
    targetType: 'player',
    targetId: input.playerId,
    payload: { lifted },
    result: 'ok',
    ip: input.ip,
  });
  return { lifted };
}

/* ------------------------------ 查询 ------------------------------ */

export function gmListAuditLogs(filter: { gmId?: string; action?: string; limit?: number }) {
  return listGmAuditLogs(filter);
}

export function gmPlayerInfo(playerId: string) {
  const player = requirePlayer(playerId);
  const ban = findActiveBan(playerId, nowIso());
  return { player, activeBan: ban ?? null };
}

/** GM 玩家检索（v16 按服隔离配套）：按服 / 昵称 / ID 关键字过滤，只读不写审计。 */
export function gmListPlayers(filter: { server?: number; keyword?: string; limit?: number }) {
  return listPlayersForAdmin(filter);
}

/* ------------------------------ 功能与活动开关（v21） ------------------------------ */

export function gmListFeatureToggles() {
  return listFeatureToggles().map(row => ({
    key: row.key,
    name: row.name,
    category: row.category,
    enabled: row.enabled === 1,
    openDay: row.open_day,
    closeDay: row.close_day,
    detail: row.detail,
  }));
}

/**
 * GM 修改功能/活动开关（edit_config 权限）：事务内更新 + bump feature 域版本，
 * 客户端下次拉 catalog 即拿到新开关状态（动态生效）。
 * 允许修改：enabled / openDay / closeDay；undefined = 不修改，显式 null = 清除界限。
 */
export function gmUpdateFeatureToggle(input: {
  gm: GmAccountRow;
  key: string;
  enabled?: boolean;
  openDay?: number | null;
  closeDay?: number | null;
  ip?: string;
}) {
  const current = listFeatureToggles().find(row => row.key === input.key);
  if (!current) throw badRequest(`功能开关不存在：${input.key}`);

  const enabled = input.enabled === undefined ? current.enabled === 1 : input.enabled;
  const openDay = input.openDay === undefined ? current.open_day : input.openDay;
  const closeDay = input.closeDay === undefined ? current.close_day : input.closeDay;
  if (openDay !== null && (!Number.isInteger(openDay) || openDay < 1)) throw badRequest('openDay 必须为 ≥ 1 的整数或 null');
  if (closeDay !== null && (!Number.isInteger(closeDay) || closeDay < 1)) throw badRequest('closeDay 必须为 ≥ 1 的整数或 null');
  if (openDay !== null && closeDay !== null && closeDay < openDay) throw badRequest('closeDay 不能早于 openDay');

  transaction(() => {
    execute(
      `UPDATE feature_toggles SET enabled = ?, open_day = ?, close_day = ? WHERE key = ?`,
      enabled ? 1 : 0, openDay, closeDay, input.key,
    );
    bumpCatalogVersion('feature');
  });

  insertGmAuditLog({
    gmId: input.gm.id,
    action: 'edit_config',
    targetType: 'config',
    targetId: `feature_toggle:${input.key}`,
    payload: { enabled, openDay, closeDay, before: { enabled: current.enabled === 1, openDay: current.open_day, closeDay: current.close_day } },
    result: 'ok',
    ip: input.ip,
  });
  return { key: input.key, enabled, openDay, closeDay };
}
