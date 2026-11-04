import { mkdirSync } from 'node:fs';
import path from 'node:path';
import { DatabaseSync, type StatementSync } from 'node:sqlite';
import { env } from '../config/env.js';

/** node:sqlite 允许绑定的标量类型（注意：不接受 boolean / undefined）。 */
export type SqlValue = string | number | bigint | null | Uint8Array;

let connection: DatabaseSync | null = null;

/**
 * 打开（或创建）SQLite 数据库并设置连接级 PRAGMA。
 * WAL 让读写并发更友好；foreign_keys 必须显式开启，SQLite 默认是关闭的。
 */
export function openDatabase(file: string = env.databasePath): DatabaseSync {
  mkdirSync(path.dirname(file), { recursive: true });
  const db = new DatabaseSync(file);
  db.exec('PRAGMA journal_mode = WAL;');
  db.exec('PRAGMA foreign_keys = ON;');
  db.exec('PRAGMA busy_timeout = 5000;');
  db.exec('PRAGMA synchronous = NORMAL;');
  return db;
}

/** 进程内单例连接；未初始化时直接报错，避免静默产生第二个连接。 */
export function getDb(): DatabaseSync {
  if (!connection) throw new Error('数据库尚未连接，请先调用 connectDatabase()');
  return connection;
}

export function connectDatabase(file: string = env.databasePath): DatabaseSync {
  if (connection) return connection;
  connection = openDatabase(file);
  return connection;
}

export function closeDatabase(): void {
  if (!connection) return;
  connection.close();
  connection = null;
}

/** 统一把 undefined 归一到 null，避免驱动绑定报错。 */
function normalize(params: SqlValue[]): SqlValue[] {
  return params.map(value => (value === undefined ? null : value));
}

function prepare(sql: string): StatementSync {
  return getDb().prepare(sql);
}

export function queryAll<T>(sql: string, ...params: SqlValue[]): T[] {
  return prepare(sql).all(...normalize(params)) as T[];
}

export function queryOne<T>(sql: string, ...params: SqlValue[]): T | undefined {
  return prepare(sql).get(...normalize(params)) as T | undefined;
}

export function execute(sql: string, ...params: SqlValue[]): { changes: number; lastInsertRowid: number } {
  const result = prepare(sql).run(...normalize(params));
  return { changes: Number(result.changes), lastInsertRowid: Number(result.lastInsertRowid) };
}

/**
 * 显式事务：业务写操作必须包在这里面，保证「扣资源 + 写流水 + 改状态」原子生效。
 * 使用 BEGIN IMMEDIATE，避免并发写入时升级锁失败。
 */
export function transaction<T>(fn: () => T): T {
  const db = getDb();
  db.exec('BEGIN IMMEDIATE');
  try {
    const result = fn();
    db.exec('COMMIT');
    return result;
  } catch (error) {
    try {
      db.exec('ROLLBACK');
    } catch {
      // 回滚失败时保留原始错误，避免掩盖根因
    }
    throw error;
  }
}

/** 便捷的计数查询。 */
export function countRows(sql: string, ...params: SqlValue[]): number {
  const row = queryOne<{ total: number }>(sql, ...params);
  return row ? Number(row.total) : 0;
}
