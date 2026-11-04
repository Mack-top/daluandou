/**
 * 每日挑战次数：常量与纯计算（domain 层，供 battle.service 与 state.service 共用，
 * 避免 state → battle.service 的循环依赖）。
 *
 * 数值定案：
 * - 每日免费 4 次（3-5 区间取中偏下：免费过多会稀释挑战卡价值，过少伤害日常体验）；
 * - 挑战卡 15 灵晶/张，每日最多购 6 张（免费 4 + 购买 6 = 总上限 10）；
 * - 达总上限后当天不能再挑战；跨日随 dayKey 自然重置（battle_passes 按日建行，零清零操作）。
 */
export const FREE_BATTLES_PER_DAY = 4;
export const MAX_BATTLES_PER_DAY = 10;
export const MAX_PASSES_PER_DAY = MAX_BATTLES_PER_DAY - FREE_BATTLES_PER_DAY;
export const BATTLE_PASS_COST_GEMS = 15;

export type BattleChargeRow = { player_id: string; day_key: string; used: number; purchased: number };

export type BattleCharges = {
  dayKey: string;
  used: number;
  purchased: number;
  freeLimit: number;
  totalLimit: number;
  remaining: number;
  canBuy: boolean;
};

/** 由当日计数行推导挑战次数视图。 */
export function computeBattleCharges(row: BattleChargeRow): BattleCharges {
  const allowed = FREE_BATTLES_PER_DAY + row.purchased;
  return {
    dayKey: row.day_key,
    used: row.used,
    purchased: row.purchased,
    freeLimit: FREE_BATTLES_PER_DAY,
    totalLimit: MAX_BATTLES_PER_DAY,
    remaining: Math.max(0, allowed - row.used),
    canBuy: row.used >= FREE_BATTLES_PER_DAY && row.purchased < MAX_PASSES_PER_DAY && row.used < MAX_BATTLES_PER_DAY,
  };
}
