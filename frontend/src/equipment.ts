import type { GameSave } from './game-data';

export const equipmentSlots = [
  { id: 'weapon', name: '武器', english: 'WEAPON' },
  { id: 'crown', name: '头饰', english: 'CROWN' },
  { id: 'armor', name: '衣甲', english: 'ARMOR' },
  { id: 'charm', name: '饰品', english: 'CHARM' },
  { id: 'relic', name: '秘宝', english: 'RELIC' },
  { id: 'crest', name: '徽记', english: 'CREST' },
] as const;
export type EquipmentSlot = typeof equipmentSlots[number]['id'];
export type EquipmentRarity = 'rare' | 'epic' | 'legendary';
export type EquipmentStats = { health: number; attack: number; defense: number; speed: number; critical: number; resistance: number };
export type EquipmentDefinition = { id: string; name: string; slot: EquipmentSlot; rarity: EquipmentRarity; story: string; stats: EquipmentStats; tier?: number; requiredLevel?: number };
/** v20 §4.3 副属性：每件至多 1 条（value 2..6，生命 ×100 计入），未洗练为 null。 */
export type SubstatKey = 'critical' | 'resistance' | 'speed' | 'health';
export type EquipmentInstance = {
  id: string; templateId: string; level: number; acquiredAt: string;
  substat?: { key: SubstatKey; value: number } | null;
  washCount?: number;
};
export type ChestReceipt = { id: string; equipmentIds: string[]; openedAt: string; count: number };
export type EquipmentState = Pick<GameSave, 'equipment' | 'equipped'>;

export const MAX_EQUIPMENT = 120;
/** v17 数值核心 v2（设计 §4.2）：强化上限 5 → 12，后期每级成本构主要金币消耗口。 */
export const MAX_ENHANCEMENT = 12;
export const STARTER_CHESTS = 6;
export const rarities = {
  rare: { label: '稀有', english: 'RARE', rank: 1 },
  epic: { label: '史诗', english: 'EPIC', rank: 2 },
  legendary: { label: '传说', english: 'LEGENDARY', rank: 3 },
} as const;
export const statLabels: Record<keyof EquipmentStats, string> = { health: '生命', attack: '攻击', defense: '防御', speed: '速度', critical: '暴击', resistance: '抗暴' };
export const emptyEquipmentStats = (): EquipmentStats => ({ health: 0, attack: 0, defense: 0, speed: 0, critical: 0, resistance: 0 });

/**
 * v17 装备 6 阶（与后端 seed EQUIPMENT_TIERS/EQUIPMENT_COLLECTIONS 逐字一致，设计 §4.1）：
 * 阶位系数 ×1.85 递进，穿戴等级 1/10/25/40/60/80；id 规则 1–3 阶 `${slot}-${rarity}`（存量兼容）、
 * 4–6 阶 `${slot}-t${tier}-${rarity}`。6 槽 × 6 阶 × 3 稀有度 = 108 件。
 */
export const equipmentTiers = [
  { tier: 1, requiredLevel: 1, label: '青芽' },
  { tier: 2, requiredLevel: 10, label: '月华' },
  { tier: 3, requiredLevel: 25, label: '星辉' },
  { tier: 4, requiredLevel: 40, label: '鼎辉' },
  { tier: 5, requiredLevel: 60, label: '忘川' },
  { tier: 6, requiredLevel: 80, label: '天鼎' },
] as const;

