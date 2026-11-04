import type { NextFunction, Request, Response } from 'express';

type Bucket = { count: number; resetAt: number };

const buckets = new Map<string, Bucket>();

export type RateLimitOptions = {
  /** 时间窗口（毫秒） */
  windowMs: number;
  /** 窗口内允许的最大请求数 */
  max: number;
  /** 限流键的附加前缀，避免不同路由互相影响 */
  scope: string;
};

/**
 * 进程内固定窗口限流。
 * 用于游客注册等匿名可调用的写接口，防止刷号耗尽数据库资源。
 * 单实例部署够用；多实例部署时应换 Redis 实现（接口保持不变）。
 */
export function rateLimit(options: RateLimitOptions) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const ip = req.ip ?? req.socket.remoteAddress ?? 'unknown';
    const key = `${options.scope}:${ip}`;
    const now = Date.now();
    const bucket = buckets.get(key);

    if (!bucket || bucket.resetAt <= now) {
      buckets.set(key, { count: 1, resetAt: now + options.windowMs });
      res.setHeader('X-RateLimit-Limit', options.max);
      res.setHeader('X-RateLimit-Remaining', options.max - 1);
      next();
      return;
    }

    if (bucket.count >= options.max) {
      const retryAfter = Math.ceil((bucket.resetAt - now) / 1000);
      res.setHeader('Retry-After', retryAfter);
      res.status(429).json({
        ok: false,
        error: { code: 'RATE_LIMITED', message: `请求过于频繁，请 ${retryAfter} 秒后再试` },
      });
      return;
    }

    bucket.count += 1;
    res.setHeader('X-RateLimit-Limit', options.max);
    res.setHeader('X-RateLimit-Remaining', options.max - bucket.count);
    next();
  };
}

/** 供测试使用：清空全部计数 */
export function clearRateLimits(): void {
  buckets.clear();
}
