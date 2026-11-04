/**
 * v7（战斗内容配置）+ v8（场景）验证：
 * 外键引用链（enemy→skill/vfx）、Boss phase_json 约束、
 * catalog_meta 版本戳、stage_defs.scene_id 迁移与回填、seed 幂等重跑。
 */
import { after, before, test } from 'node:test';
import assert from 'node:assert/strict';
import { rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { closeDatabase, connectDatabase, execute, queryAll, queryOne, transaction } from '../src/db/index.js';
import { runMigrations } from '../src/db/migrate.js';
import { seedCatalog } from '../src/db/seed.js';
import { createGuest } from '../src/services/auth.service.js';
import { listEnemyDefs, findEnemyDef, validateSkillIds } from '../src/repositories/enemy.repository.js';
import { listSkillDefs, findSkillDef } from '../src/repositories/skill.repository.js';
import { listVfxDefs } from '../src/repositories/vfx.repository.js';
import { listSceneDefs, findSceneDef, resolveStageScene } from '../src/repositories/scene.repository.js';
import { getAllCatalogVersions, getCatalogVersion, bumpCatalogVersion } from '../src/repositories/catalog-meta.repository.js';
import { ApiError } from '../src/lib/errors.js';

const databaseFile = path.join(tmpdir(), `food-fantasy-combat-config-${process.pid}.db`);

before(() => {
  connectDatabase(databaseFile);
  runMigrations();
  seedCatalog();
});

after(() => {
  closeDatabase();
  for (const suffix of ['', '-wal', '-shm']) rmSync(`${databaseFile}${suffix}`, { force: true });
});

test('v7 外键引用链完整：enemy → skill/vfx 全部可解析', () => {
  const skills = new Set(listSkillDefs().map(skill => skill.id));
  const vfx = new Set(listVfxDefs().map(row => row.id));
  assert.ok(skills.has('sk-frost-nova'));
  assert.ok(vfx.has('vfx-skill-frost'));

  for (const enemy of listEnemyDefs()) {
    for (const skillId of JSON.parse(enemy.skill_ids) as string[]) {
      assert.ok(skills.has(skillId), `${enemy.name} 引用的技能 ${skillId} 必须存在`);
    }
    if (enemy.vfx_id) assert.ok(vfx.has(enemy.vfx_id), `${enemy.name} 引用的特效必须存在`);
  }
});

test('v7 Boss 判别：kind=boss 携带 phase_json，非 Boss 必须为 NULL（CHECK 约束）', () => {
  const bosses = listEnemyDefs('boss');
  // v17 seed v2：8 Boss（囡囡/咸与淡/壶中翁/雾厨无名氏/忘川馔/醉月仙/月蚀魔女/轮回之主）
  assert.equal(bosses.length, 8);
  for (const boss of bosses) {
    const phases = JSON.parse(boss.phase_json ?? '[]') as Array<{ threshold_bp: number }>;
    assert.ok(phases.length >= 1, `Boss ${boss.name} 必须携带阶段机制`);
    for (const phase of phases) {
      assert.ok(phase.threshold_bp > 0 && phase.threshold_bp <= 10000, '万分比阈值必须落在 (0, 10000]');
    }
  }
  const normals = listEnemyDefs('normal');
  assert.ok(normals.length >= 10);
  assert.ok(normals.every(enemy => enemy.phase_json === null));
});

test('v7 CHECK 约束：非 Boss 写 phase_json 被数据库拒绝', () => {
  assert.throws(() =>
    execute(
      `UPDATE enemy_defs SET phase_json = '[{"threshold_bp":5000}]' WHERE id = 'enemy-lantern'`,
    ),
  );
});

test('v7 逻辑外键（D-2）：validateSkillIds 对未知技能抛 422', () => {
  assert.throws(
    () => validateSkillIds(['sk-slap', 'sk-ghost']),
    (error: unknown) => error instanceof ApiError && error.status === 422,
  );
  // 合法清单不抛
  validateSkillIds(['sk-slap', 'sk-frost-nova']);
});

test('v7 catalog_meta：seed 后各域版本 >= 1，bump 原子自增', () => {
  const versions = getAllCatalogVersions();
  for (const domain of ['enemy', 'skill', 'vfx', 'scene', 'item', 'activity', 'leaderboard']) {
    assert.ok((versions[domain] ?? 0) >= 1, `${domain} 版本戳应已登记`);
  }
  const before = getCatalogVersion('enemy');
  transaction(() => bumpCatalogVersion('enemy'));
  assert.equal(getCatalogVersion('enemy'), before + 1);
});

test('v8 场景：默认战斗场景存在，关卡场景回退可用', () => {
  assert.ok(findSceneDef('scene-battle-main'));
  assert.equal(listSceneDefs('battle').length >= 1, true);
  // 关卡的 scene_id 已由 seed 回填为默认战斗场景
  const stage = queryOne<{ scene_id: string | null }>("SELECT scene_id FROM stage_defs WHERE id = '1-1'");
  assert.equal(stage?.scene_id, 'scene-battle-main');
  // 未配置/悬空引用回退默认场景
  assert.equal(resolveStageScene(null)?.id, 'scene-battle-main');
  assert.equal(resolveStageScene('scene-ghost')?.id, 'scene-battle-main');
});

test('seed 幂等：重复执行不抛错、不产生重复行、版本戳单调递增', () => {
  const enemyBefore = queryOne<{ total: number }>('SELECT COUNT(*) AS total FROM enemy_defs');
  const versionBefore = getCatalogVersion('enemy');
  assert.doesNotThrow(() => seedCatalog());
  const enemyAfter = queryOne<{ total: number }>('SELECT COUNT(*) AS total FROM enemy_defs');
  assert.equal(enemyAfter?.total, enemyBefore?.total, '重复 seed 不应产生重复行');
  assert.equal(getCatalogVersion('enemy'), versionBefore + 1, 'seed 重跑视为一次配置变更，版本自增');
});

test('v8 场景解锁等级判定字段随 catalog 下发口径一致（unlock_worldtree_level ∈ 1..100）', () => {
  for (const scene of listSceneDefs()) {
    assert.ok(scene.unlock_worldtree_level >= 1 && scene.unlock_worldtree_level <= 100);
  }
});

test('v7 玩家数据不受配置表影响：新玩家可正常创建并引用默认阵容', () => {
  const { player } = createGuest({ nickname: '配置旅人' });
  assert.ok(player.id);
  assert.ok(findSkillDef('sk-slap'));
  assert.ok(findEnemyDef('enemy-lantern'));
  const counts = queryAll<{ kind: string; total: number }>(
    'SELECT kind, COUNT(*) AS total FROM enemy_defs GROUP BY kind',
  );
  assert.equal(counts.length, 3, 'normal/elite/boss 三类齐备');
});
