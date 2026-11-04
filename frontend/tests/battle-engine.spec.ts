import { test, expect } from '@playwright/test';
import { beginBattle, healthAt, isBattleRecord, settleBattle, simulateBattle, simulateTimeline, bossStages, BOSS_PARAMS } from '../src/battle-engine';
import { createFreshSave, localDate, rolloverDaily } from '../src/game-clock';
import { parseSave } from '../src/save-store';
import { ascendCharacter, claimIdleRewards, exchangeResources, unlockStarNode } from '../src/game-transactions';
import { characterPower, squadPower } from '../src/game-data';

function traveler() {
  const now = new Date();
  return { ...createFreshSave(now), profile: { name: '测试旅人', gender: 'female' as const, createdAt: now.toISOString() } };
}

test('seeded combat is reproducible and every hit changes valid health', () => {
  const save = traveler();
  const now = new Date();
  const a = simulateBattle(save, '1-1', ['青团'], 42, 'same-id', now)!;
  const b = simulateBattle(save, '1-1', ['青团'], 42, 'same-id', now)!;
  expect(a).toEqual(b);
  expect(isBattleRecord(a)).toBe(true);
  expect(a.win).toBe(true);
  expect(a.turns.length).toBeGreaterThan(4);
  let previous = healthAt(a, 0);
  for (const turn of a.turns) {
    expect(turn.health[turn.target]).toBe(previous[turn.target] + (turn.kind === 'heal' ? turn.amount : -turn.amount));
    expect(turn.health[turn.target]).toBeGreaterThanOrEqual(0);
    previous = turn.health;
  }
  expect(healthAt(a, a.turns.length)).toEqual(a.turns.at(-1)!.health);
});

test('the introductory battle is completable without purchases', () => {
  const save = traveler();
  for (let seed = 0; seed < 100; seed++) {
    expect(simulateBattle(save, '1-1', ['青团'], seed, `training-${seed}`)!.win).toBe(true);
  }
});

test('only one pending battle exists and settlement grants rewards once', () => {
  const save = traveler();
  const pending = beginBattle(save, '1-1', ['青团'], 42, 'first');
  expect(beginBattle(pending, '2-3', ['青团'], 99, 'second')).toBe(pending);
  expect(pending.coins).toBe(save.coins);
  const settled = settleBattle(pending, 'first');
  expect(settled.coins).toBe(save.coins + 10000);
  expect(settled.leaves).toBe(30);
  expect(settled.battleWins).toBe(1);
  expect(settled.chroniclePoints).toBe(1);
  expect(settled.firstClears).toEqual(['1-1']);
  expect(settled.pendingBattle).toBeNull();
  expect(settleBattle(settled, 'first')).toBe(settled);
  expect(settled.battleHistory).toHaveLength(1);
  const repeated = settleBattle(beginBattle(settled, '1-1', ['青团'], 42, 'repeat'), 'repeat');
  expect(repeated.coins - settled.coins).toBe(2000);
  expect(repeated.leaves - settled.leaves).toBe(6);
  expect(repeated.battleHistory[0].firstClear).toBe(false);
});

test('defeat saves history without rewarding currency or victories', () => {
  const save = traveler();
  const pending = beginBattle(save, '3-2', ['青团'], 42, 'defeat');
  expect(pending.pendingBattle!.win).toBe(false);
  const settled = settleBattle(pending, 'defeat');
  expect(settled.coins).toBe(save.coins);
  expect(settled.battleWins).toBe(0);
  expect(settled.chroniclePoints).toBe(0);
  expect(settled.battleHistory[0].status).toBe('lost');
  expect(settled.battleHistory[0].rewards).toEqual([]);
});

test('new chapter stages swap in their own enemy rosters via stageEnemies', () => {
  const save = traveler();
  const record = simulateBattle(save, '4-1', ['青团'], 42, 'ch4-coldroom');
  expect(record).not.toBeNull();
  const enemyNames = record!.units.filter(unit => unit.side === 'enemy').map(unit => unit.name);
  expect(enemyNames).toEqual(['馔尘蛾', '雾隐食客', '冰髓甜魄']);
  // 5-1 为 Boss 关：编成由 bossStages 覆盖（忘川馔为 Boss 主体）
  const finale = simulateBattle(save, '5-1', ['青团'], 42, 'finale');
  expect(finale!.units.filter(unit => unit.side === 'enemy').map(unit => unit.name)).toEqual(bossStages['5-1'].enemies);
  // 未登记的关卡回落默认三件套（引擎公式不变）
  const fallback = simulateBattle(save, '2-3', ['青团'], 42, 'fallback');
  expect(fallback!.units.filter(unit => unit.side === 'enemy').map(unit => unit.name)).toEqual(['巡夜灯灵', '雾隐食客', '月桥守卫']);
});

