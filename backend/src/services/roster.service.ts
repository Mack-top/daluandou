import { transaction } from '../db/index.js';
import { nowIso } from '../lib/clock.js';
import { badRequest, conflict, forbidden, notFound } from '../lib/errors.js';
import { newId } from '../lib/ids.js';
import { ASCENSION_MAX_STAR, ascendCost } from '../domain/power.js';
import { applyResourceDelta, getProgress, grantRewards, requirePlayer, updateProgress } from '../repositories/player.repository.js';
import {
  addAstrologyNode,
  countPlayerEquipment,
  deletePlayerEquipment,
  equipItem,
  findOwnedCharacter,
  findPlayerEquipment,
  insertPlayerEquipment,
  listAstrology,
  listOwnedCharacters,
  listPlayerEquipment,
  replaceFormation,
  setCharacterStar,
  unequipSlot,
  updatePlayerEquipmentLevel,
  updatePlayerEquipmentSubstat,
} from '../repositories/roster.repository.js';
import { findCharacterDefByName, findEquipmentDefById, listAstrologyNodes } from '../repositories/catalog.repository.js';
import { parseJsonArray } from '../domain/types.js';
import { insertOpLog } from '../repositories/log.repository.js';
import { createRng } from '../lib/rng.js';
import { buildSquad } from './battle.service.js';
import { updateLeaderboardScore } from './leaderboard.service.js';

const LEADERBOARD_POWER = 'lb-power';

/* ------------------------------ 升星 ------------------------------ */

/**
 * 食灵升星：消耗灵味原浆与食灵精华。
 * 三星奖励稀有徽章，五星奖励食灵契约（与前端规则一致）。
 */
export function ascendCharacter(playerId: string, characterName: string): { star: number; bonus: string | null } {
  return transaction(() => {
    const definition = findCharacterDefByName(characterName);
    if (!definition) throw notFound('食灵不存在');

    const owned = findOwnedCharacter(playerId, definition.id);
    if (!owned) throw conflict(`尚未结识食灵「${characterName}」`);

    const star = Number(owned.star);
    if (star >= ASCENSION_MAX_STAR) throw conflict('该食灵已达五星');

    const cost = ascendCost(star);
    applyResourceDelta(playerId, { potion: -cost.potions, leaf: -cost.leaves }, 'character.ascend', definition.id);
    setCharacterStar(playerId, definition.id, star + 1);

    let bonus: string | null = null;
    if (star + 1 === 5) {
      grantRewards(playerId, [{ kind: 'book', amount: 1, label: '食灵契约' }], 'character.ascend.bonus', definition.id);
      bonus = '食灵契约';
    } else if (star + 1 === 3) {
      grantRewards(playerId, [{ kind: 'medal', amount: 1, label: '稀有徽章' }], 'character.ascend.bonus', definition.id);
      bonus = '稀有徽章';
    }

    return { star: star + 1, bonus };
  });
}

/* ------------------------------ 阵容 ------------------------------ */

/** 设置出战阵容：最多 3 位，去重，且必须已拥有。 */
export function setFormation(playerId: string, characterNames: string[]): string[] {
  if (!Array.isArray(characterNames) || characterNames.length === 0) {
    throw badRequest('阵容不能为空');
  }
  if (characterNames.length > 3) throw badRequest('阵容最多 3 位食灵');

  const owned = new Map(listOwnedCharacters(playerId).map(character => [character.name, character.character_id]));
  const ids: string[] = [];
  for (const name of new Set(characterNames)) {
    const id = owned.get(name);
    if (!id) throw conflict(`尚未结识食灵「${name}」`);
    ids.push(id);
  }

  transaction(() => {
    replaceFormation(playerId, ids);
    // power 榜：阵容变更事务内重算 upsert（设计 §3.6）
    const { power } = buildSquad(playerId);
    if (power > 0) updateLeaderboardScore(LEADERBOARD_POWER, playerId, power);
  });
  return characterNames;
}

/* ------------------------------ 装备 ------------------------------ */

export function equip(playerId: string, equipmentId: string): { slot: string } {
  const item = listPlayerEquipment(playerId).find(entry => entry.id === equipmentId);
  if (!item) throw notFound('装备不存在');

  const definition = findEquipmentDefById(item.template_id);
  if (!definition) throw notFound('装备模板不存在');

  transaction(() => equipItem(playerId, equipmentId, definition.slot));
  return { slot: definition.slot };
}

export function unequip(playerId: string, slot: string): void {
  const item = listPlayerEquipment(playerId).find(entry => entry.equipped_slot === slot);
  if (!item) throw notFound('该槽位当前没有装备');
  transaction(() => unequipSlot(playerId, slot));
}

const RARITY_RANK: Record<string, number> = { rare: 1, epic: 2, legendary: 3 };
export const MAX_ENHANCEMENT = 12;

/** v17 §4.2 强化成本（与前端 equipment.ts enhancementCost 同式）：coins = 3000×rank×(level+1)×1.35^level；leaves = 10×rank×(level+1)。 */
function enhancementCost(rank: number, level: number): { coins: number; leaves: number } {
  return { coins: Math.round(3000 * rank * (level + 1) * Math.pow(1.35, level)), leaves: 10 * rank * (level + 1) };
}

