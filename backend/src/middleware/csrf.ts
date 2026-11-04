import { timingSafeEqual } from 'node:crypto';
import type { NextFunction, Request, Response } from 'express';
import { forbidden } from '../lib/errors.js';
import { CSRF_COOKIE, readCookie } from './session-cookie.js';

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

function sameToken(left: string, right: string): boolean {
  const a = Buffer.from(left);
  const b = Buffer.from(right);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

/**
 * CSRF 双提交校验：Cookie 轨道的写请求必须携带 x-csrf-token 头，且与 csrf cookie 一致。
 * Bearer 轨道不受 CSRF 威胁（跨站页面无法携带自定义头），直接放行——这是双轨兼容的一部分。
 * 挂载在每个业务 router 的 requireAuth 之前；/api/auth/guest 豁免（首次签发时还没有令牌）。
 */
export function requireCsrf(req: Request, _res: Response, next: NextFunction): void {
  if (SAFE_METHODS.has(req.method)) {
    next();
    return;
  }
  const header = req.header('authorization') ?? '';
  if (header.toLowerCase().startsWith('bearer ')) {
    next();
    return;
  }
  const cookieToken = readCookie(req, CSRF_COOKIE);
  const headerToken = req.header('x-csrf-token');
  if (!cookieToken || !headerToken || !sameToken(cookieToken, headerToken)) {
    throw forbidden('缺少有效的 CSRF 令牌');
  }
  next();
}
