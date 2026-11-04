import { randomBytes } from 'node:crypto';
import type { NextFunction, Request, Response } from 'express';
import { env } from '../config/env.js';
import { forbidden, unauthorized } from '../lib/errors.js';
import { gmCan, type GmAction } from '../domain/gm-permissions.js';
import { findGmById, insertGmAuditLog } from '../repositories/gm.repository.js';
import type { GmAccountRow } from '../domain/types.js';

/**
 * GM 独立会话：进程内令牌 → GM 账号（v11 设计 §2.7）。
 * 不落库、不复用玩家 requireAuth/requireCsrf 轨道；重启后需重新登录（运维可接受）。
 */
type GmSession = { gmId: string; expiresAt: number };

const sessions = new Map<string, GmSession>();
/** 登录失败锁定：窗口内连续失败达到上限后，锁定该账号名一段时间。 */
const loginFailures = new Map<string, { count: number; lockedUntil: number; expiresAt: number }>();

function sweepExpired(): void {
  const now = Date.now();
  for (const [token, session] of sessions) {
    if (session.expiresAt <= now) sessions.delete(token);
  }
  for (const [username, state] of loginFailures) {
    if (state.expiresAt <= now) loginFailures.delete(username);
  }
}

export function issueGmSession(gmId: string): string {
  sweepExpired();
  const token = randomBytes(32).toString('base64url');
  sessions.set(token, { gmId, expiresAt: Date.now() + env.gmSessionTtlHours * 3600_000 });
  return token;
}

export function revokeGmSession(token: string): boolean {
  return sessions.delete(token);
}

export function clearLoginFailures(username: string): void {
  loginFailures.delete(username);
}

/** 返回剩余锁定秒数；0 = 未锁定（锁定已过期的记录顺手清理）。 */
export function isLoginLocked(username: string): number {
  const state = loginFailures.get(username);
  if (!state) return 0;
  if (state.lockedUntil > Date.now()) return Math.ceil((state.lockedUntil - Date.now()) / 1000);
  if (state.expiresAt <= Date.now()) loginFailures.delete(username);
  return 0;
}

export function recordLoginFailure(username: string): void {
  const now = Date.now();
  const previous = loginFailures.get(username);
  const state = previous && previous.expiresAt > now ? previous : { count: 0, lockedUntil: 0, expiresAt: now + env.gmLoginLockMinutes * 60_000 };
  state.count += 1;
  if (state.count >= env.gmLoginMaxFailures) {
    state.lockedUntil = Date.now() + env.gmLoginLockMinutes * 60_000;
    state.count = 0;
    state.expiresAt = state.lockedUntil;
  }
  loginFailures.set(username, state);
}

/** 来源 IP 归一：IPv4-mapped IPv6（::ffff:127.0.0.1）折算回 IPv4 记法。 */
export function normalizeIp(ip: string | undefined): string {
  const value = ip ?? '';
  return value.startsWith('::ffff:') ? value.slice('::ffff:'.length) : value;
}

/** GM 管理端点 IP 白名单：挂在 admin 路由最外层，先于会话校验。 */
export function requireGmIp(req: Request, _res: Response, next: NextFunction): void {
  const ip = normalizeIp(req.ip);
  if (!env.gmIpAllowlist.includes(ip)) {
    throw forbidden('当前来源不允许访问 GM 管理端点');
  }
  next();
}

function bearerToken(req: Request): string | undefined {
  const header = req.header('authorization') ?? '';
  return header.toLowerCase().startsWith('bearer ') ? header.slice(7).trim() : undefined;
}

/** GM 会话校验（不含权限判断），并将 GM 账号挂到 req.gm。 */
export function requireGmSession(req: Request, _res: Response, next: NextFunction): void {
  sweepExpired();
  const token = bearerToken(req);
  if (!token) {
    next(unauthorized('缺少 GM 会话令牌'));
    return;
  }
  const session = sessions.get(token);
  if (!session || session.expiresAt <= Date.now()) {
    sessions.delete(token);
    next(unauthorized('GM 会话无效或已过期'));
    return;
  }
  // 每次请求回查账号：封禁/停用 GM 账号即时生效，不依赖会话快照
  const gm = findGmById(session.gmId);
  if (!gm || gm.status !== 'active') {
    next(unauthorized('GM 账号不可用'));
    return;
  }
  req.gm = gm;
  next();
}

/** 会话 + 权限双重校验；无权时写 denied 审计记录（append-only）并抛 403。 */
export function requireGm(action: GmAction) {
  return (req: Request, res: Response, next: NextFunction): void => {
    requireGmSession(req, res, (error?: unknown) => {
      if (error) {
        next(error);
        return;
      }
      const gm = req.gm as GmAccountRow;
      if (!gmCan(gm, action)) {
        insertGmAuditLog({
          gmId: gm.id,
          action,
          targetType: 'system',
          targetId: gm.username,
          payload: { reason: 'permission_denied' },
          result: 'denied',
          ip: normalizeIp(req.ip),
        });
        next(forbidden(`当前 GM 角色无权执行 ${action} 操作`));
        return;
      }
      next();
    });
  };
}

/** 供测试使用：清空全部会话与锁定状态。 */
export function resetGmSessions(): void {
  sessions.clear();
  loginFailures.clear();
}

/** 在已挂载 requireGmSession 的路由中取当前 GM。 */
export function currentGm(req: Request): GmAccountRow {
  if (!req.gm) throw unauthorized('缺少 GM 会话');
  return req.gm;
}

export { gmCan };
export type { GmAction };
