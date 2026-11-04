import type { NextFunction, Request, Response } from 'express';
import { unauthorized } from '../lib/errors.js';
import { authenticate } from '../services/auth.service.js';
import type { PlayerRow } from '../domain/types.js';
import { readCookie, SESSION_COOKIE } from './session-cookie.js';

/**
 * 双轨鉴权：Authorization: Bearer 优先（脚本/测试/未来原生客户端），
 * 其次读取 HttpOnly 会话 Cookie sid（浏览器主轨道，配合 requireCsrf）。
 */
export function requireAuth(req: Request, _res: Response, next: NextFunction): void {
  const header = req.header('authorization') ?? '';
  let token = header.toLowerCase().startsWith('bearer ') ? header.slice(7).trim() : undefined;
  let viaCookie = false;
  if (!token) {
    const sid = readCookie(req, SESSION_COOKIE);
    if (sid) {
      token = sid;
      viaCookie = true;
    }
  }
  const { player, sessionId } = authenticate(token);
  req.player = player;
  req.sessionId = sessionId;
  req.authVia = viaCookie ? 'cookie' : 'bearer';
  next();
}

/** 在已挂载 requireAuth 的路由中取当前玩家。 */
export function currentPlayer(req: Request): PlayerRow {
  if (!req.player) throw unauthorized();
  return req.player;
}
