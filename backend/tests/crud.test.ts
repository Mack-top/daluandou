/**
 * 数据库增删改查与约束验证。
 * 目标不是"测服务"，而是直接验证 SQLite 层的行为：
 * 外键、CHECK、部分唯一索引、级联删除、事务回滚。
 */
import { after, before, test } from 'node:test';
import assert from 'node:assert/strict';
import { rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { closeDatabase, connectDatabase, countRows, execute, queryAll, queryOne, transaction } from '../src/db/index.js';
import { runMigrations } from '../src/db/migrate.js';
import { seedCatalog } from '../src/db/seed.js';
import { createGuest } from '../src/services/auth.service.js';
import { buildSave } from '../src/services/state.service.js';
import { upgradeWorldtree } from '../src/services/economy.service.js';
import { startBattle } from '../src/services/battle.service.js';
import { applyResourceDelta, updateProgress } from '../src/repositories/player.repository.js';
import { deletePlayerEquipment, insertPlayerEquipment, listPlayerEquipment } from '../src/repositories/roster.repository.js';
import { insertSaveDocument } from '../src/repositories/save-document.repository.js';
import { equip, unequip } from '../src/services/roster.service.js';
import { newId } from '../src/lib/ids.js';
import { nowIso } from '../src/lib/clock.js';
import { ApiError } from '../src/lib/errors.js';

const databaseFile = path.join(tmpdir(), `food-fantasy-crud-${process.pid}.db`);

before(() => {
  connectDatabase(databaseFile);
  runMigrations();
  seedCatalog();
});

after(() => {
  closeDatabase();
  for (const suffix of ['', '-wal', '-shm']) rmSync(`${databaseFile}${suffix}`, { force: true });
});

/* ------------------------------ 增 ------------------------------ */

test('新增玩家会同时创建资源、进度、阵容等关联记录', () => {
  const { player } = createGuest({ nickname: '增删改查甲' });
  const id = player.id;

  const expectations: Array<[string, string]> = [
    ['players', 'id'],
    ['player_resources', 'player_id'],
    ['player_progress', 'player_id'],
    ['player_daily_state', 'player_id'],
    ['player_sessions', 'player_id'],
    ['player_characters', 'player_id'],
    ['player_formation', 'player_id'],
  ];
  for (const [table, column] of expectations) {
    const total = countRows(`SELECT COUNT(*) AS total FROM ${table} WHERE ${column} = ?`, id);
    assert.ok(total >= 1, `${table} 应有记录`);
  }

  const ledger = countRows('SELECT COUNT(*) AS total FROM resource_ledger WHERE player_id = ?', id);
  assert.equal(ledger, 3, '初始金币/灵晶/契约应各有一条流水');
});

/* ------------------------------ 查 ------------------------------ */

test('读取时能把多表数据聚合成存档视图', () => {
  const { player } = createGuest({ nickname: '增删改查乙' });
  const save = buildSave(player.id);
  assert.equal(save.profile?.name, '增删改查乙');
  assert.equal(save.worldtree, 1);
  assert.deepEqual(save.formation, ['青团']);
  assert.equal(save.stars['青团'], 1);
});

/* ------------------------------ 改 ------------------------------ */

test('更新世界树等级会同步扣除经验与资源并写流水（v17 三重消耗）', () => {
  const { player } = createGuest({ nickname: '增删改查丙' });
  transaction(() => applyResourceDelta(player.id, { coin: 200_000, leaf: 200 }, 'test.grant', null));
  // v17：1→2 级需 80 经验（seed 分段曲线 80×1.05^0）；金币成本 = 28000×1^1.55×0.2 = 5600；精华 = 15
  updateProgress(player.id, { exp: 80 });
  const before = buildSave(player.id).coins;
  upgradeWorldtree(player.id);
  const save = buildSave(player.id);
  assert.equal(save.worldtree, 2);
  assert.equal(save.coins, before - 5600);
  assert.equal(save.leaves, 185);
  assert.equal(save.expEarned, 0, '经验应被等额消耗');

  const ledger = queryOne<{ total: number }>(
    "SELECT COUNT(*) AS total FROM resource_ledger WHERE player_id = ? AND reason = 'worldtree.upgrade'",
    player.id,
  );
  assert.equal(Number(ledger?.total), 2, '金币与精华各应有一条扣减流水');

  // v17 经验闸门：经验不足时拒绝升级（避免只花钱跳级）
  transaction(() => applyResourceDelta(player.id, { coin: 200_000, leaf: 200 }, 'test.grant', null));
  assert.throws(() => upgradeWorldtree(player.id), /经验不足/);
  assert.equal(buildSave(player.id).worldtree, 2, '升级失败后等级不变');
});

/* ------------------------------ 装备 CRUD ------------------------------ */

test('装备：新增、装备、同槽位替换、卸下、删除', () => {
  const { player } = createGuest({ nickname: '增删改查丁' });

  const first = newId();
  const second = newId();
  insertPlayerEquipment({ id: first, playerId: player.id, templateId: 'weapon-rare', obtainedAt: nowIso() });
  insertPlayerEquipment({ id: second, playerId: player.id, templateId: 'weapon-epic', obtainedAt: nowIso() });
  assert.equal(listPlayerEquipment(player.id).length, 2);

  equip(player.id, first);
  assert.equal(buildSave(player.id).equipped.weapon, first);

  // 同槽位装备新件时，旧件必须自动卸下，否则会撞上唯一索引
  equip(player.id, second);
  const equipped = buildSave(player.id).equipped;
  assert.equal(equipped.weapon, second);
  assert.equal(listPlayerEquipment(player.id).filter(item => item.equipped_slot).length, 1);

  unequip(player.id, 'weapon');
  assert.equal(buildSave(player.id).equipped.weapon, undefined);

  assert.throws(() => unequip(player.id, 'weapon'), (error: unknown) => error instanceof ApiError && error.status === 404);

  assert.equal(deletePlayerEquipment(player.id, first), 1);
  assert.equal(deletePlayerEquipment(player.id, first), 0, '重复删除不应再影响任何行');
  assert.equal(listPlayerEquipment(player.id).length, 1);
});

/* ------------------------------ 约束 ------------------------------ */

test('数据库层直接拒绝负余额', () => {
  const { player } = createGuest({ nickname: '增删改查戊' });
  assert.throws(() => execute('UPDATE player_resources SET coins = -1 WHERE player_id = ?', player.id));
});

test('外键拒绝不存在的食灵引用', () => {
  const { player } = createGuest({ nickname: '增删改查己' });
  assert.throws(() =>
    execute(
      'INSERT INTO player_characters (player_id, character_id, unlocked_at) VALUES (?, ?, ?)',
      player.id,
      'ghost-character',
      nowIso(),
    ),
  );
});

test('部分唯一索引阻止同一关卡出现两场未结算战斗', () => {
  const { player } = createGuest({ nickname: '增删改查庚' });
  startBattle(player.id, '1-1');

  assert.throws(
    () => startBattle(player.id, '1-1'),
    (error: unknown) => error instanceof ApiError && error.status === 409,
  );

  // 绕过服务层直接写库，同样应被数据库拦住
  assert.throws(() =>
    execute(
      `INSERT INTO battles (id, player_id, stage_id, seed, status, power, enemy_power, units_json, started_at)
       VALUES (?, ?, '1-1', 1, 'pending', 0, 0, '[]', ?)`,
      newId(),
      player.id,
      nowIso(),
    ),
  );
});

/* ------------------------------ 事务 ------------------------------ */

test('事务中途异常时，本次写入全部回滚且不留流水', () => {
  const { player } = createGuest({ nickname: '增删改查辛' });
  const before = buildSave(player.id).coins;

  assert.throws(() =>
    transaction(() => {
      applyResourceDelta(player.id, { coin: -1000 }, 'test.rollback', null);
      assert.equal(buildSave(player.id).coins, before - 1000, '事务内应能读到未提交的变更');
      throw new Error('模拟业务异常');
    }),
  );

  assert.equal(buildSave(player.id).coins, before);
  assert.equal(
    countRows("SELECT COUNT(*) AS total FROM resource_ledger WHERE player_id = ? AND reason = 'test.rollback'", player.id),
    0,
    '回滚后不应残留流水',
  );
});

/* ------------------------------ 删 ------------------------------ */

test('删除玩家会级联清理全部关联数据', () => {
  const { player } = createGuest({ nickname: '增删改查壬' });
  insertPlayerEquipment({ id: newId(), playerId: player.id, templateId: 'armor-rare', obtainedAt: nowIso() });
  insertSaveDocument(player.id, JSON.stringify({ coins: 1 }), nowIso());
  startBattle(player.id, '1-1');

  const before = queryOne<{ total: number }>('SELECT COUNT(*) AS total FROM players');
  execute('DELETE FROM players WHERE id = ?', player.id);
  const after = queryOne<{ total: number }>('SELECT COUNT(*) AS total FROM players');
  assert.equal(Number(after?.total), Number(before?.total) - 1);

  const cascades = [
    'player_resources', 'player_progress', 'player_daily_state', 'player_sessions',
    'player_characters', 'player_formation', 'player_equipment', 'battles', 'resource_ledger',
    'player_save_documents',
  ];
  for (const table of cascades) {
    const total = countRows(`SELECT COUNT(*) AS total FROM ${table} WHERE player_id = ?`, player.id);
    assert.equal(total, 0, `${table} 应被级联清空`);
  }
});

/* ------------------------------ 读写一致性 ------------------------------ */

test('连续 20 次资源变更后余额与流水仍然一致', () => {
  const { player } = createGuest({ nickname: '增删改查癸' });
  for (let i = 0; i < 20; i += 1) {
    transaction(() => applyResourceDelta(player.id, { coin: 100, gem: 1 }, 'stress.test', String(i)));
  }

  const save = buildSave(player.id);
  assert.equal(save.coins, 50_000 + 2000);
  assert.equal(save.gems, 100 + 20);

  const ledger = queryAll<{ currency: string; total: number }>(
    'SELECT currency, SUM(delta) AS total FROM resource_ledger WHERE player_id = ? GROUP BY currency',
    player.id,
  );
  const expected: Record<string, number> = {
    coin: save.coins,
    gem: save.gems,
    book: save.books,
    leaf: save.leaves,
    potion: save.potions,
    chest: save.chests,
    medal: save.medals,
  };
  for (const row of ledger) {
    assert.equal(Number(row.total), expected[row.currency], `${row.currency} 对账不一致`);
  }
});
