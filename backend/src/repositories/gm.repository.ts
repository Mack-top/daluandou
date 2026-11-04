import { execute, queryAll, queryOne } from '../db/index.js';
import { nowIso } from '../lib/clock.js';
import { newId } from '../lib/ids.js';
import type { GmAccountRow, GmAuditLogRow, GmPlayerBanRow } from '../domain/types.js';

/* ------------------------------ GM 账号（v11） ------------------------------ */

export function findGmByUsername(username: string): GmAccountRow | undefined {
  return queryOne<GmAccountRow>('SELECT * FROM gm_accounts WHERE username = ?', username);
}

export function findGmById(id: string): GmAccountRow | undefined {
  return queryOne<GmAccountRow>('SELECT * FROM gm_accounts WHERE id = ?', id);
}

export function insertGmAccount(input: {
  id?: string;
  username: string;
  passwordHash: string;
  role: GmAccountRow['role'];
}): string {
  const id = input.id ?? newId();
  execute(
    `INSERT INTO gm_accounts (id, username, password_hash, role, status, created_at)
     VALUES (?, ?, ?, ?, 'active', ?)`,
    id,
    input.username,
    input.passwordHash,
    input.role,
    nowIso(),
  );
  return id;
}

export function touchGmLogin(gmId: string): void {
  execute('UPDATE gm_accounts SET last_login_at = ? WHERE id = ?', nowIso(), gmId);
}

/* ------------------------------ 审计日志（append-only） ------------------------------ */

export function insertGmAuditLog(input: {
  gmId: string;
  action: GmAuditLogRow['action'];
  targetType: GmAuditLogRow['target_type'];
  targetId?: string | null;
  payload?: unknown;
  result?: GmAuditLogRow['result'];
  ip?: string;
}): void {
  execute(
    `INSERT INTO gm_audit_logs (id, gm_id, action, target_type, target_id, payload_json, result, ip, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    newId(),
    input.gmId,
    input.action,
    input.targetType,
    input.targetId ?? null,
    JSON.stringify(input.payload ?? {}),
    input.result ?? 'ok',
    input.ip ?? '',
    nowIso(),
  );
}

export function listGmAuditLogs(filter: { gmId?: string; action?: string; limit?: number } = {}): GmAuditLogRow[] {
  const conditions: string[] = [];
  const params: Array<string | number> = [];
  if (filter.gmId) {
    conditions.push('gm_id = ?');
    params.push(filter.gmId);
  }
  if (filter.action) {
    conditions.push('action = ?');
    params.push(filter.action);
  }
  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
  const limit = Math.min(Math.max(filter.limit ?? 100, 1), 500);
  return queryAll<GmAuditLogRow>(
    `SELECT * FROM gm_audit_logs ${where} ORDER BY created_at DESC LIMIT ${limit}`,
    ...params,
  );
}

/* ------------------------------ 封禁（v11） ------------------------------ */

export function insertPlayerBan(input: {
  playerId: string;
  reason: string;
  bannedBy: string;
  expiresAt: string | null;
}): string {
  const id = newId();
  execute(
    `INSERT INTO gm_player_bans (id, player_id, reason, banned_by, banned_at, expires_at, lifted_at, active)
     VALUES (?, ?, ?, ?, ?, ?, NULL, 1)`,
    id,
    input.playerId,
    input.reason,
    input.bannedBy,
    nowIso(),
    input.expiresAt,
  );
  return id;
}

/** 当前生效的封禁：active = 1 且未过期（expires_at NULL = 永久）。 */
export function findActiveBan(playerId: string, nowIsoValue: string): GmPlayerBanRow | undefined {
  return queryOne<GmPlayerBanRow>(
    `SELECT * FROM gm_player_bans
      WHERE player_id = ? AND active = 1 AND (expires_at IS NULL OR expires_at > ?)
      ORDER BY banned_at DESC LIMIT 1`,
    playerId,
    nowIsoValue,
  );
}

/** 解封：把该玩家全部生效记录置为 inactive + lifted_at，历史记录保留（审计友好）。 */
export function liftPlayerBans(playerId: string): number {
  return execute(
    'UPDATE gm_player_bans SET active = 0, lifted_at = ? WHERE player_id = ? AND active = 1',
    nowIso(),
    playerId,
  ).changes;
}
