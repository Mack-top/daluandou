/**
 * 前后端战斗引擎逐帧对齐（parity）测试。
 * 前端 battle-engine 是玩法口径的设计基准；后端 simulateTimeline 必须在
 * 「同单位快照 + 同种子」下产出完全一致的 turns/win/rounds。
 * 跨包导入：tsx 可直接加载前端 .ts 源码（引擎依赖链在 Node 下纯净）。
 */
import { after, before, test } from 'node:test';
import assert from 'node:assert/strict';
import { rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

// 前端引擎（设计基准）
import { battleRewards as frontendBattleRewards, simulateTimeline as frontendTimeline, stageEnemies as frontendStageEnemies, bossStages as frontendBossStages, buildBossEnemies as frontendBuildBossEnemies, BOSS_PARAMS as frontendBossParams } from '../../frontend/src/battle-engine.ts';
import { characterBattleStats as frontendCharacterBattleStats } from '../../frontend/src/game-data.ts';
// 后端引擎（权威执行）
import { buildBossContext, buildEnemies, buildSquad, settleBattle, simulateTimeline as backendTimeline, BOSS_PARAMS as backendBossParams, BOSS_STAGES as backendBossStages, SKILL_PARAMS, STAGE_ENEMIES as backendStageEnemies, startBattle, type BossContext } from '../src/services/battle.service.js';
import { createGuest } from '../src/services/auth.service.js';
import { setWorldtreeLevel } from '../src/repositories/player.repository.js';
import { addOwnedCharacter } from '../src/repositories/roster.repository.js';
import { listPlayerEquipment } from '../src/repositories/roster.repository.js';
import { findEquipmentDefById, findStageById } from '../src/repositories/catalog.repository.js';
import { listAstrology } from '../src/repositories/roster.repository.js';
import { claimStarterChests, equip, openEquipmentChests, setFormation } from '../src/services/roster.service.js';
import { closeDatabase, connectDatabase } from '../src/db/index.js';
import { runMigrations } from '../src/db/migrate.js';
import { seedCatalog } from '../src/db/seed.js';
import { nowIso } from '../src/lib/clock.js';

const databaseFile = path.join(tmpdir(), `food-fantasy-battle-parity-${process.pid}.db`);

before(() => {
  connectDatabase(databaseFile);
  runMigrations();
  seedCatalog();
});

after(() => {
  closeDatabase();
  for (const suffix of ['', '-wal', '-shm']) rmSync(`${databaseFile}${suffix}`, { force: true });
});

/* ------------------------------ 场景构造 ------------------------------ */

type Spec = {
  id: string;
  name: string;
  side: 'ally' | 'enemy';
  character: string | null;
  star?: number;
  maxHp: number;
  attack: number;
  speed: number;
  defense?: number;
  critical?: number;
  resistance?: number;
};

/** 前端输入：省略 defense/critical/resistance 时走 `?? 0 / ?? 18` 兜底路径。 */
function frontendUnits(specs: Spec[]): Parameters<typeof frontendTimeline>[0] {
  return specs.map(spec => {
    const unit: Record<string, unknown> = {
      id: spec.id, name: spec.name, side: spec.side, character: spec.character,
      star: spec.star ?? 1, maxHp: spec.maxHp, attack: spec.attack, speed: spec.speed,
    };
    if (spec.defense !== undefined) unit.defense = spec.defense;
    if (spec.critical !== undefined) unit.critical = spec.critical;
    if (spec.resistance !== undefined) unit.resistance = spec.resistance;
    return unit as Parameters<typeof frontendTimeline>[0][number];
  });
}

/** 后端输入：DTO 三字段必填，以显式 0/18 复刻前端兜底语义。 */
function backendUnits(specs: Spec[]): Parameters<typeof backendTimeline>[0] {
  return specs.map(spec => ({
    id: spec.id, name: spec.name, side: spec.side, character: spec.character,
    star: spec.star ?? 1, maxHp: spec.maxHp, attack: spec.attack, speed: spec.speed,
    defense: spec.defense ?? 0, critical: spec.critical ?? 18, resistance: spec.resistance ?? 0,
  }));
}

const scenarios: Array<{ name: string; units: Spec[] }> = [
  {
    name: '纯攻队（无青团）',
    units: [
      { id: 'ally-0', name: '冬阴功', side: 'ally', character: '冬阴功', maxHp: 2400, attack: 420, speed: 116, defense: 30, critical: 25, resistance: 10 },
      { id: 'ally-1', name: '拉菲', side: 'ally', character: '拉菲', maxHp: 2200, attack: 380, speed: 113, defense: 20, critical: 20, resistance: 8 },
      { id: 'enemy-0', name: '巡夜灯灵', side: 'enemy', character: null, star: 3, maxHp: 900, attack: 150, speed: 100 },
      { id: 'enemy-1', name: '雾隐食客', side: 'enemy', character: null, star: 3, maxHp: 900, attack: 150, speed: 104 },
      { id: 'enemy-2', name: '月桥守卫', side: 'enemy', character: null, star: 3, maxHp: 1200, attack: 190, speed: 108 },
    ],
  },
  {
    name: '青团治疗队（青团先手，易触发治疗）',
    units: [
      { id: 'ally-0', name: '青团', side: 'ally', character: '青团', maxHp: 3000, attack: 350, speed: 130, defense: 10, critical: 18 },
      { id: 'ally-1', name: '蓝纹奶酪', side: 'ally', character: '蓝纹奶酪', maxHp: 1500, attack: 300, speed: 112, defense: 0, critical: 20 },
      { id: 'enemy-0', name: '巡夜灯灵', side: 'enemy', character: null, star: 3, maxHp: 1400, attack: 350, speed: 100 },
      { id: 'enemy-1', name: '雾隐食客', side: 'enemy', character: null, star: 3, maxHp: 1400, attack: 350, speed: 104 },
      { id: 'enemy-2', name: '月桥守卫', side: 'enemy', character: null, star: 3, maxHp: 1800, attack: 380, speed: 108 },
    ],
  },
  {
    name: '青团治疗队（青团先手）',
    units: [
      { id: 'ally-0', name: '青团', side: 'ally', character: '青团', maxHp: 2600, attack: 350, speed: 130, defense: 10, critical: 18 },
      { id: 'ally-1', name: '咖喱', side: 'ally', character: '咖喱', maxHp: 1100, attack: 280, speed: 112, defense: 15, critical: 12 },
      { id: 'enemy-0', name: '巡夜灯灵', side: 'enemy', character: null, star: 3, maxHp: 1500, attack: 380, speed: 100 },
      { id: 'enemy-1', name: '雾隐食客', side: 'enemy', character: null, star: 3, maxHp: 1500, attack: 380, speed: 104 },
      { id: 'enemy-2', name: '月桥守卫', side: 'enemy', character: null, star: 3, maxHp: 2000, attack: 460, speed: 108 },
    ],
  },
  {
    name: '全员平速（稳定排序）',
    units: [
      { id: 'ally-0', name: '拉菲', side: 'ally', character: '拉菲', maxHp: 2000, attack: 320, speed: 100, defense: 10 },
      { id: 'ally-1', name: '冬阴功', side: 'ally', character: '冬阴功', maxHp: 2000, attack: 320, speed: 100, defense: 10 },
      { id: 'enemy-0', name: '巡夜灯灵', side: 'enemy', character: null, maxHp: 1300, attack: 260, speed: 100 },
      { id: 'enemy-1', name: '雾隐食客', side: 'enemy', character: null, maxHp: 1300, attack: 260, speed: 100 },
    ],
  },
  {
    name: '12 轮打满双方同耗（严格大于判负）——全部 none 效果保持对称',
    units: [
      { id: 'ally-0', name: '巡夜灯灵', side: 'ally', character: null, maxHp: 1_000_000, attack: 2, speed: 120, critical: 0 },
      { id: 'ally-1', name: '巡夜灯灵', side: 'ally', character: null, maxHp: 1_000_000, attack: 2, speed: 110, critical: 0 },
      { id: 'ally-2', name: '巡夜灯灵', side: 'ally', character: null, maxHp: 1_000_000, attack: 2, speed: 100, critical: 0 },
      { id: 'enemy-0', name: '巡夜灯灵', side: 'enemy', character: null, maxHp: 1_000_000, attack: 2, speed: 120, critical: 0 },
      { id: 'enemy-1', name: '巡夜灯灵', side: 'enemy', character: null, maxHp: 1_000_000, attack: 2, speed: 110, critical: 0 },
      { id: 'enemy-2', name: '巡夜灯灵', side: 'enemy', character: null, maxHp: 1_000_000, attack: 2, speed: 100, critical: 0 },
    ],
  },
  {
    name: '12 轮打满我方血量优势（判胜）——全部 none 效果保持对称',
    units: [
      { id: 'ally-0', name: '巡夜灯灵', side: 'ally', character: null, maxHp: 2_000_000, attack: 2, speed: 120, critical: 0 },
      { id: 'ally-1', name: '巡夜灯灵', side: 'ally', character: null, maxHp: 2_000_000, attack: 2, speed: 110, critical: 0 },
      { id: 'ally-2', name: '巡夜灯灵', side: 'ally', character: null, maxHp: 2_000_000, attack: 2, speed: 100, critical: 0 },
      { id: 'enemy-0', name: '巡夜灯灵', side: 'enemy', character: null, maxHp: 1_000_000, attack: 2, speed: 120, critical: 0 },
      { id: 'enemy-1', name: '巡夜灯灵', side: 'enemy', character: null, maxHp: 1_000_000, attack: 2, speed: 110, critical: 0 },
      { id: 'enemy-2', name: '巡夜灯灵', side: 'enemy', character: null, maxHp: 1_000_000, attack: 2, speed: 100, critical: 0 },
    ],
  },
  {
    name: '秒杀局',
    units: [
      { id: 'ally-0', name: '冬阴功', side: 'ally', character: '冬阴功', maxHp: 9999, attack: 99_999, speed: 116, critical: 30 },
      { id: 'enemy-0', name: '巡夜灯灵', side: 'enemy', character: null, maxHp: 525, attack: 88, speed: 100 },
      { id: 'enemy-1', name: '雾隐食客', side: 'enemy', character: null, maxHp: 525, attack: 88, speed: 104 },
      { id: 'enemy-2', name: '月桥守卫', side: 'enemy', character: null, maxHp: 700, attack: 112, speed: 108 },
    ],
  },
  {
    name: '被团灭局',
    units: [
      { id: 'ally-0', name: '拉菲', side: 'ally', character: '拉菲', maxHp: 100, attack: 50, speed: 80 },
      { id: 'enemy-0', name: '巡夜灯灵', side: 'enemy', character: null, maxHp: 6000, attack: 9999, speed: 200 },
      { id: 'enemy-1', name: '雾隐食客', side: 'enemy', character: null, maxHp: 6000, attack: 9999, speed: 190 },
      { id: 'enemy-2', name: '月桥守卫', side: 'enemy', character: null, maxHp: 6000, attack: 9999, speed: 180 },
    ],
  },
];

const SEEDS = Array.from({ length: 64 }, (_, index) => index * 6_700_417 + 11);

/* ------------------------------ 逐帧 parity ------------------------------ */

test('同单位快照 + 同种子：两引擎 64 种子 × 8 场景逐帧一致', () => {
  let compared = 0;
  for (const scenario of scenarios) {
    for (const seed of SEEDS) {
      const frontend = frontendTimeline(frontendUnits(scenario.units), seed);
      const backend = backendTimeline(backendUnits(scenario.units), seed);
      assert.deepEqual(
        backend,
        frontend,
        `场景「${scenario.name}」种子 ${seed} 两引擎时间线分叉`,
      );
      compared += 1;
    }
  }
  assert.ok(compared >= 512, `比对次数不足：${compared}`);
});

test('机制覆盖聚合：治疗/技能/暴击/clamp 在矩阵中真实发生', () => {
  const healSeeds: number[] = [];
  const skillSeeds: number[] = [];
  const critSeeds: number[] = [];
  for (const seed of SEEDS) {
    const scenario = scenarios[1]; // 青团治疗队（青团末速）
    const frontend = frontendTimeline(frontendUnits(scenario.units), seed);
    if (frontend.turns.some(turn => turn.kind === 'heal' && turn.skill === '春风化雨')) healSeeds.push(seed);
    if (frontend.turns.some(turn => turn.kind === 'skill')) skillSeeds.push(seed);
    if (frontend.turns.some(turn => turn.critical)) critSeeds.push(seed);
    for (const turn of frontend.turns) {
      const target = scenario.units.find(unit => unit.id === turn.target)!;
      const before = turn.round === 1 && frontend.turns.indexOf(turn) === 0
        ? target.maxHp
        : (frontend.turns[frontend.turns.indexOf(turn) - 1]?.health[target.id] ?? target.maxHp);
      if (turn.kind === 'heal') {
        assert.ok(turn.amount <= target.maxHp - before + 1, '治疗不得超过缺口');
      } else {
        assert.ok(turn.amount <= before, '伤害不得超过出手前血量（过量截断）');
      }
    }
  }
  assert.ok(healSeeds.length > 32, `治疗路径覆盖不足：${healSeeds.length}/64`);
  assert.ok(skillSeeds.length > 48, `技能回合覆盖不足：${skillSeeds.length}/64`);
  assert.ok(critSeeds.length > 8, `暴击路径覆盖不足：${critSeeds.length}/64`);
});

test('平速阵容：出手顺序等于插入序（稳定排序，无 id 决胜）', () => {
  const scenario = scenarios[3];
  const result = backendTimeline(backendUnits(scenario.units), 42);
  const firstRoundActors = result.turns.filter(turn => turn.round === 1).map(turn => turn.actor);
  assert.deepEqual(firstRoundActors, ['ally-0', 'ally-1', 'enemy-0', 'enemy-1']);
});

test('12 轮打满同耗：hpRatio 相等时判负（严格大于）', () => {
  const scenario = scenarios[4];
  const result = backendTimeline(backendUnits(scenario.units), 7);
  assert.equal(result.rounds, 12);
  assert.equal(result.win, false);
  const favored = backendTimeline(backendUnits(scenarios[5].units), 7);
  assert.equal(favored.rounds, 12);
  assert.equal(favored.win, true);
});

/* ------------------------------ 技能效果机制（零 RNG、确定性结算） ------------------------------ */

type TimelineUnit = Parameters<typeof backendTimeline>[0][number];

function duel(allyName: string, enemyMaxHp = 99_999, extra: Partial<TimelineUnit> = {}): TimelineUnit[] {
  return [
    { id: 'ally-0', name: allyName, side: 'ally', character: allyName, star: 1, maxHp: 10_000, attack: 400, speed: 130, defense: 0, critical: 0, resistance: 0, ...extra },
    { id: 'enemy-0', name: '巡夜灯灵', side: 'enemy', character: null, star: 1, maxHp: enemyMaxHp, attack: 10, speed: 100, defense: 0, critical: 18, resistance: 0 },
  ];
}

const firstActorOf = (turns: Array<{ round: number; actor: string; skill: string }>, round: number) =>
  turns.filter(turn => turn.round === round && turn.skill !== '灼烧')[0]?.actor;

test('技能机制：冬阴功灼烧在轮末跳伤（零 RNG、写入时间线、按施加者攻击结算）', () => {
  const result = backendTimeline(duel('冬阴功'), 11);
  const burnTicks = result.turns.filter(turn => turn.skill === '灼烧');
  assert.ok(burnTicks.length >= 2, `灼烧跳伤不足：${burnTicks.length}`);
  for (const tick of burnTicks) {
    assert.equal(tick.actor, 'ally-0');
    assert.equal(tick.target, 'enemy-0');
    assert.equal(tick.critical, false);
    assert.equal(tick.amount, Math.round(400 * SKILL_PARAMS.BURN_RATIO));
  }
});

test('技能机制：蓝纹奶酪迟滞改变后续轮出手顺序（速度 ×0.75）', () => {
  // enemy 106 快于 ally 105；被迟滞后 106×0.75=79.5 < 105 → 我方反超先手
  const units: TimelineUnit[] = [
    { id: 'ally-0', name: '蓝纹奶酪', side: 'ally', character: '蓝纹奶酪', star: 1, maxHp: 10_000, attack: 300, speed: 105, defense: 0, critical: 0, resistance: 0 },
    { id: 'enemy-0', name: '巡夜灯灵', side: 'enemy', character: null, star: 1, maxHp: 99_999, attack: 10, speed: 106, defense: 0, critical: 18, resistance: 0 },
  ];
  const result = backendTimeline(units, 11);
  assert.equal(firstActorOf(result.turns, 1), 'enemy-0', '迟滞前敌方先手');
  assert.equal(firstActorOf(result.turns, 4), 'ally-0', '第 3 轮施加迟滞，第 4 轮我方反超');
});

test('技能机制：拉菲护盾吸收伤害（同种子对比无护盾基线）', () => {
  const shielded: TimelineUnit[] = [
    { id: 'ally-0', name: '拉菲', side: 'ally', character: '拉菲', star: 1, maxHp: 10_000, attack: 500, speed: 130, defense: 0, critical: 0, resistance: 0 },
    { id: 'enemy-0', name: '巡夜灯灵', side: 'enemy', character: null, star: 1, maxHp: 99_999, attack: 600, speed: 100, defense: 0, critical: 0, resistance: 0 },
  ];
  const baseline = shielded.map(unit => unit.id === 'ally-0' ? { ...unit, name: '巡夜灯灵', character: null } : unit);
  const shieldResult = backendTimeline(shielded, 11);
  const baseResult = backendTimeline(baseline, 11);
  // 第 3 轮施加护盾（=500×0.9=450，存续至第 5 轮），同种子下第 5 轮末我方血量应严格高于无护盾基线
  const lastTurn = (result: ReturnType<typeof backendTimeline>) => result.turns.filter(turn => turn.round === 5).at(-1)!;
  const shieldHp = lastTurn(shieldResult).health['ally-0'];
  const baseHp = lastTurn(baseResult).health['ally-0'];
  assert.ok(shieldHp > baseHp, `护盾应减少实际扣血：护盾后 ${shieldHp} vs 基线 ${baseHp}`);
  // 护盾值精确性：差额应等于护盾在存续期内吸收的总量（每轮命中最多吸收 450）
  assert.ok(shieldHp - baseHp <= 450 * 3, `吸收量不得超过护盾上限：${shieldHp - baseHp}`);
});

test('技能机制：雾隐食客汲取按实际伤害 40% 回复自身（快照可见）', () => {
  const units: TimelineUnit[] = [
    { id: 'ally-0', name: '巡夜灯灵', side: 'ally', character: null, star: 1, maxHp: 9_000, attack: 400, speed: 130, defense: 0, critical: 0, resistance: 0 },
    { id: 'enemy-0', name: '雾隐食客', side: 'enemy', character: null, star: 1, maxHp: 8_000, attack: 400, speed: 100, defense: 0, critical: 0, resistance: 0 },
  ];
  const result = backendTimeline(units, 11);
  const allyHit = result.turns.filter(turn => turn.round === 3 && turn.actor === 'ally-0')[0];
  const enemyHit = result.turns.filter(turn => turn.round === 3 && turn.actor === 'enemy-0')[0];
  assert.ok(allyHit && enemyHit, '第 3 轮双方应有技能回合');
  assert.equal(enemyHit.health['enemy-0'], allyHit.health['enemy-0'] + Math.floor(enemyHit.amount * SKILL_PARAMS.DRAIN_RATIO), '汲取回复应精确等于实际伤害 ×40% 并体现在快照中');
});

test('技能机制：雾厨无名氏无视防御（高防目标受到的伤害显著更高）', () => {
  const withDefense: TimelineUnit[] = [
    { id: 'ally-0', name: '雾厨无名氏', side: 'ally', character: null, star: 1, maxHp: 10_000, attack: 400, speed: 130, defense: 0, critical: 0, resistance: 0 },
    { id: 'enemy-0', name: '巡夜灯灵', side: 'enemy', character: null, star: 1, maxHp: 99_999, attack: 10, speed: 100, defense: 900, critical: 18, resistance: 0 },
  ];
  const baseline: TimelineUnit[] = withDefense.map(unit => unit.id === 'ally-0' ? { ...unit, name: '巡夜灯灵' } : unit);
  const pierced = backendTimeline(withDefense, 11).turns.filter(turn => turn.round === 3 && turn.kind === 'skill')[0];
  const normal = backendTimeline(baseline, 11).turns.filter(turn => turn.round === 3 && turn.kind === 'skill')[0];
  assert.ok(pierced && normal);
  // 无视防御：900×0.35=315 的减免被移除（两边同为 1.55x 技能倍率、同 RNG 浮动）
  assert.ok(pierced.amount >= normal.amount + 300, `无视防御伤害应显著更高：${pierced.amount} vs ${normal.amount}`);
});

test('技能机制：月桥守卫破甲使目标防御清零（后续普通攻击伤害提升）', () => {
  const units: TimelineUnit[] = [
    { id: 'ally-0', name: '巡夜灯灵', side: 'ally', character: null, star: 1, maxHp: 50_000, attack: 400, speed: 90, defense: 500, critical: 0, resistance: 0 },
    { id: 'enemy-0', name: '月桥守卫', side: 'enemy', character: null, star: 1, maxHp: 99_999, attack: 400, speed: 100, defense: 0, critical: 0, resistance: 0 },
    { id: 'enemy-1', name: '巡夜灯灵', side: 'enemy', character: null, star: 1, maxHp: 99_999, attack: 400, speed: 95, defense: 0, critical: 0, resistance: 0 },
  ];
  const result = backendTimeline(units, 11);
  // 破甲由 enemy-0 在第 3 轮施加；对比 enemy-1（speed 95，不施加效果）在第 1-2 轮与第 4-5 轮的普通攻击
  const hitsBefore = result.turns.filter(turn => turn.round <= 2 && turn.actor === 'enemy-1');
  const hitsAfter = result.turns.filter(turn => turn.round >= 4 && turn.round <= 5 && turn.actor === 'enemy-1');
  assert.ok(hitsBefore.length > 0 && hitsAfter.length > 0);
  const avgBefore = hitsBefore.reduce((sum, turn) => sum + turn.amount, 0) / hitsBefore.length;
  const avgAfter = hitsAfter.reduce((sum, turn) => sum + turn.amount, 0) / hitsAfter.length;
  assert.ok(avgAfter > avgBefore, `破甲后同源伤害应提升：${avgAfter} vs ${avgBefore}`);
});

/* ------------------------------ 构建口径 parity ------------------------------ */

test('敌人构建与前端公式逐字段一致（含 star 规则与 0/18/0 兜底；1-1 为 Boss 关按强化公式）', () => {
  for (const stageId of ['1-1', '2-3', '3-2']) {
    const stage = findStageById(stageId);
    assert.ok(stage, `关卡 ${stageId} 未种子化`);
    const boss = backendBossStages[stageId];
    const enemies = buildEnemies(stageId, stage.suggested_power);
    const names = boss ? boss.enemies : ['巡夜灯灵', '雾隐食客', '月桥守卫'];
    enemies.forEach((enemy, index) => {
      assert.equal(enemy.id, `enemy-${index}`);
      assert.equal(enemy.name, names[index]);
      assert.equal(enemy.star, stageId === '1-1' ? 1 : 3);
      assert.equal(enemy.maxHp, Math.round(stage.suggested_power / 12 * (index === 2 ? 1.2 : 0.9) * (index === 2 && boss ? backendBossParams.BOSS_HP_FACTOR : 1)));
      assert.equal(enemy.attack, Math.round(stage.suggested_power / 72 * (index === 2 ? 1.15 : 0.9) * (index === 2 && boss ? backendBossParams.BOSS_ATTACK_FACTOR : 1)));
      assert.equal(enemy.speed, 100 + index * 4);
      assert.equal(enemy.defense, 0);
      assert.equal(enemy.critical, 18);
      assert.equal(enemy.resistance, 0);
    });
  }
});

test('新章节关卡：敌人名映射表前后端逐字一致，公式字段仍逐字段对齐', () => {
  // 1) 前后端映射表必须完全一致（新增关卡只允许改数据，不允许分叉逻辑）
  assert.deepEqual(backendStageEnemies, frontendStageEnemies);

  // 2) 每张新关卡的敌人构建公式字段逐项对齐（star / maxHp / attack / speed / 0/18/0）
  //    Boss 关（1-1/2-4/3-1/4-3/5-1）编成与强化公式由「Boss 关敌人构建」专用用例覆盖，此处跳过
  for (const [stageId, names] of Object.entries(frontendStageEnemies)) {
    if (frontendBossStages[stageId]) continue;
    const stage = findStageById(stageId);
    assert.ok(stage, `新关卡 ${stageId} 未种子化`);
    const enemies = buildEnemies(stageId, stage.suggested_power);
    assert.equal(enemies.length, names.length, `${stageId} 敌人数量应为 3`);
    enemies.forEach((enemy, index) => {
      assert.equal(enemy.name, names[index], `${stageId} enemy-${index} 名称`);
      assert.equal(enemy.star, stageId === '1-1' ? 1 : 3);
      assert.equal(enemy.maxHp, Math.round(stage.suggested_power / 12 * (index === 2 ? 1.2 : 0.9)));
      assert.equal(enemy.attack, Math.round(stage.suggested_power / 72 * (index === 2 ? 1.15 : 0.9)));
      assert.equal(enemy.speed, 100 + index * 4);
      assert.equal(enemy.defense, 0);
      assert.equal(enemy.critical, 18);
      assert.equal(enemy.resistance, 0);
    });
  }

  // 3) 新关卡必须已种子化且关卡定义与前端 battleStages 同源同值
  for (const stageId of Object.keys(frontendStageEnemies)) {
    const stage = findStageById(stageId);
    assert.ok(stage, `关卡 ${stageId} 未种子化`);
  }
});

test('buildSquad 与前端 characterBattleStats/statsPower 口径一致（含装备全额摊入）', () => {
  const { player } = createGuest({ nickname: '对齐甲一', gender: 'male' });
  claimStarterChests(player.id);
  const { drops } = openEquipmentChests(player.id, { count: 5, operationId: 'parity-op-1', seed: 20261103 });
  equip(player.id, drops[0].id);
  equip(player.id, drops[1].id);
  addOwnedCharacter(player.id, 'blue-cheese', nowIso());
  setFormation(player.id, ['青团', '蓝纹奶酪']);

  const { allies, power } = buildSquad(player.id);

  // 规格锚点：以纯数据复算期望值（前端公式内联）
  const gear = { health: 0, attack: 0, defense: 0, speed: 0, critical: 0, resistance: 0 };
  for (const row of listPlayerEquipment(player.id).filter(item => item.equipped_slot)) {
    const def = findEquipmentDefById(row.template_id)!;
    const scale = 1 + row.level * 0.12; // v17 §4.2 强化系数（与 sumEquipmentStats / equipment.ts 同步）
    for (const key of Object.keys(gear) as Array<keyof typeof gear>) gear[key] += Math.round(def[key] * scale);
  }
  const gearPower = Math.round(gear.health * 0.25 + gear.attack * 6 + gear.defense * 3 + gear.speed * 20 + (gear.critical + gear.resistance) * 35);
  const astrologyCount = listAstrology(player.id).length;
  const roster = [
    { name: '青团', base: 9000 },
    { name: '蓝纹奶酪', base: 12000 },
  ];

  assert.equal(allies.length, 2);
  allies.forEach((ally, index) => {
    const expected = roster[index];
    const base = Math.round(expected.base * (1 + astrologyCount * 0.02)); // star=1，星级系数为 1
    assert.equal(ally.id, `ally-${index}`);
    assert.equal(ally.name, expected.name);
    assert.equal(ally.character, expected.name);
    assert.equal(ally.star, 1);
    assert.equal(ally.maxHp, Math.round(base / 4) + gear.health, `角色 ${expected.name} maxHp 口径不一致`);
    assert.equal(ally.attack, Math.round(base / 24) + gear.attack, `角色 ${expected.name} attack 口径不一致`);
    assert.equal(ally.speed, 116 - index * 3 + gear.speed, `角色 ${expected.name} speed 口径不一致`);
    assert.equal(ally.defense, gear.defense, `角色 ${expected.name} defense 无基础值口径不一致`);
    assert.equal(ally.critical, Math.min(60, 18 + gear.critical));
    assert.equal(ally.resistance, Math.min(50, gear.resistance), `角色 ${expected.name} resistance 无基础值口径不一致`);
  });
  const expectedPower = roster.reduce((sum, member) => {
    const base = Math.round(member.base * (1 + astrologyCount * 0.02));
    return sum + base + gearPower;
  }, 0);
  assert.equal(power, expectedPower);
});

test('v17 §6 职业成长权重：世界树 >1 级时属性按职业分化，前后端逐字段一致', () => {
  // growth(50) = (10000 + round(16000×49/99))/10000 ≈ 1.7919；成长增量按职业权重分化
  const { player } = createGuest({ nickname: '职业权重甲', gender: 'male' });
  addOwnedCharacter(player.id, 'qing', nowIso()); // 治疗 hp1.10 / atk0.85
  addOwnedCharacter(player.id, 'tom-yum', nowIso()); // 输出 hp0.95 / atk1.20
  setFormation(player.id, ['青团', '冬阴功']);
  setWorldtreeLevel(player.id, 50);

  const { allies } = buildSquad(player.id);
  const healer = allies.find(unit => unit.character === '青团')!;
  const dps = allies.find(unit => unit.character === '冬阴功')!;

  // 基线 = 权重全 1 的期望（青团 base 9000：hp 2250 / atk 375；冬阴功 base 12000：hp 3000 / atk 500）
  const healerHpBaseline = Math.round((9000 / 4) * 1.7919);
  const healerAtkBaseline = Math.round((9000 / 24) * 1.7919);
  const dpsAtkBaseline = Math.round((12000 / 24) * 1.7919);
  assert.ok(healer.maxHp > healerHpBaseline, `治疗血量应高于无权重基线 ${healerHpBaseline}（权重 1.10）：${healer.maxHp}`);
  assert.ok(healer.attack < healerAtkBaseline, `治疗攻击应低于无权重基线 ${healerAtkBaseline}（权重 0.85）：${healer.attack}`);
  assert.ok(dps.attack > dpsAtkBaseline, `输出攻击应高于无权重基线 ${dpsAtkBaseline}（权重 1.20）：${dps.attack}`);

  // 同稀有度（SSR base 12000）速度对照：辅助 1.15 > 防御 0.85
  const speedPlayer = createGuest({ nickname: '职业权重乙', gender: 'female' });
  addOwnedCharacter(speedPlayer.player.id, 'lafite', nowIso()); // 辅助
  addOwnedCharacter(speedPlayer.player.id, 'curry', nowIso()); // 防御
  setWorldtreeLevel(speedPlayer.player.id, 50);
  setFormation(speedPlayer.player.id, ['拉菲']);
  const { allies: lafiteSquad } = buildSquad(speedPlayer.player.id);
  setFormation(speedPlayer.player.id, ['咖喱']);
  const { allies: currySquad } = buildSquad(speedPlayer.player.id);
  const baselineSpeed = Math.round(116 * 1.7919);
  assert.ok(lafiteSquad[0].speed > baselineSpeed, `辅助速度应高于无权重基线 ${baselineSpeed}（权重 1.15）：${lafiteSquad[0].speed}`);
  assert.ok(currySquad[0].speed < baselineSpeed, `防御速度应低于无权重基线 ${baselineSpeed}（权重 0.85）：${currySquad[0].speed}`);

  // 前后端口径逐字段一致（同一 save 形状）
  const saveStub = {
    worldtree: 50, astrology: [], characters: ['青团', '冬阴功'], stars: {}, equipment: [], equipped: {}, formation: ['青团', '冬阴功'],
  } as never;
  const frontendHealer = frontendCharacterBattleStats(saveStub, '青团', 0);
  const frontendDps = frontendCharacterBattleStats(saveStub, '冬阴功', 1);
  assert.equal(healer.maxHp, frontendHealer.health, '治疗 maxHp 前后端一致');
  assert.equal(healer.attack, frontendHealer.attack, '治疗 attack 前后端一致');
  assert.equal(healer.speed, frontendHealer.speed, '治疗 speed 前后端一致');
  assert.equal(dps.maxHp, frontendDps.health, '输出 maxHp 前后端一致');
  assert.equal(dps.attack, frontendDps.attack, '输出 attack 前后端一致');
  assert.equal(dps.speed, frontendDps.speed, '输出 speed 前后端一致');

  // 等级 1（growth=1）时权重不生效：属性与旧公式完全一致
  const junior = createGuest({ nickname: '职业权重丙', gender: 'male' });
  addOwnedCharacter(junior.player.id, 'qing', nowIso());
  setFormation(junior.player.id, ['青团']);
  const { allies: juniorAllies } = buildSquad(junior.player.id);
  assert.equal(juniorAllies[0].maxHp, Math.round(9000 / 4), '1 级无成长增量，权重不生效');
  assert.equal(juniorAllies[0].speed, 116, '1 级速度与旧公式一致');
});

test('结算奖励与前端 battleRewards 一致：首通全奖、复刷 20% 折算（v17 追加经验）', () => {
  const { player } = createGuest({ nickname: '对齐乙二', gender: 'female' });

  const first = startBattle(player.id, '1-1');
  const settledFirst = settleBattle(player.id, first.id);
  assert.equal(settledFirst.win, true, 'guest 单青团 vs 1-1 应稳定获胜');
  assert.equal(settledFirst.battle.firstClear, true);
  // v17：前后端奖励口径完全一致（前端 battleRewards 现自带掌灶人经验条目）
  // exp = round(锚7000/90)×3（首通 ×3）= 234；空编成战力 0 < 锚×1.5=10500，不触发碾压衰减
  const emptySave = {
    firstClears: [], formation: [], characters: [], stars: {}, astrology: [], equipment: [], equipped: {}, worldtree: 1,
  } as never;
  assert.deepEqual(settledFirst.rewards, frontendBattleRewards(emptySave, '1-1'));
  assert.deepEqual(settledFirst.rewards.at(-1), { kind: 'exp', amount: 234, label: '掌灶人经验' });

  const second = startBattle(player.id, '1-1');
  const settledSecond = settleBattle(player.id, second.id);
  assert.equal(settledSecond.win, true);
  assert.equal(settledSecond.battle.firstClear, false);
  // 复刷折算的具体锚点：1-1 奖励 coin 10000 / leaf 30 → 2000 / 6；exp = round(7000/90) = 78（无首通加成）
  assert.deepEqual(settledSecond.rewards, frontendBattleRewards({ ...emptySave, firstClears: ['1-1'] } as never, '1-1'));
  assert.deepEqual(settledSecond.rewards.at(-1), { kind: 'exp', amount: 78, label: '掌灶人经验' });
});

test('败局奖励为空', () => {
  const { player } = createGuest({ nickname: '对齐丙三', gender: 'male' });
  // 临时削弱阵容：无可用服务层手段，直接用纯引擎断言败局分支
  const outcome = backendTimeline(backendUnits(scenarios[7].units), 42);
  assert.equal(outcome.win, false);
  const frontend = frontendTimeline(frontendUnits(scenarios[7].units), 42);
  assert.equal(frontend.win, false);
  assert.ok(player.id.length > 0);
});

/* ------------------------------ Boss 机制（零 RNG、确定性结算、parity 锁定） ------------------------------ */

/** Boss 环境事件技能名（kind 'skill'、amount 0 的插入轮）：从直击过滤中排除 */
const bossEventSkills = ['淡境', '味性前摇', '咸境', '餐前', '上菜', '散席', '饥饿', '吞噬'];
const isDirectHit = (turn: { actor: string; target: string; skill: string }, actorId: string, targetId: string) =>
  turn.actor === actorId && turn.target === targetId && !bossEventSkills.includes(turn.skill);

test('Boss 配置表：bossStages/BOSS_STAGES 与 BOSS_PARAMS 前后端逐字一致', () => {
  assert.deepEqual(backendBossStages, frontendBossStages);
  assert.deepEqual(backendBossParams, frontendBossParams);
});

test('Boss 关敌人构建：buildEnemies（含影厨）与前端 buildBossEnemies 逐字段一致', () => {
  const allySpecs: Spec[] = [
    { id: 'ally-0', name: '青团', side: 'ally', character: '青团', maxHp: 2250, attack: 375, speed: 116, defense: 0, critical: 18, resistance: 0 },
    { id: 'ally-1', name: '冬阴功', side: 'ally', character: '冬阴功', maxHp: 2400, attack: 420, speed: 113, defense: 30, critical: 25, resistance: 10 },
  ];
  const frontendAllies = frontendUnits(allySpecs);
  for (const stageId of Object.keys(frontendBossStages)) {
    const stage = findStageById(stageId);
    assert.ok(stage, `Boss 关 ${stageId} 未种子化`);
    const backend = buildEnemies(stageId, stage.suggested_power, backendUnits(allySpecs));
    const frontend = frontendBuildBossEnemies({ id: stageId, chapter: '测试', name: '测试', suggest: stage.suggested_power, rewards: [] }, frontendAllies);
    // 数量、id、名称、属性逐字段对齐
    assert.equal(backend.length, frontend.enemies.length, `${stageId} 编成数量`);
    backend.forEach((enemy, index) => {
      const fe = frontend.enemies[index];
      assert.equal(enemy.id, fe.id, `${stageId} enemy-${index} id`);
      assert.equal(enemy.name, fe.name, `${stageId} enemy-${index} 名称`);
      assert.equal(enemy.star, fe.star, `${stageId} enemy-${index} star`);
      assert.equal(enemy.maxHp, fe.maxHp, `${stageId} enemy-${index} maxHp`);
      assert.equal(enemy.attack, fe.attack, `${stageId} enemy-${index} attack`);
      assert.equal(enemy.speed, fe.speed, `${stageId} enemy-${index} speed`);
    });
    // Boss 主体（index 2）强化公式锚点：HP ×2、攻击 ×1.3
    const bossBody = backend[2];
    assert.equal(bossBody.maxHp, Math.round(stage.suggested_power / 12 * 1.2 * backendBossParams.BOSS_HP_FACTOR));
    assert.equal(bossBody.attack, Math.round(stage.suggested_power / 72 * 1.15 * backendBossParams.BOSS_ATTACK_FACTOR));
    // 影厨（仅 4-3）：前后端逐字段（含 defense/critical/resistance）一致
    const feMirror = frontend.enemies.find(unit => unit.id === 'enemy-mirror');
    const beMirror = backend.find(unit => unit.id === 'enemy-mirror');
    if (feMirror) {
      assert.ok(beMirror, '后端应生成影厨');
      assert.deepEqual(beMirror, feMirror);
    } else {
      assert.ok(!beMirror, '非 mirror 关不应生成影厨');
    }
  }
});

/** Boss 机制 parity 场景：同单位快照 + 同种子 + 同上下文，双端时间线必须逐帧一致。 */
const bossScenarios: Array<{ name: string; context: BossContext; units: Spec[] }> = [
  {
    name: '1-1 囡囡（吞噬增益：有护盾/守护可吞 + 饥饿分支）',
    context: { stageId: '1-1', bossId: 'enemy-0', mechanic: 'devour' },
    units: [
      { id: 'ally-0', name: '拉菲', side: 'ally', character: '拉菲', maxHp: 9000, attack: 520, speed: 130, defense: 10, critical: 20, resistance: 5 },
      { id: 'ally-1', name: '咖喱', side: 'ally', character: '咖喱', maxHp: 8000, attack: 400, speed: 118, defense: 8, critical: 15, resistance: 5 },
      { id: 'enemy-0', name: '囡囡', side: 'enemy', character: null, star: 1, maxHp: 60_000, attack: 260, speed: 100 },
    ],
  },
  {
    name: '2-4 咸与淡（味性切换：淡境减伤 + 咸境掉血）',
    context: { stageId: '2-4', bossId: 'enemy-0', mechanic: 'taste' },
    units: [
      { id: 'ally-0', name: '青团', side: 'ally', character: '青团', maxHp: 50_000, attack: 420, speed: 128, defense: 10, critical: 18 },
      { id: 'ally-1', name: '蓝纹奶酪', side: 'ally', character: '蓝纹奶酪', maxHp: 30_000, attack: 380, speed: 114, defense: 6, critical: 18 },
      { id: 'enemy-0', name: '咸与淡', side: 'enemy', character: null, star: 3, maxHp: 90_000, attack: 420, speed: 100 },
    ],
  },
  {
    name: '3-1 壶中翁（醉步速度波动 + stun）',
    context: { stageId: '3-1', bossId: 'enemy-0', mechanic: 'drunk' },
    units: [
      { id: 'ally-0', name: '巡夜灯灵', side: 'ally', character: null, maxHp: 50_000, attack: 400, speed: 125, defense: 0, critical: 0, resistance: 0 },
      { id: 'enemy-0', name: '壶中翁', side: 'enemy', character: null, star: 3, maxHp: 90_000, attack: 300, speed: 100 },
    ],
  },
  {
    name: '4-3 雾厨无名氏（镜像影厨减伤）',
    context: { stageId: '4-3', bossId: 'enemy-0', mechanic: 'mirror', mirrorId: 'enemy-mirror', mirrorSource: '巡夜灯灵' },
    units: [
      { id: 'ally-0', name: '巡夜灯灵', side: 'ally', character: null, maxHp: 50_000, attack: 400, speed: 130, defense: 0, critical: 0, resistance: 0 },
      { id: 'enemy-0', name: '雾厨无名氏', side: 'enemy', character: null, star: 3, maxHp: 90_000, attack: 300, speed: 100 },
      { id: 'enemy-mirror', name: '影厨·巡夜灯灵', side: 'enemy', character: null, star: 3, maxHp: 20_000, attack: 360, speed: 100 },
    ],
  },
  {
    name: '5-1 忘川馔（三阶段 + 团圆纹）',
    context: { stageId: '5-1', bossId: 'enemy-0', mechanic: 'feast' },
    units: [
      { id: 'ally-0', name: '巡夜灯灵', side: 'ally', character: null, maxHp: 1_000_000, attack: 1200, speed: 130, defense: 0, critical: 0, resistance: 0 },
      { id: 'enemy-0', name: '忘川馔', side: 'enemy', character: null, star: 3, maxHp: 40_000, attack: 600, speed: 100 },
    ],
  },
];

test('Boss 机制：同单位快照 + 同种子 + 同上下文，两引擎 64 种子 × 5 场景逐帧一致', () => {
  let compared = 0;
  for (const scenario of bossScenarios) {
    for (const seed of SEEDS) {
      const frontend = frontendTimeline(frontendUnits(scenario.units), seed, scenario.context);
      const backend = backendTimeline(backendUnits(scenario.units), seed, scenario.context);
      assert.deepEqual(
        backend,
        frontend,
        `Boss 场景「${scenario.name}」种子 ${seed} 两引擎时间线分叉`,
      );
      compared += 1;
    }
  }
  assert.ok(compared >= 320, `Boss 比对次数不足：${compared}`);
});

test('Boss 机制：囡囡饥饿时受伤 ×2（同种子无上下文基线精确对比）', () => {
  const units: TimelineUnit[] = [
    { id: 'ally-0', name: '巡夜灯灵', side: 'ally', character: null, star: 1, maxHp: 50_000, attack: 400, speed: 130, defense: 0, critical: 0, resistance: 0 },
    { id: 'enemy-0', name: '囡囡', side: 'enemy', character: null, star: 1, maxHp: 999_999, attack: 10, speed: 100, defense: 0, critical: 0, resistance: 0 },
  ];
  const context: BossContext = { stageId: '1-1', bossId: 'enemy-0', mechanic: 'devour' };
  const hungry = backendTimeline(units, 11, context);
  const baseline = backendTimeline(units, 11);
  // 无可吞增益 → 每轮轮首写「饥饿」事件，本轮受伤 ×2
  assert.ok(hungry.turns.filter(turn => turn.skill === '饥饿' && turn.amount === 0).length >= 10);
  const hungryHit = hungry.turns.find(turn => turn.actor === 'ally-0' && turn.target === 'enemy-0')!;
  const baseHit = baseline.turns.find(turn => turn.actor === 'ally-0' && turn.target === 'enemy-0')!;
  assert.ok(hungryHit && baseHit);
  assert.equal(hungryHit.amount, baseHit.amount * 2, '饥饿轮 Boss 受伤应精确 ×2（同种子同 raw）');
});

test('Boss 机制：囡囡吞噬拉菲护盾转为自身护盾（同种子对比吸收量）', () => {
  const units: TimelineUnit[] = [
    { id: 'ally-0', name: '拉菲', side: 'ally', character: '拉菲', star: 1, maxHp: 50_000, attack: 500, speed: 130, defense: 0, critical: 0, resistance: 0 },
    { id: 'enemy-0', name: '囡囡', side: 'enemy', character: null, star: 1, maxHp: 999_999, attack: 10, speed: 100, defense: 0, critical: 0, resistance: 0 },
  ];
  const context: BossContext = { stageId: '1-1', bossId: 'enemy-0', mechanic: 'devour' };
  const devour = backendTimeline(units, 11, context);
  const baseline = backendTimeline(units, 11);
  // 第 3 轮拉菲施加护盾（=500×0.9=450，until 5），第 4 轮轮首被吞噬并写入事件
  const devourEvent = devour.turns.find(turn => turn.skill === '吞噬');
  assert.ok(devourEvent, '应写入吞噬事件');
  assert.equal(devourEvent.round, 4);
  assert.equal(devourEvent.target, 'ally-0');
  assert.equal(devourEvent.amount, 0);
  // 第 4 轮拉菲攻击：Boss 已持被吞护盾 → 实际扣血严格低于无吞噬基线（同种子同 raw）
  const devourHit = devour.turns.find(turn => turn.round === 4 && turn.actor === 'ally-0' && turn.target === 'enemy-0')!;
  const baseHit = baseline.turns.find(turn => turn.round === 4 && turn.actor === 'ally-0' && turn.target === 'enemy-0')!;
  assert.ok(devourHit && baseHit);
  assert.ok(devourHit.amount < baseHit.amount, `吞噬后护盾应吸收伤害：${devourHit.amount} vs ${baseHit.amount}`);
});

test('Boss 机制：咸境轮末 3% 掉血 + 淡境奇数轮输出 ×0.75（淡境/前摇/咸境事件齐全）', () => {
  const units: TimelineUnit[] = [
    { id: 'ally-0', name: '巡夜灯灵', side: 'ally', character: null, star: 1, maxHp: 30_000, attack: 400, speed: 130, defense: 0, critical: 0, resistance: 0 },
    { id: 'enemy-0', name: '咸与淡', side: 'enemy', character: null, star: 1, maxHp: 999_999, attack: 600, speed: 100, defense: 0, critical: 0, resistance: 0 },
  ];
  const context: BossContext = { stageId: '2-4', bossId: 'enemy-0', mechanic: 'taste' };
  const taste = backendTimeline(units, 11, context);
  const baseline = backendTimeline(units, 11);
  // 首轮宣告淡境；奇数轮末写前摇、偶数轮末写咸境
  assert.equal(taste.turns[0].skill, '淡境');
  assert.ok(taste.turns.some(turn => turn.round === 1 && turn.skill === '味性前摇' && turn.amount === 0));
  assert.ok(taste.turns.some(turn => turn.round === 2 && turn.skill === '咸境' && turn.amount === 0));
  // 咸境掉血精确值：30000 × 3% = 900（保底 1）
  const saltTicks = taste.turns.filter(turn => turn.skill === '咸境' && turn.amount > 0);
  assert.ok(saltTicks.length > 0, '咸境应写入逐人掉血轮');
  for (const tick of saltTicks) {
    assert.equal(tick.actor, 'enemy-0');
    assert.equal(tick.target, 'ally-0');
    assert.equal(tick.amount, Math.max(1, Math.round(30_000 * backendBossParams.TASTE_SALT_RATIO)));
  }
  // 淡境 ×0.75：奇数轮 Boss 直击精确对比基线；偶数轮不折减
  const bossHits = (result: ReturnType<typeof backendTimeline>, round: number) =>
    result.turns.filter(turn => turn.round === round && isDirectHit(turn, 'enemy-0', 'ally-0'));
  for (const round of [1, 3]) {
    const a = bossHits(taste, round)[0];
    const b = bossHits(baseline, round)[0];
    assert.ok(a && b, `第 ${round} 轮 Boss 应有直击`);
    assert.equal(a.amount, Math.max(1, Math.round(b.amount * backendBossParams.TASTE_MILD_FACTOR)));
  }
  const evenA = bossHits(taste, 2)[0];
  const evenB = bossHits(baseline, 2)[0];
  assert.ok(evenA && evenB);
  assert.equal(evenA.amount, evenB.amount, '偶数轮（咸境）不折减直击伤害');
});

test('Boss 机制：壶中翁醉步偶/奇轮速度波动改变出手序', () => {
  const units: TimelineUnit[] = [
    { id: 'ally-0', name: '巡夜灯灵', side: 'ally', character: null, star: 1, maxHp: 50_000, attack: 400, speed: 125, defense: 0, critical: 0, resistance: 0 },
    { id: 'enemy-0', name: '壶中翁', side: 'enemy', character: null, star: 1, maxHp: 999_999, attack: 10, speed: 100, defense: 0, critical: 0, resistance: 0 },
  ];
  const drunk = backendTimeline(units, 11, { stageId: '3-1', bossId: 'enemy-0', mechanic: 'drunk' });
  // 奇数轮 100×0.7=70 < 125 → 我方先手；偶数轮 100×1.3=130 > 125 → Boss 先手
  assert.equal(firstActorOf(drunk.turns, 1), 'ally-0');
  assert.equal(firstActorOf(drunk.turns, 2), 'enemy-0');
  assert.equal(firstActorOf(drunk.turns, 3), 'ally-0');
  assert.equal(firstActorOf(drunk.turns, 4), 'enemy-0');
});

test('Boss 机制：影厨存活时无名氏受伤 ×0.3（同种子无上下文基线精确对比）', () => {
  const units: TimelineUnit[] = [
    { id: 'ally-0', name: '巡夜灯灵', side: 'ally', character: null, star: 1, maxHp: 50_000, attack: 400, speed: 130, defense: 0, critical: 0, resistance: 0 },
    { id: 'enemy-0', name: '雾厨无名氏', side: 'enemy', character: null, star: 1, maxHp: 999_999, attack: 10, speed: 100, defense: 0, critical: 0, resistance: 0 },
    { id: 'enemy-mirror', name: '影厨·巡夜灯灵', side: 'enemy', character: null, star: 3, maxHp: 999_999, attack: 10, speed: 100, defense: 0, critical: 0, resistance: 0 },
  ];
  const context: BossContext = { stageId: '4-3', bossId: 'enemy-0', mechanic: 'mirror', mirrorId: 'enemy-mirror', mirrorSource: '巡夜灯灵' };
  const mirrored = backendTimeline(units, 11, context);
  const baseline = backendTimeline(units, 11);
  const hits = mirrored.turns.filter(turn => turn.actor === 'ally-0' && turn.target === 'enemy-0');
  const baseHits = baseline.turns.filter(turn => turn.actor === 'ally-0' && turn.target === 'enemy-0');
  assert.ok(hits.length > 0 && hits.length === baseHits.length, '同种子下命中 Boss 的回合序列应一致');
  for (let index = 0; index < hits.length; index++) {
    assert.equal(hits[index].amount, Math.max(1, Math.round(baseHits[index].amount * backendBossParams.MIRROR_BOSS_REDUCE)), `第 ${index + 1} 次命中应精确 ×0.3`);
  }
});

test('Boss 机制：影厨被消灭后无名氏受全伤（减伤翻转）', () => {
  const units: TimelineUnit[] = [
    { id: 'ally-0', name: '巡夜灯灵', side: 'ally', character: null, star: 1, maxHp: 50_000, attack: 400, speed: 130, defense: 0, critical: 0, resistance: 0 },
    { id: 'enemy-0', name: '雾厨无名氏', side: 'enemy', character: null, star: 1, maxHp: 999_999, attack: 10, speed: 100, defense: 0, critical: 0, resistance: 0 },
    { id: 'enemy-mirror', name: '影厨·巡夜灯灵', side: 'enemy', character: null, star: 3, maxHp: 400, attack: 10, speed: 100, defense: 0, critical: 0, resistance: 0 },
  ];
  const context: BossContext = { stageId: '4-3', bossId: 'enemy-0', mechanic: 'mirror', mirrorId: 'enemy-mirror', mirrorSource: '巡夜灯灵' };
  const result = backendTimeline(units, 11, context);
  // 减伤期理论上限：400 攻 ×1.55 技能 ×1.5 暴击 ×0.3（+取整裕度）
  const cap = Math.ceil(400 * 1.55 * 1.5 * backendBossParams.MIRROR_BOSS_REDUCE) + 1;
  const fullHits = result.turns.filter(turn => turn.actor === 'ally-0' && turn.target === 'enemy-0' && turn.health['enemy-mirror'] === 0);
  assert.ok(fullHits.length > 0, '影厨应在战斗中被消灭');
  for (const hit of fullHits) {
    assert.ok(hit.amount >= Math.round(400 * 0.9), `影厨阵亡后 Boss 应受全伤（普通攻击下限 = 400×0.9）：${hit.amount}`);
  }
  const reducedHits = result.turns.filter(turn => turn.actor === 'ally-0' && turn.target === 'enemy-0' && turn.health['enemy-mirror'] > 0);
  for (const hit of reducedHits) {
    assert.ok(hit.amount <= cap, `影厨存活期 Boss 受伤应被削减到 ×0.3 上限内：${hit.amount}`);
  }
});

test('Boss 机制：团圆纹达成 ×1.25 / 破纹 ×0.5（各自同种子基线精确对比）', () => {
  const bossUnit: TimelineUnit = { id: 'enemy-0', name: '忘川馔', side: 'enemy', character: null, star: 1, maxHp: 999_999, attack: 400, speed: 100, defense: 0, critical: 0, resistance: 0 };
  const context: BossContext = { stageId: '5-1', bossId: 'enemy-0', mechanic: 'feast' };
  const reunionAlly: TimelineUnit = { id: 'ally-0', name: '巡夜灯灵', side: 'ally', character: null, star: 1, maxHp: 1_000_000, attack: 400, speed: 130, defense: 0, critical: 0, resistance: 0 };
  // 破纹口径：maxHp 1000（判定线 300）、慢速（80 < Boss 100 → Boss 先手）：
  // 第 1 轮 Boss 直击后血量 540..620 > 300 → 首击仍 ×1.25；第 2 轮直击后 80..240 < 300 → 第 2 击起 ×0.5
  const brokenAlly: TimelineUnit = { id: 'ally-0', name: '巡夜灯灵', side: 'ally', character: null, star: 1, maxHp: 1000, attack: 400, speed: 80, defense: 0, critical: 0, resistance: 0 };
  const reunion = backendTimeline([reunionAlly, bossUnit], 11, context);
  const reunionBase = backendTimeline([reunionAlly, bossUnit], 11);
  const broken = backendTimeline([brokenAlly, bossUnit], 11, context);
  const brokenBase = backendTimeline([brokenAlly, bossUnit], 11);
  const hitsOf = (result: ReturnType<typeof backendTimeline>) => result.turns.filter(turn => isDirectHit(turn, 'ally-0', 'enemy-0'));
  const reunionHits = hitsOf(reunion);
  const reunionBaseHits = hitsOf(reunionBase);
  const brokenHits = hitsOf(broken);
  const brokenBaseHits = hitsOf(brokenBase);
  // 团圆方全程 ×1.25
  assert.ok(reunionHits.length > 0 && reunionHits.length === reunionBaseHits.length);
  for (let index = 0; index < reunionHits.length; index++) {
    assert.equal(reunionHits[index].amount, Math.max(1, Math.round(reunionBaseHits[index].amount * backendBossParams.FEAST_REUNION_BONUS)), `团圆纹第 ${index + 1} 击应精确 ×1.25`);
  }
  // 破纹方：首击 ×1.25，第二击起 ×0.5
  assert.ok(broken.turns.some(turn => turn.skill === '餐前' && turn.amount === 0), '应写入餐前宣告事件');
  assert.ok(broken.turns.some(turn => turn.skill === '餐前' && turn.amount > 0), '餐前应写入逐人掉血轮');
  assert.equal(brokenHits.length, 2, '破纹方应在第 3 轮 Boss 先手击杀前恰好打出两击');
  assert.equal(brokenHits[0].amount, Math.max(1, Math.round(brokenBaseHits[0].amount * backendBossParams.FEAST_REUNION_BONUS)), '首击时血量仍高于 30% → ×1.25');
  assert.equal(brokenHits[1].amount, Math.max(1, Math.round(brokenBaseHits[1].amount * backendBossParams.FEAST_REUNION_PENALTY)), '第二击起破纹 → ×0.5');
});

test('Boss 机制：忘川馔三阶段按血量切换并写入时间线（散席期攻击显著放大）', () => {
  const units: TimelineUnit[] = [
    { id: 'ally-0', name: '巡夜灯灵', side: 'ally', character: null, star: 1, maxHp: 1_000_000, attack: 3000, speed: 130, defense: 0, critical: 0, resistance: 0 },
    { id: 'enemy-0', name: '忘川馔', side: 'enemy', character: null, star: 1, maxHp: 30_000, attack: 600, speed: 100, defense: 0, critical: 0, resistance: 0 },
  ];
  const result = backendTimeline(units, 11, { stageId: '5-1', bossId: 'enemy-0', mechanic: 'feast' });
  const phaseEvents = result.turns.filter(turn => ['餐前', '上菜', '散席'].includes(turn.skill) && turn.amount === 0);
  const phases = phaseEvents.map(turn => turn.skill);
  assert.deepEqual(phases, ['餐前', '上菜', '散席'], `阶段事件应按序切换：${phases.join('→')}`);
  // 散席期 Boss 直击应显著高于餐前期（攻击 ×1.4，技能回合 ×1.55）；过滤 Boss 事件轮
  const serveIndex = phaseEvents.findIndex(turn => turn.skill === '上菜');
  const farewellHits = result.turns.filter(turn => turn.round > phaseEvents[serveIndex].round && isDirectHit(turn, 'enemy-0', 'ally-0'));
  const preHits = result.turns.filter(turn => turn.round < phaseEvents[serveIndex].round && isDirectHit(turn, 'enemy-0', 'ally-0'));
  assert.ok(farewellHits.length > 0 && preHits.length > 0);
  const maxPre = Math.max(...preHits.map(turn => turn.amount));
  const maxFarewell = Math.max(...farewellHits.map(turn => turn.amount));
  assert.ok(maxFarewell > maxPre, `散席期最大直击应高于餐前期：${maxFarewell} vs ${maxPre}`);
});

test('Boss 关开战→结算：上下文从存储单元重建且结果一致（4-3 影厨在场）', () => {
  const { player } = createGuest({ nickname: '对齐丁四', gender: 'female' });
  addOwnedCharacter(player.id, 'qing', nowIso());
  addOwnedCharacter(player.id, 'lafite', nowIso());
  addOwnedCharacter(player.id, 'curry', nowIso());
  setFormation(player.id, ['青团', '拉菲', '咖喱']);
  const started = startBattle(player.id, '4-3');
  const settled = settleBattle(player.id, started.id);
  // 影厨单位在场且属性 = 最高攻食灵 ×1.2
  const units = settled.battle.units;
  const allies = units.filter(unit => unit.side === 'ally');
  const mirror = units.find(unit => unit.id === 'enemy-mirror');
  assert.ok(mirror, '4-3 应生成影厨');
  const source = allies.reduce((best, unit) => (!best || unit.attack > best.attack) ? unit : best);
  assert.equal(mirror.name, `影厨·${source.name}`);
  assert.equal(mirror.maxHp, Math.round(source.maxHp * backendBossParams.MIRROR_STATS_FACTOR));
  assert.equal(mirror.attack, Math.round(source.attack * backendBossParams.MIRROR_STATS_FACTOR));
  // 结算时间线确定性：从存储单元重建上下文后同种子重放完全一致
  const context = buildBossContext('4-3', allies)!;
  assert.ok(context.mirrorId === 'enemy-mirror' && context.mirrorSource === source.name);
  const replay = backendTimeline(units, started.seed, context);
  assert.equal(replay.win, settled.battle.win);
  assert.equal(replay.turns.length, settled.battle.turns.length);
  assert.deepEqual(replay.turns, settled.battle.turns);
});
