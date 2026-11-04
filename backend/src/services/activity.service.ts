import { transaction } from '../db/index.js';
import { nowIso } from '../lib/clock.js';
import { conflict, notFound } from '../lib/errors.js';
import { activityRewardScale } from '../domain/power.js';
import {
  parseJsonArray,
  parseJsonObject,
  type ActivityDefRow,
  type PlayerActivityProgressRow,
  type Reward,
} from '../domain/types.js';
import { advanceActivityProgress, findActivityDef, listActiveActivities, listActivityProgress, saveClaimedTiers } from '../repositories/activity.repository.js';
import { requirePlayer } from '../repositories/player.repository.js';
import { insertOpLog } from '../repositories/log.repository.js';
import { applyRewards } from './item.service.js';

/* ------------------------------ 活动视图 ------------------------------ */

export type ActivityTier = { key: string; need: number; rewards: Reward[] };

export type ActivityView = {
  id: string;
  name: string;
  type: ActivityDefRow['type'];
  startAt: string;
  endAt: string;
  tiers: ActivityTier[];
  progress: number;
  claimed: string[];
  claimable: string[];
};

function tiersOf(activity: ActivityDefRow): ActivityTier[] {
  const config = parseJsonObject<{ tiers?: Array<{ key: string; need: number; rewards: Reward[] }> }>(activity.config_json);
  return config?.tiers ?? [];
}

/**
 * §9 等级缩放口径：仅养成资源（金币/食灵精华/经验）随掌灶人等级放大，
 * 灵晶/契约/物品等稀缺或整件资源保持原值（§10 反通胀：灵晶不可 farm）。
 * 视图与领取共用同一缩放，保证展示数量 = 入账数量。
 */
const SCALABLE_KINDS = new Set(['coin', 'leaf', 'exp']);

function scaleRewards(rewards: Reward[], level: number): Reward[] {
  const scale = activityRewardScale(level);
  if (scale === 1) return rewards;
  return rewards.map(reward => (
    SCALABLE_KINDS.has(reward.kind)
      ? { ...reward, amount: Math.round(reward.amount * scale) }
      : reward
  ));
}

/** 玩家活动列表：仅返回时间窗内进行中的活动 + 各自进度与可领档位（奖励按 §9 等级缩放）。 */
export function listPlayerActivities(playerId: string): ActivityView[] {
  const now = nowIso();
  const level = requirePlayer(playerId).worldtree_level;
  const progressMap = new Map(listActivityProgress(playerId).map(row => [row.activity_id, row]));

  return listActiveActivities(now).map(activity => {
    const progress: PlayerActivityProgressRow = progressMap.get(activity.id) ?? {
      player_id: playerId,
      activity_id: activity.id,
      progress: 0,
      claimed_json: '[]',
      updated_at: now,
    };
    const claimed = parseJsonArray<string>(progress.claimed_json);
    const tiers = tiersOf(activity).map(tier => ({ ...tier, rewards: scaleRewards(tier.rewards, level) }));
    return {
      id: activity.id,
      name: activity.name,
      type: activity.type,
      startAt: activity.start_at,
      endAt: activity.end_at,
      tiers,
      progress: Number(progress.progress),
      claimed,
      claimable: tiers
        .filter(tier => !claimed.includes(tier.key) && progress.progress >= tier.need)
        .map(tier => tier.key),
    };
  });
}

/* ------------------------------ 领取档位奖励 ------------------------------ */

/**
 * 领取活动档位奖励：时间窗、档位存在性、进度达标、未重复领取全部服务端校验。
 * 领取走 applyRewards（货币过 applyResourceDelta 流水 + 物品过 grantItem）。
 */
export function claimActivityTier(
  playerId: string,
  activityId: string,
  tierKey: string,
  ip = '',
): { rewards: Reward[] } {
  return transaction(() => {
    const activity = findActivityDef(activityId);
    if (!activity) throw notFound('活动不存在');
    const now = nowIso();
    if (now < activity.start_at || now >= activity.end_at) {
      throw conflict('活动不在进行时间内');
    }

    const tier = tiersOf(activity).find(item => item.key === tierKey);
    if (!tier) throw notFound('活动档位不存在');

    const progress = advanceActivityProgress(playerId, activityId, 0);
    const claimed = parseJsonArray<string>(progress.claimed_json);
    if (claimed.includes(tierKey)) throw conflict('该档位奖励已领取');
    if (Number(progress.progress) < tier.need) {
      throw conflict('活动档位尚未达成', { progress: Number(progress.progress), need: tier.need });
    }

    const level = requirePlayer(playerId).worldtree_level;
    const rewards = scaleRewards(tier.rewards, level);
    applyRewards(playerId, rewards, 'activity.claim', activityId);
    saveClaimedTiers(playerId, activityId, JSON.stringify([...claimed, tierKey]));
    insertOpLog({
      playerId,
      action: 'activity_claim',
      detail: { activityId, tierKey, rewardScale: activityRewardScale(level) },
      ip,
    });

    return { rewards };
  });
}

/**
 * 事件推进入口：战斗/召唤/充值等事件调用（可在既有事务内使用，推进本身是单条
 * upsert，天然原子；如需与其它写操作同生共死，请在外层包 transaction）。
 */
export function advanceActivities(playerId: string, activityId: string, delta: number): void {
  const activity = findActivityDef(activityId);
  if (!activity) throw notFound('活动不存在');
  advanceActivityProgress(playerId, activityId, delta);
}
