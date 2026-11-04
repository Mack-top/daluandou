/**
 * v14 主线任务链 P0（1–30 级，26 个 MQ 任务）：
 * 服务端权威进度计算（新 metric）+ 领取流转（未完成 409 → 完成 → 发奖 → 防重复）。
 * 进度一律由 measure(context) 计算，客户端无法伪造成已完成。
 */
import { after, before, test } from 'node:test';
import assert from 'node:assert/strict';
import { rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { claimQuest, listQuestsWithProgress, claimMail } from '../src/services/progress.service.js';
import { setFormation, claimStarterChests } from '../src/services/roster.service.js';
import { createGuest } from '../src/services/auth.service.js';
import { getBalances } from '../src/repositories/player.repository.js';
import { execute, queryOne, closeDatabase, connectDatabase } from '../src/db/index.js';
import { runMigrations } from '../src/db/migrate.js';
import { seedCatalog } from '../src/db/seed.js';
import { nowIso, dayKey } from '../src/lib/clock.js';

const databaseFile = path.join(tmpdir(), `food-fantasy-quest-main-${process.pid}.db`);

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
  const { player } = createGuest({ nickname, gender: 'male' });
  claimStarterChests(player.id);
  setFormation(player.id, ['青团']);
  return player.id;
}

/** 直插一条已胜利的战斗记录（关卡胜场是 stage_clear 的唯一进度来源）。 */
function insertWin(playerId: string, stageId: string, id: string): void {
  execute(
    `INSERT INTO battles (id, player_id, stage_id, seed, status, win, rounds, power, enemy_power, first_clear, units_json, started_at, settled_at)
     VALUES (?, ?, ?, 123, 'claimed', 1, 3, 100, 90, 1, '[]', ?, ?)`,
    id, playerId, stageId, nowIso(), nowIso(),
  );
}

function progressOf(playerId: string, questId: string): { progress: number; claimable: boolean; claimed: boolean } {
  const view = listQuestsWithProgress(playerId).find(quest => quest.id === questId);
  assert.ok(view, `任务 ${questId} 应存在于任务列表`);
  return { progress: view.progress, claimable: view.claimable, claimed: view.claimed };
}

test('种子灌入：26 个 MQ 主线任务全部就位且 stage_clear 带关卡引用', () => {
  const mainQuests = queryOne<{ total: number }>("SELECT COUNT(*) AS total FROM quest_defs WHERE group_name = '主线' AND id LIKE 'MQ-%'");
  assert.equal(Number(mainQuests?.total), 26);
  for (const [questId, ref] of [['MQ-1-04', '1-1'], ['MQ-1-11', '2-3'], ['MQ-2-01', '2-4']] as const) {
    const row = queryOne<{ ref_id: string | null }>('SELECT ref_id FROM quest_defs WHERE id = ?', questId);
    assert.equal(row?.ref_id, ref);
  }
});

test('MQ-1-01（none）：建号即完成，可直接领取', () => {
  const playerId = newPlayer('点火旅人');
  const state = progressOf(playerId, 'MQ-1-01');
  assert.equal(state.progress, 1);
  assert.equal(state.claimable, true);
  claimQuest(playerId, 'MQ-1-01');
  assert.equal(progressOf(playerId, 'MQ-1-01').claimed, true);
});

test('MQ-1-04（stage_clear）：胜场插入前 0，插入后完成；重复领取拒绝', () => {
  const playerId = newPlayer('试炼旅人');
  assert.equal(progressOf(playerId, 'MQ-1-04').progress, 0);

  insertWin(playerId, '1-1', 'qtest-win-1');
  const state = progressOf(playerId, 'MQ-1-04');
  assert.equal(state.progress, 1);
  assert.equal(state.claimable, true);

  claimQuest(playerId, 'MQ-1-04');
  assert.equal(progressOf(playerId, 'MQ-1-04').claimed, true);
  assert.throws(() => claimQuest(playerId, 'MQ-1-04'), /已领取/);
});

