/**
 * v9（物品背包）+ v10（运营活动）验证：
 * 堆叠合并与 max_stack 封顶、清零删行、消耗品使用效果白名单、
 * 活动窗口/进度/重复领取三重校验、op_logs 留痕。
 */
import { after, before, test } from 'node:test';
import assert from 'node:assert/strict';
import { rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { closeDatabase, connectDatabase, countRows, queryOne, transaction } from '../src/db/index.js';
import { runMigrations } from '../src/db/migrate.js';
import { seedCatalog } from '../src/db/seed.js';
import { createGuest } from '../src/services/auth.service.js';
import { consumeItem, countItemQuantity, grantItem, insertItemDef } from '../src/repositories/item.repository.js';
import { listBackpack, useItem, applyRewards } from '../src/services/item.service.js';
import { advanceActivityProgress, setActivityProgress, insertActivityDef } from '../src/repositories/activity.repository.js';
import { claimActivityTier, listPlayerActivities } from '../src/services/activity.service.js';
import { activityRewardScale } from '../src/domain/power.js';
import { getBalances, setWorldtreeLevel } from '../src/repositories/player.repository.js';
import { ApiError } from '../src/lib/errors.js';

const databaseFile = path.join(tmpdir(), `food-fantasy-item-activity-${process.pid}.db`);

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
  return createGuest({ nickname, gender: 'female' }).player.id;
}

/* ------------------------------ v9 背包 ------------------------------ */

test('可堆叠物品发放合并为一行，超发按 max_stack 封顶', () => {
  const playerId = newPlayer('堆叠旅人');
  transaction(() => {
    grantItem(playerId, 'item-spice-bundle', 10);
    grantItem(playerId, 'item-spice-bundle', 5);
  });
  assert.equal(countItemQuantity(playerId, 'item-spice-bundle'), 15);
  assert.equal(countRows('SELECT COUNT(*) AS total FROM player_items WHERE player_id = ?', playerId), 1);

  transaction(() => grantItem(playerId, 'item-newbie-gift', 99)); // max_stack = 99
  const gift = queryOne<{ quantity: number }>(
    "SELECT quantity FROM player_items WHERE player_id = ? AND item_id = 'item-newbie-gift'",
    playerId,
  );
  assert.equal(Number(gift?.quantity), 99);
  // 超过 max_stack 的单次发放直接拒绝，不静默超发
  assert.throws(
    () => transaction(() => grantItem(playerId, 'item-newbie-gift', 100)),
    (error: unknown) => error instanceof ApiError && error.status === 409,
  );
});

test('不可堆叠物品一物一行，消耗按获得时间从旧到新删除', () => {
  const playerId = newPlayer('碎片旅人');
  // 注册一个不可堆叠的定义（与 seed 数据解耦，直接测 consume 的实例删除路径）
  transaction(() => {
    insertItemDef({
      id: 'item-test-ticket', name: '测试门票', type: 'material', rarity: 'common', stackable: 0,
    });
    grantItem(playerId, 'item-test-ticket', 3);
  });
  assert.equal(countRows("SELECT COUNT(*) AS total FROM player_items WHERE player_id = ? AND item_id = 'item-test-ticket'", playerId), 3, '一物一行');

  transaction(() => consumeItem(playerId, 'item-test-ticket', 2));
  assert.equal(countRows("SELECT COUNT(*) AS total FROM player_items WHERE player_id = ? AND item_id = 'item-test-ticket'", playerId), 1);

  // 数量不足拒绝
  assert.throws(
    () => transaction(() => consumeItem(playerId, 'item-test-ticket', 2)),
    (error: unknown) => error instanceof ApiError && error.status === 422,
  );

  // 可堆叠物品：清零即删行，CHECK (quantity > 0) 不允许 0 存量
  transaction(() => grantItem(playerId, 'item-stew-small', 3));
  transaction(() => consumeItem(playerId, 'item-stew-small', 2));
  assert.equal(countItemQuantity(playerId, 'item-stew-small'), 1);
  transaction(() => consumeItem(playerId, 'item-stew-small', 1));
  assert.equal(countRows("SELECT COUNT(*) AS total FROM player_items WHERE player_id = ? AND item_id = 'item-stew-small'", playerId), 0);

  assert.throws(
    () => transaction(() => consumeItem(playerId, 'item-stew-small', 1)),
    (error: unknown) => error instanceof ApiError && error.status === 422,
  );
});

