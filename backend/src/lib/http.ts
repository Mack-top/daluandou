import type { Response } from 'express';
import { badRequest } from './errors.js';
import type { ZodTypeAny, z } from 'zod';

/** 统一成功响应包装，便于客户端判定 ok 字段。 */
export function ok(res: Response, data: unknown, status = 200): void {
  res.status(status).json({ ok: true, data });
}

/** 参数校验：失败时抛 400，并带出字段级明细。 */
export function parseBody<S extends ZodTypeAny>(schema: S, payload: unknown): z.infer<S> {
  const result = schema.safeParse(payload ?? {});
  if (!result.success) {
    throw badRequest('请求参数校验失败', result.error.flatten());
  }
  return result.data;
}
