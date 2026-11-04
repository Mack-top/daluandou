import { exec } from 'node:child_process';
import { createApp } from './app.js';
import { env } from './config/env.js';
import { closeDatabase, connectDatabase, countRows } from './db/index.js';
import { runMigrations } from './db/migrate.js';
import { seedCatalog } from './db/seed.js';
import { isSea } from 'node:sea';

function bootstrap(): void {
  connectDatabase();

  const migration = runMigrations();
  console.log(`[boot] 数据库已连接：${env.databasePath}`);
  console.log(`[boot] 迁移：新增 ${migration.applied.length} 个版本，跳过 ${migration.skipped.length} 个`);

  // 首次启动时自动灌入配置数据，省去手工 seed；已有数据则不动
  if (countRows('SELECT COUNT(*) AS total FROM character_defs') === 0) {
    const summary = seedCatalog();
    console.log('[boot] 配置表为空，已写入种子数据：', summary);
  }

  const app = createApp();
  const server = app.listen(env.port, env.host, () => {
    console.log(`[api] 监听 http://${env.host}:${env.port}/api`);
    console.log(`[api] 健康检查 http://${env.host}:${env.port}/api/health`);

    // SEA 单文件模式（双击 exe 运行）：启动完成后自动打开浏览器进入游戏
    if (isSea()) {
      const url = `http://127.0.0.1:${env.port}/`;
      exec(`start "" "${url}"`, error => {
        if (error) console.log(`[api] 自动打开浏览器失败，请手动访问 ${url}`);
        else console.log(`[api] 已在默认浏览器打开 ${url}`);
      });
    }
  });

  const shutdown = (signal: string) => {
    console.log(`[api] 收到 ${signal}，正在关闭…`);
    server.close(() => {
      closeDatabase();
      process.exit(0);
    });
  };
  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));
}

bootstrap();
