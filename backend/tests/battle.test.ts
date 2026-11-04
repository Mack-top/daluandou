import { test } from 'node:test';
import assert from 'node:assert/strict';
import { simulateBattle } from '../src/services/battle.service.js';
import type { BattleUnitDto } from '../src/domain/types.js';

function unit(overrides: Partial<BattleUnitDto> & Pick<BattleUnitDto, 'id' | 'side'>): BattleUnitDto {
  return {
    name: overrides.id,
    character: overrides.side === 'ally' ? overrides.id : null,
    star: 1,
    maxHp: 1000,
    attack: 100,
    speed: 100,
    defense: 50,
    critical: 10,
    resistance: 5,
    ...overrides,
  };
}

const strongAllies = [
  unit({ id: 'a1', side: 'ally', maxHp: 5000, attack: 600, speed: 120 }),
  unit({ id: 'a2', side: 'ally', maxHp: 4500, attack: 520, speed: 110 }),
];

const weakEnemies = [unit({ id: 'e1', side: 'enemy', maxHp: 800, attack: 60, speed: 90 })];

test('相同种子必然得到完全相同的战斗过程', () => {
  const first = simulateBattle({ seed: 20261103, allies: strongAllies, enemies: weakEnemies });
  const second = simulateBattle({ seed: 20261103, allies: strongAllies, enemies: weakEnemies });
  assert.deepEqual(second, first);
});

test('不同种子会产生不同的出手序列', () => {
  const a = simulateBattle({ seed: 1, allies: strongAllies, enemies: weakEnemies });
  const b = simulateBattle({ seed: 99, allies: strongAllies, enemies: weakEnemies });
  assert.notDeepEqual(a.turns.map(turn => turn.amount), b.turns.map(turn => turn.amount));
});

test('强势方获胜且回合数不超过上限', () => {
  const result = simulateBattle({ seed: 7, allies: strongAllies, enemies: weakEnemies });
  assert.equal(result.win, true);
  assert.ok(result.rounds >= 1 && result.rounds <= 12, `回合数异常：${result.rounds}`);
  assert.ok(result.turns.length > 0, '应产生至少一条出手记录');
});

test('弱势方战败', () => {
  const result = simulateBattle({
    seed: 42,
    allies: [unit({ id: 'a1', side: 'ally', maxHp: 500, attack: 40, speed: 80 })],
    enemies: [unit({ id: 'e1', side: 'enemy', maxHp: 6000, attack: 400, speed: 130 })],
  });
  assert.equal(result.win, false);
});

test('每次出手都带有全场血量快照，可用于回放', () => {
  const result = simulateBattle({ seed: 5, allies: strongAllies, enemies: weakEnemies });
  for (const turn of result.turns) {
    assert.ok(turn.amount >= 1, '伤害应至少为 1');
    assert.ok(turn.health.a1 !== undefined, '快照应包含我方单位');
    assert.ok(turn.health.e1 !== undefined, '快照应包含敌方单位');
  }
});