const collections = {
  weapon: { names: ['青芽短刃', '月华长刃', '星辉誓剑', '鼎辉战刃', '忘川霜刃', '天鼎圣剑'], story: '刀锋不只切开迷雾，也为同行者开辟归途。', stats: { attack: 65, critical: 1 } },
  crown: { names: ['茶庭发冠', '月桂之冠', '晨星王冠', '鼎辉冕冠', '忘川星冠', '天鼎神冠'], story: '把晨露与一缕月光，编入旅者的发间。', stats: { health: 130, defense: 22 } },
  armor: { names: ['青叶轻甲', '银月礼衣', '星织守护', '鼎辉重铠', '忘川月衣', '天鼎圣铠'], story: '细密的纹路之间，藏着一份不曾言说的守护。', stats: { health: 300, defense: 30 } },
  charm: { names: ['玉露吊坠', '月影指环', '永昼之约', '鼎辉坠饰', '忘川泪珠', '天鼎符印'], story: '愿远方的灯火，永远为你留一盏。', stats: { speed: 3, critical: 1 } },
  relic: { names: ['清泉茶盏', '浮月灵灯', '流光星仪', '鼎辉香炉', '忘川魂灯', '天鼎宝鼎'], story: '一件古老的灵器，记得每一次相遇的温度。', stats: { attack: 32, health: 120 } },
  crest: { names: ['新叶徽记', '银月勋章', '星穹纹章', '鼎辉战徽', '忘川纹章', '天鼎龙章'], story: '将并肩走过的旅程，刻成胸前不灭的微光。', stats: { defense: 25, resistance: 1 } },
};

/** 桥接 id 规则（与后端 seed/roster 一致）：rare@t1 / epic@t2 / legendary@t3 沿用旧 id，其余带阶位段。 */
const equipmentTemplateId = (slot: string, rarity: EquipmentRarity, tier: number): string => {
  const bridged = (rarity === 'rare' && tier === 1) || (rarity === 'epic' && tier === 2) || (rarity === 'legendary' && tier === 3);
  return bridged ? `${slot}-${rarity}` : `${slot}-t${tier}-${rarity}`;
};

export const equipmentCatalogue: EquipmentDefinition[] = equipmentSlots.flatMap(slot => {
  const collection = collections[slot.id];
  return equipmentTiers.flatMap(tier =>
    (['rare', 'epic', 'legendary'] as const).map(rarity => {
      const multiplier = Math.pow(1.85, tier.tier - 1) * [1, 1.7, 2.6][rarities[rarity].rank - 1];
      const stats = emptyEquipmentStats();
      for (const [key, value] of Object.entries(collection.stats)) stats[key as keyof EquipmentStats] = Math.round(value * multiplier);
      return {
        id: equipmentTemplateId(slot.id, rarity, tier.tier),
        slot: slot.id, rarity, name: collection.names[tier.tier - 1], story: collection.story, stats,
        tier: tier.tier, requiredLevel: tier.requiredLevel,
      } as EquipmentDefinition;
    }),
  );
});

/** 按玩家（掌灶人）等级过滤可掉落/可穿戴的模板：穿戴等级 > 玩家等级的模板不解锁。 */
export function templatesForLevel(level: number): EquipmentDefinition[] {
  return equipmentCatalogue.filter(template => (template.requiredLevel ?? 1) <= level);
}

/**
 * v33 数据持久化：服务端 catalog.equipment 下发后原位替换本地目录（splice 保持数组引用，
 * equipmentDefinition / isEquipmentInstance 等既有消费点零改动）。本地 108 件与后端 seed
 * 逐字同源，仅作离线兜底；在线时以数据库为权威。tier 从 requiredLevel 反推（1/10/25/40/60/80）。
 */
export function applyCatalogEquipment(templates: Array<{
  id: string; name: string; slot: string; rarity: string; story: string;
  stats: Record<string, number>; requiredLevel: number;
}>): void {
  if (!templates.length) return;
  const tierByLevel = new Map<number, number>(equipmentTiers.map(tier => [tier.requiredLevel as number, tier.tier as number]));
  const next = templates.map(template => ({
    id: template.id,
    slot: template.slot,
    rarity: template.rarity,
    name: template.name,
    story: template.story,
    stats: { ...emptyEquipmentStats(), ...template.stats } as EquipmentStats,
    tier: tierByLevel.get(template.requiredLevel) ?? 1,
    requiredLevel: template.requiredLevel,
  } as EquipmentDefinition));
  equipmentCatalogue.splice(0, equipmentCatalogue.length, ...next);
}

