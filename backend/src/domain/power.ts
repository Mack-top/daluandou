import type { Balances, Currency, EquipmentDefRow } from './types.js';

/* =============================================================================
 * 数值公式（服务端权威口径）
 * 与前端 frontend/src/game-data.ts 对齐；后端是唯一可信来源，
 * 客户端只负责展示，因此公式集中在此处，避免服务层各写一份。
 * ============================================================================= */

export const STAR_POWER_STEP = 0.28;
export const ASCENSION_MAX_STAR = 5;
/** 世界树（=掌灶人等级）上限：v17 为 100，v19 §2.5 无墙延伸至 150。players.worldtree_level CHECK 与 seed 经验表主键域同为 1..150。 */
export const WORLD_TREE_MAX = 150;
/** 存量成长曲线锚：1→100 级线性铺满 2.6x（v17 曲线零漂移），100+ 级封顶续用（§2.5）。 */
export const GROWTH_ANCHOR_LEVEL = 100;

/**
 * v17 §6 职业成长权重（与前端 game-data.ts CLASS_GROWTH_WEIGHTS 逐字一致）：
 * 成长增量（growth-1 部分）按职业相对权重分化——治疗血厚、法术高攻脆皮、输出极限攻、
 * 辅助先手高速、防御坚壁。等级 1（growth=1）时权重不生效，存量属性零变化。
 * defense 权重暂无承载面（面板 defense 无基础值，装备全额摊入），保留字段供未来引入基础防御。
 */
export const CLASS_GROWTH_WEIGHTS: Record<string, { health: number; attack: number; defense: number; speed: number }> = {
  治疗: { health: 1.10, attack: 0.85, defense: 1.00, speed: 1.00 },
  法术: { health: 0.90, attack: 1.15, defense: 0.85, speed: 1.00 },
  输出: { health: 0.95, attack: 1.20, defense: 0.90, speed: 1.05 },
  辅助: { health: 0.95, attack: 0.90, defense: 0.95, speed: 1.15 },
  防御: { health: 1.20, attack: 0.85, defense: 1.25, speed: 0.85 },
};

const DEFAULT_GROWTH_WEIGHTS = { health: 1, attack: 1, defense: 1, speed: 1 };

/** 职业成长权重取值：未知职业回退全 1（与旧行为一致）。 */
export function growthWeightsOf(role: string | null | undefined): { health: number; attack: number; defense: number; speed: number } {
  return (role && CLASS_GROWTH_WEIGHTS[role]) || DEFAULT_GROWTH_WEIGHTS;
}

/** 成长增量按职业权重缩放：basePart × (1 + (growth-1)×weight)。growth=1 时恒等于 basePart。 */
export function growthScaled(basePart: number, growth: number, weight: number): number {
  return basePart * (1 + (growth - 1) * weight);
}

/** 食灵战力：基础战力 × 星级系数 × 星象加成 × 掌灶人成长系数（v17 §2.3，growth 接口缺省 1 = 旧行为） */
export function characterPower(basePower: number, star: number, astrologyCount: number, growth = 1): number {
  return Math.round(basePower * (1 + (star - 1) * STAR_POWER_STEP) * (1 + astrologyCount * 0.02) * growth);
}

/**
 * 掌灶人整体成长系数（v17 数值核心 v2，设计 §2.3；v19 §2.5 封顶）：
 * 万分比曲线 10000 + 16000×(L-1)/99（1 级 1.0x → 100 级 2.6x），
 * 分母钉死 99（GROWTH_ANCHOR_LEVEL-1）而非 WORLD_TREE_MAX-1——等级域延伸到 150 时
 * 1–100 级曲线零漂移，100+ 级 growth 封顶 2.6（战力上限受控，设计 §2.5「无墙延伸」语义）。
 * 与 seed level_stats_defs（growth_bp 列）同一公式；battle/前端 characterBattleStats 同乘。
 */