test('boss stages override rosters, strengthen the boss body and still pass isBattleRecord', () => {
  const save = traveler();
  // 1-1 囡囡：Boss 主体强化（index 2 公式 ×HP2 / ×攻1.3），非 Boss 关公式不变
  const record = simulateBattle(save, '1-1', ['青团'], 42, 'boss-11')!;
  expect(record.units.filter(unit => unit.side === 'enemy').map(unit => unit.name)).toEqual(['巡夜灯灵', '雾隐食客', '囡囡']);
  const boss = record.units.find(unit => unit.name === '囡囡')!;
  expect(boss.maxHp).toBe(Math.round(7000 / 12 * 1.2 * BOSS_PARAMS.BOSS_HP_FACTOR));
  expect(boss.attack).toBe(Math.round(7000 / 72 * 1.15 * BOSS_PARAMS.BOSS_ATTACK_FACTOR));
  // 4-3 影厨：3 我方 + 3 敌人 + 1 影厨 = 7 单位，isBattleRecord 上限已放宽到 7
  const mirrorRecord = simulateBattle(save, '4-3', ['青团', '拉菲', '咖喱'], 42, 'boss-43')!;
  expect(mirrorRecord.units).toHaveLength(7);
  const mirror = mirrorRecord.units.find(unit => unit.id === 'enemy-mirror')!;
  const source = mirrorRecord.units.filter(unit => unit.side === 'ally').reduce((best, unit) => (!best || unit.attack > best.attack) ? unit : best);
  expect(mirror.name).toBe(`影厨·${source.name}`);
  expect(mirror.maxHp).toBe(Math.round(source.maxHp * BOSS_PARAMS.MIRROR_STATS_FACTOR));
  expect(mirror.attack).toBe(Math.round(source.attack * BOSS_PARAMS.MIRROR_STATS_FACTOR));
  expect(isBattleRecord(mirrorRecord)).toBe(true);
  // 回放健康快照必须包含影厨
  expect(mirrorRecord.turns.at(-1)!.health).toHaveProperty('enemy-mirror');
});

test('boss mechanics surface as zero-amount timeline events with their own skill names', () => {
  const save = traveler();
  // 1-1：单青团无增益 → 囡囡轮首写「饥饿」事件（amount 0）
  const hungry = simulateBattle(save, '1-1', ['青团'], 42, 'devour')!;
  expect(hungry.turns.filter(turn => turn.skill === '饥饿' && turn.amount === 0).length).toBeGreaterThanOrEqual(5);
  // 2-4：首轮「淡境」宣告 + 奇数轮「味性前摇」+ 偶数轮「咸境」与逐人掉血
  const taste = simulateBattle(save, '2-4', ['青团'], 42, 'taste')!;
  expect(taste.turns[0].skill).toBe('淡境');
  expect(taste.turns.some(turn => turn.skill === '味性前摇' && turn.amount === 0)).toBe(true);
  expect(taste.turns.some(turn => turn.skill === '咸境' && turn.amount > 0)).toBe(true);
  // 5-1：阶段事件（餐前至少存在）与团圆纹/餐前掉血写入时间线
  const feast = simulateBattle(save, '5-1', ['青团'], 42, 'feast')!;
  expect(feast.turns.some(turn => turn.skill === '餐前' && turn.amount === 0)).toBe(true);
  expect(feast.turns.some(turn => turn.skill === '餐前' && turn.amount > 0)).toBe(true);
});

test('boss timeline is reproducible under the same seed and boss context', () => {
  // 直接驱动 simulateTimeline 的纯函数口径：拉菲护盾被囡囡吞噬（1v1 + Boss 上下文）
  const units = [
    { id: 'ally-0', name: '拉菲', side: 'ally' as const, character: '拉菲', star: 1, maxHp: 50000, attack: 500, speed: 130, defense: 0, critical: 0, resistance: 0 },
    { id: 'enemy-0', name: '囡囡', side: 'enemy' as const, character: null, star: 1, maxHp: 999999, attack: 10, speed: 100, defense: 0, critical: 0, resistance: 0 },
  ];
  const boss = { stageId: '1-1', bossId: 'enemy-0', mechanic: 'devour' as const };
  const first = simulateTimeline(units, 11, boss);
  expect(simulateTimeline(units, 11, boss)).toEqual(first);
  // 第 3 轮护盾 → 第 4 轮轮首被吞噬并写入事件
  const devour = first.turns.find(turn => turn.skill === '吞噬');
  expect(devour).toBeTruthy();
  expect(devour!.round).toBe(4);
  expect(devour!.target).toBe('ally-0');
  expect(devour!.amount).toBe(0);
  expect(devour!.health).toEqual(first.turns.filter(turn => turn.round === 4)[0].health);
});

