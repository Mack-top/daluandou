import { execute, queryAll, queryOne } from '../db/index.js';
import { nowIso } from '../lib/clock.js';
import { newId } from '../lib/ids.js';
import type { LeaderboardDefRow, LeaderboardEntryRow, LeaderboardSnapshotRow } from '../domain/types.js';

/* ------------------------------ 排行榜定义（v12） ------------------------------ */

export function listLeaderboardDefs(): LeaderboardDefRow[] {
  return queryAll<LeaderboardDefRow>('SELECT * FROM leaderboard_defs ORDER BY id');
}

export function findLeaderboardDef(id: string): LeaderboardDefRow | undefined {
  return queryOne<LeaderboardDefRow>('SELECT * FROM leaderboard_defs WHERE id = ?', id);
}

/** 幂等 upsert（seed 可重复执行）。 */
export function insertLeaderboardDef(input: {
  id: string;
  name: string;
  metric: LeaderboardDefRow['metric'];
  period?: LeaderboardDefRow['period'];
  seasonKey?: string | null;
  capacity?: number;
}): void {
  execute(
    `INSERT INTO leaderboard_defs (id, name, metric, period, season_key, capacity, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(id) DO UPDATE SET
       name = excluded.name, metric = excluded.metric, period = excluded.period,
       season_key = excluded.season_key, capacity = excluded.capacity, updated_at = excluded.updated_at`,
    input.id,
    input.name,
    input.metric,
    input.period ?? 'all',
    input.seasonKey ?? null,
    input.capacity ?? 100,
    nowIso(),
  );
}

/* ------------------------------ 榜单条目 ------------------------------ */

/** 覆写玩家在某个榜单的分数（事件来源在事务内调用）。 */
export function upsertLeaderboardEntry(leaderboardId: string, playerId: string, score: number): void {
  execute(
    `INSERT INTO leaderboard_entries (leaderboard_id, player_id, score, updated_at)
     VALUES (?, ?, ?, ?)
     ON CONFLICT(leaderboard_id, player_id) DO UPDATE SET
       score = excluded.score, updated_at = excluded.updated_at`,
    leaderboardId,
    playerId,
    score,
    nowIso(),
  );
}

/**
 * 带名次的榜单视图：RANK() 并列同分同名次（1,1,3），与竞技场通行口径一致。
 * v16 按服隔离：server 有值时只统计该服玩家，名次在服内独立计算（WHERE 先于窗口函数）。
 */
export type LeaderboardRankRow = {
  rank: number;
  player_id: string;
  nickname: string | null;
  score: number;
  updated_at: string;
};

export function listLeaderboardWithRanks(leaderboardId: string, limit: number, server?: number): LeaderboardRankRow[] {
  const serverFilter = typeof server === 'number' ? 'AND p.server = ?' : '';
  const rows = queryAll<LeaderboardRankRow>(
    `SELECT RANK() OVER (ORDER BY e.score DESC) AS rank,
            e.player_id, p.nickname, e.score, e.updated_at
       FROM leaderboard_entries e
       LEFT JOIN players p ON p.id = e.player_id
      WHERE e.leaderboard_id = ? ${serverFilter}
      ORDER BY e.score DESC, e.updated_at
      LIMIT ?`,
    ...(typeof server === 'number' ? [leaderboardId, server, limit] : [leaderboardId, limit]),
  );
  return rows.map(row => ({ ...row, rank: Number(row.rank) }));
}

/** v16 按服隔离：名次固定按玩家所在服独立计算（0 = 未上榜）。 */
export function getLeaderboardRank(leaderboardId: string, playerId: string): number {
  const row = queryOne<{ rank: number }>(
    `SELECT rank FROM (
       SELECT e.player_id, RANK() OVER (ORDER BY e.score DESC) AS rank
         FROM leaderboard_entries e
         JOIN players p ON p.id = e.player_id
        WHERE e.leaderboard_id = ?
          AND p.server = (SELECT server FROM players WHERE id = ?)
     ) WHERE player_id = ?`,
    leaderboardId,
    playerId,
    playerId,
  );
  return row ? Number(row.rank) : 0;
}

/* ------------------------------ 赛季快照（append-only） ------------------------------ */

export function insertLeaderboardSnapshot(input: {
  leaderboardId: string;
  seasonKey: string;
  playerId: string;
  rank: number;
  score: number;
}): string {
  const id = newId();
  execute(
    `INSERT INTO leaderboard_snapshots (id, leaderboard_id, season_key, player_id, rank, score, rewarded, snapshot_at)
     VALUES (?, ?, ?, ?, ?, ?, 0, ?)`,
    id,
    input.leaderboardId,
    input.seasonKey,
    input.playerId,
    input.rank,
    input.score,
    nowIso(),
  );
  return id;
}

/** 未发奖的快照行：断点续发（ rewarded = 0）按名次升序取出。 */
export function listUnrewardedSnapshots(leaderboardId: string, seasonKey: string): LeaderboardSnapshotRow[] {
  return queryAll<LeaderboardSnapshotRow>(
    `SELECT * FROM leaderboard_snapshots
      WHERE leaderboard_id = ? AND season_key = ? AND rewarded = 0
      ORDER BY rank`,
    leaderboardId,
    seasonKey,
  );
}

export function markSnapshotRewarded(id: string): void {
  execute('UPDATE leaderboard_snapshots SET rewarded = 1 WHERE id = ?', id);
}

export function listSnapshots(leaderboardId: string, seasonKey: string): LeaderboardSnapshotRow[] {
  return queryAll<LeaderboardSnapshotRow>(
    `SELECT * FROM leaderboard_snapshots
      WHERE leaderboard_id = ? AND season_key = ?
      ORDER BY rank`,
    leaderboardId,
    seasonKey,
  );
}

export type { LeaderboardEntryRow };
