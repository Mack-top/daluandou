import { z } from 'zod';
import { execute, queryAll, queryOne, transaction, type SqlValue } from '../db/index.js';
import { badRequest, notFound } from '../lib/errors.js';
import { nowIso } from '../lib/clock.js';
import { env } from '../config/env.js';
import { getAllCatalogVersions, getCatalogVersion, bumpCatalogVersion } from '../repositories/catalog-meta.repository.js';
import { insertGmAuditLog } from '../repositories/gm.repository.js';
import { resolveServerOpenDate, serverOpenDay } from './catalog.service.js';
import {
  CATALOG_VERSION_DOMAINS,
  CONFIG_DOMAINS,
  RUNTIME_DOMAIN_KEY,
  getConfigDomain,
  getConfigDomainByVersion,
  type ColumnSpec,
  type ConfigDomain,
} from '../config/config-domains.js';
import type { GmAccountRow } from '../domain/types.js';

export type ConfigRow = Record<string, unknown>;
export type ConfigActor = { gm: GmAccountRow; ip: string };

/**
 * 列定义 DTO：契约要求 { name, label, type, nullable, editable }，
 * 同时保留内部 key（表单/表格按 key 提交），二者并存便于新旧界面兼容。
 */
export type ColumnDto = {
  key: string;
  name: string;
  label: string;
  /** 后台界面约定的类型词（admin.html 的 renderFields / collectForm 按此分派控件） */
  type: string;
  /** 注册表内部存储类型（zod 校验口径），供诊断使用 */
  storageType: ColumnSpec['type'];
  nullable: boolean;
  editable: boolean;
  required: boolean;
  readOnly: boolean;
  options?: readonly string[];
  min?: number;
  max?: number;
  maxLength?: number;
  default?: string | number | null;
  help?: string;
};

/**
 * 内部列类型 → 后台 UI 类型词。
 * 后台管理页（backend/public/admin.html）用 'int' / 'number' 渲染数字输入并做
 * 前端整数校验，用 'text' 渲染 textarea；注册表内部用 'integer' / 'string'。
 * 两者在 DTO 层对齐，服务端 coerce 仍按 storageType（zod）校验，互不影响。
 */
function uiColumnType(spec: ColumnSpec): string {
  switch (spec.type) {
    case 'integer': return 'int';
    default: return spec.type;
  }
}

function columnDto(spec: ColumnSpec): ColumnDto {
  return {
    key: spec.key,
    name: spec.key,
    label: spec.label,
    type: uiColumnType(spec),
    storageType: spec.type,
    nullable: Boolean(spec.nullable),
    // editable 表达「表单是否接受用户输入」：主键在新建时必须由 GM 填写，
    // 编辑时由后台界面按 isPk 自行锁定，因此这里只有自动时间戳（autoNow）不可输入。
    // 若把主键标成 editable:false，界面会误判为「后端生成、可留空」而跳过必填校验。
    editable: !spec.autoNow,
    required: Boolean(spec.required),
    readOnly: Boolean(spec.readOnly),
    options: spec.options,
    min: spec.min,
    max: spec.max,
    maxLength: spec.maxLength,
    default: spec.default,
    help: spec.help,
  };
}

/** 标识符一律来自注册表白名单，这里只做防御性引号包裹。 */
const ident = (name: string) => `"${name.replace(/"/g, '""')}"`;

function requireDomain(key: string): ConfigDomain {
  const domain = getConfigDomain(key);
  if (!domain) throw notFound(`未知配置域：${key}`);
  return domain;
}

function requireWritable(domain: ConfigDomain): void {
  if (domain.readOnly) {
    if (domain.key === RUNTIME_DOMAIN_KEY) {
      throw badRequest('「运行时参数」来自服务器 .env / 进程环境，只读；修改需编辑 .env 并重启服务');
    }
    throw badRequest(`配置域「${domain.label}」为只读运维视图，不支持增改删`);
  }
}

function requireVersioned(domain: ConfigDomain): void {
  if (!domain.versionDomain) throw badRequest(`配置域「${domain.label}」没有关联版本域，无法发布`);
}

/** 虚拟域（runtime）不落库，由服务层从 env 直接组装行。 */
function isVirtual(domain: ConfigDomain): boolean {
  return domain.key === RUNTIME_DOMAIN_KEY;
}