export function growthBp(level: number): number {
  const capped = Math.min(level - 1, GROWTH_ANCHOR_LEVEL - 1);
  return 10_000 + Math.round(16_000 * capped / (GROWTH_ANCHOR_LEVEL - 1));
}

/** growth_bp → 乘数（1.0–2.6），供 characterPower / buildSquad 直接使用 */
export function growthMultiplier(level: number): number {
  return growthBp(level) / 10_000;
}

/** 升星消耗：随星级线性增长 */
export function ascendCost(star: number): { potions: number; leaves: number } {
  return { potions: 40_000 * star, leaves: 30 * star };
}

/** 研制坊炼制消耗 */
export function craftCost(times: number): { coins: number; leaves: number } {
  return { coins: 22_000 * times, leaves: 24 * times };
}

/** 炼制产出（累计炼制 5 次后效率 +10%） */
export function craftYield(times: number, craftedTotal: number): number {
  return Math.round(90_000 * times * (craftedTotal >= 5 ? 1.1 : 1));
}

/**
 * 世界树升级消耗（v17 数值核心 v2，设计 §3.1）：
 * 旧公式 120000×1.5^L 在 L29→30 达 102 亿金币（332 天产出）形成硬墙；
 * 新公式多项式 28000×L^1.55，回本天数 0.5→2.0 单调缓升，全程无墙。
 * 注意：升级实际消耗 = 本表 leaves + coins×0.2 + exp_required(L)（见 §2.3 升级接线）。
 */
export function worldtreeCost(level: number): { coins: number; leaves: number } {
  return {
    coins: Math.round(28_000 * Math.pow(level, 1.55)),
    leaves: Math.round(15 * Math.pow(level, 1.55)),
  };
}

/** 世界树产出加成（离线收益用） */
export function worldtreeBonus(level: number, astrologyCount: number): number {
  return 1 + (level - 1) * 0.05 + astrologyCount * 0.02;
}

/**
 * 离线收益（v17 数值核心 v2，设计 §3.2）：
 * 金币/小时 = 15000×(1+0.22×(树-1))，灵味原浆/小时 = 4200×(1+0.12×(树-1))，经验/小时 = 1800×树。
 * 产出阶数（线性）< 世界树消耗阶数（1.55），长期略有盈余压力 → 引导战斗/任务补充。
 * 经验与金币同源同闸门（离线上限 8/12 小时共用）。
 */
export function idleAccrual(input: {
  worldtreeLevel: number;
  astrologyCount: number;
  sinceIso: string | null;
  now?: Date;
}): { capHours: number; hours: number; coins: number; potions: number; exp: number } {
  const capHours = input.worldtreeLevel >= 2 ? 12 : 8;
  const now = input.now ?? new Date();
  const startMs = input.sinceIso ? Date.parse(input.sinceIso) : Number.NaN;
  const hours = Number.isFinite(startMs)
    ? Math.min(capHours, Math.max(0, (now.getTime() - startMs) / 3_600_000))
    : 0;
  const bonus = worldtreeBonus(input.worldtreeLevel, input.astrologyCount);
  const coinRate = 15_000 * (1 + 0.22 * (input.worldtreeLevel - 1));
  const potionRate = 4_200 * (1 + 0.12 * (input.worldtreeLevel - 1));
  return {
    capHours,
    hours,
    coins: Math.floor(coinRate * hours * bonus),
    potions: Math.floor(potionRate * hours * bonus),
    exp: Math.floor(1_800 * input.worldtreeLevel * hours * bonus),
  };
}

/**
 * 战斗胜利经验（v17 数值核心 v2，设计 §2.2/§3.4）：
 * exp = round(关卡锚 / 90)，首通 ×3；
 * 等级差保护：队伍战力 ≥ 关卡锚 × 1.5 视为碾压刷取，收益减半（防低级图刷级）。
 */
export function battleExpGain(anchorPower: number, firstClear: boolean, squadPower: number): number {
  let exp = Math.round(anchorPower / 90) * (firstClear ? 3 : 1);
  if (squadPower >= anchorPower * 1.5) exp = Math.floor(exp / 2);
  return exp;
}

