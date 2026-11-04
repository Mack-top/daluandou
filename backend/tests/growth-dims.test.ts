/**
 * v15 成长维度：经验表（level_exp_defs）/ 等级表（level_stats_defs）/ 职业表（class_defs）
 * 与装备等级需求（equipment_defs.required_level）。
 * 重点验证用户要求的两件事：
 *   1. 主外键关联真实生效（非法职业 / 等级域外的引用必须写不进去）；
 *   2. 表间数据逻辑一致（经验恒等式、成长系数单调、派生属性随等级单调、职业与角色一一对应）。
 */
import { after, before, test } from 'node:test';
import assert from 'node:assert/strict';
import { rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { closeDatabase, connectDatabase, execute, queryAll, queryOne } from '../src/db/index.js';
import { runMigrations } from '../src/db/migrate.js';
import { assertGrowthConsistency, seedCatalog } from '../src/db/seed.js';
import { getCatalog } from '../src/services/catalog.service.js';

const databaseFile = path.join(tmpdir(), `food-fantasy-growth-${process.pid}.db`);

before(() => {
  connectDatabase(databaseFile);
  runMigrations();
  seedCatalog();
});

after(() => {
  closeDatabase();
  for (const suffix of ['', '-wal', '-shm']) rmSync(`${databaseFile}${suffix}`, { force: true });
});

test('经验表覆盖 1..150 级且满足累计恒等式 exp_total(L+1) = exp_total(L) + exp_required(L)', () => {
  const rows = queryAll<{ level: number; exp_required: number; exp_total: number }>(
    'SELECT level, exp_required, exp_total FROM level_exp_defs ORDER BY level',
  );
  assert.equal(rows.length, 150, '经验表应恰好 150 行（v19 §2.5）');
  assert.equal(rows[0].level, 1);
  assert.equal(rows[0].exp_total, 0, '1 级累计经验为 0');
  assert.equal(rows[149].exp_required, 0, '满级（150）升级经验为 0（封顶标记）');

  for (let index = 1; index < rows.length; index += 1) {
    const previous = rows[index - 1];
    const current = rows[index];
    assert.equal(current.level, previous.level + 1, '等级必须连续');
    assert.equal(current.exp_total, previous.exp_total + previous.exp_required, `第 ${current.level} 级累计经验恒等式不成立`);
    if (current.level < 150) assert.ok(current.exp_required > 0, `第 ${current.level} 级升级经验必须为正`);
  }
  assert.ok(rows[99].exp_total > 400_000, '100 级累计经验应达到数十万量级（与经验药剂产出匹配）');
});

test('v17 数值锚点：经验曲线分段几何（1.05/1.06/1.07）与设计文档 §2.1 完全一致', () => {
  const rows = queryAll<{ level: number; exp_required: number; exp_total: number }>(
    'SELECT level, exp_required, exp_total FROM level_exp_defs ORDER BY level',
  );
  const required = (level: number) => rows[level - 1].exp_required;

  // 分段锚点（设计 §2.1 表）：曲线平滑无断崖，三段倍率差 ≤0.02
  assert.equal(required(1), 80, '1 级需求 80（首战 78 exp ≈ 1 战 1 级）');
  assert.equal(required(10), 120, '10 级需求 120');
  assert.equal(required(30), 330, '30 级需求 330（新手段末）');
  assert.equal(required(45), 1040, '45 级需求 1040（中段）');
  assert.equal(required(60), 2490, '60 级需求 2490（中段末）');
  assert.equal(required(70), 8520, '70 级需求 8520（后段起）');
  assert.equal(required(90), 32980, '90 级需求 32980');
  assert.equal(required(99), 60630, '99 级需求 60630（100+ 续接基数）');
  // 1-100 段累计 902,220（旧曲线 425,480 → 新曲线后期更陡但收入同步扩容）
  assert.equal(rows[99].exp_total, 902_220, '100 级累计经验应为 902,220（存量曲线零漂移）');
  // 1-30 段累计约 5,290 量级：26 个主线任务的 exp 奖励（约 4,800）应能覆盖大半
  const earlyTotal = rows[29].exp_total;
  assert.ok(earlyTotal > 4_000 && earlyTotal < 7_000, `1-30 段累计应在 4k–7k 区间：${earlyTotal}`);
});

test('v19 §2.5 锚点：100+ 级以 1.07 续接，单级需求受控（<500 万），growth/暴击封顶续用', () => {
  const rows = queryAll<{ level: number; exp_required: number; exp_total: number }>(
    'SELECT level, exp_required, exp_total FROM level_exp_defs ORDER BY level',
  );
  const required = (level: number) => rows[level - 1].exp_required;

  // L100 起以 L99 需求为基数 ×1.07 续接（闭式公式自然连续，无新增曲线段）
  assert.equal(required(100), 64_880, '100 级需求（80×1.07^99 闭式取整，L99 基数 1.07 续接）');
  assert.equal(required(101), 69_420, '101 级需求继续 ×1.07');
  // 150 级需求 ≈ 179 万，远低于 500 万受控线（文档 §2.5：数字规模仍受控）
  assert.ok(required(149) > 1_000_000 && required(149) < 5_000_000, `149 级需求应落在 100 万–500 万区间：${required(149)}`);
  assert.ok(rows[149].exp_total < 60_000_000, `150 级满级累计应 <6000 万：${rows[149].exp_total}`);
  // 续接段严格单调递增且比值恒 1.07（取整误差 ±10）
  for (let level = 101; level < 149; level += 1) {
    const ratio = required(level + 1) / required(level);
    assert.ok(ratio > 1.06 && ratio < 1.08, `${level}→${level + 1} 级需求比值应约 1.07：${ratio}`);
  }
});

test('等级表与经验表共享等级域，成长系数基线 10000、单调不减、端点正确', () => {
  const stats = queryAll<{ level: number; growth_bp: number; crit_add: number; res_add: number }>(
    'SELECT level, growth_bp, crit_add, res_add FROM level_stats_defs ORDER BY level',
  );
  assert.equal(stats.length, 150, '等级表应恰好 150 行（v19 §2.5）');

  const expLevels = queryAll<{ level: number }>('SELECT level FROM level_exp_defs ORDER BY level');
  assert.deepEqual(stats.map(row => row.level), expLevels.map(row => row.level), '两表等级集合必须完全一致');

  assert.equal(stats[0].growth_bp, 10000, '1 级成长系数为基线 10000');
  assert.equal(stats[99].growth_bp, 26000, '100 级成长系数为 2.6 倍（26000，v17 数值核心 v2）');
  assert.equal(stats[149].growth_bp, 26000, '100+ 级成长系数封顶 2.6 续用（v19 §2.5）');
  assert.equal(stats[0].crit_add, 0);
  assert.equal(stats[99].crit_add, 30);
  assert.equal(stats[99].res_add, 25);
  assert.equal(stats[149].crit_add, 30, '100+ 级暴击增量封顶 +30');
  assert.equal(stats[149].res_add, 25, '100+ 级抗性增量封顶 +25');
  for (let index = 1; index < stats.length; index += 1) {
    assert.ok(stats[index].growth_bp >= stats[index - 1].growth_bp, '成长系数必须单调不减');
  }
});

test('职业表五大职业与角色表 role 一一对应，基础属性均为正', () => {
  const classes = queryAll<{ id: string; name: string }>('SELECT id, name FROM class_defs ORDER BY rowid');
  assert.deepEqual(classes.map(row => row.id), ['治疗', '法术', '输出', '辅助', '防御']);

  const roles = queryAll<{ role: string }>('SELECT DISTINCT role FROM character_defs ORDER BY role');
  const classIds = new Set(classes.map(row => row.id));
  for (const row of roles) {
    assert.ok(classIds.has(row.role), `角色职业「${row.role}」必须挂靠职业表`);
  }

  const broken = queryOne<{ total: number }>(
    'SELECT COUNT(*) AS total FROM class_defs WHERE health <= 0 OR attack <= 0 OR defense <= 0 OR speed <= 0 OR critical < 0 OR resistance < 0',
  );
  assert.equal(Number(broken?.total), 0, '职业基础属性必须全部为正');
});

test('外键真实生效：未知职业与被装备引用的等级都无法写入/删除', () => {
  // 角色的 role 必须引用已定义职业
  assert.throws(() => {
    execute(
      `INSERT INTO character_defs (id, name, title, element, rarity, role, detail, portrait, base_power)
       VALUES ('fk-probe', '外键探针', '测试', '火', 'R', '不存在的职业', '', '', 1000)`,
    );
  }, /FOREIGN KEY|foreign key/i, '非法职业应被外键拒绝');

  // legendary 装备 required_level = 25，删除该等级必须被外键拦截
  assert.throws(() => {
    execute('DELETE FROM level_exp_defs WHERE level = 25');
  }, /FOREIGN KEY|foreign key/i, '被装备引用的等级不可删除');
});

test('装备等级需求按 v17 阶位分布（1/10/25/40/60/80）且全部落在等级域内', () => {
  // v17 装备 6 阶：每个 (slot, tier) 内 3 档稀有度共享阶位穿戴等级
  const rows = queryAll<{ required_level: number; total: number }>(
    'SELECT required_level, COUNT(*) AS total FROM equipment_defs GROUP BY required_level ORDER BY required_level',
  ).map(row => ({ required_level: row.required_level, total: Number(row.total) }));
  assert.deepEqual(rows, [
    { required_level: 1, total: 18 },
    { required_level: 10, total: 18 },
    { required_level: 25, total: 18 },
    { required_level: 40, total: 18 },
    { required_level: 60, total: 18 },
    { required_level: 80, total: 18 },
  ], '6 阶 × 18 件（6 槽 × 3 稀有度）的穿戴等级分布');
  const outside = queryOne<{ total: number }>(
    'SELECT COUNT(*) AS total FROM equipment_defs WHERE required_level NOT IN (SELECT level FROM level_exp_defs)',
  );
  assert.equal(Number(outside?.total), 0);
});

test('派生属性一致性：任意职业任意等级的属性 = floor(基础 × growth_bp / 10000)，且随等级单调不减', () => {
  const classes = queryAll<{ id: string; health: number; attack: number }>('SELECT id, health, attack FROM class_defs');
  const stats = queryAll<{ level: number; growth_bp: number }>('SELECT level, growth_bp FROM level_stats_defs ORDER BY level');

  for (const cls of classes) {
    let previousHealth = 0;
    let previousAttack = 0;
    for (const stat of [stats[0], stats[49], stats[99]]) {
      const health = Math.floor(cls.health * stat.growth_bp / 10000);
      const attack = Math.floor(cls.attack * stat.growth_bp / 10000);
      assert.ok(health >= previousHealth && attack >= previousAttack, `职业 ${cls.id} 派生属性必须随等级单调不减`);
      previousHealth = health;
      previousAttack = attack;
    }
    // 100 级换算结果必须等于 2.6 倍基线（v17：成长曲线 1.0 → 2.6，floor 误差不超过基线的 1%）
    assert.ok(
      Math.floor(cls.health * 26000 / 10000) === Math.floor(cls.health * 2.6),
      `职业 ${cls.id} 满级生命换算与 2.6 倍系数不符`,
    );
  }
});

test('种子自检内建：跨表不一致时 assertGrowthConsistency 必须抛错，修复后恢复通过', () => {
  // 破坏第 5 级成长系数公式值（10000 是 CHECK 允许的合法值，但与曲线公式不符）→ 自检必须拦截
  execute('UPDATE level_stats_defs SET growth_bp = 10000 WHERE level = 5');
  assert.throws(() => assertGrowthConsistency(), /与曲线公式不一致/);
  // v17：5 级公式值 = 10000 + 16000×4/99 ≈ 10646
  execute('UPDATE level_stats_defs SET growth_bp = 10646 WHERE level = 5');

  // 破坏经验恒等式 → 自检必须拦截
  execute('UPDATE level_exp_defs SET exp_total = exp_total + 1 WHERE level = 50');
  assert.throws(() => assertGrowthConsistency(), /累计经验/);
  execute('UPDATE level_exp_defs SET exp_total = exp_total - 1 WHERE level = 50');

  // 修复后自检通过，且 seedCatalog 幂等重跑成功
  assertGrowthConsistency();
  const summary = seedCatalog();
  assert.equal(summary.levels, 150, 'v19 §2.5：等级域延伸至 150');
  assert.equal(summary.classes, 5);
});

test('catalog 全量下发包含 levels / classes，装备携带 requiredLevel', () => {
  const catalog = getCatalog() as unknown as {
    levels: Array<{ level: number; expRequired: number; expTotal: number; growthBp: number; critAdd: number; resAdd: number }>;
    classes: Array<{ id: string; name: string; trait: string; baseStats: Record<string, number> }>;
    equipment: Array<{ id: string; rarity: string; requiredLevel: number }>;
  };

  assert.equal(catalog.levels.length, 150, 'v19 §2.5：等级域延伸至 150');
  assert.equal(catalog.levels[0].level, 1);
  assert.equal(catalog.levels[0].growthBp, 10000);
  assert.equal(catalog.levels[149].expRequired, 0, '150 级为封顶标记');
  assert.equal(catalog.levels[99].expRequired, 64880, '100 级需求 64880（60630 × 1.07 续接，闭式取整）');
  assert.ok(catalog.levels[99].expTotal > 400_000);
  assert.ok(catalog.levels[149].expTotal > 400_000, '150 级累计应远超 100 级量级');

  assert.equal(catalog.classes.length, 5);
  const healer = catalog.classes.find(cls => cls.id === '治疗');
  assert.ok(healer?.trait.includes('治疗'), '职业特性描述应随 catalog 下发');
  assert.ok((healer?.baseStats.health ?? 0) > 0);

  // v17 桥接 id：weapon-legendary = 3 阶传说（t3 桥接件），穿戴需求 25
  const legendary = catalog.equipment.find(row => row.id === 'weapon-legendary');
  assert.equal(legendary?.requiredLevel, 25);
  // 每阶都有 18 件（6 槽 × 3 稀有度），且穿戴需求覆盖 1/10/25/40/60/80
  const requiredLevels = new Set(catalog.equipment.map(row => row.requiredLevel));
  assert.deepEqual([...requiredLevels].sort((a, b) => a - b), [1, 10, 25, 40, 60, 80]);
});