/**
 * ORDER BY 也走白名单：片段只能来自注册表声明的列（orderBy 本身是常量，
 * 这里再做一次运行期校验，杜绝有人往注册表里塞注入片段）。
 */
function safeOrderBy(domain: ConfigDomain): string {
  const allowed = new Set(domain.columns.map(column => column.key));
  const tokens = domain.orderBy.split(',').map(part => part.trim().split(/\s+/)[0]);
  for (const token of tokens) {
    if (!allowed.has(token)) throw badRequest(`配置域「${domain.label}」排序字段非法：${token}`);
  }
  return domain.orderBy;
}

/* ------------------------------ 严格白名单 ------------------------------ */

/** 传了注册表未声明的列一律 400 拒绝（防注入 / 防越权改列），而不是静默忽略。 */
function rejectUnknownColumns(domain: ConfigDomain, input: Record<string, unknown>): void {
  const allowed = new Set(domain.columns.map(column => column.key));
  const unknown = Object.keys(input).filter(key => !allowed.has(key));
  if (unknown.length) {
    throw badRequest(
      `「${domain.label}」不接受未声明的列：${unknown.join('、')}。` +
      '仅允许配置域注册表白名单内的列。',
    );
  }
}

/* ------------------------------ zod 字段校验与归一化 ------------------------------ */

/** 把 UI 提交的任意值按列 type（zod）校验并转成 SQLite 可绑定标量；非法输入抛 400 带中文原因。 */
function coerce(spec: ColumnSpec, raw: unknown): SqlValue {
  const empty = raw === null || raw === undefined || raw === '';
  if (empty) {
    if (spec.autoNow) return nowIso();
    if (spec.nullable) return null;
    if (spec.required) throw badRequest(`「${spec.label}」为必填项`);
    if (spec.type === 'json') return spec.default ?? '{}';
    if (spec.type === 'integer' || spec.type === 'boolean') return 0;
    return '';
  }

  const fail = (message: string): never => {
    throw badRequest(message);
  };

  switch (spec.type) {
    case 'integer': {
      const parsed = z.coerce.number().int().safeParse(raw);
      if (!parsed.success) return fail(`「${spec.label}」必须是整数`);
      const value = parsed.data;
      if (spec.min !== undefined && value < spec.min) return fail(`「${spec.label}」不能小于 ${spec.min}`);
      if (spec.max !== undefined && value > spec.max) return fail(`「${spec.label}」不能大于 ${spec.max}`);
      return value;
    }
    case 'boolean': {
      // 严格 0/1 布尔：只接受 0、1、true、false 及其字符串形式，其它一律拒绝。
      const parsed = z.union([
        z.boolean(), z.literal(0), z.literal(1),
        z.enum(['0', '1', 'true', 'false']),
      ]).safeParse(raw);
      if (!parsed.success) return fail(`「${spec.label}」只能是 0 / 1（布尔）`);
      const value = parsed.data;
      return value === true || value === 1 || value === '1' || value === 'true' ? 1 : 0;
    }
    case 'enum': {
      const parsed = z.string().safeParse(raw);
      if (!parsed.success || !spec.options?.includes(parsed.data)) {
        return fail(`「${spec.label}」只能是：${(spec.options ?? []).join(' / ')}`);
      }
      return parsed.data;
    }
    case 'json': {
      const text = typeof raw === 'string' ? raw : JSON.stringify(raw);
      try {
        return JSON.stringify(JSON.parse(text));
      } catch {
        return fail(`「${spec.label}」不是合法 JSON：${text.slice(0, 80)}`);
      }
    }
    case 'datetime': {
      const parsed = z.string().regex(/^\d{4}-\d{2}-\d{2}/).safeParse(raw);
      if (!parsed.success) return fail(`「${spec.label}」须为 ISO 日期时间（YYYY-MM-DD…）`);
      return parsed.data;
    }
    default: {
      const parsed = z.string().safeParse(raw);
      if (!parsed.success) return fail(`「${spec.label}」必须是文本`);
      const value = parsed.data;
      if (spec.maxLength && value.length > spec.maxLength) {
        return fail(`「${spec.label}」长度不能超过 ${spec.maxLength} 字`);
      }
      return value;
    }
  }
}

