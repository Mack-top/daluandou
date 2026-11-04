import { execute, queryAll, queryOne } from '../db/index.js';
import { nowIso } from '../lib/clock.js';
import type { CatalogMetaRow } from '../domain/types.js';

/* ------------------------------ 配置域版本戳（v7） ------------------------------ */

/**
 * 读取某配置域的当前版本。未登记过返回 0，语义为「该域从未变更，客户端可长期缓存」。
 */
export function getCatalogVersion(domain: string): number {
  const row = queryOne<CatalogMetaRow>('SELECT * FROM catalog_meta WHERE domain = ?', domain);
  return row ? Number(row.version) : 0;
}

export function getAllCatalogVersions(): Record<string, number> {
  return Object.fromEntries(
    queryAll<CatalogMetaRow>('SELECT * FROM catalog_meta').map(row => [row.domain, Number(row.version)]),
  );
}

/**
 * 版本自增（upsert）：配置写入方（seed / GM edit_config）在自己的事务内调用。
 * SQLite 无 INSERT ... ON CONFLICT DO UPDATE 引用旧值的独立域函数，
 * 用 catalog_meta.version + 1 原子递增，并发安全（写库串行化）。
 */
export function bumpCatalogVersion(domain: string): void {
  execute(
    `INSERT INTO catalog_meta (domain, version, updated_at) VALUES (?, 1, ?)
     ON CONFLICT(domain) DO UPDATE SET version = catalog_meta.version + 1, updated_at = excluded.updated_at`,
    domain,
    nowIso(),
  );
}