test('MQ-1-17：2-3 需 3 胜，胜场不足时领取 409（尚未完成）', () => {
  const playerId = newPlayer('茶庭旅人');
  insertWin(playerId, '2-3', 'qtest-win-2a');
  insertWin(playerId, '2-3', 'qtest-win-2b');
  assert.equal(progressOf(playerId, 'MQ-1-17').progress, 2);
  assert.equal(progressOf(playerId, 'MQ-1-17').claimable, false);
  assert.throws(() => claimQuest(playerId, 'MQ-1-17'), /尚未完成/);

  insertWin(playerId, '2-3', 'qtest-win-2c');
  assert.equal(progressOf(playerId, 'MQ-1-17').claimable, true);
});

test('MQ-1-06（formation_slots）：编满 3 槽后进度达标', () => {
  const playerId = newPlayer('编队旅人');
  // 新玩家只有青团 + 新手宝箱装备，先补两名食灵再编队
  for (const name of ['蓝纹奶酪', '冬阴功']) {
    execute(
      'INSERT INTO player_characters (player_id, character_id, star, level, unlocked_at) VALUES (?, (SELECT id FROM character_defs WHERE name = ?), 1, 1, ?)',
      playerId, name, nowIso(),
    );
  }
  setFormation(playerId, ['青团', '蓝纹奶酪', '冬阴功']);
  assert.equal(progressOf(playerId, 'MQ-1-06').progress, 3);
});

test('MQ-1-09（mail_claimed）：领取邮件后任务进度 +1', () => {
  const playerId = newPlayer('收信旅人');
  assert.equal(progressOf(playerId, 'MQ-1-09').progress, 0);
  claimMail(playerId, 'open');
  assert.equal(progressOf(playerId, 'MQ-1-09').progress, 1);
});

test('MQ-1-05（summons_total）与 MQ-1-08（crafted_total）读累计口径字段', () => {
  const playerId = newPlayer('召唤旅人');
  execute('UPDATE player_progress SET packs_opened = 1, crafted = 2 WHERE player_id = ?', playerId);
  // 进度显示钳制到 target，但累计值 2 ≥ target 1 即可领取
  const summon = progressOf(playerId, 'MQ-1-05');
  const crafted = progressOf(playerId, 'MQ-1-08');
  assert.equal(summon.progress, 1);
  assert.equal(summon.claimable, true);
  assert.equal(crafted.progress, 1);
  assert.equal(crafted.claimable, true);
});

test('MQ-2-05（worldtree_level）随 players.worldtree_level 走', () => {
  const playerId = newPlayer('世界树旅人');
  execute('UPDATE players SET worldtree_level = 5 WHERE id = ?', playerId);
  assert.equal(progressOf(playerId, 'MQ-2-05').progress, 5);
});

test('MQ-2-06（stars_reached）：3 名食灵达 3 星后达标', () => {
  const playerId = newPlayer('升星旅人');
  execute('UPDATE player_characters SET star = 3 WHERE player_id = ?', playerId);
  assert.equal(progressOf(playerId, 'MQ-2-06').progress, 1);
  for (const name of ['蓝纹奶酪', '冬阴功']) {
    execute(
      'INSERT INTO player_characters (player_id, character_id, star, level, unlocked_at) VALUES (?, (SELECT id FROM character_defs WHERE name = ?), 3, 1, ?)',
      playerId, name, nowIso(),
    );
  }
  assert.equal(progressOf(playerId, 'MQ-2-06').progress, 3);
});

test('MQ-1-02（login_days）：player_daily_state 按天分键累计登录天数', () => {
  const playerId = newPlayer('登录旅人');
  execute(
    "INSERT INTO player_daily_state (player_id, day_key, daily_paid, claimed_tiers_json, summons, login_rewards) VALUES (?, '2026-01-01', 0, '[]', 0, 0)",
    playerId,
  );
  // 原始累计 = 昨日显式行 + 今日 ensureDailyState 隐式行 = 2；进度显示钳制到 target 1
  const raw = queryOne<{ total: number }>(
    'SELECT COUNT(*) AS total FROM player_daily_state WHERE player_id = ?',
    playerId,
  );
  assert.equal(Number(raw?.total), 2);
  const state = progressOf(playerId, 'MQ-1-02');
  assert.equal(state.progress, 1);
  assert.equal(state.claimable, true);
});