export function equipmentDefinition(item: EquipmentInstance): EquipmentDefinition {
  return equipmentCatalogue.find(template => template.id === item.templateId)!;
}

export function equipmentStats(item: EquipmentInstance): EquipmentStats {
  const definition = equipmentDefinition(item);
  if (!definition) return emptyEquipmentStats();
  const result = emptyEquipmentStats();
  // v17 §4.2：强化加成 0.15 → 0.12（+12 → ×2.44），与后端 sumEquipmentStats 一致
  for (const key of Object.keys(result) as (keyof EquipmentStats)[]) result[key] = Math.round(definition.stats[key] * (1 + item.level * 0.12));
  // v20 §4.3：副属性固定加成，不随强化放大（与后端 sumEquipmentStats 口径一致）
  if (item.substat) result[item.substat.key] += substatDelta(item.substat);
  return result;
}

export function statsPower(stats: EquipmentStats): number {
  return Math.round(stats.health * 0.25 + stats.attack * 6 + stats.defense * 3 + stats.speed * 20 + (stats.critical + stats.resistance) * 35);
}

export function equipmentScore(item: EquipmentInstance): number {
  return statsPower(equipmentStats(item));
}

export function wornEquipment(save: EquipmentState, slot: EquipmentSlot): EquipmentInstance | undefined {
  return save.equipment.find(item => item.id === save.equipped[slot] && equipmentDefinition(item)?.slot === slot);
}

export function equipmentBonuses(save: EquipmentState): EquipmentStats {
  const total = emptyEquipmentStats();
  for (const slot of equipmentSlots) {
    const item = wornEquipment(save, slot.id);
    if (!item) continue;
    const stats = equipmentStats(item);
    for (const key of Object.keys(total) as (keyof EquipmentStats)[]) total[key] += stats[key];
  }
  return total;
}

export function equipmentPower(save: EquipmentState): number {
  return statsPower(equipmentBonuses(save));
}

export function formatStat(key: keyof EquipmentStats, value: number): string {
  return `${value.toLocaleString('zh-CN')}${key === 'critical' || key === 'resistance' ? '%' : ''}`;
}

/** v17 强化成本（设计 §4.2）：coins = 3000 × rank × (level+1) × 1.35^level；leaves = 10 × rank × (level+1)。 */
export function enhancementCost(item: EquipmentInstance): { coins: number; leaves: number } {
  const rank = rarities[equipmentDefinition(item).rarity].rank;
  return { coins: Math.round(3000 * rank * (item.level + 1) * Math.pow(1.35, item.level)), leaves: 10 * rank * (item.level + 1) };
}

/* ------------------------------ v20 §4.3 副属性洗练 ------------------------------ */

/** 洗练解锁等级（设计 §4.3：60 级解锁）。 */
export const REFORGE_UNLOCK_LEVEL = 60;
/** 副属性池：暴击/抗暴/速度/生命（设计原文「命中」并入暴击口径——战斗引擎无命中/闪避机制）。 */
export const SUBSTAT_POOL = ['critical', 'resistance', 'speed', 'health'] as const;
export const substatLabels: Record<SubstatKey, string> = { critical: '暴击', resistance: '抗暴', speed: '速度', health: '生命' };

/** 洗练成本（与后端 roster.service reforgeCost 同式）：coins = 20000 × (1 + 0.5 × 累计洗练次数)。 */
export function reforgeCost(washCount: number): number {
  return Math.round(20_000 * (1 + 0.5 * washCount));
}

/** 副属性面板增量：生命 ×100（2–6% 语义映射到绝对值 200–600），其余直加；与后端 power.ts substatDelta 同式。 */
export function substatDelta(substat: { key: SubstatKey; value: number }): number {
  return substat.key === 'health' ? substat.value * 100 : substat.value;
}

/** 副属性展示文案：暴击/抗暴/速度显示 +N%，生命显示 +N×100 点。 */
export function formatSubstat(substat: { key: SubstatKey; value: number }): string {
  return substat.key === 'health'
    ? `+${substat.value * 100} 生命`
    : `+${substat.value}% ${substatLabels[substat.key]}`;
}

