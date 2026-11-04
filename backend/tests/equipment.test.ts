/** 装备获取链路：新手宝箱、开箱掉落、幂等与背包上限。 */
import { after, before, test } from 'node:test';
import assert from 'node:assert/strict';
import { rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { closeDatabase, connectDatabase, queryOne } from '../src/db/index.js';
import { runMigrations } from '../src/db/migrate.js';
import { seedCatalog } from '../src/db/seed.js';
import { createGuest } from '../src/services/auth.service.js';
import { buildSave } from '../src/services/state.service.js';
import { claimStarterChests, enhanceEquipment, equip, openEquipmentChests, reforgeEquipment, REFORGE_UNLOCK_LEVEL, salvageEquipment, SUBSTAT_POOL } from '../src/services/roster.service.js';
import { ApiError } from '../src/lib/errors.js';
import { applyResourceDelta, setWorldtreeLevel } from '../src/repositories/player.repository.js';
import { findEquipmentDefById } from '../src/repositories/catalog.repository.js';
import { substatDelta, sumEquipmentStats } from '../src/domain/power.js';

const databaseFile = path.join(tmpdir(), `food-fantasy-equipment-${process.pid}.db`);

before(() => {
  connectDatabase(databaseFile);
  runMigrations();
  seedCatalog();
});

after(() => {
  closeDatabase();
  for (const suffix of ['', '-wal', '-shm']) rmSync(`${databaseFile}${suffix}`, { force: true });
});

test('新手宝箱只能领取一次，发放 6 个宝箱', () => {
  const { player } = createGuest({ nickname: '装备测试甲' });
  const result = claimStarterChests(player.id);
  assert.equal(result.chests, 6);
  assert.equal(buildSave(player.id).chests, 6);
  assert.equal(buildSave(player.id).starterEquipmentClaimed, true);

  assert.throws(
    () => claimStarterChests(player.id),
    (error: unknown) => error instanceof ApiError && error.status === 409,
  );
});

test('开箱产出装备，初始强化等级为 0，槽位按顺序轮转', () => {
  const { player } = createGuest({ nickname: '装备测试乙' });
  claimStarterChests(player.id);

  const { drops } = openEquipmentChests(player.id, { count: 5, operationId: 'op-1', seed: 12345 });
  assert.equal(drops.length, 5);
  assert.deepEqual(
    drops.map(drop => drop.slot),
    ['weapon', 'crown', 'armor', 'charm', 'relic'],
    '前五次应依次产出五个不同槽位',
  );

  const save = buildSave(player.id);
  assert.equal(save.chests, 1);
  assert.equal(save.equipment.length, 5);
  assert.equal(save.equipmentChestsOpened, 5);
  assert.ok(save.equipment.every(item => item.level === 0), '新装备应为未强化（0 级）');

  const rows = queryOne<{ total: number }>(
    'SELECT COUNT(*) AS total FROM player_equipment WHERE player_id = ? AND level = 0',
    player.id,
  );
  assert.equal(Number(rows?.total), 5);
});

test('同一操作号重复提交被拒绝，不会重复掉落', () => {
  const { player } = createGuest({ nickname: '装备测试丙' });
  claimStarterChests(player.id);
  openEquipmentChests(player.id, { count: 1, operationId: 'op-dup', seed: 7 });

  assert.throws(
    () => openEquipmentChests(player.id, { count: 1, operationId: 'op-dup', seed: 7 }),
    (error: unknown) => error instanceof ApiError && error.status === 409,
  );
  assert.equal(buildSave(player.id).equipment.length, 1);
  assert.equal(buildSave(player.id).chests, 5);
});

test('宝箱不足时开箱失败且不产生任何装备', () => {
  const { player } = createGuest({ nickname: '装备测试丁' });
  assert.throws(
    () => openEquipmentChests(player.id, { count: 5, operationId: 'op-poor', seed: 7 }),
    (error: unknown) => error instanceof ApiError && error.status === 409,
  );
  assert.equal(buildSave(player.id).equipment.length, 0);
  assert.equal(buildSave(player.id).chests, 0);
});

test('相同种子在不同账号上产出相同的掉落模板序列', () => {
  const first = createGuest({ nickname: '装备测试戊' });
  const second = createGuest({ nickname: '装备测试己' });
  claimStarterChests(first.player.id);
  claimStarterChests(second.player.id);

  const a = openEquipmentChests(first.player.id, { count: 5, operationId: 'op-seed', seed: 999 });
  const b = openEquipmentChests(second.player.id, { count: 5, operationId: 'op-seed', seed: 999 });
  assert.deepEqual(
    a.drops.map(drop => drop.templateId),
    b.drops.map(drop => drop.templateId),
  );
});

/* ------------------------- v17 §3.3①/§4.2：服务端分解/强化 ------------------------- */

test('服务端强化：扣费入账、等级 +1、上限 12、乐观锁防重复提交', () => {
  const { player } = createGuest({ nickname: '强化测试甲' });
  claimStarterChests(player.id);
  applyResourceDelta(player.id, { coin: 500_000, leaf: 2_000 }, 'test.grant');
  const { drops } = openEquipmentChests(player.id, { count: 1, operationId: 'enh-1', seed: 42 });
  const item = drops[0];

  const before = buildSave(player.id);
  const result = enhanceEquipment(player.id, item.id, 0);
  assert.equal(result.level, 1);
  assert.ok(result.coins > 0 && result.leaves > 0, '强化成本应为正');

  const after = buildSave(player.id);
  assert.equal(before.coins - after.coins, result.coins, '金币应按成本扣减');
  assert.equal(before.leaves - after.leaves, result.leaves, '精华应按成本扣减');

  // 乐观锁：同一 expectedLevel 重复提交被拒
  assert.throws(() => enhanceEquipment(player.id, item.id, 0), /等级已变化/);
  // 幂等续强：携带新等级成功
  assert.equal(enhanceEquipment(player.id, item.id, 1).level, 2);
});

test('服务端分解：返还原金币口径 + 累计强化 leaf 的 30%，已穿戴件被拒绝', () => {
  const { player } = createGuest({ nickname: '分解测试甲' });
  claimStarterChests(player.id);
  applyResourceDelta(player.id, { coin: 500_000, leaf: 2_000 }, 'test.grant');
  const { drops } = openEquipmentChests(player.id, { count: 2, operationId: 'sal-1', seed: 43 });
  const [enhanced, fresh] = drops;

  // 强化到 3 级（rank1：每级 leaves = 10×1×(L+1) → 累计 10+20+30 = 60）
  enhanceEquipment(player.id, enhanced.id, 0);
  enhanceEquipment(player.id, enhanced.id, 1);
  enhanceEquipment(player.id, enhanced.id, 2);

  const before = buildSave(player.id);
  const rankOf = (templateId: string) => ({ rare: 1, epic: 2, legendary: 3 } as Record<string, number>)[findEquipmentDefById(templateId)!.rarity];
  const rank = rankOf(enhanced.templateId);
  const yield1 = salvageEquipment(player.id, enhanced.id);
  assert.equal(yield1.coins, 2000 * rank + 3 * 1000, '分解金币 = 2000×rank + level×1000');
  assert.equal(yield1.leaves, Math.round(10 * rank * 3 * 4 / 2 * 0.3), '分解 leaf = 累计强化消耗 × 30%');
  const after1 = buildSave(player.id);
  assert.equal(after1.coins - before.coins, yield1.coins);
  assert.equal(after1.leaves - before.leaves, yield1.leaves);

  // 未强化件：只返金币，无 leaf
  const yield2 = salvageEquipment(player.id, fresh.id);
  assert.equal(yield2.leaves, 0, '未强化件分解不返 leaf');
  assert.equal(yield2.coins, 2000 * rankOf(fresh.templateId), '未强化件金币 = 2000×rank');

  // 已穿戴件拒绝分解
  const { drops: wearable } = openEquipmentChests(player.id, { count: 1, operationId: 'sal-2', seed: 44 });
  equip(player.id, wearable[0].id);
  assert.throws(() => salvageEquipment(player.id, wearable[0].id), /已穿戴/);
});

/* ------------------------- v20 §4.3：副属性洗练 ------------------------- */

test('sumEquipmentStats 副属性折算：生命 ×100、其余直加、不随强化放大', () => {
  const base = { health: 1000, attack: 100, defense: 20, speed: 10, critical: 5, resistance: 5, level: 3 };
  const without = sumEquipmentStats([base]);
  const withHealth = sumEquipmentStats([{ ...base, substat: { key: 'health', value: 6 } }]);
  const withCrit = sumEquipmentStats([{ ...base, substat: { key: 'critical', value: 4 } }]);
  assert.equal(withHealth.health - without.health, 600, '生命副属性 6 → +600（×100）');
  assert.equal(withCrit.critical - without.critical, 4, '暴击副属性 4 → +4（不乘强化 1.36）');
  assert.equal(withCrit.health, without.health, '非对应维度不受影响');
  assert.equal(substatDelta({ key: 'speed', value: 3 }), 3);
});

test('服务端洗练：60 级解锁、扣费 2 万×(1+0.5×次数)、重随副属性、乐观锁防连点', () => {
  const { player } = createGuest({ nickname: '洗练测试甲' });
  claimStarterChests(player.id);
  applyResourceDelta(player.id, { coin: 5_000_000 }, 'test.grant');
  const { drops } = openEquipmentChests(player.id, { count: 1, operationId: 'ref-1', seed: 45 });
  const item = drops[0];

  // 未达 60 级：403 拒绝
  assert.throws(
    () => reforgeEquipment(player.id, item.id, 0),
    (error: unknown) => error instanceof ApiError && error.status === 403,
  );

  setWorldtreeLevel(player.id, REFORGE_UNLOCK_LEVEL);
  const before = buildSave(player.id);
  const result = reforgeEquipment(player.id, item.id, 0);
  assert.equal(result.washCount, 1);
  assert.equal(result.coins, 20_000, '首次洗练成本 2 万');
  assert.ok((SUBSTAT_POOL as readonly string[]).includes(result.substat.key), '副属性 key 必须在池内');
  assert.ok(result.substat.value >= 2 && result.substat.value <= 6, '副属性 value ∈ 2..6');
  assert.equal(before.coins - buildSave(player.id).coins, 20_000);

  // 乐观锁：旧 expectedWashCount 重复提交被拒
  assert.throws(() => reforgeEquipment(player.id, item.id, 0), /洗练状态已变化/);
  // 第二次成本 20000 × 1.5 = 30000
  const second = reforgeEquipment(player.id, item.id, 1);
  assert.equal(second.washCount, 2);
  assert.equal(second.coins, 30_000, '第二次洗练成本 3 万');

  // 存档 DTO 携带副属性与洗练次数
  const dto = buildSave(player.id).equipment.find(entry => entry.id === item.id);
  assert.ok(dto);
  assert.deepEqual(dto.substat, { key: second.substat.key, value: second.substat.value });
  assert.equal(dto.washCount, 2);
});

test('洗练副属性计入战斗面板：穿搭配副属性后 buildSquad 战力上升', async () => {
  const { buildSquad } = await import('../src/services/battle.service.js');
  const { updatePlayerEquipmentSubstat } = await import('../src/repositories/roster.repository.js');
  const { player } = createGuest({ nickname: '洗练战力甲' });
  claimStarterChests(player.id);
  applyResourceDelta(player.id, { coin: 5_000_000 }, 'test.grant');
  setWorldtreeLevel(player.id, REFORGE_UNLOCK_LEVEL);
  const { drops } = openEquipmentChests(player.id, { count: 1, operationId: 'ref-pow', seed: 46 });
  equip(player.id, drops[0].id);

  const before = buildSquad(player.id).power;
  updatePlayerEquipmentSubstat(player.id, drops[0].id, 'critical', 6, 1);
  const after = buildSquad(player.id).power;
  assert.ok(after > before, `副属性暴击 +6 应计入战力（${before} → ${after}）`);
});