test('history is capped and malformed saved timelines are rejected', () => {
  let save = traveler();
  for (let index = 0; index < 24; index++) {
    // 每日挑战次数上限 10 次（免费 4 + 卡 6）：每 10 场模拟跨日重置并补满挑战卡，保证 24 场都能开战
    if (index % 10 === 0) save = { ...save, dailyBattleDate: localDate(), dailyBattlesUsed: 0, battlePassesPurchased: 6 };
    save = settleBattle(beginBattle(save, '1-1', ['青团'], 42, `battle-${index}`), `battle-${index}`);
  }
  expect(save.battleHistory).toHaveLength(20);
  expect(save.battleHistory[0].id).toBe('battle-23');
  expect(parseSave(save).battleHistory).toHaveLength(20);
  const broken = structuredClone(save.battleHistory[0]);
  broken.turns[0].health[broken.units[0].id] = -5;
  expect(isBattleRecord(broken)).toBe(false);
  expect(parseSave({ ...save, pendingBattle: { nonsense: true }, battleHistory: [broken] }).pendingBattle).toBeNull();
  expect(parseSave({ ...save, battleHistory: [broken] }).battleHistory).toEqual([]);
});

test('formation rejects unowned characters and star upgrades increase battle power', () => {
  const save = traveler();
  expect(simulateBattle(save, '1-1', ['未知食灵'], 42, 'bad')).toBeNull();
  expect(simulateBattle({ ...save, profile: null }, '1-1', ['青团'], 42, 'guest')).toBeNull();
  expect(squadPower(save)).toBe(9000);
  const upgraded = ascendCharacter({ ...save, leaves: 1000, potions: 1000000 }, '青团');
  expect(characterPower(upgraded, '青团')).toBeGreaterThan(characterPower(save, '青团'));
  expect(ascendCharacter(upgraded, '未拥有的食灵')).toBe(upgraded);
  expect(unlockStarNode({ ...save, gems: 1000 }, 'star-3').astrology).toEqual([]);
});

test('trade enforces the real daily limit inside the state transaction', () => {
  let save = { ...traveler(), coins: 900000 };
  for (let index = 0; index < 10; index++) save = exchangeResources(save, 't1');
  expect(save.tradeCounts.t1).toBe(3);
  expect(save.books).toBe(13);
  expect(save.coins).toBe(450000);
  expect(exchangeResources(save, 'made-up')).toBe(save);
});

test('each daily system resets on its own date while long-term progress remains', () => {
  const today = new Date();
  const yesterday = new Date(today); yesterday.setDate(yesterday.getDate() - 1);
  const old = localDate(yesterday);
  const save = { ...traveler(), dailyDate: old, marketDate: old, tradeDate: old, chronicleDate: old, dailyPaid: 68, dailyClaimed: [6, 12], dailySummons: 10, dailyLoginRewards: 1, marketBought: ['m1'], tradeCounts: { t1: 3 }, chroniclePoints: 4, chronicleClaimed: ['c1'], claimedQuests: ['summon', 'collection'], firstClears: ['1-1'] };
  const next = rolloverDaily(save, today);
  expect(next.dailyPaid).toBe(0);
  expect(next.dailyClaimed).toEqual([]);
  expect(next.marketBought).toEqual([]);
  expect(next.tradeCounts).toEqual({});
  expect(next.chroniclePoints).toBe(0);
  expect(next.chronicleClaimed).toEqual([]);
  expect(next.claimedQuests).toEqual(['collection']);
  expect(next.firstClears).toEqual(['1-1']);
  expect(rolloverDaily(next, today)).toBe(next);
  const independent = parseSave({ ...next, tradeDate: old, tradeCounts: { t1: 3 }, marketDate: localDate(today), marketBought: ['m1'] });
  expect(independent.tradeCounts).toEqual({});
  expect(independent.marketBought).toEqual(['m1']);
});

test('idle and battle rewards cannot be replayed after refresh or double click', () => {
  const now = new Date();
  const save = { ...traveler(), idleClaimAt: new Date(now.getTime() - 3600000).toISOString() };
  const claimed = claimIdleRewards(save, now);
  expect(claimed.coins).toBe(save.coins + 18000);
  expect(claimIdleRewards(claimed, now)).toBe(claimed);
  const pending = beginBattle(claimed, '1-1', ['青团'], 42, 'restore', now);
  const restored = parseSave(JSON.parse(JSON.stringify(pending)));
  expect(restored.pendingBattle).toEqual(pending.pendingBattle);
  expect(settleBattle(restored, 'wrong-id')).toBe(restored);
  expect(settleBattle(settleBattle(restored, 'restore'), 'restore').battleHistory).toHaveLength(1);
});

