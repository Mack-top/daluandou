import { existsSync, rmSync } from 'node:fs';
import { closeDatabase, connectDatabase } from './index.js';
import { isMain } from '../lib/is-main.js';
import { env } from '../config/env.js';
import { runMigrations } from './migrate.js';
import { seedCatalog } from './seed.js';

/** 清空并重建数据库：删除文件 → 迁移 → 种子。仅用于开发环境。 */
export function resetDatabase(): void {
  closeDatabase();
  for (const suffix of ['', '-wal', '-shm']) {
    const file = `${env.databasePath}${suffix}`;
    if (existsSync(file)) rmSync(file, { force: true });
  }
  connectDatabase();
  runMigrations();
  seedCatalog();
  const count = env.databasePath;
  console.log(`[reset] 数据库已重建：${count}`);
}

if (isMain(import.meta.url)) {
  if (env.isProduction) {
    console.error('[reset] 拒绝在生产环境执行数据库重置');
    process.exit(1);
  }
  resetDatabase();
  closeDatabase();
}
