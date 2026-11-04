/**
 * v21 副本体系与功能活动开关：
 *   1. dungeon_defs / feature_toggles 种子完整，stage_defs 全部归属副本；
 *   2. catalog 下发 dungeons / features / serverOpenDate / serverOpenDay，stages 携带 dungeonId；
 *   3. 开服日期持久化幂等（重启不漂移），env SERVER_OPEN_DATE 优先；
 *   4. 开服天数单调：开服日当天 = 第 1 天。
 */
import { after, before, test } from 'node:test';
import assert from 'node:assert/strict';
import { rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { closeDatabase, connectDatabase, execute, queryAll, queryOne } from '../src/db/index.js';
import { runMigrations } from '../src/db/migrate.js';
import { seedCatalog } from '../src/db/seed.js';
import { getCatalog, resolveServerOpenDate, serverOpenDay } from '../src/services/catalog.service.js';
import { gmListFeatureToggles, gmUpdateFeatureToggle } from '../src/services/gm.service.js';
import { insertGmAccount, findGmByUsername } from '../src/repositories/gm.repository.js';
import { hashPassword } from '../src/lib/password.js';
import type { GmAccountRow } from '../src/domain/types.js';
import { ApiError } from '../src/lib/errors.js';

const databaseFile = path.join(tmpdir(), `food-fantasy-dungeon-${process.pid}.db`);

before(() => {
  connectDatabase(databaseFile);
  runMigrations();
  seedCatalog();
});

after(() => {
  closeDatabase();
  for (const suffix of ['', '-wal', '-shm']) rmSync(`${databaseFile}${suffix}`, { force: true });
});

function makeGm(username: string, role: GmAccountRow['role']): GmAccountRow {
  insertGmAccount({ username, passwordHash: hashPassword('TestPass123'), role });
  const gm = findGmByUsername(username);
  assert.ok(gm);
  return gm;
}

test('副本种子：6 个副本、关卡全覆盖、解锁条件单调递增', () => {
  const dungeons = queryAll<{ id: string; order_index: number; unlock_level: number; unlock_open_day: number }>(
    'SELECT id, order_index, unlock_level, unlock_open_day FROM dungeon_defs ORDER BY order_index',
  );
  assert.equal(dungeons.length, 6);
  for (let index = 1; index < dungeons.length; index += 1) {
    assert.ok(dungeons[index].unlock_level >= dungeons[index - 1].unlock_level, '副本解锁等级应随顺序单调不减');
    assert.ok(dungeons[index].unlock_open_day >= dungeons[index - 1].unlock_open_day, '副本开服天要求应随顺序单调不减');
  }
  // 每个副本至少 1 关，全部关卡归属副本且关卡 id 与副本一对一覆盖
  const orphans = queryOne<{ total: number }>('SELECT COUNT(*) AS total FROM stage_defs WHERE dungeon_id IS NULL');
  assert.equal(Number(orphans?.total), 0);
  for (const dungeon of dungeons) {
    const stages = queryOne<{ total: number }>('SELECT COUNT(*) AS total FROM stage_defs WHERE dungeon_id = ?', dungeon.id);
    assert.ok(Number(stages?.total) >= 1, `副本 ${dungeon.id} 至少应有 1 关`);
  }
  // 章节-副本映射与后端种子一致：6 章节 → 6 副本
  const chapters = queryOne<{ total: number }>('SELECT COUNT(DISTINCT chapter) AS total FROM stage_defs');
  assert.equal(Number(chapters?.total), 6);
});

test('catalog 下发：dungeons / features / serverOpenDate / serverOpenDay / stages.dungeonId', () => {
  const catalog = getCatalog() as Record<string, unknown>;
  const dungeons = catalog.dungeons as Array<Record<string, unknown>>;
  const features = catalog.features as Array<Record<string, unknown>>;
  const stages = catalog.stages as Array<Record<string, unknown>>;

  assert.equal(dungeons.length, 6);
  assert.ok(dungeons.every(dungeon => typeof dungeon.unlockLevel === 'number' && typeof dungeon.unlockOpenDay === 'number'));

  assert.ok(features.length >= 20, '功能与活动开关应随 catalog 下发');
  const seven = features.find(feature => feature.key === 'seven')!;
  assert.ok(seven, '七日之约开关应存在');
  assert.equal(seven.category, 'activity');
  assert.equal(seven.openDay, 1);
  assert.equal(seven.closeDay, 7);
  assert.equal(seven.enabled, true, 'enabled 应为布尔值');

  assert.ok(stages.every(stage => typeof stage.dungeonId === 'string'), '全部关卡的 catalog DTO 都应携带 dungeonId');
  assert.match(catalog.serverOpenDate as string, /^\d{4}-\d{2}-\d{2}$/, 'serverOpenDate 应为 ISO 日期');
  assert.equal(catalog.serverOpenDay, 1, '全新测试库开服日当天应为第 1 天');
});

test('开服日期持久化幂等：手动改写后再读不漂移', () => {
  const first = resolveServerOpenDate();
  assert.match(first, /^\d{4}-\d{2}-\d{2}$/);
  // 模拟「开服日期在过去」：直接改写 catalog_meta 后再次读取应返回改写值（env 未配置时以库为准）
  execute("UPDATE catalog_meta SET updated_at = '2024-01-01T00:00:00.000Z' WHERE domain = 'server_open_date'");
  assert.equal(resolveServerOpenDate(), '2024-01-01');
  assert.ok(serverOpenDay() > 1, '开服日期在过去时，开服天数应大于 1');
});

test('功能开关 CHECK 约束：非法 category / 非法 enabled 必须写不进去', () => {
  assert.throws(() => execute(
    "INSERT INTO feature_toggles (key, name, category, enabled, open_day, close_day, sort_index, detail) VALUES ('x-bad', '非法', 'plugin', 1, NULL, NULL, 999, '')",
  ), 'category 必须限于 feature/activity/system');
  assert.throws(() => execute(
    "INSERT INTO feature_toggles (key, name, category, enabled, open_day, close_day, sort_index, detail) VALUES ('x-bad2', '非法', 'feature', 2, NULL, NULL, 999, '')",
  ), 'enabled 必须限于 0/1');
  assert.throws(() => execute(
    "INSERT INTO dungeon_defs (id, name, english, description, order_index, unlock_level, unlock_open_day) VALUES ('dungeon-bad', '非法', '', '', 99, 0, 1)",
  ), 'unlock_level 必须落在 1..150');
});

test('GM 开关管理：修改生效 + feature 域版本自增 + 审计落库', () => {
  const gm = makeGm(`gm-feature-${Date.now()}`, 'ops');
  const versionBefore = queryOne<{ version: number }>("SELECT version FROM catalog_meta WHERE domain = 'feature'")?.version ?? 0;

  const updated = gmUpdateFeatureToggle({ gm, key: 'seven', enabled: false, openDay: 1, closeDay: 14, ip: '127.0.0.1' });
  assert.equal(updated.enabled, false);
  assert.equal(updated.closeDay, 14);

  const row = queryOne<{ enabled: number; close_day: number }>("SELECT enabled, close_day FROM feature_toggles WHERE key = 'seven'");
  assert.equal(row?.enabled, 0);
  assert.equal(row?.close_day, 14);

  const versionAfter = queryOne<{ version: number }>("SELECT version FROM catalog_meta WHERE domain = 'feature'")?.version ?? 0;
  assert.ok(versionAfter > versionBefore, '修改开关必须 bump feature 域版本（动态生效）');

  // catalog 重新读取应反映新状态
  const catalog = getCatalog() as { features: Array<{ key: string; enabled: boolean; closeDay: number | null }> };
  const seven = catalog.features.find(feature => feature.key === 'seven');
  assert.equal(seven?.enabled, false);
  assert.equal(seven?.closeDay, 14);

  // GM 列表接口返回布尔口径
  const listed = gmListFeatureToggles().find(feature => feature.key === 'seven');
  assert.equal(listed?.enabled, false);

  // 恢复开启 + 清除窗口（null 语义）
  gmUpdateFeatureToggle({ gm, key: 'seven', enabled: true, openDay: 1, closeDay: null });
  const restored = queryOne<{ enabled: number; close_day: number | null }>("SELECT enabled, close_day FROM feature_toggles WHERE key = 'seven'");
  assert.equal(restored?.enabled, 1);
  assert.equal(restored?.close_day, null);

  const audit = queryOne<{ total: number }>(
    "SELECT COUNT(*) AS total FROM gm_audit_logs WHERE action = 'edit_config' AND target_id LIKE 'feature_toggle:%'",
  );
  assert.ok(Number(audit?.total) >= 2, '每次修改都应写 GM 审计');
});

test('GM 开关管理：非法输入被拒绝（未知 key / closeDay < openDay / 非整数）', () => {
  const gm = makeGm(`gm-feature-bad-${Date.now()}`, 'ops');
  assert.throws(() => gmUpdateFeatureToggle({ gm, key: 'no-such-toggle', enabled: false }), ApiError);
  assert.throws(() => gmUpdateFeatureToggle({ gm, key: 'seven', openDay: 5, closeDay: 2 }), ApiError);
  assert.throws(() => gmUpdateFeatureToggle({ gm, key: 'seven', openDay: 0 }), ApiError);
});