test('settling yesterday\'s expedition does not grant progress to today\'s event', () => {
  const today = new Date();
  const yesterday = new Date(today); yesterday.setDate(yesterday.getDate() - 1);
  const save = { ...createFreshSave(yesterday), profile: { name: '跨日旅人', gender: 'male' as const, createdAt: yesterday.toISOString() }, chroniclePoints: 4 };
  const pending = beginBattle(save, '1-1', ['青团'], 42, 'overnight', yesterday);
  const settled = settleBattle(pending, 'overnight', today);
  expect(settled.coins).toBe(60000);
  expect(settled.battleWins).toBe(1);
  expect(settled.chroniclePoints).toBe(0);
  expect(settled.chronicleDate).toBe(localDate(today));
});
test('daily battle charges: 4 free per day, exhausted start is a no-op, next day resets', () => {
  let save = traveler();
  // 前 4 场正常开战并计数
  for (let index = 0; index < 4; index++) {
    save = settleBattle(beginBattle(save, '1-1', ['青团'], 42, `charge-${index}`), `charge-${index}`);
    expect(save.dailyBattlesUsed).toBe(index + 1);
  }
  // 第 5 场：免费次数用尽且未购买 → beginBattle 不开战（no-op）
  const exhausted = beginBattle(save, '1-1', ['青团'], 42, 'charge-4');
  expect(exhausted.pendingBattle).toBeNull();
  expect(exhausted.dailyBattlesUsed).toBe(4);
  // 本地购买挑战卡后可继续（演示口径），但达总上限 10 后同样拦截
  const withPasses = { ...save, battlePassesPurchased: 6 };
  const tenth = settleBattle(beginBattle(withPasses, '1-1', ['青团'], 42, 'charge-10'), 'charge-10');
  expect(tenth.dailyBattlesUsed).toBe(5);
  // 跨日重置：dailyBattleDate 置空后计数归零
  const nextDay = rolloverDaily({ ...save, dailyBattleDate: null, dailyBattlesUsed: 4, battlePassesPurchased: 2 });
  expect(nextDay.dailyBattlesUsed).toBe(0);
  expect(nextDay.battlePassesPurchased).toBe(0);
  expect(nextDay.dailyBattleDate).toBe(localDate());
});

test('skill effects: burn ticks at round end with attacker-scaled damage', () => {
  // 直接驱动 simulateTimeline 的纯函数口径：冬阴功 vs 巡夜灯灵（1v1）
  const units = [
    { id: 'ally-0', name: '冬阴功', side: 'ally' as const, character: '冬阴功', star: 1, maxHp: 10000, attack: 400, speed: 130, defense: 0, critical: 0, resistance: 0 },
    { id: 'enemy-0', name: '巡夜灯灵', side: 'enemy' as const, character: null, star: 1, maxHp: 99999, attack: 10, speed: 100, defense: 0, critical: 18, resistance: 0 },
  ];
  const result = simulateTimeline(units, 11);
  const ticks = result.turns.filter(turn => turn.skill === '灼烧');
  expect(ticks.length).toBeGreaterThanOrEqual(2);
  for (const tick of ticks) {
    expect(tick.actor).toBe('ally-0');
    expect(tick.amount).toBe(Math.round(400 * 0.35));
  }
  // 前后端同种子一致（轻量抽检）
  expect(simulateTimeline(units, 11)).toEqual(result);
});

test('skill effects: chill flips turn order from the next round', () => {
  const units = [
    { id: 'ally-0', name: '蓝纹奶酪', side: 'ally' as const, character: '蓝纹奶酪', star: 1, maxHp: 10000, attack: 300, speed: 105, defense: 0, critical: 0, resistance: 0 },
    { id: 'enemy-0', name: '巡夜灯灵', side: 'enemy' as const, character: null, star: 1, maxHp: 99999, attack: 10, speed: 106, defense: 0, critical: 18, resistance: 0 },
  ];
  const result = simulateTimeline(units, 11);
  const firstActor = (round: number) => result.turns.filter(turn => turn.round === round && turn.skill !== '灼烧')[0]?.actor;
  expect(firstActor(1)).toBe('enemy-0');
  expect(firstActor(4)).toBe('ally-0');
});

test('skill effects: record with burn turns still passes isBattleRecord', () => {
  const save = traveler();
  const now = new Date();
  const record = simulateBattle(save, '1-1', ['冬阴功', '拉菲', '咖喱'], 42, 'fx', now)!;
  expect(isBattleRecord(record)).toBe(true);
  const settled = settleBattle(beginBattle(save, '1-1', ['冬阴功', '拉菲', '咖喱'], 42, 'fx', now), 'fx', now);
  expect(settled.battleHistory[0].status).toBe('claimed');
});
