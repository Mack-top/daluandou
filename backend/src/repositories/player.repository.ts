import { execute, queryAll, queryOne, type SqlValue } from '../db/index.js';
import { conflict, notFound } from '../lib/errors.js';
import { nowIso } from '../lib/clock.js';
import { newId } from '../lib/ids.js';
import {
  CURRENCIES,
  CURRENCY_LABEL,
  RESOURCE_COLUMN,
  type Balances,
  type Currency,
  type DailyStateRow,
  type PlayerRow,
  type ProgressRow,
  type SessionRow,
} from '../domain/types.js';

/** 动态列更新：只更新传入的字段，避免整行覆盖导致并发丢失。 */
export function updateColumns(
  table: string,
  keyColumn: string,
  keyValue: string,
  patch: Record<string, SqlValue | undefined>,
): void {
  const entries = Object.entries(patch).filter((entry): entry is [string, SqlValue] => entry[1] !== undefined);
  if (!entries.length) return;
  const assignments = entries.map(([column]) => `${column} = ?`).join(', ');
  execute(
    `UPDATE ${table} SET ${assignments} WHERE ${keyColumn} = ?`,
    ...entries.map(([, value]) => value),
    keyValue,
  );
}

/* ------------------------------ 账号 ------------------------------ */

export function insertPlayer(input: {
  id: string;
  nickname: string;
  gender: 'male' | 'female';
  server: number;
  createdAt: string;
}): void {
  execute(
    `INSERT INTO players (id, nickname, gender, server, worldtree_level, created_at, updated_at)
     VALUES (?, ?, ?, ?, 1, ?, ?)`,
    input.id,
    input.nickname,
    input.gender,
    input.server,
    input.createdAt,
    input.createdAt,
  );
}

export function findPlayerById(id: string): PlayerRow | undefined {
  return queryOne<PlayerRow>('SELECT * FROM players WHERE id = ?', id);
}

/** v16 按服隔离：昵称按服唯一——查重必须带 server，同一昵称可在不同服各建一号。 */
export function findPlayerByNickname(nickname: string, server: number): PlayerRow | undefined {
  return queryOne<PlayerRow>('SELECT * FROM players WHERE nickname = ? AND server = ?', nickname, server);
}

/** 分服人口实时统计（v16）：选服界面状态的正式数据源。 */
export function countPlayersByServer(maxServer: number): Array<{ server: number; total: number }> {
  return queryAll<{ server: number; total: number }>(
    'SELECT server, COUNT(*) AS total FROM players WHERE server BETWEEN 1 AND ? GROUP BY server',
    maxServer,
  );
}

export function requirePlayer(id: string): PlayerRow {
  const player = findPlayerById(id);
  if (!player) throw notFound('玩家不存在');
  return player;
}

/** GM 玩家检索（v16 按服隔离配套）：支持按服、按昵称/ID 关键字过滤，只读。 */
export function listPlayersForAdmin(filter: { server?: number; keyword?: string; limit?: number }): PlayerRow[] {
  const conditions: string[] = [];
  const params: SqlValue[] = [];
  if (typeof filter.server === 'number') {
    conditions.push('server = ?');
    params.push(filter.server);
  }
  const keyword = filter.keyword?.trim();
  if (keyword) {
    conditions.push('(nickname LIKE ? OR id LIKE ?)');
    const like = `%${keyword}%`;
    params.push(like, like);
  }
  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
  params.push(filter.limit ?? 50);
  return queryAll<PlayerRow>(
    `SELECT * FROM players ${where} ORDER BY created_at DESC LIMIT ?`,
    ...params,
  );
}

export function setWorldtreeLevel(playerId: string, level: number): void {
  execute(
    'UPDATE players SET worldtree_level = ?, updated_at = ? WHERE id = ?',
    level,
    nowIso(),
    playerId,
  );
}

/* ------------------------------ 会话 ------------------------------ */

export function insertSession(input: {
  id: string;
  playerId: string;
  tokenHash: string;
  issuedAt: string;
  expiresAt: string;
}): void {
  execute(
    `INSERT INTO player_sessions (id, player_id, token_hash, issued_at, expires_at)
     VALUES (?, ?, ?, ?, ?)`,
    input.id,
    input.playerId,
    input.tokenHash,
    input.issuedAt,
    input.expiresAt,
  );
}

export function findSessionByTokenHash(tokenHash: string): SessionRow | undefined {
  return queryOne<SessionRow>('SELECT * FROM player_sessions WHERE token_hash = ?', tokenHash);
}

export function revokeSession(sessionId: string): void {
  execute('UPDATE player_sessions SET revoked_at = ? WHERE id = ?', nowIso(), sessionId);
}

/** 吊销玩家的全部有效会话（GM 封禁流程使用）。 */
export function revokeAllSessions(playerId: string): number {
  return execute(
    'UPDATE player_sessions SET revoked_at = ? WHERE player_id = ? AND revoked_at IS NULL',
    nowIso(),
    playerId,
  ).changes;
}

/** 登录时顺手清理已过期的会话，避免表无限膨胀。 */
export function deleteExpiredSessions(referenceIso: string): number {
  const result = execute('DELETE FROM player_sessions WHERE expires_at <= ?', referenceIso);
  return result.changes;
}

/* ------------------------------ 资源 ------------------------------ */

