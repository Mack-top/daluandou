import { test, expect } from '@playwright/test';
import {
  claimStarterEquipment, enhanceItem, equipmentBonuses, equipmentCatalogue, equipmentDefinition, equipmentPower, equipmentScore,
  equipBestItems, equipItem, MAX_ENHANCEMENT, MAX_EQUIPMENT, openEquipmentChests, salvageItem, salvageValue, unequipItem,
  type EquipmentInstance,
} from '../src/equipment';
import { createFreshSave, rolloverDaily } from '../src/game-clock';
import { characterPower, type GameSave } from '../src/game-data';
import { beginBattle, simulateBattle } from '../src/battle-engine';
import { parseSave } from '../src/save-store';

function traveler(): GameSave {
  const save = createFreshSave();
  return { ...save, profile: { name: '行装旅人', gender: 'female', createdAt: new Date().toISOString() } };
}

function item(id: string, templateId = 'weapon-rare', level = 0): EquipmentInstance {
  return { id, templateId, level, acquiredAt: new Date().toISOString() };
}

test('starter equipment gift is free, requires a character and is claimed once', () => {
  const save = traveler();
  const gift = claimStarterEquipment(save);
  expect(gift.chests).toBe(save.chests + 6);
  expect(gift.coins).toBe(save.coins);
  expect(claimStarterEquipment(gift)).toBe(gift);
  expect(claimStarterEquipment(parseSave(gift)).chests).toBe(6);
  const guest = createFreshSave();
  expect(claimStarterEquipment(guest)).toBe(guest);
});

test('opening six chests covers all slots with deterministic loot and no duplicate grants', () => {
  const save = claimStarterEquipment(traveler());
  const now = new Date();
  const a = openEquipmentChests(save, 5, 'opening-five', 42, now);
  const b = openEquipmentChests(save, 5, 'opening-five', 42, now);
  expect(a).toEqual(b);
  expect(a.chests).toBe(1);
  expect(a.equipment).toHaveLength(5);
  expect(a.lastChestOpening?.count).toBe(5);
  expect(openEquipmentChests(a, 5, 'opening-five', 42, now)).toBe(a);
  const finished = openEquipmentChests(a, 1, 'opening-sixth', 13, now);
  expect(finished.chests).toBe(0);
  expect(finished.equipment).toHaveLength(6);
  expect(new Set(finished.equipment.map(entry => equipmentDefinition(entry).slot)).size).toBe(6);
  expect(new Set(finished.equipment.map(entry => entry.id)).size).toBe(6);
  expect(finished.equipped).toEqual({});
});

test('invalid counts, missing chests and full inventory cannot consume any resources', () => {
  const save = traveler();
  expect(openEquipmentChests(save, 1, 'empty', 42)).toBe(save);
  const withChests = { ...save, chests: 6 };
  for (const count of [-1, 0, 2, 100]) expect(openEquipmentChests(withChests, count, 'invalid', 42)).toBe(withChests);
  const full = { ...withChests, equipment: Array.from({ length: MAX_EQUIPMENT }, (_, index) => item(`full-${index}`)) };
  expect(openEquipmentChests(full, 1, 'no-space', 42)).toBe(full);
  expect(openEquipmentChests(withChests, 1, '<invalid-id>', 42)).toBe(withChests);
});

test('equipping replaces only the correct slot and unequipping retains inventory', () => {
  const save = { ...traveler(), equipment: [item('first'), item('second', 'weapon-epic'), item('armor', 'armor-rare')] };
  const first = equipItem(save, 'first');
  const withArmor = equipItem(first, 'armor');
  const second = equipItem(withArmor, 'second');
  expect(second.equipped).toEqual({ weapon: 'second', armor: 'armor' });
  expect(second.equipment).toEqual(save.equipment);
  expect(equipItem(second, 'missing')).toBe(second);
  expect(equipItem(second, 'second')).toBe(second);
  const removed = unequipItem(second, 'weapon');
  expect(removed.equipped).toEqual({ armor: 'armor' });
  expect(removed.equipment).toHaveLength(3);
  expect(unequipItem(removed, 'weapon')).toBe(removed);
});

test('automatic equipment selects the best per slot and never downgrades worn gear', () => {
  const save = { ...traveler(), equipment: [item('low'), item('high', 'weapon-legendary'), item('armor', 'armor-epic'), item('crown', 'crown-rare')] };
  const equipped = equipBestItems(save);
  expect(equipped.equipped.weapon).toBe('high');
  expect(equipped.equipped.armor).toBe('armor');
  expect(equipBestItems(equipped)).toBe(equipped);
  expect(equipmentPower(equipped)).toBeGreaterThan(0);
  expect(equipmentBonuses(equipped).health).toBeGreaterThan(0);
});

test('enhancement checks the expected level and spends the displayed resource cost', () => {
  const save = equipItem({ ...traveler(), equipment: [item('blade')], coins: 1000000, leaves: 10000 }, 'blade');
  const next = enhanceItem(save, 'blade', 0);
  expect(next.equipment[0].level).toBe(1);
  expect(next.coins).toBe(save.coins - 3000);
  expect(next.leaves).toBe(save.leaves - 10);
  expect(equipmentScore(next.equipment[0])).toBeGreaterThan(equipmentScore(save.equipment[0]));
  expect(enhanceItem(next, 'blade', 0)).toBe(next);
  let maxed = next;
  for (let level = 1; level < MAX_ENHANCEMENT; level++) maxed = enhanceItem(maxed, 'blade', level);
  expect(maxed.equipment[0].level).toBe(MAX_ENHANCEMENT);
  expect(enhanceItem(maxed, 'blade', MAX_ENHANCEMENT)).toBe(maxed);
  const poor = { ...save, coins: 0 };
  expect(enhanceItem(poor, 'blade', 0)).toBe(poor);
});