test('使用消耗品：效果走 applyResourceDelta 留流水，非消耗品拒绝，未知效果拒绝', () => {
  const playerId = newPlayer('吃货旅人');
  transaction(() => grantItem(playerId, 'item-stew-small', 1));

  const potionsBefore = getBalances(playerId).potion;
  const result = useItem(playerId, 'item-stew-small');
  assert.equal(result.granted.length, 1);
  assert.equal(getBalances(playerId).potion, potionsBefore + 50_000);
  // 流水对账：item.use 原因的流水合计 = 获得量
  const ledger = queryOne<{ total: number }>(
    "SELECT SUM(delta) AS total FROM resource_ledger WHERE player_id = ? AND reason = 'item.use'",
    playerId,
  );
  assert.equal(Number(ledger?.total), 50_000);
  assert.equal(countItemQuantity(playerId, 'item-stew-small'), 0, '使用后消耗一件');

  // op_logs 留痕
  assert.equal(
    countRows("SELECT COUNT(*) AS total FROM op_logs WHERE player_id = ? AND action = 'item_use'", playerId),
    1,
  );

  // 非消耗品不可直接使用
  transaction(() => grantItem(playerId, 'item-spice-bundle', 1));
  assert.throws(() => useItem(playerId, 'item-spice-bundle'), (error: unknown) => error instanceof ApiError && error.status === 422);

  // 未拥有时数量不足
  assert.throws(() => useItem(playerId, 'item-energy-brew'), (error: unknown) => error instanceof ApiError && error.status === 422);
});

test('applyRewards 统一入口：货币过流水 + 物品过 grantItem，未知物品整体拒绝', () => {
  const playerId = newPlayer('发奖旅人');
  const gemsBefore = getBalances(playerId).gem;

  const { itemsGranted } = transaction(() => applyRewards(
    playerId,
    [
      { kind: 'gem', amount: 5, label: '灵晶' },
      { kind: 'item', amount: 2, itemId: 'item-stew-small', label: '暖胃炖汤' },
    ],
    'test.apply-rewards',
    null,
  ));
  assert.deepEqual(itemsGranted, ['item-stew-small']);
  assert.equal(getBalances(playerId).gem, gemsBefore + 5);
  assert.equal(countItemQuantity(playerId, 'item-stew-small'), 2);

  assert.throws(
    () => transaction(() => applyRewards(playerId, [{ kind: 'item', amount: 1, itemId: 'item-ghost' }], 'test.bad', null)),
    (error: unknown) => error instanceof ApiError && error.status === 422,
  );
});

test('背包视图聚合定义信息且数量正确', () => {
  const playerId = newPlayer('查包旅人');
  transaction(() => grantItem(playerId, 'item-spice-bundle', 3));
  const backpack = listBackpack(playerId);
  const row = backpack.find(item => item.itemId === 'item-spice-bundle');
  assert.ok(row);
  assert.equal(row.name, '香料包');
  assert.equal(row.type, 'material');
  assert.equal(row.quantity, 3);
});

/* ------------------------------ v10 活动 ------------------------------ */

test('活动领取：进度达标可领，重复领取与进度不足被拒，奖励入账', () => {
  const playerId = newPlayer('活动旅人');
  // day-1 档位 need = 1，奖励 20000 金币
  setActivityProgress(playerId, 'act-login-7', 1);

  const coinsBefore = getBalances(playerId).coin;
  const { rewards } = claimActivityTier(playerId, 'act-login-7', 'day-1');
  assert.equal(rewards.length, 1);
  assert.equal(getBalances(playerId).coin, coinsBefore + 20_000);

  // 重复领取拒绝
  assert.throws(
    () => claimActivityTier(playerId, 'act-login-7', 'day-1'),
    (error: unknown) => error instanceof ApiError && error.status === 409,
  );

  // 进度不足拒绝（day-3 need = 3）
  assert.throws(
    () => claimActivityTier(playerId, 'act-login-7', 'day-3'),
    (error: unknown) => error instanceof ApiError && error.status === 409,
  );

  // 档位不存在
  assert.throws(() => claimActivityTier(playerId, 'act-login-7', 'day-ghost'), (error: unknown) => error instanceof ApiError && error.status === 404);

  // op_logs 留痕
  assert.equal(
    countRows("SELECT COUNT(*) AS total FROM op_logs WHERE player_id = ? AND action = 'activity_claim'", playerId),
    1,
  );
});

test('活动窗口校验：未开始/已结束的活动拒绝领取', () => {
  const playerId = newPlayer('错过旅人');
  insertActivityDef({
    id: 'act-expired-test', name: '已结束测试活动', type: 'period',
    startAt: '2020-01-01T00:00:00.000Z', endAt: '2020-12-31T00:00:00.000Z',
    configJson: JSON.stringify({ tiers: [{ key: 't1', need: 1, rewards: [{ kind: 'coin', amount: 1, label: '金币' }] }] }),
  });
  setActivityProgress(playerId, 'act-expired-test', 10);
  assert.throws(
    () => claimActivityTier(playerId, 'act-expired-test', 't1'),
    (error: unknown) => error instanceof ApiError && error.status === 409,
  );
  // 过期活动不出现在进行中列表
  assert.ok(!listPlayerActivities(playerId).some(activity => activity.id === 'act-expired-test'));
});

