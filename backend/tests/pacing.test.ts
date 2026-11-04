/**
 * v17 数值节奏断言（设计 docs/numeric-balance-design.md §2–§3/§8）：
 *  1. 世界树升级回本天数：多项式成本下的回本锚点精确复现（§3.1 表），全程单调、满级无墙；
 *  2. 挂机产出：金币/灵味原浆/经验时薪与 §3.2 公式一致，离线上限 8/12 小时；
 *  3. 战斗经验：首通 ×3、碾压减半（§2.2）；
 *  4. 主线任务 exp 奖励总额 ≈ 4,800（§2.2，替代原 potion 奖励位）；
 *  5. 关卡锚点：21 关严格递增、两端锚点、可达性上界（参考战力 ×2，防数量级错标）。
 * 公式全部直接调用 domain/power.ts（服务端权威口径），不允许在测试内复写公式。
 */
import { after, before, test } from 'node:test';
import assert from 'node:assert/strict';
import { rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { closeDatabase, connectDatabase, queryAll } from '../src/db/index.js';
import { runMigrations } from '../src/db/migrate.js';
import { seedCatalog } from '../src/db/seed.js';
import { battleExpGain, growthMultiplier, idleAccrual, worldtreeCost } from '../src/domain/power.js';

const databaseFile = path.join(tmpdir(), `food-fantasy-pacing-${process.pid}.db`);

before(() => {
  connectDatabase(databaseFile);
  runMigrations();
  seedCatalog();
});

after(() => {
  closeDatabase();
  for (const suffix of ['', '-wal', '-shm']) rmSync(`${databaseFile}${suffix}`, { force: true });
});

/* ------------------------------ 1. 世界树回本（§3.1） ------------------------------ */

/** 日产出口径与文档一致：金币时薪 ×24，不计星象加成（bonus=1）。 */
const dailyCoins = (level: number) => 15_000 * (1 + 0.22 * (level - 1)) * 24;
const paybackDays = (level: number) => worldtreeCost(level).coins / dailyCoins(level);

test('世界树回本锚点：0.93 / 1.56 / 2.01 天（设计 §3.1 表精确复现）', () => {
  assert.ok(Math.abs(paybackDays(10) - 0.93) < 0.01, `10 级回本应 ≈0.93 天：${paybackDays(10).toFixed(3)}`);
  assert.ok(Math.abs(paybackDays(20) - 1.56) < 0.01, `20 级回本应 ≈1.56 天：${paybackDays(20).toFixed(3)}`);
  assert.ok(Math.abs(paybackDays(29) - 2.01) < 0.01, `29 级回本应 ≈2.01 天：${paybackDays(29).toFixed(3)}`);
});

test('世界树回本全程单调缓升、满级无墙（旧公式 29 级即 3953 天）', () => {
  let previous = 0;
  for (let level = 1; level <= 149; level += 1) {
    const days = paybackDays(level);
    assert.ok(days > previous, `${level} 级回本必须随等级单调上升（防「越升越划算」的负反馈）`);
    assert.ok(days < 6.5, `${level} 级回本 ${days.toFixed(2)} 天必须 < 6.5 天（无墙，v19 域至 150）`);
    previous = days;
  }
  // 存量域（1–99）维持 §3.1 锚定的 <5 天口径；延伸段（100–149）多项式成本温和爬升
  // （149 级约 5.4 天，远非旧指数墙），由世界树成本 ×0.2 实付与复刷 leaf 掉落对冲。
  for (let level = 1; level <= 99; level += 1) {
    assert.ok(paybackDays(level) < 5, `${level} 级回本应维持 < 5 天`);
  }
  // 成本规模：新公式 29 级成本比旧指数公式低三个数量级以上（517 万 vs 102 亿）
  const oldCost29 = 120_000 * Math.pow(1.5, 28);
  assert.ok(worldtreeCost(29).coins < oldCost29 / 1000, '新成本应比旧指数公式低三个数量级');
});

test('世界树升级消耗口径：exp 闸门 + 金币 ×0.2 + 精华全额（§2.3）', () => {
  const cost1 = worldtreeCost(1);
  assert.equal(cost1.coins, 28_000, '1 级金币成本 28000');
  assert.equal(cost1.leaves, 15, '1 级精华成本 15');
  assert.equal(Math.round(cost1.coins * 0.2), 5_600, '1 级升级实付金币 = 28000×0.2 = 5600');
  assert.equal(growthMultiplier(1), 1, '1 级成长系数为基线 1.0');
  assert.equal(Math.round(growthMultiplier(100) * 100) / 100, 2.6, '100 级成长系数 2.6');
  // v19 §2.5：100+ 级成长封顶 2.6 续用（等级域 150 下战力上限受控）
  assert.equal(Math.round(growthMultiplier(101) * 100) / 100, 2.6, '101 级成长系数封顶 2.6');
  assert.equal(Math.round(growthMultiplier(150) * 100) / 100, 2.6, '150 级成长系数封顶 2.6');
});

/* ------------------------------ 2. 挂机产出（§3.2） ------------------------------ */

test('挂机产出时薪与离线上限：金币/灵味原浆线性阶、经验随树等差、8/12 小时闸门', () => {
  const hours8 = 8 * 3600_000;
  const start = new Date('2026-11-03T00:00:00.000Z');
  const accrue = (level: number, hoursMs: number) => idleAccrual({
    worldtreeLevel: level,
    astrologyCount: 0,
    sinceIso: start.toISOString(),
    now: new Date(start.getTime() + hoursMs),
  });

  const level1 = accrue(1, hours8);
  assert.equal(level1.capHours, 8, '1 级离线上限 8 小时');
  assert.equal(level1.coins, 120_000, '1 级金币 8h = 15000×8');
  assert.equal(level1.potions, 33_600, '1 级灵味原浆 8h = 4200×8');
  assert.equal(level1.exp, 14_400, '1 级经验 8h = 1800×1×8');

  const level2 = accrue(2, 12 * 3600_000);
  assert.equal(level2.capHours, 12, '2 级起离线上限 12 小时');
  // bonus = 1 + 0.05×(树-1)（无星象）
  assert.equal(level2.coins, Math.floor(15_000 * 1.22 * 1.05 * 12), '2 级金币时薪 15000×1.22×bonus1.05');
  assert.equal(level2.exp, Math.floor(1800 * 2 * 1.05 * 12), '2 级经验时薪 1800×2×bonus1.05');

  // 超时截断：挂机 24h 只结算上限
  const capped = accrue(2, 24 * 3600_000);
  assert.equal(capped.hours, 12, '超时挂机按上限 12 小时截断');
  assert.equal(capped.coins, level2.coins, '超时不产生额外产出');
});

/* ------------------------------ 3. 战斗经验（§2.2） ------------------------------ */

test('战斗经验锚点：1-1 首通 234 / 复刷 78 / 碾压减半 39（round(锚/90) ± 首通 ×3 ± 1.5× 衰减）', () => {
  assert.equal(battleExpGain(7000, true, 9000), 234, '首通 = round(7000/90)×3');
  assert.equal(battleExpGain(7000, false, 9000), 78, '复刷 = round(7000/90)');
  assert.equal(battleExpGain(7000, true, 10_500), 117, '战力达锚×1.5 首通减半');
  assert.equal(battleExpGain(7000, false, 20_000), 39, '碾压复刷减半');
});

/* ------------------------------ 4. 任务经验总额（§2.2） ------------------------------ */

test('主线/成长任务 exp 奖励总额 = 4800（替代原 potion 奖励位，对应 1–30 段累计 5290 的大半）', () => {
  const rows = queryAll<{ reward_json: string }>('SELECT reward_json FROM quest_defs');
  const expTotal = rows
    .map(row => JSON.parse(row.reward_json) as Array<{ kind: string; amount: number }>)
    .flat()
    .filter(reward => reward.kind === 'exp')
    .reduce((sum, reward) => sum + reward.amount, 0);
  assert.equal(expTotal, 4_800, '任务 exp 总额应为 400+600+1300+2500 = 4800');

  // potion 回归「升星材料」定位：任务不再发放 potion（§2.4 经验药剂正名）
  const potionQuests = rows.filter(row => (JSON.parse(row.reward_json) as Array<{ kind: string }>).some(reward => reward.kind === 'potion'));
  assert.equal(potionQuests.length, 0, '任务不应再发放灵味原浆（升星材料走关卡/挂机/集市）');
});

/* ------------------------------ 5. 关卡锚点（§8） ------------------------------ */

/** 章节节奏表：该章压轴关对应的预期掌灶人等级与星级（依据 docs/main-quest-design.md 的等级线）。 */
const CHAPTER_PACE: Record<string, { level: number; star: number }> = {
  '第一章': { level: 5, star: 1 },
  '第二章': { level: 18, star: 2 },
  '第三章': { level: 31, star: 3 },
  '第四章': { level: 65, star: 4 },
  '终章': { level: 85, star: 5 },
  '无尽回廊': { level: 100, star: 5 },
};

test('关卡锚点：21 关严格递增，两端 7000 / 393000（§8 重校结果）', () => {
  const stages = queryAll<{ id: string; chapter: string; suggested_power: number }>(
    'SELECT id, chapter, suggested_power FROM stage_defs ORDER BY order_index',
  );
  assert.equal(stages.length, 21, 'v17 应恰好 21 关');
  assert.equal(stages[0].suggested_power, 7_000, '首关锚点 7000');
  assert.equal(stages[20].suggested_power, 393_000, '末关锚点 393000');
  for (let index = 1; index < stages.length; index += 1) {
    assert.ok(
      stages[index].suggested_power > stages[index - 1].suggested_power,
      `锚点必须严格递增：${stages[index].id} ≤ ${stages[index - 1].id}`,
    );
  }
});

test('锚点可达性：每关锚点 ≤ 参考可达战力 ×2（无装备口径，防数量级错标成墙）', () => {
  const stages = queryAll<{ id: string; chapter: string; suggested_power: number }>(
    'SELECT id, chapter, suggested_power FROM stage_defs ORDER BY order_index',
  );
  for (const stage of stages) {
    const pace = CHAPTER_PACE[stage.chapter];
    assert.ok(pace, `章节 ${stage.chapter} 缺少节奏表`);
    // 参考可达战力：3×SSR（基础 12000）× 星级系数 × 星象 6 层 × 成长系数，不含装备（装备补足差额）
    const reference = 3 * 12_000 * (1 + (pace.star - 1) * 0.28) * (1 + 6 * 0.02) * growthMultiplier(pace.level);
    assert.ok(
      stage.suggested_power <= reference * 2,
      `${stage.id} 锚点 ${stage.suggested_power} 超出参考战力（${Math.round(reference)}）×2，疑似不可达`,
    );
  }
});