/** 服务端强化：扣业务表货币、player_equipment.level +1（上限 12，乐观锁 expectedLevel 防重复提交）。 */
export function enhanceEquipment(playerId: string, equipmentId: string, expectedLevel: number): { level: number; coins: number; leaves: number } {
  return transaction(() => {
    requirePlayer(playerId);
    const item = findPlayerEquipment(playerId, equipmentId);
    if (!item) throw notFound('装备不存在');
    if (item.level !== expectedLevel) throw conflict('装备等级已变化，请刷新后重试');
    if (item.level >= MAX_ENHANCEMENT) throw conflict(`强化已达到上限 +${MAX_ENHANCEMENT}`);
    const definition = findEquipmentDefById(item.template_id);
    if (!definition) throw notFound('装备模板不存在');
    const rank = RARITY_RANK[definition.rarity] ?? 1;
    const cost = enhancementCost(rank, item.level);
    applyResourceDelta(playerId, { coin: -cost.coins, leaf: -cost.leaves }, 'equipment.enhance', equipmentId);
    updatePlayerEquipmentLevel(playerId, equipmentId, item.level + 1);
    return { level: item.level + 1, coins: cost.coins, leaves: cost.leaves };
  });
}

/**
 * v17 §3.3① 服务端分解：返还金币（原口径 2000×rank + level×1000）
 * + 累计强化 leaf 消耗的 30%（10×rank×L(L+1)/2×0.3，未强化件只返金币）。
 */
export function salvageEquipment(playerId: string, equipmentId: string): { coins: number; leaves: number } {
  return transaction(() => {
    requirePlayer(playerId);
    const item = findPlayerEquipment(playerId, equipmentId);
    if (!item) throw notFound('装备不存在');
    if (item.equipped_slot) throw conflict('已穿戴的装备不可分解，请先卸下');
    const definition = findEquipmentDefById(item.template_id);
    if (!definition) throw notFound('装备模板不存在');
    const rank = RARITY_RANK[definition.rarity] ?? 1;
    const coins = 2000 * rank + item.level * 1000;
    const totalLeafCost = 10 * rank * item.level * (item.level + 1) / 2;
    const leaves = Math.round(totalLeafCost * 0.3);
    deletePlayerEquipment(playerId, equipmentId);
    applyResourceDelta(playerId, { coin: coins, leaf: leaves }, 'equipment.salvage', equipmentId);
    return { coins, leaves };
  });
}

/* ------------------------------ v20 §4.3 副属性洗练 ------------------------------ */

/** 洗练解锁等级（设计 §4.3：60 级解锁，作为后期追求线）。 */
export const REFORGE_UNLOCK_LEVEL = 60;
/** 副属性池：暴击/抗暴/速度/生命（设计原文「命中」并入暴击口径——战斗引擎无命中/闪避机制）。 */
export const SUBSTAT_POOL = ['critical', 'resistance', 'speed', 'health'] as const;

/** v20 §4.3 洗练成本（与前端 equipment.ts reforgeCost 同式）：coins = 20000 × (1 + 0.5 × 累计洗练次数)。 */
function reforgeCost(washCount: number): number {
  return Math.round(20_000 * (1 + 0.5 * washCount));
}

/**
 * 服务端洗练：扣金币、重随 1 条副属性（key 均匀 4 选 1，value ∈ 2..6 均匀），
 * 乐观锁 expectedWashCount 防连点重复扣费。生命按 ×100 计入面板（sumEquipmentStats 折算）。
 */
export function reforgeEquipment(
  playerId: string,
  equipmentId: string,
  expectedWashCount: number,
): { substat: { key: string; value: number }; washCount: number; coins: number } {
  return transaction(() => {
    const player = requirePlayer(playerId);
    if (player.worldtree_level < REFORGE_UNLOCK_LEVEL) {
      throw forbidden(`副属性洗练在世界树 ${REFORGE_UNLOCK_LEVEL} 级解锁`);
    }
    const item = findPlayerEquipment(playerId, equipmentId);
    if (!item) throw notFound('装备不存在');
    if (Number(item.wash_count) !== expectedWashCount) {
      throw conflict('装备洗练状态已变化，请刷新后重试');
    }
    const cost = reforgeCost(Number(item.wash_count));
    applyResourceDelta(playerId, { coin: -cost }, 'equipment.reforge', equipmentId);
    const key = SUBSTAT_POOL[Math.floor(Math.random() * SUBSTAT_POOL.length)];
    const value = 2 + Math.floor(Math.random() * 5); // 2..6
    const washCount = Number(item.wash_count) + 1;
    updatePlayerEquipmentSubstat(playerId, equipmentId, key, value, washCount);
    insertOpLog({
      playerId,
      action: 'equipment_reforge',
      detail: { equipmentId, key, value, washCount, cost },
    });
    return { substat: { key, value }, washCount, coins: cost };
  });
}