/** 新建：所有列都写入（含自动时间戳与默认值）。 */
function buildInsertValues(domain: ConfigDomain, input: Record<string, unknown>): Record<string, SqlValue> {
  const values: Record<string, SqlValue> = {};
  for (const spec of domain.columns) {
    values[spec.key] = spec.autoNow ? nowIso() : coerce(spec, input[spec.key]);
  }
  return values;
}

/** 编辑：只写提交的列 + 自动时间戳；主键与只读列不可改，未提交的字段不清空。 */
function buildUpdateValues(domain: ConfigDomain, patch: Record<string, unknown>): Record<string, SqlValue> {
  const values: Record<string, SqlValue> = {};
  for (const spec of domain.columns) {
    if (spec.autoNow) {
      values[spec.key] = nowIso();
      continue;
    }
    if (spec.readOnly) continue;
    if (!Object.prototype.hasOwnProperty.call(patch, spec.key)) continue;
    values[spec.key] = coerce(spec, patch[spec.key]);
  }
  return values;
}

/* ------------------------------ 外键引用保护 ------------------------------ */

type Reference = { table: string; column: string; count: number };

/**
 * 删除前扫描所有表的外键，找出引用该行的记录。只要有引用（无论配置表还是
 * 玩家数据表）就拒绝删除——避免留下孤儿关卡/装备/玩家资产。
 * 退路上，DELETE 本身还会捕获 SQLite 外键约束错误（见 constraintMessage）。
 */
function findReferences(table: string, id: SqlValue): Reference[] {
  const references: Reference[] = [];
  const tables = queryAll<{ name: string }>(
    "SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%'",
  );
  for (const { name } of tables) {
    const foreignKeys = queryAll<{ table: string; from: string }>(
      `PRAGMA foreign_key_list(${ident(name)})`,
    );
    for (const fk of foreignKeys) {
      if (fk.table !== table) continue;
      const row = queryOne<{ n: number }>(
        `SELECT COUNT(*) AS n FROM ${ident(name)} WHERE ${ident(fk.from)} = ?`,
        id,
      );
      const count = row ? Number(row.n) : 0;
      if (count > 0) references.push({ table: name, column: fk.from, count });
    }
  }
  return references;
}

/** 把 SQLite 约束错误翻译成可读的中文 400，不把内部堆栈暴露给 GM。 */
function isConstraintError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  return /UNIQUE constraint failed|PRIMARY KEY|FOREIGN KEY constraint failed|CHECK constraint failed|constraint failed|SQLITE_CONSTRAINT/i.test(message);
}

function constraintMessage(error: unknown, domain: ConfigDomain): string {
  const message = error instanceof Error ? error.message : String(error);
  if (/UNIQUE|PRIMARY KEY/i.test(message)) return `保存失败：约束冲突（主键或唯一键重复，${domain.label}）。${message}`;
  if (/FOREIGN KEY/i.test(message)) return `保存失败：引用了不存在的关联配置。${message}`;
  if (/CHECK/i.test(message)) return `保存失败：约束冲突（字段取值不满足数据库约束，${domain.label}）。${message}`;
  return `保存失败：约束冲突（${domain.label}）。${message}`;
}

/* ------------------------------ 审计与版本 ------------------------------ */

function audit(actor: ConfigActor, op: string, domain: ConfigDomain, targetId: string, payload: unknown): void {
  insertGmAuditLog({
    gmId: actor.gm.id,
    action: 'edit_config',
    targetType: 'config',
    targetId: `${domain.key}:${targetId}`,
    payload: { op, domain: domain.key, ...(payload as object) },
    result: 'ok',
    ip: actor.ip,
  });
}

function currentVersion(domain: ConfigDomain): number {
  return domain.versionDomain ? getCatalogVersion(domain.versionDomain) : 0;
}

/* ------------------------------ 运行时参数（只读虚拟域） ------------------------------ */

/** 凭据类 env 值的统一打码占位：绝不回传明文。 */
const MASKED_VALUE = '***';

type RuntimeItem = {
  key: string;
  /** 契约行主键（与 key 同值），GM 台表格按 columns[].name 取列 */
  name: string;
  label: string;
  value: string;
  source: string;
  category: string;
};

/**
 * 运行时参数行（每次请求实时读取 env，不落库）。
 * 凭据类条目（paymentSecret / gmSeedPassword）无论是否配置，值一律打码为 '***'，
 * 从根上杜绝「未配置时误回传默认值 / 已配置时回传明文」两条泄露路径。
 */