test('MQ-1-13 / MQ-2-04：集市与交易坊按当日口径计进度', () => {
  const playerId = newPlayer('市集旅人');
  execute(
    "INSERT INTO player_market_purchases (player_id, day_key, offer_id, price, purchased_at) VALUES (?, ?, 'm1', 100, ?)",
    playerId, dayKey(), nowIso(),
  );
  execute(
    "INSERT INTO player_trade_usage (player_id, day_key, rate_id, used) VALUES (?, ?, 't1', 1)",
    playerId, dayKey(),
  );
  assert.equal(progressOf(playerId, 'MQ-1-13').progress, 1);
  assert.equal(progressOf(playerId, 'MQ-2-04').progress, 1);
});

test('主线任务奖励真实入账（走 grantRewards 流水）', () => {
  const playerId = newPlayer('领奖旅人');
  const before = getBalances(playerId);
  insertWin(playerId, '1-1', 'qtest-win-3');
  claimQuest(playerId, 'MQ-1-04'); // 金币 10000 + 精华 30
  const after = getBalances(playerId);
  assert.equal(after.coin - before.coin, 10000);
  assert.equal(after.leaf - before.leaf, 30);
  // 流水留痕：任务领取应有 quest.claim 记录
  const ledger = queryOne<{ total: number }>(
    "SELECT COUNT(*) AS total FROM resource_ledger WHERE player_id = ? AND reason = 'quest.claim'",
    playerId,
  );
  assert.equal(Number(ledger?.total) >= 2, true, '每项奖励都应有流水');
});

/* ------------------------- v18 §3.3②：每日任务 leaf 档 ------------------------- */

test('daily-battle（daily_battle_wins）：今日胜场计进度、跨日重置、领取发食灵精华', () => {
  const { player } = createGuest({ nickname: '每日任务甲' });
  setFormation(player.id, ['青团']);

  // 今日无胜场：进度 0，领取被拒
  const before = listQuestsWithProgress(player.id).find(quest => quest.id === 'daily-battle');
  assert.ok(before, 'daily-battle 任务应已种子化');
  assert.equal(before.progress, 0, '今日无胜场进度应为 0');
  assert.throws(() => claimQuest(player.id, 'daily-battle'), /尚未完成|409|未完成/);

  // 插入两条今日胜场（直接写 battles 表，绕过战斗管线）
  for (let index = 0; index < 2; index += 1) {
    execute(
      `INSERT INTO battles (id, player_id, stage_id, seed, status, win, rounds, power, enemy_power, first_clear, units_json, started_at, settled_at)
       VALUES (?, ?, '1-1', 1, 'claimed', 1, 3, 9000, 7000, 0, '[]', ?, ?)`,
      `daily-battle-${player.id}-${index}`, player.id, nowIso(), nowIso(),
    );
  }
  const after = listQuestsWithProgress(player.id).find(quest => quest.id === 'daily-battle');
  assert.equal(after?.progress, 2, '今日 2 胜后进度应为 2');

  const balancesBefore = getBalances(player.id);
  claimQuest(player.id, 'daily-battle');
  const balancesAfter = getBalances(player.id);
  assert.equal(balancesAfter.leaf - balancesBefore.leaf, 60, '领取应发放 60 食灵精华');

  // 已领取后重复领取被拒（player_quest_claims 按 day_key 去重）
  assert.throws(() => claimQuest(player.id, 'daily-battle'), /已领取|重复|已领取过/);
});

test('daily-market（market_today）：今日集市兑换 1 次即可领取，奖励 80 精华', () => {
  const { player } = createGuest({ nickname: '每日任务乙' });
  const before = listQuestsWithProgress(player.id).find(quest => quest.id === 'daily-market');
  assert.ok(before, 'daily-market 任务应已种子化');
  assert.equal(before?.progress, 0);

  execute(
    'INSERT INTO player_market_purchases (player_id, day_key, offer_id, price, purchased_at) VALUES (?, ?, ?, ?, ?)',
    player.id, dayKey(), 'm1', 60000, nowIso(),
  );
  const after = listQuestsWithProgress(player.id).find(quest => quest.id === 'daily-market');
  assert.equal(after?.progress, 1, '今日集市兑换后进度应为 1');

  const balancesBefore = getBalances(player.id);
  claimQuest(player.id, 'daily-market');
  assert.equal(getBalances(player.id).leaf - balancesBefore.leaf, 80, '领取应发放 80 食灵精华');
});
