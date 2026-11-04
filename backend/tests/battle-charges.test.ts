/**
 * 每日关卡挑战次数机制：
 * 免费 4 次/天 → 挑战卡（15 灵晶/张，最多 6 张）→ 每日总上限 10 次 → 跨日 dayKey 自然重置。
 * 校验在 startBattle 事务内硬执行；购买走 /api/game/battle-passes。
 */
import { after, before, test } from 'node:test';
import assert from 'node:assert/strict';
import { rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

import {
  BATTLE_PASS_COST_GEMS,
  FREE_BATTLES_PER_DAY,
  MAX_BATTLES_PER_DAY,
  MAX_PASSES_PER_DAY,
  getBattleCharges,
  purchaseBattlePass,
  startBattle,
  settleBattle,
} from '../src/services/battle.service.js';
import { setFormation, claimStarterChests } from '../src/services/roster.service.js';
import { createGuest } from '../src/services/auth.service.js';
import { getBalances } from '../src/repositories/player.repository.js';
import { execute, queryOne, closeDatabase, connectDatabase } from '../src/db/index.js';
import { runMigrations } from '../src/db/migrate.js';
import { seedCatalog } from '../src/db/seed.js';
import { dayKey } from '../src/lib/clock.js';

const databaseFile = path.join(tmpdir(), `food-fantasy-battle-charges-${process.pid}.db`);

before(() => {
  connectDatabase(databaseFile);
  runMigrations();
  seedCatalog();
});

after(() => {
  closeDatabase();
  for (const suffix of ['', '-wal', '-shm']) rmSync(`${databaseFile}${suffix}`, { force: true });
});

function newPlayer(nickname: string): string {
  const { player } = createGuest({ nickname, gender: 'female' });
  claimStarterChests(player.id);
  setFormation(player.id, ['青团']);
  return player.id;
}

test('数值定案：免费 4 次、挑战卡限购 6 张、总上限 10 次、单价 15 灵晶', () => {
  assert.equal(FREE_BATTLES_PER_DAY, 4);
  assert.equal(MAX_BATTLES_PER_DAY, 10);
  assert.equal(MAX_PASSES_PER_DAY, 6);
  assert.equal(BATTLE_PASS_COST_GEMS, 15);
});

test('免费次数内开战正常计数，剩余次数随开战递减', () => {
  const playerId = newPlayer('计数旅人');
  let charges = getBattleCharges(playerId);
  assert.equal(charges.used, 0);
  assert.equal(charges.remaining, FREE_BATTLES_PER_DAY);
  assert.equal(charges.canBuy, false, '免费未用尽时不可购买');

  for (let index = 0; index < FREE_BATTLES_PER_DAY; index += 1) {
    const battle = startBattle(playerId, '1-1');
    settleBattle(playerId, battle.id);
    charges = getBattleCharges(playerId);
    assert.equal(charges.used, index + 1);
  }
  assert.equal(charges.remaining, 0);
  assert.equal(charges.canBuy, true, '免费用尽后可购买');
});

test('免费用尽后第 5 次开战被拒；购买挑战卡后解锁；付费次数开战消耗正常', () => {
  const playerId = newPlayer('买卡旅人');
  for (let index = 0; index < FREE_BATTLES_PER_DAY; index += 1) {
    settleBattle(playerId, startBattle(playerId, '1-1').id);
  }
  assert.throws(() => startBattle(playerId, '1-1'), /免费挑战次数已用尽/);

  const gemsBefore = getBalances(playerId).gem;
  const { charges } = purchaseBattlePass(playerId);
  assert.equal(charges.purchased, 1);
  assert.equal(getBalances(playerId).gem, gemsBefore - BATTLE_PASS_COST_GEMS);

  settleBattle(playerId, startBattle(playerId, '1-1').id);
  const after = getBattleCharges(playerId);
  assert.equal(after.purchased, 1);
  assert.equal(after.used, FREE_BATTLES_PER_DAY + 1);
  assert.equal(after.remaining, 0, '付费次数打完即当前额度用尽（可再买卡扩展）');
  assert.equal(getBalances(playerId).gem, gemsBefore - BATTLE_PASS_COST_GEMS);
});

test('免费未用尽时购买被拒（保护挑战卡价值）', () => {
  const playerId = newPlayer('心急旅人');
  assert.throws(() => purchaseBattlePass(playerId), /免费挑战次数还剩/);
});

test('达每日总上限 10 次后：开战与购买同时被拒，提示明日重置', () => {
  const playerId = newPlayer('肝帝旅人');
  for (let index = 0; index < FREE_BATTLES_PER_DAY; index += 1) {
    settleBattle(playerId, startBattle(playerId, '1-1').id);
  }
  for (let index = 0; index < MAX_PASSES_PER_DAY; index += 1) {
    purchaseBattlePass(playerId);
  }
  assert.equal(getBattleCharges(playerId).purchased, MAX_PASSES_PER_DAY);
  assert.throws(() => purchaseBattlePass(playerId), /挑战卡已购满/);
  // 买满卡 ≠ 用完次数：把 6 次付费次数全部打完才触发总上限
  for (let index = 0; index < MAX_PASSES_PER_DAY; index += 1) {
    settleBattle(playerId, startBattle(playerId, '1-1').id);
  }
  assert.equal(getBattleCharges(playerId).used, MAX_BATTLES_PER_DAY);
  assert.throws(() => startBattle(playerId, '1-1'), /已达每日挑战上限（10 次）/);
  assert.equal(getBattleCharges(playerId).canBuy, false, '达总上限后不可再买');
});

test('购买所需灵晶不足时扣费失败且次数不变（事务回滚）', () => {
  const playerId = newPlayer('穷旅人');
  for (let index = 0; index < FREE_BATTLES_PER_DAY; index += 1) {
    settleBattle(playerId, startBattle(playerId, '1-1').id);
  }
  execute('UPDATE player_resources SET gems = 3 WHERE player_id = ?', playerId);
  assert.throws(() => purchaseBattlePass(playerId));
  const row = queryOne<{ used: number; purchased: number }>(
    'SELECT used, purchased FROM battle_passes WHERE player_id = ? AND day_key = ?',
    playerId,
    dayKey(),
  );
  assert.equal(row?.purchased, 0, '购买失败不增加次数');
});

test('跨日重置：day_key 变化后计数归零，昨日记录自然作废', () => {
  const playerId = newPlayer('跨日旅人');
  settleBattle(playerId, startBattle(playerId, '1-1').id);
  assert.equal(getBattleCharges(playerId).used, 1);

  // 模拟昨日：把当日计数行改到昨天，今日再查即从 0 开始
  execute('UPDATE battle_passes SET day_key = ? WHERE player_id = ?', '2026-01-01', playerId);
  const charges = getBattleCharges(playerId);
  assert.equal(charges.used, 0, '跨日后今日计数从零开始');
  assert.equal(charges.purchased, 0, '昨日购买的挑战卡不结转');
  assert.equal(charges.remaining, FREE_BATTLES_PER_DAY);
  // 今日可正常开战
  settleBattle(playerId, startBattle(playerId, '1-1').id);
  assert.equal(getBattleCharges(playerId).used, 1);
});

test('同一玩家多次跨日保留历史行（审计友好），仅当日行生效', () => {
  const playerId = newPlayer('审计旅人');
  settleBattle(playerId, startBattle(playerId, '1-1').id);
  execute('UPDATE battle_passes SET day_key = ? WHERE player_id = ?', '2026-01-01', playerId);
  getBattleCharges(playerId);
  const rows = queryOne<{ total: number }>(
    'SELECT COUNT(*) AS total FROM battle_passes WHERE player_id = ?',
    playerId,
  );
  assert.equal(rows?.total, 2, '昨日行与今日行并存');
});
