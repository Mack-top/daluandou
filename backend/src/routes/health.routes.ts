import { Router } from 'express';
import { countRows, queryOne } from '../db/index.js';
import { env } from '../config/env.js';
import { ok } from '../lib/http.js';

const router = Router();

/**
 * 健康检查：不仅返回进程存活，还实际查询数据库，
 * 用于确认「后端能连上并操作数据库」——表数量与 SQLite 版本都来自真实查询。
 */
router.get('/', (_req, res) => {
  const version = queryOne<{ version: string }>('SELECT sqlite_version() AS version');
  const tables = countRows(
    "SELECT COUNT(*) AS total FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%'",
  );
  const players = countRows('SELECT COUNT(*) AS total FROM players');
  const migrations = countRows('SELECT COUNT(*) AS total FROM schema_migrations');

  ok(res, {
    status: 'ok',
    uptimeSeconds: Math.round(process.uptime()),
    environment: env.nodeEnv,
    database: {
      connected: true,
      driver: 'node:sqlite',
      file: env.databasePath,
      sqliteVersion: version?.version ?? 'unknown',
      tables,
      migrations,
      players,
    },
  });
});

export default router;