test('活动进度推进：delta 累加、负值钳制为 0', () => {
  const playerId = newPlayer('推进旅人');
  advanceActivityProgress(playerId, 'act-collect-spice', 10);
  advanceActivityProgress(playerId, 'act-collect-spice', 20);
  let progress = queryOne<{ progress: number }>(
    "SELECT progress FROM player_activity_progress WHERE player_id = ? AND activity_id = 'act-collect-spice'",
    playerId,
  );
  assert.equal(Number(progress?.progress), 30);

  advanceActivityProgress(playerId, 'act-collect-spice', -100);
  progress = queryOne<{ progress: number }>(
    "SELECT progress FROM player_activity_progress WHERE player_id = ? AND activity_id = 'act-collect-spice'",
    playerId,
  );
  assert.equal(Number(progress?.progress), 0, '负增量钳制为 0');
});

test('进行中活动视图：带档位、进度与可领状态', () => {
  const playerId = newPlayer('看板旅人');
  setActivityProgress(playerId, 'act-login-7', 2);
  const view = listPlayerActivities(playerId).find(activity => activity.id === 'act-login-7');
  assert.ok(view);
  assert.equal(view.progress, 2);
  assert.deepEqual(view.claimable, ['day-1', 'day-2']);
  assert.ok(view.tiers.length >= 5);
});

/* ------------------------- v17 §9 活动奖励等级缩放 ------------------------- */

test('activityRewardScale 锚点：30 级前 ×1.0，线性放大，67 级起封顶 ×2.1', () => {
  assert.equal(activityRewardScale(1), 1.0, '新玩家不缩放');
  assert.equal(activityRewardScale(30), 1.0, '30 级起点');
  assert.equal(activityRewardScale(50), 1.6, '50 级 = 1 + 0.03×20');
  assert.equal(activityRewardScale(66), 2.08, '66 级 = 1 + 0.03×36');
  assert.equal(activityRewardScale(67), 2.1, '67 级触顶（1.11 → clamp 2.1）');
  assert.equal(activityRewardScale(100), 2.1, '§9 锚点「100 级时 ×2.1」');
  assert.equal(activityRewardScale(150), 2.1, '150 级域下不失控（裸算 4.6 → clamp）');
});

test('活动领取按等级缩放：100 级金币/精华 ×2.1，灵晶不缩放', () => {
  const playerId = newPlayer('满级食客');
  setWorldtreeLevel(playerId, 100);
  setActivityProgress(playerId, 'act-login-7', 7);

  const before = getBalances(playerId);
  // day-1：金币 20000 × 2.1 = 42000
  const day1 = claimActivityTier(playerId, 'act-login-7', 'day-1');
  assert.equal(day1.rewards[0].amount, 42_000);
  // day-2：食灵精华 50 × 2.1 = 105
  const day2 = claimActivityTier(playerId, 'act-login-7', 'day-2');
  assert.equal(day2.rewards[0].amount, 105);
  // day-3：灵晶 30 不缩放（§10 反通胀口径）
  const day3 = claimActivityTier(playerId, 'act-login-7', 'day-3');
  assert.equal(day3.rewards[0].amount, 30);

  const after = getBalances(playerId);
  assert.equal(after.coin - before.coin, 42_000);
  assert.equal(after.leaf - before.leaf, 105);
  assert.equal(after.gem - before.gem, 30);

  // op_logs 留痕带缩放系数
  const log = queryOne<{ detail_json: string }>(
    "SELECT detail_json FROM op_logs WHERE player_id = ? AND action = 'activity_claim' ORDER BY created_at DESC LIMIT 1",
    playerId,
  );
  assert.ok(log?.detail_json.includes('"rewardScale":2.1'), `op_logs 应记录 rewardScale，实际：${log?.detail_json}`);
});

test('低等级玩家领取不缩放（回归保护），视图展示与入账同源', () => {
  const playerId = newPlayer('萌新旅人');
  setActivityProgress(playerId, 'act-login-7', 1);
  const coinsBefore = getBalances(playerId).coin;
  claimActivityTier(playerId, 'act-login-7', 'day-1');
  assert.equal(getBalances(playerId).coin - coinsBefore, 20_000, '1 级玩家奖励原值发放');

  // 视图缩放：100 级玩家看板上的金币档位应为缩放后的 42000
  const richId = newPlayer('满级看板');
  setWorldtreeLevel(richId, 100);
  const view = listPlayerActivities(richId).find(activity => activity.id === 'act-login-7');
  assert.ok(view);
  const day1 = view.tiers.find(tier => tier.key === 'day-1');
  assert.ok(day1);
  assert.equal(day1.rewards[0].amount, 42_000, '视图奖励 = 领取入账（同源缩放）');
  const day3 = view.tiers.find(tier => tier.key === 'day-3');
  assert.ok(day3);
  assert.equal(day3.rewards[0].amount, 30, '灵晶档位视图不缩放');
});
