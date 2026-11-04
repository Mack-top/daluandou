/**
 * v22 · T-CONFIG-API 全配置通用 CRUD 验证
 * -----------------------------------------------------------------------------
 * 覆盖：域注册表完整性（列名逐表对账 schema）、CRUD 全链路、版本自增、
 * GM 审计落库、外键删除保护、非法输入拒绝、只读域拒绝写入、
 * 白名单防注入、catalog 增量下发与全量字段不回归。
 *
 * 本批次不加表、不加迁移：顺带断言表数仍 58、迁移版本仍 21。
 */
import { after, before, test } from 'node:test';
import assert from 'node:assert/strict';
import { rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { closeDatabase, connectDatabase, queryAll, queryOne } from '../src/db/index.js';
import { runMigrations } from '../src/db/migrate.js';
import { seedCatalog } from '../src/db/seed.js';
import { hashPassword } from '../src/lib/password.js';
import { insertGmAccount, findGmByUsername } from '../src/repositories/gm.repository.js';
import { getCatalogVersion, getAllCatalogVersions } from '../src/repositories/catalog-meta.repository.js';
import { ApiError } from '../src/lib/errors.js';
import {
  CATALOG_VERSION_DOMAINS,
  CONFIG_DOMAINS,
  CONFIG_TABLES,
  RUNTIME_DOMAIN_KEY,
  getConfigDomain,
} from '../src/config/config-domains.js';
import {
  createConfigRow,
  deleteConfigRow,
  getConfigRow,
  listConfigDomains,
  listConfigRows,
  listConfigVersions,
  listRawConfigRows,
  listRuntimeConfig,
  publishAllConfigs,
  updateConfigRow,
  type ConfigActor,
} from '../src/services/admin-config.service.js';
import { getCatalog, getCatalogDelta } from '../src/services/catalog.service.js';
import type { GmAccountRow } from '../src/domain/types.js';

const databaseFile = path.join(tmpdir(), `food-fantasy-admin-config-${process.pid}.db`);

let actor: ConfigActor;

before(() => {
  connectDatabase(databaseFile);
  runMigrations();
  seedCatalog();
  insertGmAccount({ username: 'config-admin', passwordHash: hashPassword('TestPass123'), role: 'super' });
  const gm = findGmByUsername('config-admin') as GmAccountRow;
  actor = { gm, ip: '127.0.0.1' };
});

after(() => {
  closeDatabase();
  for (const suffix of ['', '-wal', '-shm']) rmSync(`${databaseFile}${suffix}`, { force: true });
});

/** 断言抛出的 ApiError 带指定状态码与可读 message 片段。 */
function expectApiError(fn: () => unknown, status: number, fragment?: string): void {
  assert.throws(fn, (error: unknown) => {
    assert.ok(error instanceof ApiError, '应抛出 ApiError');
    assert.equal(error.status, status);
    if (fragment) assert.ok(error.message.includes(fragment), `错误信息应包含「${fragment}」，实际：${error.message}`);
    return true;
  });
}

/* ------------------------------ 1. 域注册表完整性 ------------------------------ */

test('域注册表覆盖全部静态定义表，且列名与 schema.sql 逐表精确一致', () => {
  const tables = new Set(
    queryAll<{ name: string }>("SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%'")
      .map(row => row.name),
  );

  // v22 要求覆盖的 24 张表（含 catalog_meta / schema_migrations 只读视图 + battle_passes 只读）
  const expected = [
    'level_exp_defs', 'level_stats_defs', 'class_defs', 'character_defs', 'equipment_defs',
    'dungeon_defs', 'stage_defs', 'feature_toggles', 'quest_defs', 'mail_defs',
    'shop_pack_defs', 'trade_rate_defs', 'market_offer_defs', 'astrology_node_defs',
    'vfx_defs', 'skill_defs', 'enemy_defs', 'scene_defs', 'item_defs', 'activity_defs',
    'leaderboard_defs', 'battle_passes', 'catalog_meta', 'schema_migrations',
  ];
  for (const table of expected) {
    assert.ok(tables.has(table), `schema 中应存在表 ${table}`);
    assert.ok(CONFIG_TABLES.has(table), `注册表应覆盖 ${table}`);
  }

  // 每一列都必须真的存在于物理表，且不允许漏列（防止「凭印象写列名」）
  for (const domain of CONFIG_DOMAINS) {
    if (!domain.table) continue; // runtime 是虚拟域
    const actual = queryAll<{ name: string }>(`SELECT name FROM pragma_table_info('${domain.table}')`)
      .map(row => row.name).sort();
    const declared = domain.columns.map(column => column.key).sort();
    assert.deepEqual(declared, actual, `${domain.key} (${domain.table}) 列清单应与 schema 完全一致`);
    assert.ok(domain.columns.some(column => column.key === domain.pk), `${domain.key} 主键应在列清单中`);
    const orderTokens = domain.orderBy.split(',').map(part => part.trim().split(/\s+/)[0]);
    for (const token of orderTokens) {
      assert.ok(declared.includes(token), `${domain.key} 排序字段 ${token} 必须是白名单列`);
    }
  }

  // 敏感/玩家动态表绝不开放
  for (const forbidden of ['players', 'gm_accounts', 'gm_audit_logs', 'player_resources', 'payment_orders', 'player_sessions']) {
    assert.ok(!CONFIG_TABLES.has(forbidden), `${forbidden} 不应登记为配置域`);
  }
  // 只读域标记正确
  for (const key of [RUNTIME_DOMAIN_KEY, 'battle_passes', 'catalog_versions', 'migrations']) {
    assert.equal(getConfigDomain(key)?.readOnly, true, `${key} 应为只读域`);
  }
  assert.equal(getConfigDomain(RUNTIME_DOMAIN_KEY)?.table, '', 'runtime 为虚拟域，不落库');
  // 所有可写域都有版本域，且都进入 catalog 增量下发
  for (const domain of CONFIG_DOMAINS.filter(item => !item.readOnly)) {
    assert.ok(domain.versionDomain, `${domain.key} 应有版本域`);
    assert.ok(CATALOG_VERSION_DOMAINS.includes(domain.versionDomain as string), `${domain.key} 应参与增量下发`);
  }

  // 本批次不加表 / 不加迁移
  assert.equal(tables.size, 58, '表数仍应为 58');
  assert.equal(Number(queryOne<{ max: number }>('SELECT MAX(version) AS max FROM schema_migrations')?.max), 21, '迁移版本仍为 21');
});

test('域清单 DTO 带 primaryKey / columns(name,nullable,editable) / rowCount / version', () => {
  const domains = listConfigDomains();
  assert.ok(domains.length >= 26);
  for (const domain of domains) {
    assert.equal(typeof domain.primaryKey, 'string');
    assert.equal(domain.primaryKey, domain.pk);
    assert.ok(Number.isInteger(domain.rowCount), `${domain.key} 应有行数`);
    assert.ok(Number.isInteger(domain.version), `${domain.key} 应有版本`);
    assert.ok(domain.columns.length > 0);
    for (const column of domain.columns) {
      assert.equal(column.name, column.key);
      assert.equal(typeof column.label, 'string');
      assert.equal(typeof column.nullable, 'boolean');
      assert.equal(typeof column.editable, 'boolean');
    }
  }
  const runtime = domains.find(domain => domain.key === RUNTIME_DOMAIN_KEY);
  assert.ok(runtime);
  assert.equal(runtime.readOnly, true);
  assert.ok(runtime.rowCount >= 10, 'runtime 应展示 .env 运行时参数');
});

/* ------------------------------ 2. CRUD 全链路 / 版本 / 审计 ------------------------------ */

test('CRUD 全链路：新建 → 详情 → 编辑 → 删除，版本逐次 +1 且全部落审计', () => {
  const version0 = getCatalogVersion('feature');
  const input = {
    key: 'test-toggle-v22', name: '测试开关', category: 'feature',
    enabled: 1, sort_index: 999, detail: 'v22 测试用',
  };

  const created = createConfigRow('features', input, actor);
  assert.equal(created.domain, 'features');
  assert.equal(created.version, version0 + 1, '新建后版本 +1');
  assert.equal(created.row?.key, input.key);
  assert.equal(created.row?.enabled, 1);
  assert.equal(created.row?.open_day, null, 'nullable 列应写 NULL');

  const detail = getConfigRow('features', input.key);
  assert.equal(detail.domain, 'features');
  assert.equal(detail.version, version0 + 1);
  assert.equal(detail.row?.name, '测试开关');

  const updated = updateConfigRow('features', input.key, { name: '改名后的开关', sort_index: 1000 }, actor);
  assert.equal(updated.version, version0 + 2, '编辑后版本 +1');
  assert.equal(updated.row?.name, '改名后的开关');
  assert.equal(updated.row?.sort_index, 1000);
  assert.equal(updated.row?.enabled, 1, '未提交的字段不得被清空/改动');
  assert.equal(updated.row?.key, input.key, '主键不可改');

  const audits = queryAll<{ action: string; target_type: string; target_id: string; payload_json: string; result: string }>(
    "SELECT * FROM gm_audit_logs WHERE gm_id = ? AND action = 'edit_config' AND target_id = ? ORDER BY created_at, rowid",
    actor.gm.id, `features:${input.key}`,
  );
  assert.equal(audits.length, 2, '新建 + 编辑各一条审计');
  for (const log of audits) {
    assert.equal(log.target_type, 'config');
    assert.equal(log.result, 'ok');
    const payload = JSON.parse(log.payload_json) as { op: string; domain: string; before: unknown; after: unknown };
    assert.equal(payload.domain, 'features');
    assert.ok(['create', 'update'].includes(payload.op));
    assert.ok('before' in payload && 'after' in payload, '审计 payload 应记录 before/after');
  }

  const deleted = deleteConfigRow('features', input.key, actor);
  assert.equal(deleted.deleted, true);
  assert.equal(deleted.id, input.key);
  assert.equal(deleted.domain, 'features');
  assert.equal(deleted.version, version0 + 3, '删除后版本 +1');
  assert.equal(queryOne('SELECT * FROM feature_toggles WHERE key = ?', input.key), undefined, '行应已物理删除');
  assert.equal(
    queryAll("SELECT * FROM gm_audit_logs WHERE target_id = ?", `features:${input.key}`).length,
    3,
    '删除也应落审计',
  );
});

test('一键发布：所有可写版本域 +1，且返回 before / after 版本映射', () => {
  const before = getAllCatalogVersions();
  const result = publishAllConfigs(actor);
  assert.equal(result.publishedDomains, CATALOG_VERSION_DOMAINS.length);
  for (const domain of CATALOG_VERSION_DOMAINS) {
    assert.equal(result.after[domain], (before[domain] ?? 0) + 1, `${domain} 版本应 +1`);
  }
  assert.equal(listConfigVersions().feature, result.after.feature);
});

/* ------------------------------ 3. 外键删除保护 ------------------------------ */

test('外键保护：被其它表引用的配置行禁止删除，且给出明确引用表名', () => {
  const classRow = queryOne<{ id: string }>('SELECT id FROM class_defs LIMIT 1');
  assert.ok(classRow);
  const versionBefore = getCatalogVersion('class');

  expectApiError(
    () => deleteConfigRow('classes', classRow.id, actor),
    400,
    'character_defs',
  );
  assert.ok(queryOne('SELECT * FROM class_defs WHERE id = ?', classRow.id), '被引用行不得被删除');
  assert.equal(getCatalogVersion('class'), versionBefore, '拒绝删除时版本不得变化');

  // 等级表被 level_stats_defs / equipment_defs 引用
  expectApiError(
    () => deleteConfigRow('level_exp', '1', actor),
    400,
    '无法删除',
  );
  assert.ok(queryOne('SELECT * FROM level_exp_defs WHERE level = 1'), '等级 1 不得被删除');
});

test('未被任何表引用的配置行可以删除，并返回明确成功反馈', () => {
  const key = 'test-toggle-deletable';
  createConfigRow('features', {
    key, name: '可删除开关', category: 'system', enabled: 0, sort_index: 998,
  }, actor);
  const result = deleteConfigRow('features', key, actor);
  assert.equal(result.deleted, true);
  assert.equal(result.id, key);
  assert.equal(result.domain, 'features');
  assert.equal(queryOne('SELECT * FROM feature_toggles WHERE key = ?', key), undefined);
});

/* ------------------------------ 4. 非法输入 / 只读域 / 白名单 ------------------------------ */

test('zod 校验：整数、0/1 布尔、枚举、必填、长度、JSON 非法值一律 400', () => {
  const base = {
    key: 'test-invalid', name: '校验用', category: 'feature',
    enabled: 1, sort_index: 1,
  };
  expectApiError(() => createConfigRow('features', { ...base, sort_index: 1.5 }, actor), 400, '必须是整数');
  expectApiError(() => createConfigRow('features', { ...base, enabled: 'not-a-bool' }, actor), 400, '0 / 1');
  expectApiError(() => createConfigRow('features', { ...base, category: 'hacker' }, actor), 400, '只能是');
  expectApiError(() => createConfigRow('features', { key: 'x', enabled: 1, category: 'feature', sort_index: 1 }, actor), 400, '必填项');
  expectApiError(() => createConfigRow('features', { ...base, name: 'x'.repeat(200) }, actor), 400, '长度不能超过');
  expectApiError(() => createConfigRow('features', { ...base, open_day: -3 }, actor), 400, '不能小于');
  expectApiError(
    () => createConfigRow('stages', {
      id: 'test-stage-json', chapter: '测试', name: 'JSON 校验',
      order_index: 1, suggested_power: 100, reward_json: '{not-json',
    }, actor),
    400,
    '不是合法 JSON',
  );
  // 非法输入不得污染库
  assert.equal(queryOne('SELECT * FROM feature_toggles WHERE key = ?', 'test-invalid'), undefined);
});

test('只读域拒绝增改删；runtime 明确提示需改 .env 并重启', () => {
  const dummy = { domain: 'x', version: 1 };
  expectApiError(() => createConfigRow('catalog_versions', dummy, actor), 400, '只读');
  expectApiError(() => updateConfigRow('catalog_versions', 'feature', { version: 99 }, actor), 400, '只读');
  expectApiError(() => deleteConfigRow('migrations', '1', actor), 400, '只读');
  expectApiError(() => createConfigRow('battle_passes', { player_id: 'p' }, actor), 400, '只读');
  expectApiError(() => createConfigRow(RUNTIME_DOMAIN_KEY, { key: 'x' }, actor), 400, '.env');
  expectApiError(() => updateConfigRow(RUNTIME_DOMAIN_KEY, 'port', { value: '9999' }, actor), 400, '.env');

  // 只读域仍可正常读取（runtime 行为契约形态 {name,label,value,category}）
  const runtime = listConfigRows(RUNTIME_DOMAIN_KEY);
  assert.equal(runtime.domain.readOnly, true);
  assert.ok(runtime.rows.some(row => row.name === 'port'));
  assert.ok(runtime.columns.length > 0);
  assert.equal(getConfigRow(RUNTIME_DOMAIN_KEY, 'port').row.name, 'port');
  assert.ok(listConfigRows('catalog_versions').rows.length > 0);
  assert.equal(listConfigRows('battle_passes').domain.readOnly, true);
});

/* ------------------------------ 4.5 BUG-02：runtime 虚拟域契约形态与敏感值打码 ------------------------------ */

test('BUG-02 runtime 域返回契约形态（rows/columns/readOnly/version），既有字段保留', () => {
  // GET /api/admin/config/runtime 命中静态路由 → listRuntimeConfig()，
  // 必须与 GET /config/:domain 同构，否则 GM 台 loadRows() 读 data.rows 拿到 undefined。
  const payload = listRuntimeConfig();
  assert.equal(payload.domain, RUNTIME_DOMAIN_KEY);
  assert.equal(payload.label, '运行时参数');
  assert.equal(payload.readOnly, true);
  assert.equal(payload.version, 0, '虚拟域不落 catalog_meta，版本恒为 0');

  assert.ok(Array.isArray(payload.rows) && payload.rows.length >= 10, 'rows 应为非空数组');
  const columnNames = payload.columns.map(column => column.name);
  for (const required of ['name', 'label', 'value', 'category']) {
    assert.ok(columnNames.includes(required), `columns 应包含 ${required} 列`);
  }
  for (const row of payload.rows as Array<Record<string, unknown>>) {
    for (const field of ['name', 'label', 'value', 'category']) {
      assert.ok(field in row, `每行都应有 ${field} 字段`);
    }
    assert.equal(typeof row.value, 'string');
  }
  // columns 与 rows 对齐：每列都能在行里取到值（GM 台按列名渲染单元格）
  for (const column of payload.columns) {
    assert.ok(payload.rows.every(row => column.name in row), `列 ${column.name} 应能在每行取到`);
  }

  // 既有字段向后兼容，不删
  assert.ok(typeof payload.note === 'string' && payload.note.includes('.env'));
  assert.ok(Array.isArray(payload.items) && payload.items.length === payload.rows.length);
  assert.ok(payload.items.every(item => 'key' in item && 'source' in item));
  assert.ok(typeof payload.versions === 'object');
  assert.ok(Array.isArray(payload.versionDomains));

  // 与 listConfigRows('runtime') / getConfigRow 保持同一行形态
  const viaDomain = listConfigRows(RUNTIME_DOMAIN_KEY);
  assert.deepEqual(viaDomain.rows, payload.rows);
  assert.deepEqual(viaDomain.columns.map(column => column.name), payload.columns.map(column => column.name));
  assert.deepEqual(getConfigRow(RUNTIME_DOMAIN_KEY, 'port').row, payload.rows.find(row => row.name === 'port'));
});

test('BUG-02 敏感 env 值一律打码，响应体不回传任何明文凭据', () => {
  const serialized = JSON.stringify(listRuntimeConfig());
  // 默认 paymentSecret 为 'dev-only-payment-secret'，绝不允许出现在响应里
  assert.ok(!serialized.includes('dev-only-payment-secret'), '响应不得包含支付签名密钥明文');
  const rows = listRuntimeConfig().rows as Array<{ name: string; value: string }>;
  const payment = rows.find(row => row.name === 'paymentSecret');
  assert.ok(payment, '应展示支付签名密钥条目（打码）');
  assert.equal(payment.value, '***', 'paymentSecret 值应打码');
  const gmSeed = rows.find(row => row.name === 'gmSeedPassword');
  assert.ok(gmSeed, '应展示 GM 初始口令条目（打码）');
  assert.equal(gmSeed.value, '***', 'gmSeedPassword 值应打码（无论是否配置都不回传明文）');
  // 打码行也应有明确分类，便于 GM 识别
  const categorized = (listRuntimeConfig().rows as Array<{ name: string; category: string }>)
    .filter(row => row.name === 'paymentSecret' || row.name === 'gmSeedPassword');
  for (const row of categorized) assert.ok(row.category.includes('凭据'));
});

test('白名单防注入：未声明列一律拒绝，注入式列名/值不会破坏数据库', () => {
  const base = {
    key: 'test-injection', name: '注入测试', category: 'feature',
    enabled: 1, sort_index: 1,
  };
  expectApiError(
    () => createConfigRow('features', { ...base, evil: 'DROP TABLE players' }, actor),
    400,
    '未声明的列',
  );
  expectApiError(
    () => createConfigRow('features', { ...base, 'name); DROP TABLE players;--': 'x' }, actor),
    400,
    '未声明的列',
  );
  expectApiError(
    () => updateConfigRow('features', 'test-injection', { 'enabled = 1; DROP TABLE players--': 1 }, actor),
    400,
    '未声明的列',
  );
  assert.equal(queryOne('SELECT * FROM feature_toggles WHERE key = ?', 'test-injection'), undefined);

  // 合法的「值」里带 SQL 片段只是普通字符串，用参数绑定写入，不执行
  createConfigRow('features', { ...base, detail: "'; DROP TABLE players; --" }, actor);
  assert.equal(
    queryOne<{ detail: string }>('SELECT detail FROM feature_toggles WHERE key = ?', 'test-injection')?.detail,
    "'; DROP TABLE players; --",
  );
  assert.ok(queryOne("SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'players'"), 'players 表仍存在');
  deleteConfigRow('features', 'test-injection', actor);
});

test('未知域 / 不存在的行返回 404，重复主键返回可读 400', () => {
  expectApiError(() => listConfigRows('not-a-domain'), 404, '未知配置域');
  expectApiError(() => getConfigRow('features', 'missing-row'), 404, '配置不存在');
  const input = { key: 'test-dup', name: '重复主键', category: 'feature', enabled: 1, sort_index: 1 };
  createConfigRow('features', input, actor);
  expectApiError(() => createConfigRow('features', input, actor), 400, '约束冲突');
  deleteConfigRow('features', 'test-dup', actor);
});

/* ------------------------------ 5. catalog 生效链路不回归 ------------------------------ */

test('getCatalog 字段保持不变；配置写入可通过 delta 的 versions 感知', () => {
  const catalog = getCatalog();
  for (const field of [
    'characters', 'stages', 'dungeons', 'features', 'quests', 'mails',
    'shopPacks', 'tradeRates', 'marketOffers', 'astrology', 'equipment',
    'levels', 'classes', 'serverOpenDate', 'serverOpenDay',
  ]) {
    assert.ok(field in catalog, `getCatalog 必须保留 ${field} 字段`);
  }
  assert.ok(Array.isArray(catalog.features));
  assert.ok(Array.isArray(catalog.levels) && catalog.levels.length === 150);

  // 从未变更且客户端未上报过的域不进入 changes（避免首刷把 150 行大表全量塞回）
  const emptyDelta = getCatalogDelta({});
  assert.ok(emptyDelta.versions && typeof emptyDelta.versions === 'object');
  assert.ok(Object.keys(emptyDelta.changes).length <= CATALOG_VERSION_DOMAINS.length);

  const before = getCatalogVersion('feature');
  createConfigRow('features', {
    key: 'test-delta', name: '增量测试', category: 'feature', enabled: 1, sort_index: 997,
  }, actor);
  const after = getCatalogVersion('feature');
  assert.equal(after, before + 1);
  const delta = getCatalogDelta({ feature: before });
  assert.equal(delta.versions.feature, after);
  assert.ok('feature' in delta.changes, '变更域应出现在 changes');
  assert.ok(Array.isArray(delta.changes.feature));
  assert.ok(Array.isArray(listRawConfigRows('feature')));
  deleteConfigRow('features', 'test-delta', actor);
});