test('salvage cannot destroy equipped gear and pays once for an unused item', () => {
  const save = equipItem({ ...traveler(), equipment: [item('worn'), item('unused', 'weapon-epic', 2)] }, 'worn');
  expect(salvageItem(save, 'worn')).toBe(save);
  const value = salvageValue(save.equipment[1]);
  const salvaged = salvageItem(save, 'unused');
  expect(salvaged.coins).toBe(save.coins + value);
  expect(salvaged.equipment).toHaveLength(1);
  expect(salvageItem(salvaged, 'unused')).toBe(salvaged);
  expect(save.equipment).toHaveLength(2);
});

test('storage restores valid equipment and rejects duplicates, invalid stats and mismatched slots', () => {
  const save = traveler();
  const stored = { ...save, equipment: [item('valid'), item('valid'), item('bad-template', 'not-equipment'), item('bad-level', 'weapon-rare', 99)], equipped: { weapon: 'valid', armor: 'valid', crown: 'does-not-exist' }, coins: 74000 };
  const parsed = parseSave(stored);
  expect(parsed.equipment).toEqual([stored.equipment[0]]);
  expect(parsed.equipped).toEqual({ weapon: 'valid' });
  expect(parsed.coins).toBe(74000);
  expect(parseSave({ ...save, equipment: { invalid: true } }).equipment).toEqual([]);
  const legacy = { ...save } as Partial<GameSave>;
  delete legacy.equipment; delete legacy.equipped; delete legacy.starterEquipmentClaimed;
  const restored = parseSave(legacy);
  expect(restored.equipment).toEqual([]);
  expect(restored.profile?.name).toBe(save.profile?.name);
  expect(restored.starterEquipmentClaimed).toBe(false);
});

test('equipment persists across daily resets and existing battle snapshots stay unchanged', () => {
  const save = traveler();
  const baseline = simulateBattle(save, '1-1', ['青团'], 42, 'base')!;
  const set = equipmentCatalogue.filter(template => template.rarity === 'epic').map((template, index) => item(`set-${index}`, template.id));
  const geared = equipBestItems({ ...save, equipment: set, coins: 100000, leaves: 1000 });
  const battle = simulateBattle(geared, '1-1', ['青团'], 42, 'geared')!;
  expect(characterPower(geared, '青团')).toBeGreaterThan(characterPower(save, '青团'));
  expect(battle.power).toBeGreaterThan(baseline.power);
  expect(battle.units[0].maxHp).toBeGreaterThan(baseline.units[0].maxHp);
  expect(battle.units[0].attack).toBeGreaterThan(baseline.units[0].attack);
  expect(battle.units[0].defense).toBeGreaterThan(0);
  expect(battle.units[0].critical).toBeGreaterThan(18);
  const pending = beginBattle(geared, '1-1', ['青团'], 42, 'snapshot');
  const original = structuredClone(pending.pendingBattle);
  const changed = enhanceItem(pending, set[0].id, 0);
  expect(changed.equipment[0].level).toBe(1);
  expect(changed.pendingBattle).toEqual(original);
  const tomorrow = new Date(); tomorrow.setDate(tomorrow.getDate() + 1);
  expect(rolloverDaily(geared, tomorrow).equipment).toEqual(geared.equipment);
  expect(rolloverDaily(geared, tomorrow).equipped).toEqual(geared.equipped);
});

test('guests cannot consume chests, equip or salvage a forged inventory', () => {
  const guest = { ...createFreshSave(), chests: 1, equipment: [item('guest')], coins: 100000, leaves: 1000 };
  expect(openEquipmentChests(guest, 1, 'guest-opening', 1)).toBe(guest);
  expect(equipItem(guest, 'guest')).toBe(guest);
  expect(equipBestItems(guest)).toBe(guest);
  expect(enhanceItem(guest, 'guest', 0)).toBe(guest);
  expect(salvageItem(guest, 'guest')).toBe(guest);
});

test('opening receipts survive refresh and do not refer to removed gear', () => {
  const opened = openEquipmentChests(claimStarterEquipment(traveler()), 1, 'saved-opening', 42);
  const restored = parseSave(JSON.parse(JSON.stringify(opened)));
  expect(restored.lastChestOpening).toEqual(opened.lastChestOpening);
  expect(restored.equipmentChestsOpened).toBe(1);
  expect(openEquipmentChests(restored, 1, 'saved-opening', 42)).toBe(restored);
  const cleaned = parseSave(salvageItem(restored, restored.equipment[0].id));
  expect(cleaned.lastChestOpening?.equipmentIds).toEqual([]);
});

test('enhancement cannot charge twice for a stale level or cross the maximum', () => {
  const save = { ...traveler(), equipment: [item('repeat-upgrade')], coins: 1000000, leaves: 1000 };
  let next = enhanceItem(save, 'repeat-upgrade', 0);
  const once = { coins: next.coins, leaves: next.leaves };
  for (let i = 0; i < 10; i++) next = enhanceItem(next, 'repeat-upgrade', 0);
  expect(next.equipment[0].level).toBe(1);
  expect(next.coins).toBe(once.coins);
  expect(next.leaves).toBe(once.leaves);
});