export function insertDefaultResources(playerId: string): void {
  execute(
    `INSERT INTO player_resources (player_id, coins, gems, books, leaves, potions, chests, medals, updated_at)
     VALUES (?, 0, 0, 0, 0, 0, 0, 0, ?)`,
    playerId,
    nowIso(),
  );
}

export function getBalances(playerId: string): Balances {
  const row = queryOne<Record<string, number>>(
    'SELECT coins, gems, books, leaves, potions, chests, medals FROM player_resources WHERE player_id = ?',
    playerId,
  );
  if (!row) throw notFound('玩家资源记录不存在');
  const balances = {} as Balances;
  for (const currency of CURRENCIES) balances[currency] = Number(row[RESOURCE_COLUMN[currency]] ?? 0);
  return balances;
}

/**
 * 资源增减的唯一入口：校验余额 → 更新余额 → 写流水。
 * 必须在 transaction() 内调用，否则余额与流水可能不一致。
 */
export function applyResourceDelta(
  playerId: string,
  deltas: Partial<Record<Currency, number>>,
  reason: string,
  refId: string | null = null,
): Balances {
  const current = getBalances(playerId);
  const next = { ...current };
  const changes: Array<{ currency: Currency; delta: number }> = [];

  for (const currency of CURRENCIES) {
    const delta = deltas[currency] ?? 0;
    if (!delta) continue;
    if (!Number.isInteger(delta)) {
      throw conflict(`资源变更必须为整数：${currency}`);
    }
    const value = current[currency] + delta;
    if (value < 0) {
      throw conflict(`${CURRENCY_LABEL[currency]}不足`, {
        currency,
        required: -delta,
        available: current[currency],
      });
    }
    next[currency] = value;
    changes.push({ currency, delta });
  }

  if (!changes.length) return current;

  execute(
    `UPDATE player_resources
        SET coins = ?, gems = ?, books = ?, leaves = ?, potions = ?, chests = ?, medals = ?, updated_at = ?
      WHERE player_id = ?`,
    next.coin,
    next.gem,
    next.book,
    next.leaf,
    next.potion,
    next.chest,
    next.medal,
    nowIso(),
    playerId,
  );

  const stamp = nowIso();
  for (const change of changes) {
    execute(
      `INSERT INTO resource_ledger (id, player_id, currency, delta, balance_after, reason, ref_id, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      newId(),
      playerId,
      change.currency,
      change.delta,
      next[change.currency],
      reason,
      refId,
      stamp,
    );
  }

  return next;
}

/**
 * 按奖励清单入账，返回统一格式，供服务层复用。
 * v17：kind = 'exp'（掌灶人经验）不进 player_resources/流水，改记 player_progress.exp。
 */
export function grantRewards(
  playerId: string,
  rewards: Array<{ kind: string; amount: number; label: string }>,
  reason: string,
  refId: string | null = null,
): Balances {
  const deltas: Partial<Record<Currency, number>> = {};
  let expDelta = 0;
  for (const reward of rewards) {
    if (reward.kind === 'exp') {
      expDelta += reward.amount;
      continue;
    }
    if (!CURRENCIES.includes(reward.kind as Currency)) continue;
    const currency = reward.kind as Currency;
    deltas[currency] = (deltas[currency] ?? 0) + reward.amount;
  }
  if (expDelta !== 0) {
    const progress = getProgress(playerId);
    updateProgress(playerId, { exp: Math.max(0, progress.exp + expDelta) });
  }
  return applyResourceDelta(playerId, deltas, reason, refId);
}

/* ------------------------------ 进度 ------------------------------ */

export function insertDefaultProgress(playerId: string): void {
  execute('INSERT INTO player_progress (player_id, updated_at) VALUES (?, ?)', playerId, nowIso());
}

export function getProgress(playerId: string): ProgressRow {
  const row = queryOne<ProgressRow>('SELECT * FROM player_progress WHERE player_id = ?', playerId);
  if (!row) throw notFound('玩家进度记录不存在');
  return row;
}

export function updateProgress(
  playerId: string,
  patch: Partial<Omit<ProgressRow, 'player_id'>>,
): void {
  updateColumns('player_progress', 'player_id', playerId, {
    ...patch,
    updated_at: nowIso(),
  });
}

/* ------------------------------ 每日状态 ------------------------------ */

export function ensureDailyState(playerId: string, dayKey: string): DailyStateRow {
  const existing = queryOne<DailyStateRow>(
    'SELECT * FROM player_daily_state WHERE player_id = ? AND day_key = ?',
    playerId,
    dayKey,
  );
  if (existing) return existing;
  execute('INSERT INTO player_daily_state (player_id, day_key) VALUES (?, ?)', playerId, dayKey);
  return {
    player_id: playerId,
    day_key: dayKey,
    daily_paid: 0,
    claimed_tiers_json: '[]',
    summons: 0,
    login_rewards: 0,
  };
}

export function updateDailyState(
  playerId: string,
  dayKey: string,
  patch: Partial<Omit<DailyStateRow, 'player_id' | 'day_key'>>,
): void {
  const assignments = Object.keys(patch);
  if (!assignments.length) return;
  const sets = assignments.map(column => `${column} = ?`).join(', ');
  execute(
    `UPDATE player_daily_state SET ${sets} WHERE player_id = ? AND day_key = ?`,
    ...assignments.map(column => patch[column as keyof typeof patch] as SqlValue),
    playerId,
    dayKey,
  );
}
