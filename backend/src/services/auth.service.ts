import { transaction } from '../db/index.js';
import { env } from '../config/env.js';
import { addHoursIso, dayKey, isExpired, nowIso } from '../lib/clock.js';
import { badRequest, conflict, forbidden, unauthorized } from '../lib/errors.js';
import { guestNickname, hashToken, newId, newSessionToken } from '../lib/ids.js';
import { applyResourceDelta, deleteExpiredSessions, findPlayerById, findPlayerByNickname, findSessionByTokenHash, insertDefaultProgress, insertDefaultResources, insertPlayer, insertSession, revokeSession } from '../repositories/player.repository.js';
import { ensureDailyState } from '../repositories/player.repository.js';
import { addOwnedCharacter, replaceFormation } from '../repositories/roster.repository.js';
import { findCharacterDefByName } from '../repositories/catalog.repository.js';
import type { PlayerRow } from '../domain/types.js';
import { findCredential, insertCredential } from '../repositories/account.repository.js';
import { hashPassword, isStrongPassword, verifyPassword } from '../lib/password.js';
import { findActiveBan } from '../repositories/gm.repository.js';
import { insertSecurityLog } from '../repositories/log.repository.js';

/** 新账号初始资源（与前端 defaultSave 对齐） */
const STARTER = { coin: 50_000, gem: 100, book: 10 } as const;
const STARTER_CHARACTER = '青团';
const NICKNAME_PATTERN = /^[\p{L}\p{N}]{2,8}$/u;

export type AuthResult = { token: string; expiresAt: string; player: PlayerRow };

export type CreateGuestInput = {
  nickname?: string;
  gender?: 'male' | 'female';
  server?: number;
};

/**
 * 创建游客账号并签发会话。
 * 整个过程在一个事务内完成：账号、资源、进度、初始食灵、阵容、会话要么全成，要么全败。
 */
export function createGuest(input: CreateGuestInput): AuthResult {
  const gender = input.gender ?? 'female';
  const server = input.server ?? 17;
  if (!Number.isInteger(server) || server < 1 || server > 99) {
    throw badRequest('服务器编号需在 1-99 之间');
  }

  const nickname = (input.nickname ?? guestNickname()).trim();
  if (!NICKNAME_PATTERN.test(nickname)) {
    throw badRequest('昵称需为 2-8 位中英文或数字');
  }
  // v16 按服隔离：先确定 server 再查重——同一昵称在不同服互不冲突
  if (findPlayerByNickname(nickname, server)) {
    throw conflict('该昵称在当前服务器已被使用');
  }

  const playerId = newId();
  const createdAt = nowIso();
  const { token, tokenHash } = newSessionToken();
  const expiresAt = addHoursIso(env.sessionTtlHours);

  const player = transaction(() => {
    // 匿名注册是匿名写入口，先清理过期会话，防止表无限膨胀
    deleteExpiredSessions(createdAt);
    insertPlayer({ id: playerId, nickname, gender, server, createdAt });
    insertDefaultResources(playerId);
    insertDefaultProgress(playerId);
    ensureDailyState(playerId, dayKey());

    const starter = findCharacterDefByName(STARTER_CHARACTER);
    if (!starter) throw conflict('初始食灵配置缺失，请先执行种子数据写入');
    addOwnedCharacter(playerId, starter.id, createdAt);
    replaceFormation(playerId, [starter.id]);

    // 初始资源走统一入口，确保留下流水（便于对账与回滚）
    applyResourceDelta(playerId, { ...STARTER }, 'player.create', playerId);

    insertSession({ id: newId(), playerId, tokenHash, issuedAt: createdAt, expiresAt });

    const row = findPlayerById(playerId);
    if (!row) throw conflict('账号创建失败');
    return row;
  });

  return { token, expiresAt, player };
}

/** 校验令牌并返回玩家；令牌无效、被吊销或过期一律 401；封禁账号 403。 */
export function authenticate(token: string | undefined): { player: PlayerRow; sessionId: string } {
  if (!token) throw unauthorized('缺少访问令牌');
  const session = findSessionByTokenHash(hashToken(token));
  if (!session) throw unauthorized('访问令牌无效');
  if (session.revoked_at) throw unauthorized('访问令牌已失效');
  if (isExpired(session.expires_at)) throw unauthorized('访问令牌已过期');
  const player = findPlayerById(session.player_id);
  if (!player) throw unauthorized('账号不存在');

  // 封禁检查（v11）：active = 1 且未过期的封禁记录即时生效，留安全日志供风控聚合
  const ban = findActiveBan(player.id, nowIso());
  if (ban) {
    insertSecurityLog({
      playerId: player.id,
      event: 'ban_hit',
      detail: { reason: ban.reason, expiresAt: ban.expires_at },
    });
    throw forbidden(ban.expires_at ? `账号已被封禁，至 ${ban.expires_at}` : '账号已被封禁');
  }

  return { player, sessionId: session.id };
}

export function logout(sessionId: string): void {
  revokeSession(sessionId);
}

/** 为已有玩家重新签发令牌（多端登录场景）。 */
export function issueSession(playerId: string): AuthResult {
  const player = findPlayerById(playerId);
  if (!player) throw unauthorized('账号不存在');
  const { token, tokenHash } = newSessionToken();
  const issuedAt = nowIso();
  const expiresAt = addHoursIso(env.sessionTtlHours);
  insertSession({ id: newId(), playerId, tokenHash, issuedAt, expiresAt });
  return { token, expiresAt, player };
}

/* ------------------------------ 账号密码注册 / 登录 ------------------------------ */

/**
 * 为当前会话身份设置密码（正式注册）。一个身份至多一套凭据，重复设置返回 409。
 * 账号 ID（players.id）是找回凭证，前端须提示用户妥善保存。
 */
export function registerPassword(playerId: string, password: unknown): { accountId: string } {
  if (!isStrongPassword(password)) {
    throw badRequest('密码需 8-64 位且同时包含字母与数字');
  }
  if (findCredential(playerId)) {
    throw conflict('该账号已设置密码，如需修改请使用登录后改密流程');
  }
  insertCredential(playerId, hashPassword(password));
  return { accountId: playerId };
}

/** 账号 ID + 密码登录：校验通过后为该身份签发新会话（跨设备找回存档）。 */
export function loginWithPassword(accountId: unknown, password: unknown): AuthResult {
  if (typeof accountId !== 'string' || !accountId.trim()) throw badRequest('缺少账号 ID');
  if (!isStrongPassword(password)) throw unauthorized('账号 ID 或密码不正确');
  const player = findPlayerById(accountId.trim());
  // 统一错误口径：不区分「账号不存在/未设密码/密码错误」，避免账号枚举
  const credential = player ? findCredential(player.id) : undefined;
  if (!player || !credential || !verifyPassword(password, credential.password_hash)) {
    throw unauthorized('账号 ID 或密码不正确');
  }
  return issueSession(player.id);
}
