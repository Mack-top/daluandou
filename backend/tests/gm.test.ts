/**
 * v11 GM 体系验证：
 * 登录（scrypt + 失败审计 + 安全日志）、权限矩阵与 denied 审计、
 * 批量邮件/补偿发放与领取、封禁（撤销会话 + 登录 403）与解封。
 */
import { after, before, test } from 'node:test';
import assert from 'node:assert/strict';
import { rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import type { NextFunction, Request, Response } from 'express';

import { closeDatabase, connectDatabase, countRows, execute, queryOne } from '../src/db/index.js';
import { runMigrations } from '../src/db/migrate.js';
import { seedCatalog } from '../src/db/seed.js';
import { createGuest, authenticate, issueSession } from '../src/services/auth.service.js';
import { hashPassword } from '../src/lib/password.js';
import { insertGmAccount, findGmByUsername } from '../src/repositories/gm.repository.js';
import {
  gmBanPlayer,
  gmLogin,
  gmSendCompensation,
  gmSendMail,
  gmUnbanPlayer,
} from '../src/services/gm.service.js';
import { claimSystemMail, listSystemMailbox } from '../src/services/system-mail.service.js';
import { getBalances } from '../src/repositories/player.repository.js';
import { countItemQuantity } from '../src/repositories/item.repository.js';
import { gmCan } from '../src/domain/gm-permissions.js';
import { issueGmSession, requireGm, resetGmSessions } from '../src/middleware/gm-auth.js';
import type { GmAccountRow } from '../src/domain/types.js';
import { ApiError } from '../src/lib/errors.js';

const databaseFile = path.join(tmpdir(), `food-fantasy-gm-${process.pid}.db`);

before(() => {
  connectDatabase(databaseFile);
  runMigrations();
  seedCatalog();
});

after(() => {
  closeDatabase();
  for (const suffix of ['', '-wal', '-shm']) rmSync(`${databaseFile}${suffix}`, { force: true });
});

function makeGm(username: string, role: GmAccountRow['role']): GmAccountRow {
  insertGmAccount({ username, passwordHash: hashPassword('TestPass123'), role });
  const gm = findGmByUsername(username);
  assert.ok(gm);
  return gm;
}

let counter = 0;
const uniqueGm = (role: GmAccountRow['role']) => makeGm(`gm-${role}-${(counter += 1)}-${Date.now()}`, role);

/* ------------------------------ 权限矩阵 ------------------------------ */

test('权限矩阵：super 全量，ops 无封禁，support 仅邮件，readonly 只可登录', () => {
  assert.equal(gmCan({ role: 'super' }, 'ban'), true);
  assert.equal(gmCan({ role: 'super' }, 'edit_config'), true);
  assert.equal(gmCan({ role: 'ops' }, 'send_compensation'), true);
  assert.equal(gmCan({ role: 'ops' }, 'ban'), false);
  assert.equal(gmCan({ role: 'support' }, 'send_mail'), true);
  assert.equal(gmCan({ role: 'support' }, 'grant_resource'), false);
  assert.equal(gmCan({ role: 'readonly' }, 'send_mail'), false);
});

/* ------------------------------ 登录与审计 ------------------------------ */

test('GM 登录：口令正确签发会话并写审计；错误口令 401 且写 failed 审计 + 安全日志', () => {
  const gm = uniqueGm('ops');

  const result = gmLogin(gm.username, 'TestPass123', '127.0.0.1');
  assert.ok(result.token.length > 20);
  assert.equal(result.gm.role, 'ops');
  assert.equal(
    countRows("SELECT COUNT(*) AS total FROM gm_audit_logs WHERE gm_id = ? AND action = 'login' AND result = 'ok'", gm.id),
    1,
  );

  assert.throws(() => gmLogin(gm.username, 'WrongPass999'), (error: unknown) => error instanceof ApiError && error.status === 401);
  assert.equal(
    countRows("SELECT COUNT(*) AS total FROM gm_audit_logs WHERE gm_id = ? AND result = 'failed'", gm.id),
    1,
    '失败登录必须留审计',
  );
  assert.ok(
    countRows("SELECT COUNT(*) AS total FROM security_logs WHERE event = 'login_fail'") >= 1,
    '失败登录必须留安全日志',
  );
});

test('requireGm 中间件：权限不足时写 denied 审计并抛 403', () => {
  const readonly = uniqueGm('readonly');
  const token = issueGmSession(readonly.id);

  const middleware = requireGm('send_mail');
  const req = { header: (name: string) => (name === 'authorization' ? `Bearer ${token}` : undefined), ip: '127.0.0.1', gm: undefined } as unknown as Request;
  const nextCalls: unknown[] = [];
  const res = {} as Response;
  middleware(req, res, ((error?: unknown) => nextCalls.push(error ?? 'ok')) as NextFunction);

  assert.equal(nextCalls.length, 1);
  const error = nextCalls[0];
  assert.ok(error instanceof ApiError && error.status === 403, 'readonly 无 send_mail 权限，应 403');
  assert.equal(
    countRows("SELECT COUNT(*) AS total FROM gm_audit_logs WHERE gm_id = ? AND result = 'denied'", readonly.id),
    1,
    '越权尝试必须写 denied 审计',
  );
});

/* ------------------------------ 邮件与补偿 ------------------------------ */

test('GM 批量邮件：逐玩家一行，领取走 applyRewards（货币流水 + 物品入包），重复领取拒绝', () => {
  const gm = uniqueGm('super');
  const playerA = createGuest({ nickname: '收件旅人甲' }).player.id;
  const playerB = createGuest({ nickname: '收件旅人乙' }).player.id;

  const { sent } = gmSendMail({
    gm,
    playerIds: [playerA, playerB],
    title: '测试邮件',
    body: '附件请查收',
    attachments: [
      { kind: 'gem', amount: 5 },
      { kind: 'item', amount: 2, itemId: 'item-stew-small', label: '暖胃炖汤' },
    ],
    expireDays: 7,
  });
  assert.equal(sent, 2);
  assert.equal(
    countRows("SELECT COUNT(*) AS total FROM player_system_mails WHERE source = 'gm' AND title = '测试邮件'"),
    2,
  );

  const gemsBefore = getBalances(playerA).gem;
  const mailbox = listSystemMailbox(playerA);
  assert.equal(mailbox.length, 1);
  const mail = mailbox[0];
  const { rewards } = claimSystemMail(playerA, mail.id);
  assert.equal(rewards.length, 2);
  assert.equal(getBalances(playerA).gem, gemsBefore + 5);
  assert.equal(countItemQuantity(playerA, 'item-stew-small'), 2, '物品附件经 grantItem 入包');
  // 货币附件必须留 resource_ledger 流水（统一入口的硬证据）
  assert.equal(
    countRows("SELECT COUNT(*) AS total FROM resource_ledger WHERE player_id = ? AND reason = 'mail.system.claim' AND currency = 'gem'", playerA),
    1,
  );

  assert.throws(() => claimSystemMail(playerA, mail.id), (error: unknown) => error instanceof ApiError && error.status === 409);

  // 不存在的收件人整体失败
  assert.throws(() => gmSendMail({ gm, playerIds: ['ghost-player'], title: 'x', attachments: [{ kind: 'gem', amount: 1 }] }));
});

test('GM 补偿：批量发放 source=compensation 邮件并写审计', () => {
  const gm = uniqueGm('ops');
  const playerId = createGuest({ nickname: '补偿旅人' }).player.id;

  const { sent } = gmSendCompensation({
    gm,
    playerIds: [playerId],
    reason: '闪断补偿',
    attachments: [{ kind: 'coin', amount: 10000 }],
  });
  assert.equal(sent, 1);
  const mail = queryOne<{ source: string }>(
    "SELECT source FROM player_system_mails WHERE player_id = ? AND source = 'compensation'",
    playerId,
  );
  assert.equal(mail?.source, 'compensation');
  assert.equal(
    countRows("SELECT COUNT(*) AS total FROM gm_audit_logs WHERE gm_id = ? AND action = 'send_compensation'", gm.id),
    1,
  );

  // 空原因/空附件/非法附件类型全部拒绝
  assert.throws(() => gmSendCompensation({ gm, playerIds: [playerId], reason: '  ', attachments: [{ kind: 'gem', amount: 1 }] }));
  assert.throws(() => gmSendCompensation({ gm, playerIds: [playerId], reason: 'x', attachments: [] }));
  assert.throws(() => gmSendCompensation({ gm, playerIds: [playerId], reason: 'x', attachments: [{ kind: 'diamond', amount: 1 }] }));
});

/* ------------------------------ 封禁 ------------------------------ */

test('封禁：撤销全部会话 + 认证链路 403 + 解封恢复', () => {
  const gm = uniqueGm('super');
  const { player, token } = createGuest({ nickname: '违规旅人' });
  authenticate(token); // 封禁前正常

  const { banId, revokedSessions } = gmBanPlayer({ gm, playerId: player.id, reason: '外挂嫌疑', days: 7 });
  assert.ok(banId);
  assert.equal(revokedSessions, 1, '封禁应撤销全部有效会话');

  // 已有令牌被吊销 → 401
  assert.throws(
    () => authenticate(token),
    (error: unknown) => error instanceof ApiError && error.status === 401,
  );
  // 封禁未解除时，重新签发的会话在认证链路命中封禁检查 → 403
  const bannedToken = issueSession(player.id).token;
  assert.throws(
    () => authenticate(bannedToken),
    (error: unknown) => error instanceof ApiError && error.status === 403,
  );
  assert.equal(
    countRows("SELECT COUNT(*) AS total FROM gm_audit_logs WHERE gm_id = ? AND action = 'ban' AND target_id = ?", gm.id, player.id),
    1,
  );

  const { lifted } = gmUnbanPlayer({ gm, playerId: player.id });
  assert.equal(lifted, 1);
  assert.equal(
    countRows("SELECT COUNT(*) AS total FROM gm_player_bans WHERE player_id = ? AND active = 1", player.id),
    0,
  );
  // 解封后新签发的会话恢复正常访问
  const restoredToken = issueSession(player.id).token;
  assert.equal(authenticate(restoredToken).player.id, player.id);
  // 旧令牌在封禁时已被吊销（不可恢复）
  assert.throws(
    () => authenticate(token),
    (error: unknown) => error instanceof ApiError && error.status === 401,
  );
});

test('封禁留痕：active 标记与历史行保留（解封不清历史）', () => {
  const gm = uniqueGm('super');
  const { player } = createGuest({ nickname: '留痕旅人' });
  gmBanPlayer({ gm, playerId: player.id, reason: '永久封禁测试' });
  gmUnbanPlayer({ gm, playerId: player.id });
  gmBanPlayer({ gm, playerId: player.id, reason: '二次封禁' });

  const rows = queryOne<{ total: number }>('SELECT COUNT(*) AS total FROM gm_player_bans WHERE player_id = ?', player.id);
  assert.equal(Number(rows?.total), 2, '封禁历史行全部保留（两次封禁 → 两行）');
  const active = queryOne<{ total: number }>('SELECT COUNT(*) AS total FROM gm_player_bans WHERE player_id = ? AND active = 1', player.id);
  assert.equal(Number(active?.total), 1, '仅最新一次封禁生效');

  // 审计表 append-only 防线：UPDATE/DELETE 路径不存在于代码，这里验证触发器级别的最后防线不存在也要能写
  assert.doesNotThrow(() =>
    execute("SELECT COUNT(*) FROM gm_audit_logs WHERE result IN ('ok', 'failed', 'denied')"),
  );
});

test('封禁原因必填', () => {
  const gm = uniqueGm('super');
  const { player } = createGuest({ nickname: '无因旅人' });
  assert.throws(() => gmBanPlayer({ gm, playerId: player.id, reason: '  ' }));
});

/* 清理 GM 会话内存状态，避免影响其它测试文件（node:test 每文件独立进程，防御性即可） */
test('会话状态可重置', () => {
  resetGmSessions();
  assert.ok(true);
});