/** v17 §3.3①：分解返还 = 金币（原口径）+ 累计强化 leaf 消耗的 30%（未强化件只返金币）。与后端 salvageEquipment 同式。 */
export function salvageValue(item: EquipmentInstance): { coins: number; leaves: number } {
  const rank = rarities[equipmentDefinition(item).rarity].rank;
  const coins = 2000 * rank + item.level * 1000;
  const totalLeafCost = 10 * rank * item.level * (item.level + 1) / 2;
  return { coins, leaves: Math.round(totalLeafCost * 0.3) };
}

export function claimStarterEquipment(save: GameSave): GameSave {
  if (!save.profile || save.starterEquipmentClaimed) return save;
  return { ...save, chests: save.chests + STARTER_CHESTS, starterEquipmentClaimed: true };
}

function chestRandom(seed: number) {
  let state = seed >>> 0;
  return () => {
    state += 0x6d2b79f5;
    let value = Math.imul(state ^ state >>> 15, 1 | state);
    value ^= value + Math.imul(value ^ value >>> 7, 61 | value);
    return ((value ^ value >>> 14) >>> 0) / 4294967296;
  };
}

export function openEquipmentChests(save: GameSave, count: number, operationId: string, seed: number, now = new Date()): GameSave {
  if (!save.profile || (count !== 1 && count !== 5) || save.chests < count || save.equipment.length + count > MAX_EQUIPMENT) return save;
  if (!/^[a-zA-Z0-9-]{1,80}$/.test(operationId) || !Number.isSafeInteger(seed) || save.chestOperations.includes(operationId)) return save;
  const random = chestRandom(seed);
  // v17 装备 6 阶：按掌灶人等级（=世界树）解锁最高阶位（确定性规则，与后端 roster.service 一致）
  const unlockedTier = [...equipmentTiers].reverse().find(tier => tier.requiredLevel <= save.worldtree) ?? equipmentTiers[0];
  const drops = Array.from({ length: count }, (_, index): EquipmentInstance => {
    const slot = equipmentSlots[(save.equipmentChestsOpened + index) % equipmentSlots.length].id;
    const chance = random();
    const rarity = chance < 0.6 ? 'rare' : chance < 0.95 ? 'epic' : 'legendary';
    // v17 桥接 id 规则（与 seed equipmentTemplateId / 后端 roster.service 一致）：
    // rare@t1 / epic@t2 / legendary@t3 沿用旧 id，其余用 `${slot}-t${tier}-${rarity}`
    const bridged = (rarity === 'rare' && unlockedTier.tier === 1) || (rarity === 'epic' && unlockedTier.tier === 2) || (rarity === 'legendary' && unlockedTier.tier === 3);
    const templateId = bridged ? `${slot}-${rarity}` : `${slot}-t${unlockedTier.tier}-${rarity}`;
    return { id: `eq-${save.equipmentChestsOpened + index + 1}-${operationId}`, templateId, level: 0, acquiredAt: now.toISOString() };
  });
  if (drops.some(drop => save.equipment.some(item => item.id === drop.id))) return save;
  return {
    ...save, chests: save.chests - count, equipment: [...save.equipment, ...drops], equipmentChestsOpened: save.equipmentChestsOpened + count,
    chestOperations: [...save.chestOperations, operationId].slice(-100),
    lastChestOpening: { id: operationId, equipmentIds: drops.map(item => item.id), count, openedAt: now.toISOString() },
  };
}

export function equipItem(save: GameSave, id: string): GameSave {
  if (!save.profile) return save;
  const item = save.equipment.find(entry => entry.id === id);
  if (!item) return save;
  const slot = equipmentDefinition(item)?.slot;
  if (!slot || save.equipped[slot] === id) return save;
  return { ...save, equipped: { ...save.equipped, [slot]: id } };
}

