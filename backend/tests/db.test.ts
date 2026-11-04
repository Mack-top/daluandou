import { after, before, test } from 'node:test';
import assert from 'node:assert/strict';
import { rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { closeDatabase, connectDatabase, queryAll, queryOne } from '../src/db/index.js';
import { runMigrations } from '../src/db/migrate.js';
import { seedCatalog } from '../src/db/seed.js';
import { createGuest } from '../src/services/auth.service.js';
import { exchange } from '../src/services/economy.service.js';
import { claimMail } from '../src/services/progress.service.js';
import { buildSave } from '../src/services/state.service.js';
import { ApiError } from '../src/lib/errors.js';

const databaseFile = path.join(tmpdir(), `food-fantasy-test-${process.pid}.db`);

before(() => {
  connectDatabase(databaseFile);
  runMigrations();
  seedCatalog();
});

after(() => {
  closeDatabase();
  for (const suffix of ['', '-wal', '-shm']) rmSync(`${databaseFile}${suffix}`, { force: true });
});

test('迁移与种子数据可用', () => {
  const tables = queryOne<{ total: number }>(
    "SELECT COUNT(*) AS total FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%'",
  );
  assert.equal(Number(tables?.total), 58, 'v21 迁移后应为 58 张表（含 dungeon_defs / feature_toggles）');

  const migrations = queryOne<{ max: number }>('SELECT MAX(version) AS max FROM schema_migrations');
  assert.equal(Number(migrations?.max), 21, '迁移版本应到 v21');

  // v21 副本体系：6 副本种子、全部关卡归属副本、功能开关表非空
  assert.equal(Number(queryOne<{ total: number }>('SELECT COUNT(*) AS total FROM dungeon_defs')?.total), 6, '应有 6 个副本定义');
  assert.equal(
    Number(queryOne<{ total: number }>('SELECT COUNT(*) AS total FROM stage_defs WHERE dungeon_id IS NULL')?.total), 0,
    '全部关卡都应归属某个副本',
  );
  assert.ok(Number(queryOne<{ total: number }>('SELECT COUNT(*) AS total FROM feature_toggles')?.total) >= 20, '功能与活动开关种子应非空');
  // 开服天数解锁双条件完整性：等级域内且开服天数 ≥ 1
  assert.equal(
    Number(queryOne<{ total: number }>(
      'SELECT COUNT(*) AS total FROM dungeon_defs WHERE unlock_level NOT BETWEEN 1 AND 150 OR unlock_open_day < 1',
    )?.total), 0, '副本解锁条件必须落在合法域内',
  );

  // v17 数值核心：世界树（=掌灶人等级）上限 30 → 100；v19 §2.5 无墙延伸 100 → 150；player_progress 补经验余额列
  const playersSqlV17 = queryOne<{ sql: string }>("SELECT sql FROM sqlite_master WHERE type = 'table' AND name = 'players'");
  assert.ok(playersSqlV17?.sql.includes('worldtree_level BETWEEN 1 AND 150'), '世界树等级上限应已放开至 150（v19）');
  const progressColumns = queryAll<{ name: string }>("SELECT name FROM pragma_table_info('player_progress')");
  assert.ok(progressColumns.some(column => column.name === 'exp'), 'player_progress 应有经验余额列 exp');

  // v16 按服隔离：players 昵称唯一约束已改为 (server, nickname)
  const playersSql = queryOne<{ sql: string }>("SELECT sql FROM sqlite_master WHERE type = 'table' AND name = 'players'");
  assert.ok(playersSql?.sql.includes('UNIQUE (server, nickname)'), '昵称唯一约束应按服生效');

  // v15 成长维度种子自检（v19 放开）：经验表/等级表覆盖 1..150，职业表 5 条
  assert.equal(Number(queryOne<{ total: number }>('SELECT COUNT(*) AS total FROM level_exp_defs')?.total), 150);
  assert.equal(Number(queryOne<{ total: number }>('SELECT COUNT(*) AS total FROM level_stats_defs')?.total), 150);
  assert.equal(Number(queryOne<{ total: number }>('SELECT COUNT(*) AS total FROM class_defs')?.total), 5);
  // 外键链路：所有角色挂靠职业、所有装备等级需求落在等级域
  assert.equal(
    Number(queryOne<{ total: number }>(
      'SELECT COUNT(*) AS total FROM character_defs WHERE role NOT IN (SELECT id FROM class_defs)',
    )?.total), 0, '角色必须全部挂靠已定义职业',
  );
  assert.equal(
    Number(queryOne<{ total: number }>(
      'SELECT COUNT(*) AS total FROM equipment_defs WHERE required_level NOT IN (SELECT level FROM level_exp_defs)',
    )?.total), 0, '装备等级需求必须全部落在等级域内',
  );

  // v14 主线任务链种子自检：quest_defs 36 条（8 既有 + 26 主线 + v18 每日 leaf 档 ×2），ref_id 正确落库
  const quests = queryOne<{ total: number }>('SELECT COUNT(*) AS total FROM quest_defs');
  assert.equal(Number(quests?.total), 36, 'quest_defs 应有 36 条任务');
  const stageQuest = queryOne<{ ref_id: string | null }>(
    "SELECT ref_id FROM quest_defs WHERE id = 'MQ-1-04'",
  );
  assert.equal(stageQuest?.ref_id, '1-1', 'stage_clear 任务应带关卡引用');

  const characters = queryOne<{ total: number }>('SELECT COUNT(*) AS total FROM character_defs');
  assert.equal(Number(characters?.total), 5);

  // v7–v13 新配置域种子自检（v17 seed v2：技能 18 / 敌人 30 / 物品 14 / 特效 9）
  for (const [table, expected] of [
    ['vfx_defs', 9], ['skill_defs', 18], ['enemy_defs', 30], ['scene_defs', 5],
    ['item_defs', 14], ['activity_defs', 3], ['leaderboard_defs', 4], ['stage_defs', 21], ['equipment_defs', 108],
  ] as const) {
    const count = queryOne<{ total: number }>(`SELECT COUNT(*) AS total FROM ${table}`);
    assert.equal(Number(count?.total), expected, `${table} 种子数据齐备`);
  }
  const boss = queryOne<{ phase_json: string | null; kind: string }>(
    "SELECT phase_json, kind FROM enemy_defs WHERE id = 'enemy-twin-taste'",
  );
  assert.equal(boss?.kind, 'boss');
  assert.ok(boss?.phase_json?.includes('threshold_bp'), 'Boss 应有阶段机制');
});

test('创建游客账号后初始状态完整', () => {
  const { player, token } = createGuest({ nickname: '测试旅人', gender: 'female' });
  assert.ok(token.length > 20);

  const save = buildSave(player.id);
  assert.equal(save.coins, 50_000);
  assert.equal(save.gems, 100);
  assert.equal(save.books, 10);
  assert.deepEqual(save.characters, ['青团']);
  assert.deepEqual(save.formation, ['青团']);
  assert.equal(save.profile?.name, '测试旅人');
});

test('余额不足时兑换被拒绝且数据不发生任何变化', () => {
  const { player } = createGuest({ nickname: '测试穷鬼' });

  assert.throws(
    () => exchange(player.id, 't1'),
    (error: unknown) => error instanceof ApiError && error.status === 409,
  );

  const save = buildSave(player.id);
  assert.equal(save.coins, 50_000);
  assert.equal(save.books, 10);
  assert.deepEqual(save.tradeCounts, {});
});

test('兑换成功后账本流水合计等于账面余额', () => {
  const { player } = createGuest({ nickname: '测试账本' });
  exchange(player.id, 't3'); // 100 灵晶 → 300000 药剂

  const save = buildSave(player.id);
  assert.equal(save.gems, 0);
  assert.equal(save.potions, 300_000);
  assert.equal(save.tradeCounts.t3, 1);

  const columns: Record<string, string> = {
    coin: 'coins', gem: 'gems', book: 'books', leaf: 'leaves',
    potion: 'potions', chest: 'chests', medal: 'medals',
  };
  const balances = queryOne<Record<string, number>>(
    'SELECT coins, gems, books, leaves, potions, chests, medals FROM player_resources WHERE player_id = ?',
    player.id,
  );
  const ledger = queryAll<{ currency: string; total: number }>(
    'SELECT currency, SUM(delta) AS total FROM resource_ledger WHERE player_id = ? GROUP BY currency',
    player.id,
  );

  for (const row of ledger) {
    assert.equal(Number(row.total), Number(balances?.[columns[row.currency]]), `${row.currency} 对账失败`);
  }
});

test('同一封邮件奖励不能重复领取', () => {
  const { player } = createGuest({ nickname: '测试邮件' });
  const first = claimMail(player.id, 'open');
  assert.equal(first.rewards.length, 2);

  assert.throws(
    () => claimMail(player.id, 'open'),
    (error: unknown) => error instanceof ApiError && error.status === 409,
  );
});