function runtimeItems(): RuntimeItem[] {
  return [
    { key: 'serverOpenDate', name: 'serverOpenDate', label: '开服日期', value: resolveServerOpenDate(), source: 'SERVER_OPEN_DATE / catalog_meta', category: '开服与运营' },
    { key: 'serverOpenDay', name: 'serverOpenDay', label: '开服第几天', value: String(serverOpenDay()), source: '按开服日期实时计算', category: '开服与运营' },
    { key: 'nodeEnv', name: 'nodeEnv', label: '运行环境', value: env.nodeEnv, source: 'NODE_ENV', category: '服务与网络' },
    { key: 'port', name: 'port', label: '监听端口', value: String(env.port), source: 'PORT', category: '服务与网络' },
    { key: 'host', name: 'host', label: '监听地址', value: env.host, source: 'HOST', category: '服务与网络' },
    { key: 'corsOrigins', name: 'corsOrigins', label: '允许来源', value: env.corsOrigins.join(', '), source: 'CORS_ORIGIN', category: '服务与网络' },
    { key: 'sessionTtlHours', name: 'sessionTtlHours', label: '玩家会话时长(h)', value: String(env.sessionTtlHours), source: 'SESSION_TTL_HOURS', category: '会话与安全' },
    { key: 'gmSessionTtlHours', name: 'gmSessionTtlHours', label: 'GM 会话时长(h)', value: String(env.gmSessionTtlHours), source: 'GM_SESSION_TTL_HOURS', category: '会话与安全' },
    { key: 'gmIpAllowlist', name: 'gmIpAllowlist', label: 'GM IP 白名单', value: env.gmIpAllowlist.join(', '), source: 'GM_IP_ALLOWLIST', category: '会话与安全' },
    { key: 'serversMaintenance', name: 'serversMaintenance', label: '维护中区服', value: env.serversMaintenance.join(', ') || '（无）', source: 'SERVERS_MAINTENANCE', category: '会话与安全' },
    { key: 'serverBusyThreshold', name: 'serverBusyThreshold', label: '热闹服阈值', value: String(env.serverBusyThreshold), source: 'SERVER_BUSY_THRESHOLD', category: '会话与安全' },
    { key: 'paymentSecret', name: 'paymentSecret', label: '支付签名密钥', value: MASKED_VALUE, source: 'PAYMENT_SECRET', category: '凭据（已打码）' },
    { key: 'gmSeedPassword', name: 'gmSeedPassword', label: 'GM 初始口令', value: MASKED_VALUE, source: 'GM_SEED_PASSWORD', category: '凭据（已打码）' },
  ];
}

/** 契约行形态：{ name, label, value, category }（GM 台表格直接按列名渲染）。 */
function runtimeRows(): ConfigRow[] {
  return runtimeItems().map(({ name, label, value, category }) => ({ name, label, value, category }));
}

/* ------------------------------ 对外 API ------------------------------ */

/** 后台左侧域清单（含列定义 / 行数 / 版本，供前端自动生成表单与表格）。 */
export function listConfigDomains() {
  return CONFIG_DOMAINS.map(domain => {
    let rowCount = 0;
    if (isVirtual(domain)) {
      rowCount = runtimeItems().length;
    } else if (domain.table) {
      const row = queryOne<{ total: number }>(`SELECT COUNT(*) AS total FROM ${ident(domain.table)}`);
      rowCount = row ? Number(row.total) : 0;
    }
    return {
      key: domain.key,
      label: domain.label,
      group: domain.group,
      description: domain.description,
      table: domain.table,
      pk: domain.pk,
      primaryKey: domain.pk,
      readOnly: Boolean(domain.readOnly),
      versionDomain: domain.versionDomain ?? null,
      columns: domain.columns.map(columnDto),
      rowCount,
      version: currentVersion(domain),
    };
  });
}

/** 读取某配置域全部行 + 列定义 + 当前版本。 */
export function listConfigRows(key: string): { domain: ConfigDomain; rows: ConfigRow[]; columns: ColumnDto[]; version: number } {
  const domain = requireDomain(key);
  const columns = domain.columns.map(columnDto);
  if (isVirtual(domain)) return { domain, rows: runtimeRows(), columns, version: 0 };
  const rows = queryAll<ConfigRow>(`SELECT * FROM ${ident(domain.table)} ORDER BY ${safeOrderBy(domain)}`);
  return { domain, rows, columns, version: currentVersion(domain) };
}

