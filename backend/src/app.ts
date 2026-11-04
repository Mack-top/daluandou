import { existsSync } from 'node:fs';
import path from 'node:path';
import cors from 'cors';
import express, { type Express } from 'express';
import { backendRoot, env } from './config/env.js';
import { errorHandler, notFoundHandler } from './middleware/error-handler.js';
import routes from './routes/index.js';

/**
 * 前端静态资源（打包分发模式）：webapp/ 与根目录同级时自动启用——
 * SEA 单文件 exe 模式下 webapp/ 与可执行文件同级，工程内构建时位于 <root>/webapp。
 * dev 模式由 Vite 开发服务器负责前端，这里探测不到 webapp/ 即完全跳过。
 */
const webappDir = path.join(backendRoot, 'webapp');
const webappReady = existsSync(path.join(webappDir, 'index.html'));

/**
 * GM 管理台静态页（v22 收敛为单一权威副本：backend/public/admin.html）。
 * 打包分发模式下 webapp/ 与 exe 同级，admin.html 由 scripts/build-exe.mjs
 * 复制到 webapp/ 与 index.html 同级；dev 模式直接读 backend/public。
 * 静态壳本身不含敏感信息，真正的门禁由 /api/admin/* 的 IP 白名单 + GM 会话把守。
 */
const adminDir = webappReady ? webappDir : path.join(backendRoot, 'public');

/** 组装 Express 应用（与启动解耦，便于测试中直接复用）。 */
export function createApp(): Express {
  const app = express();

  app.disable('x-powered-by');
  app.use(
    cors({
      origin: env.corsOrigins,
      credentials: true,
      methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    }),
  );
  // 请求体上限 256KB：本服务只有小体量 JSON，无需更大
  app.use(express.json({ limit: '256kb' }));

  // API 根信息：仅开发/API 模式注册；打包分发模式下让静态中间件托管游戏首页
  if (!webappReady) {
    app.get('/', (_req, res) => {
      res.json({ ok: true, data: { name: 'food-fantasy-api', api: '/api', health: '/api/health' } });
    });
  }

  app.use('/admin', express.static(adminDir, { index: 'admin.html' }));

  app.use('/api', routes);

  // 打包分发模式：游戏前端（单页应用）由后端直接托管；非 /api、/admin 的 GET 一律回退 index.html
  if (webappReady) {
    app.use(express.static(webappDir, { index: 'index.html' }));
    app.use((req, res, next) => {
      if (req.method !== 'GET' || req.path.startsWith('/api') || req.path.startsWith('/admin')) {
        next();
        return;
      }
      res.sendFile(path.join(webappDir, 'index.html'));
    });
  }

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