export function unequipItem(save: GameSave, slot: EquipmentSlot): GameSave {
  if (!save.profile || !save.equipped[slot]) return save;
  const equipped = { ...save.equipped };
  delete equipped[slot];
  return { ...save, equipped };
}

export function equipBestItems(save: GameSave): GameSave {
  if (!save.profile) return save;
  let next = save;
  for (const slot of equipmentSlots) {
    const current = wornEquipment(next, slot.id);
    const best = next.equipment.filter(item => equipmentDefinition(item)?.slot === slot.id).sort((a, b) => equipmentScore(b) - equipmentScore(a))[0];
    if (best && (!current || equipmentScore(best) > equipmentScore(current))) next = equipItem(next, best.id);
  }
  return next;
}

export function enhanceItem(save: GameSave, id: string, expectedLevel: number): GameSave {
  if (!save.profile) return save;
  const item = save.equipment.find(entry => entry.id === id);
  if (!item || item.level !== expectedLevel || item.level >= MAX_ENHANCEMENT) return save;
  const cost = enhancementCost(item);
  if (save.coins < cost.coins || save.leaves < cost.leaves) return save;
  return { ...save, coins: save.coins - cost.coins, leaves: save.leaves - cost.leaves, equipment: save.equipment.map(entry => entry.id === id ? { ...entry, level: entry.level + 1 } : entry) };
}

export function salvageItem(save: GameSave, id: string): GameSave {
  if (!save.profile || Object.values(save.equipped).includes(id)) return save;
  const item = save.equipment.find(entry => entry.id === id);
  if (!item) return save;
  const value = salvageValue(item);
  return { ...save, coins: save.coins + value.coins, leaves: save.leaves + value.leaves, equipment: save.equipment.filter(entry => entry.id !== id) };
}

/**
 * v20 §4.3 本地洗练：世界树 60 级解锁，扣金币 20000×(1+0.5×累计次数)，
 * 重随 1 条副属性（key 4 选 1、value 2..6）。服务端权威口径见 roster.service reforgeEquipment
 * （expectedWashCount 乐观锁），前端本地随机为演示口径，接线专项时切换。
 */
export function reforgeItem(save: GameSave, id: string): GameSave {
  if (!save.profile || save.worldtree < REFORGE_UNLOCK_LEVEL) return save;
  const item = save.equipment.find(entry => entry.id === id);
  if (!item) return save;
  const washCount = item.washCount ?? 0;
  const cost = reforgeCost(washCount);
  if (save.coins < cost) return save;
  const key = SUBSTAT_POOL[Math.floor(Math.random() * SUBSTAT_POOL.length)];
  const value = 2 + Math.floor(Math.random() * 5); // 2..6
  return {
    ...save,
    coins: save.coins - cost,
    equipment: save.equipment.map(entry => entry.id === id ? { ...entry, substat: { key, value }, washCount: washCount + 1 } : entry),
  };
}

export function isEquipmentInstance(value: unknown): value is EquipmentInstance {
  if (!value || typeof value !== 'object') return false;
  const item = value as EquipmentInstance;
  if (!(typeof item.id === 'string' && /^[a-zA-Z0-9-]{1,110}$/.test(item.id)
    && equipmentCatalogue.some(template => template.id === item.templateId)
    && Number.isSafeInteger(item.level) && item.level >= 0 && item.level <= MAX_ENHANCEMENT
    && typeof item.acquiredAt === 'string' && !Number.isNaN(Date.parse(item.acquiredAt)))) return false;
  // v20 §4.3：substat/washCount 为可选扩展字段，存在时校验形态（与服务端 save-document 白名单一致）
  if (item.substat !== undefined && item.substat !== null) {
    if (!SUBSTAT_POOL.includes(item.substat.key)) return false;
    if (!Number.isSafeInteger(item.substat.value) || item.substat.value < 2 || item.substat.value > 6) return false;
  }
  if (item.washCount !== undefined && (!Number.isSafeInteger(item.washCount) || item.washCount < 0 || item.washCount > 999)) return false;
  return true;
}