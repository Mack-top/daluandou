import type { Request, Response } from 'express';
import { env } from '../config/env.js';
import { newSessionToken } from '../lib/ids.js';

export const SESSION_COOKIE = 'sid';
export const CSRF_COOKIE = 'csrf';

/** 手工解析 Cookie 头（不引入 cookie-parser 依赖）。 */
export function readCookie(req: Request, name: string): string | undefined {
  const header = req.headers.cookie;
  if (!header) return undefined;
  for (const part of header.split(';')) {
    const eq = part.indexOf('=');
    if (eq > -1 && part.slice(0, eq).trim() === name) {
      const raw = part.slice(eq + 1).trim();
      try {
        return decodeURIComponent(raw);
      } catch {
        return raw;
      }
    }
  }
  return undefined;
}

function cookieOptions() {
  return {
    sameSite: 'lax' as const,
    path: '/',
    // Express 的 maxAge 单位是毫秒
    maxAge: env.sessionTtlHours * 3_600_000,
    secure: env.isProduction,
  };
}

/**
 * 成对签发会话 Cookie：
 * - sid：会话令牌本体，HttpOnly（JS 不可读，防 XSS 窃取）；
 * - csrf：双提交校验令牌，可读（前端读取后放进 x-csrf-token 头）。
 * 两者同生命周期，登录/登出必须成对签发/清除。
 */
export function issueSessionCookies(res: Response, token: string): void {
  res.cookie(SESSION_COOKIE, token, { ...cookieOptions(), httpOnly: true });
  res.cookie(CSRF_COOKIE, newSessionToken().token, cookieOptions());
}

export function clearSessionCookies(res: Response): void {
  const { maxAge: _maxAge, ...rest } = cookieOptions();
  res.clearCookie(SESSION_COOKIE, { ...rest, httpOnly: true });
  res.clearCookie(CSRF_COOKIE, rest);
}
