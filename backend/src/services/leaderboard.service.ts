import { transaction } from '../db/index.js';
import { conflict, notFound } from '../lib/errors.js';
import type { LeaderboardDefRow, Reward } from '../domain/types.js';
import {
  findLeaderboardDef,
  getLeaderboardRank,
  insertLeaderboardSnapshot,
  listLeaderboardDefs,
  listLeaderboardWithRanks,
  listSnapshots,
  listUnrewardedSnapshots,
  markSnapshotRewarded,
  upsertLeaderboardEntry,
  type LeaderboardRankRow,
} from '../repositories/leaderboard.repository.js';
import { requirePlayer } from '../repositories/player.repository.js';
import { insertSystemMail } from '../repositories/system-mail.repository.js';

/* ------------------------------ 榜单查询（v12；v16 起支持按服过滤） ------------------------------ */

/** v16 按服隔离：server 有值时榜单只展示该服玩家；缺省返回全服聚合视图（向后兼容）。 */
export function listLeaderboards(server?: number): Array<LeaderboardDefRow & { entries: LeaderboardRankRow[]; server?: number }> {
  return listLeaderboardDefs().map(def => ({
    ...def,
    ...(typeof server === 'number' ? { server } : {}),
    entries: listLeaderboardWithRanks(def.id, def.capacity, server),
  }));
}

export function getLeaderboardView(leaderboardId: string, limit?: number, server?: number) {
  const def = findLeaderboardDef(leaderboardId);
  if (!def) throw notFound('排行榜不存在');
  return {
    def,
    ...(typeof server === 'number' ? { server } : {}),
    entries: listLeaderboardWithRanks(leaderboardId, limit ?? def.capacity, server),
  };
}

/* ------------------------------ 分数更新 ------------------------------ */

/**
 * 覆写玩家在榜单上的分数（绝对值语义：battle_wins 榜传累计胜场，power 榜传当前战力）。
 * 事件来源（战斗结算/战力变化）在各自事务内调用；榜单不存在抛 404，由调用方决定是否吞掉。
 */
export function updateLeaderboardScore(leaderboardId: string, playerId: string, score: number): void {
  if (!Number.isInteger(score) || score < 0) throw conflict('榜单分数必须为非负整数');
  requirePlayer(playerId);
  if (!findLeaderboardDef(leaderboardId)) throw notFound('排行榜不存在');
  upsertLeaderboardEntry(leaderboardId, playerId, score);
}

/* ------------------------------ 赛季结算 ------------------------------ */

/**
 * 结算快照：把当前榜单按名次写入 leaderboard_snapshots（append-only，rewarded = 0）。
 * 同一榜单同一赛季重复结算直接拒绝，防止覆盖已发奖快照。
 */
export function snapshotLeaderboard(leaderboardId: string, seasonKey: string): { snapshotted: number } {
  return transaction(() => {
    const def = findLeaderboardDef(leaderboardId);
    if (!def) throw notFound('排行榜不存在');
    if (listSnapshots(leaderboardId, seasonKey).length > 0) {
      throw conflict('该赛季已有结算快照，禁止重复结算');
    }
    const entries = listLeaderboardWithRanks(leaderboardId, def.capacity);
    for (const entry of entries) {
      insertLeaderboardSnapshot({
        leaderboardId,
        seasonKey,
        playerId: entry.player_id,
        rank: Number(entry.rank),
        score: entry.score,
      });
    }
    return { snapshotted: entries.length };
  });
}

/**
 * 赛季发奖（断点续发）：按快照名次给未发奖玩家发系统邮件，逐行标记 rewarded。
 * 奖励从 def.reward_json 不存在——奖励配置由调用方传入（运营按赛季配置）。
 * 单行失败（玩家已删号等）跳过该行继续，下次调用续发。
 */
export function distributeSeasonRewards(
  leaderboardId: string,
  seasonKey: string,
  rewardsByRank: Array<{ upTo: number; rewards: Reward[] }>,
): { distributed: number } {
  let distributed = 0;
  const pending = listUnrewardedSnapshots(leaderboardId, seasonKey);
  for (const snapshot of pending) {
    const tier = rewardsByRank.find(rule => snapshot.rank <= rule.upTo);
    if (!tier) continue;
    try {
      transaction(() => {
        const rewards = tier.rewards;
        insertSystemMail({
          playerId: snapshot.player_id,
          title: '赛季结算奖励',
          body: `你在 ${seasonKey} 赛季中获得第 ${snapshot.rank} 名`,
          attachments: rewards,
          source: 'system',
        });
        markSnapshotRewarded(snapshot.id);
      });
      distributed += 1;
    } catch {
      // 单行失败不阻断续发；rewarded 仍为 0，下次调用重试
    }
  }
  return { distributed };
}

/** 玩家在指定榜单的名次（0 = 未上榜）。v16 起名次按玩家所在服独立计算。 */
export function getPlayerRank(leaderboardId: string, playerId: string): number {
  if (!findLeaderboardDef(leaderboardId)) throw notFound('排行榜不存在');
  return getLeaderboardRank(leaderboardId, playerId);
}

export function currentSeasonKey(date: Date = new Date()): string {
  const year = date.getUTCFullYear();
  const week = Math.ceil((Math.floor((date.getTime() - Date.UTC(year, 0, 1)) / 86_400_000) + 1) / 7);
  return `${year}W${String(week).padStart(2, '0')}`;
}