/** 读取单行配置（GET /config/:domain/:id）。 */
export function getConfigRow(key: string, id: string): { row: ConfigRow; version: number; domain: string } {
  const domain = requireDomain(key);
  if (isVirtual(domain)) {
    const item = runtimeItems().find(candidate => candidate.name === id || candidate.key === id);
    if (!item) throw notFound(`配置不存在：${domain.label} / ${id}`);
    const { name, label, value, category } = item;
    return { row: { name, label, value, category }, version: 0, domain: domain.key };
  }
  const row = queryOne<ConfigRow>(`SELECT * FROM ${ident(domain.table)} WHERE ${ident(domain.pk)} = ?`, id);
  if (!row) throw notFound(`配置不存在：${domain.label} / ${id}`);
  return { row, version: currentVersion(domain), domain: domain.key };
}

/**
 * 运行时参数（.env / 进程环境，只读）。
 *
 * BUG-02 修复：`GET /api/admin/config/runtime` 是静态路由，命中本函数而非
 * `listConfigRows('runtime')`，此前缺少契约要求的 { domain, label, columns, rows,
 * version, readOnly }，GM 台 loadRows() 读 data.rows 拿到 undefined → 表格空白。
 * 现在返回与 `GET /config/:domain` 同构的超集；既有 note/items/versions/versionDomains
 * 字段全部保留（向后兼容），新增字段只增不删。
 *
 * version 恒为 0：runtime 是虚拟域，不写 catalog_meta、没有版本概念，
 * 每次请求实时读取 env，客户端无需按版本缓存。
 * 敏感值（支付签名密钥 / GM 初始口令）一律打码为 '***'，绝不明文回传。
 */
export function listRuntimeConfig() {
  const runtimeDomain = getConfigDomain(RUNTIME_DOMAIN_KEY) as ConfigDomain;
  return {
    /* ---- 契约形态（GET /config/:domain 同构，GM 台配置管理页签直接消费） ---- */
    domain: RUNTIME_DOMAIN_KEY,
    label: runtimeDomain.label,
    columns: runtimeDomain.columns.map(columnDto),
    rows: runtimeRows(),
    version: 0,
    readOnly: true,
    /* ---- 既有字段（v22 早期调用方与诊断仍可用） ---- */
    note: '运行时参数来自服务器 .env / 进程环境，只读展示；修改需编辑 .env 后重启服务，不会由后台写库。',
    items: runtimeItems().map(({ key, label, value, source }) => ({ key, label, value, source })),
    versions: getAllCatalogVersions(),
    versionDomains: CATALOG_VERSION_DOMAINS,
  };
}

export function listConfigVersions(): Record<string, number> {
  return getAllCatalogVersions();
}

/** 新增一行配置。事务内写库 + 版本自增 + 审计，返回新版本与域标识供界面反馈。 */
export function createConfigRow(key: string, input: Record<string, unknown>, actor: ConfigActor) {
  const domain = requireDomain(key);
  requireWritable(domain);
  requireVersioned(domain);
  rejectUnknownColumns(domain, input);
  const values = buildInsertValues(domain, input);
  const columns = domain.columns;
  const before = currentVersion(domain);

  try {
    transaction(() => {
      execute(
        `INSERT INTO ${ident(domain.table)} (${columns.map(spec => ident(spec.key)).join(', ')}) ` +
        `VALUES (${columns.map(() => '?').join(', ')})`,
        ...columns.map(spec => values[spec.key]),
      );
      bumpCatalogVersion(domain.versionDomain as string);
      audit(actor, 'create', domain, String(values[domain.pk]), { before: null, after: values });
    });
  } catch (error) {
    if (isConstraintError(error)) throw badRequest(constraintMessage(error, domain));
    throw error;
  }

  return {
    row: queryOne<ConfigRow>(`SELECT * FROM ${ident(domain.table)} WHERE ${ident(domain.pk)} = ?`, values[domain.pk]),
    domain: domain.key,
    versionBefore: before,
    version: currentVersion(domain),
  };
}

