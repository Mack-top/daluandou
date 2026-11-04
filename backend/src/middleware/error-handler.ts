import type { NextFunction, Request, Response } from 'express';
import { ApiError } from '../lib/errors.js';
import { env } from '../config/env.js';

/** 未匹配到任何路由 */
export function notFoundHandler(req: Request, res: Response): void {
  res.status(404).json({
    ok: false,
    error: { code: 'NOT_FOUND', message: `接口不存在：${req.method} ${req.path}` },
  });
}

/**
 * 统一错误出口：把领域错误翻译成 HTTP 状态，非预期错误一律 500 且不泄露堆栈。
 * Express 会依据 4 个入参识别这是错误处理中间件，因此 next 必须保留。
 */
export function errorHandler(error: unknown, _req: Request, res: Response, _next: NextFunction): void {
  if (error instanceof ApiError) {
    res.status(error.status).json({
      ok: false,
      error: { code: error.code, message: error.message, details: error.details },
    });
    return;
  }

  // express.json 的解析/体积错误不是 ApiError，但同样属于客户端请求问题，
  // 不能落进 500；否则监控会把错误的请求体误报成服务端故障。
  if (typeof error === 'object' && error !== null) {
    const bodyError = error as { type?: string };
    if (bodyError.type === 'entity.too.large') {
      res.status(413).json({
        ok: false,
        error: { code: 'PAYLOAD_TOO_LARGE', message: '请求体过大' },
      });
      return;
    }
    if (bodyError.type === 'entity.parse.failed') {
      res.status(400).json({
        ok: false,
        error: { code: 'INVALID_JSON', message: '请求体不是合法 JSON' },
      });
      return;
    }
  }

  console.error('[unhandled]', error);
  res.status(500).json({
    ok: false,
    error: {
      code: 'INTERNAL_ERROR',
      message: '服务器内部错误',
      details: env.isProduction ? undefined : String(error),
    },
  });
}