/* ------------------------------ 装备获取 ------------------------------ */

const SLOT_ORDER = ['weapon', 'crown', 'armor', 'charm', 'relic', 'crest'] as const;
export const STARTER_CHESTS = 6;
export const MAX_EQUIPMENT = 120;

/** 新手装备宝箱：一次性发放 6 个宝箱，重复领取返回 409。 */
export function claimStarterChests(playerId: string): { chests: number } {
  return transaction(() => {
    const progress = getProgress(playerId);
    if (progress.starter_equipment_claimed) throw conflict('新手装备宝箱已领取');
    applyResourceDelta(playerId, { chest: STARTER_CHESTS }, 'equipment.starter', null);
    updateProgress(playerId, { starter_equipment_claimed: 1 });
    return { chests: STARTER_CHESTS };
  });
}

export type EquipmentDrop = { id: string; templateId: string; slot: string; rarity: string };

/**
 * 开启装备宝箱：消耗宝箱 → 按种子确定性掉落 → 落库。
 * operationId 用于幂等，重复提交同一操作号直接拒绝，避免网络重试刷装备。
 */
export function openEquipmentChests(
  playerId: string,
  input: { count: 1 | 5; operationId: string; seed: number },
): { drops: EquipmentDrop[] } {
  return transaction(() => {
    const progress = getProgress(playerId);
    const operations = parseJsonArray<string>(progress.chest_operations_json);
    if (operations.includes(input.operationId)) {
      throw conflict('该开箱操作已处理，请勿重复提交');
    }

    const owned = countPlayerEquipment(playerId);
    if (owned + input.count > MAX_EQUIPMENT) throw conflict(`背包已满（上限 ${MAX_EQUIPMENT} 件）`);

    // 先扣宝箱：余额不足时 applyResourceDelta 抛 409，整个事务回滚
    applyResourceDelta(playerId, { chest: -input.count }, 'equipment.chest.open', input.operationId);

    const random = createRng(input.seed);
    const opened = Number(progress.equipment_chests_opened);
    const stamp = nowIso();
    const drops: EquipmentDrop[] = [];
    // v17 装备 6 阶：按掌灶人等级（=世界树）解锁最高阶位（确定性规则，与前端 equipment.ts 一致）
    const playerLevel = requirePlayer(playerId).worldtree_level;
    const unlockedTier = [1, 10, 25, 40, 60, 80].filter(required => required <= playerLevel).length;

    for (let index = 0; index < input.count; index += 1) {
      // 槽位按已开次数轮转，保证六类装备均衡产出
      const slot = SLOT_ORDER[(opened + index) % SLOT_ORDER.length];
      const chance = random();
      const rarity = chance < 0.6 ? 'rare' : chance < 0.95 ? 'epic' : 'legendary';
      // v17 桥接 id 规则（与 seed equipmentTemplateId / 前端 equipment.ts 一致）：
      // rare@t1 / epic@t2 / legendary@t3 沿用旧 id，其余用 `${slot}-t${tier}-${rarity}`
      const bridged = (rarity === 'rare' && unlockedTier === 1) || (rarity === 'epic' && unlockedTier === 2) || (rarity === 'legendary' && unlockedTier === 3);
      const templateId = bridged ? `${slot}-${rarity}` : `${slot}-t${unlockedTier}-${rarity}`;
      // 主键用 UUID：eq-{序号}-{操作号} 在多账号下会撞主键（序号与操作号都是玩家私有的）
      const id = newId();
      insertPlayerEquipment({ id, playerId, templateId, obtainedAt: stamp, level: 0 });
      drops.push({ id, templateId, slot, rarity });
    }

    updateProgress(playerId, {
      equipment_chests_opened: opened + input.count,
      chest_operations_json: JSON.stringify([...operations, input.operationId].slice(-100)),
      last_chest_opening_json: JSON.stringify({
        id: input.operationId,
        equipmentIds: drops.map(drop => drop.id),
        count: input.count,
        openedAt: stamp,
      }),
    });

    return { drops };
  });
}

/* ------------------------------ 星象 ------------------------------ */

/** 解锁星象节点：必须按顺序解锁，消耗灵晶。 */
export function unlockAstrology(playerId: string, nodeId: string): { unlocked: string[] } {
  return transaction(() => {
    const nodes = listAstrologyNodes();
    const index = nodes.findIndex(node => node.id === nodeId);
    if (index < 0) throw notFound('星象节点不存在');

    const unlocked = listAstrology(playerId).map(node => node.node_id);
    if (unlocked.includes(nodeId)) throw conflict('该星象节点已解锁');
    if (index > 0 && !unlocked.includes(nodes[index - 1].id)) {
      throw conflict(`请先解锁前置节点「${nodes[index - 1].name}」`);
    }

    applyResourceDelta(playerId, { gem: -nodes[index].gem_cost }, 'astrology.unlock', nodeId);
    addAstrologyNode(playerId, nodeId, nowIso());
    return { unlocked: [...unlocked, nodeId] };
  });
}