/**
 * 活动/战令奖励等级缩放（v17 数值核心 v2，设计 §9）：
 * scale = 1 + 0.03 × max(0, 掌灶人等级 − 30)，上限 2.1（§9 锚点「100 级时 ×2.1」）。
 * 公式裸算在 100 级应为 3.1，但文档锚点明确 ×2.1，故取 2.1 为封顶：
 * 67 级起持平 2.1，等级域延伸到 150（§2.5）后也不会失控（150 级裸算 4.6）。
 * 仅对养成资源（金币/食灵精华/经验）生效；灵晶/契约/物品等稀缺或整件资源
 * 不缩放（§10 反通胀：灵晶不可 farm）。
 */
export const ACTIVITY_REWARD_SCALE_CAP = 2.1;

export function activityRewardScale(level: number): number {
  return Math.min(1 + 0.03 * Math.max(0, level - 30), ACTIVITY_REWARD_SCALE_CAP);
}

export type EquipmentStats = Pick<EquipmentDefRow, 'health' | 'attack' | 'defense' | 'speed' | 'critical' | 'resistance'>;

export const EMPTY_STATS: EquipmentStats = { health: 0, attack: 0, defense: 0, speed: 0, critical: 0, resistance: 0 };

/**
 * v20 §4.3 副属性洗练：每件装备至多 1 条，池 = 暴击/抗暴/速度/生命（设计文档原文的「命中」
 * 并入暴击口径——战斗引擎无命中/闪避机制）。value ∈ 2..6 重随；生命按 ×100 计入面板
 * （2–6% 语义映射到绝对值 200–600）；副属性为固定加成，不随强化 ×(1+level×0.12) 放大。
 */
export type SubstatKey = 'critical' | 'resistance' | 'speed' | 'health';
export type EquipmentSubstat = { key: SubstatKey; value: number };

export function substatDelta(substat: EquipmentSubstat): number {
  return substat.key === 'health' ? substat.value * 100 : substat.value;
}

export function sumEquipmentStats(list: Array<EquipmentStats & { level: number; substat?: EquipmentSubstat | null }>): EquipmentStats {
  const total: EquipmentStats = { ...EMPTY_STATS };
  for (const item of list) {
    // v17 §4.2：强化加成 0.15 → 0.12（+12 → ×2.44），与前端 equipment.ts equipmentStats 一致
    const scale = 1 + item.level * 0.12;
    total.health += Math.round(item.health * scale);
    total.attack += Math.round(item.attack * scale);
    total.defense += Math.round(item.defense * scale);
    total.speed += Math.round(item.speed * scale);
    total.critical += Math.round(item.critical * scale);
    total.resistance += Math.round(item.resistance * scale);
    if (item.substat) {
      total[item.substat.key] += substatDelta(item.substat);
    }
  }
  return total;
}

/**
 * 装备战力权重：与前端 frontend/src/equipment.ts statsPower 完全一致
 * （血量 0.25 / 攻击 6 / 防御 3 / 速度 20 / 暴击+抗暴各 35）。
 */
export function equipmentPower(stats: EquipmentStats): number {
  return Math.round(
    stats.health * 0.25 + stats.attack * 6 + stats.defense * 3 + stats.speed * 20 + (stats.critical + stats.resistance) * 35,
  );
}

/** 把奖励拆成资源增量，供 grantRewards 使用 */
export function rewardsToDeltas(rewards: Array<{ kind: string; amount: number }>): Partial<Record<Currency, number>> {
  const deltas: Partial<Record<Currency, number>> = {};
  const allowed: Currency[] = ['coin', 'gem', 'book', 'leaf', 'potion', 'chest', 'medal'];
  for (const reward of rewards) {
    if (!allowed.includes(reward.kind as Currency)) continue;
    const currency = reward.kind as Currency;
    deltas[currency] = (deltas[currency] ?? 0) + reward.amount;
  }
  return deltas;
}

export type { Balances };
