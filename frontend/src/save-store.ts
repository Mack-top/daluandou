import { astrologyNodes, battleStages, characters, dailyTiers, fundMilestones, mailList, quests, shopPacks, tradeRates, type GameSave } from './game-data';
import { isBattleRecord, MAX_BATTLE_HISTORY } from './battle-engine';
import { createFreshSave, rolloverDaily } from './game-clock';
import { equipmentDefinition, equipmentSlots, isEquipmentInstance, MAX_EQUIPMENT } from './equipment';
import { parseSocialSave } from './social';

const object = (value: unknown): value is Record<string, unknown> => !!value && typeof value === 'object' && !Array.isArray(value);
const number = (value: unknown, max = 1e12): value is number => typeof value === 'number' && Number.isSafeInteger(value) && value >= 0 && value <= max;
const date = (value: unknown): value is string => typeof value === 'string' && !Number.isNaN(Date.parse(value));
const day = (value: unknown): value is string => typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value) && date(value);

export function parseSave(stored: unknown): GameSave {
  const next = createFreshSave();
  if (!object(stored)) return next;
  const numeric = ['coins', 'gems', 'books', 'leaves', 'potions', 'chests', 'medals', 'dailyPaid', 'battleWins', 'crafted', 'packsOpened', 'chroniclePoints', 'dailySummons', 'dailyLoginRewards', 'loginDays'] as const;
  for (const key of numeric) if (number(stored[key])) next[key] = stored[key];
  for (const key of ['dailyDate', 'marketDate', 'tradeDate', 'chronicleDate'] as const) if (day(stored[key])) next[key] = stored[key];
  const strings = (value: unknown, allowed: string[]) => Array.isArray(value) ? [...new Set(value.filter((item): item is string => typeof item === 'string' && allowed.includes(item)))] : [];
  const numbers = (value: unknown, allowed: number[]) => Array.isArray(value) ? [...new Set(value.filter((item): item is number => typeof item === 'number' && allowed.includes(item)))] : [];
  next.characters = strings(stored.characters, characters.map(character => character.name));
  if (!next.characters.length) next.characters = ['青团'];
  next.purchases = strings(stored.purchases, ['contract', 'level', 'first', 'fund']);
  next.claimedQuests = strings(stored.claimedQuests, quests.map(quest => quest.id));
  next.claimedMail = strings(stored.claimedMail, mailList.map(mail => mail.id));
  next.firstClaimed = numbers(stored.firstClaimed, [1, 2, 3]);
  next.sevenClaimed = numbers(stored.sevenClaimed, [1, 2, 3, 4, 5, 6, 7]);
  next.dailyClaimed = numbers(stored.dailyClaimed, dailyTiers);
  next.bpClaimed = numbers(stored.bpClaimed, Array.from({ length: 10 }, (_, index) => index + 1));
  next.fundClaimed = strings(stored.fundClaimed, fundMilestones.map(milestone => milestone.id));
  next.marketBought = strings(stored.marketBought, ['m1', 'm2', 'm3', 'm4', 'm5', 'm6']);
  next.chronicleClaimed = strings(stored.chronicleClaimed, ['c1', 'c2', 'c4', 'c6']);
  next.shopBought = strings(stored.shopBought, shopPacks.map(pack => pack.id));
  next.astrology = strings(stored.astrology, astrologyNodes.map(node => node.id));
  next.firstClears = strings(stored.firstClears, battleStages.map(stage => stage.id));
  next.formation = strings(stored.formation, next.characters).slice(0, 3);
  if (!next.formation.length) next.formation = next.characters.slice(0, 3);
  if (object(stored.stars)) {
    for (const character of characters) {
      const level = stored.stars[character.name];
      if (number(level, 5) && level >= 1) next.stars[character.name] = level;
    }
  }
  if (object(stored.tradeCounts)) {
    for (const rate of tradeRates) {
      const used = stored.tradeCounts[rate.id];
      if (number(used)) next.tradeCounts[rate.id] = Math.min(used, rate.dailyLimit);
    }
  }
  // v14 主线任务链：关卡胜场分布（服务端权威覆盖）与累计登录天数
  if (object(stored.stageClears)) {
    for (const stage of battleStages) {
      const count = stored.stageClears[stage.id];
      if (number(count, 1e6)) next.stageClears[stage.id] = count;
    }
  }
  if (Array.isArray(stored.equipment)) {
    const seen = new Set<string>();
    next.equipment = stored.equipment.filter(isEquipmentInstance).filter(item => {
      if (seen.has(item.id)) return false;
      seen.add(item.id);
      return true;
    }).slice(0, MAX_EQUIPMENT);
  }
  if (object(stored.equipped)) {
    for (const slot of equipmentSlots) {
      const id = stored.equipped[slot.id];
      if (next.equipment.some(item => item.id === id && equipmentDefinition(item).slot === slot.id)) next.equipped[slot.id] = id as string;
    }
  }
  next.starterEquipmentClaimed = stored.starterEquipmentClaimed === true;
  if (number(stored.equipmentChestsOpened)) next.equipmentChestsOpened = stored.equipmentChestsOpened;
  if (Array.isArray(stored.chestOperations)) next.chestOperations = [...new Set(stored.chestOperations.filter((id): id is string => typeof id === 'string' && /^[a-zA-Z0-9-]{1,80}$/.test(id)))].slice(-100);
  const receipt = stored.lastChestOpening;
  if (object(receipt) && typeof receipt.id === 'string' && next.chestOperations.includes(receipt.id) && date(receipt.openedAt) && (receipt.count === 1 || receipt.count === 5) && Array.isArray(receipt.equipmentIds)) {
    next.lastChestOpening = { id: receipt.id, openedAt: receipt.openedAt, count: receipt.count, equipmentIds: strings(receipt.equipmentIds, next.equipment.map(item => item.id)).slice(0, 5) };
  }
  if (object(stored.profile) && typeof stored.profile.name === 'string' && /^[\p{L}\p{N}]{2,8}$/u.test(stored.profile.name) && (stored.profile.gender === 'male' || stored.profile.gender === 'female') && date(stored.profile.createdAt)) {
    next.profile = { name: stored.profile.name, gender: stored.profile.gender, createdAt: stored.profile.createdAt };
  }
  if (number(stored.server, 18) && stored.server >= 1) next.server = stored.server;
  if (number(stored.worldtree, 30) && stored.worldtree >= 1) next.worldtree = stored.worldtree;
  if (date(stored.firstPurchasedAt)) next.firstPurchasedAt = stored.firstPurchasedAt;
  if (date(stored.idleClaimAt)) next.idleClaimAt = stored.idleClaimAt;
  for (const key of ['extraClaimed', 'guideCompleted', 'fundPurchased'] as const) next[key] = stored[key] === true;
  if (Array.isArray(stored.battleHistory)) {
    const seen = new Set<string>();
    next.battleHistory = stored.battleHistory.filter(isBattleRecord).filter(record => {
      if (seen.has(record.id) || record.status === 'pending') return false;
      seen.add(record.id);
      return true;
    }).slice(0, MAX_BATTLE_HISTORY);
  }
  const pending = stored.pendingBattle;
  if (next.profile && isBattleRecord(pending) && pending.status === 'pending' && !next.battleHistory.some(record => record.id === pending.id)) next.pendingBattle = pending;
  next.social = parseSocialSave(stored.social);
  return rolloverDaily(next);
}