/** 编辑一行配置（主键与只读列不可改）。 */
export function updateConfigRow(key: string, id: string, patch: Record<string, unknown>, actor: ConfigActor) {
  const domain = requireDomain(key);
  requireWritable(domain);
  requireVersioned(domain);
  rejectUnknownColumns(domain, patch);
  const existing = queryOne<ConfigRow>(`SELECT * FROM ${ident(domain.table)} WHERE ${ident(domain.pk)} = ?`, id);
  if (!existing) throw notFound(`配置不存在：${domain.label} / ${id}`);

  const values = buildUpdateValues(domain, patch);
  const keys = Object.keys(values);
  if (!keys.length) throw badRequest('没有可保存的字段');
  const before = currentVersion(domain);

  try {
    transaction(() => {
      execute(
        `UPDATE ${ident(domain.table)} SET ${keys.map(column => `${ident(column)} = ?`).join(', ')} ` +
        `WHERE ${ident(domain.pk)} = ?`,
        ...keys.map(column => values[column]),
        id,
      );
      bumpCatalogVersion(domain.versionDomain as string);
      audit(actor, 'update', domain, id, { before: existing, after: values });
    });
  } catch (error) {
    if (isConstraintError(error)) throw badRequest(constraintMessage(error, domain));
    throw error;
  }

  return {
    row: queryOne<ConfigRow>(`SELECT * FROM ${ident(domain.table)} WHERE ${ident(domain.pk)} = ?`, id),
    domain: domain.key,
    versionBefore: before,
    version: currentVersion(domain),
  };
}

/** 删除一行配置；被任何表引用时拒绝，避免影响现有玩法。返回明确成功/失败反馈。 */
export function deleteConfigRow(key: string, id: string, actor: ConfigActor) {
  const domain = requireDomain(key);
  requireWritable(domain);
  requireVersioned(domain);
  const existing = queryOne<ConfigRow>(`SELECT * FROM ${ident(domain.table)} WHERE ${ident(domain.pk)} = ?`, id);
  if (!existing) throw notFound(`配置不存在：${domain.label} / ${id}`);

  const references = findReferences(domain.table, id);
  if (references.length) {
    throw badRequest(
      `无法删除：该配置已被 ${references.map(ref => `${ref.table}(${ref.count} 条)`).join('、')} 引用。` +
      '为避免影响现有玩法与玩家数据，请先解除引用，或改用「编辑」调整内容 / 关闭开关。',
    );
  }

  const before = currentVersion(domain);
  try {
    transaction(() => {
      execute(`DELETE FROM ${ident(domain.table)} WHERE ${ident(domain.pk)} = ?`, id);
      bumpCatalogVersion(domain.versionDomain as string);
      audit(actor, 'delete', domain, id, { before: existing, after: null });
    });
  } catch (error) {
    if (isConstraintError(error)) {
      throw badRequest(`无法删除：仍被其它表外键引用（${constraintMessage(error, domain)}）。请先解除引用。`);
    }
    throw error;
  }

  return { deleted: true, id, domain: domain.key, versionBefore: before, version: currentVersion(domain) };
}

/**
 * 一键发布：把所有可写配置域版本 +1，强制所有客户端下次拉取 catalog 时
 * 重新读取全量配置。配置值本身入库即生效，此操作用于「明确生效」确认。
 */
export function publishAllConfigs(actor: ConfigActor) {
  const before = getAllCatalogVersions();
  transaction(() => {
    for (const versionDomain of CATALOG_VERSION_DOMAINS) bumpCatalogVersion(versionDomain);
    insertGmAuditLog({
      gmId: actor.gm.id,
      action: 'edit_config',
      targetType: 'config',
      targetId: 'publish:all',
      payload: { op: 'publish', domains: CATALOG_VERSION_DOMAINS.length },
      result: 'ok',
      ip: actor.ip,
    });
  });
  return {
    publishedDomains: CATALOG_VERSION_DOMAINS.length,
    before,
    after: getAllCatalogVersions(),
  };
}

/** catalog 增量下发兜底：未单独实现 DTO 的配置域直接回传原始行（原始列名，注释见 catalog.service）。 */
export function listRawConfigRows(versionDomain: string): ConfigRow[] {
  const domain = getConfigDomainByVersion(versionDomain);
  if (!domain || !domain.table) return [];
  return queryAll<ConfigRow>(`SELECT * FROM ${ident(domain.table)} ORDER BY ${safeOrderBy(domain)}`);
}
