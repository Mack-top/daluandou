import { Router } from 'express';
import { z } from 'zod';
import { ok, parseBody } from '../lib/http.js';
import { requireAuth, currentPlayer } from '../middleware/auth.js';
import { requireCsrf } from '../middleware/csrf.js';
import { clearSessionCookies, issueSessionCookies } from '../middleware/session-cookie.js';
import { rateLimit } from '../middleware/rate-limit.js';
import { createGuest, loginWithPassword, logout, registerPassword } from '../services/auth.service.js';
import { buildSave } from '../services/state.service.js';
import type { PlayerRow } from '../domain/types.js';

const router = Router();

const createGuestSchema = z.object({
  nickname: z.string().trim().min(2).max(8).optional(),
  gender: z.enum(['male', 'female']).optional(),
  server: z.number().int().min(1).max(99).optional(),
});

const playerView = (player: PlayerRow) => ({
  id: player.id,
  nickname: player.nickname,
  gender: player.gender,
  server: player.server,
  worldtree: player.worldtree_level,
  createdAt: player.created_at,
});

/**
 * 游客登录：无账号体系下最轻量的入口，返回令牌与完整存档。
 * 这是唯一的匿名写接口，必须限流防刷号。
 */
router.post('/guest', rateLimit({ windowMs: 60_000, max: 30, scope: 'auth-guest' }), (req, res) => {
  const input = parseBody(createGuestSchema, req.body);
  const result = createGuest(input);
  // 浏览器主轨道：HttpOnly 会话 Cookie + 可读 csrf 双提交令牌；响应体仍返回 token 供双轨兼容
  issueSessionCookies(res, result.token);
  ok(
    res,
    {
      token: result.token,
      expiresAt: result.expiresAt,
      player: playerView(result.player),
      save: buildSave(result.player.id),
    },
    201,
  );
});

router.get('/me', requireAuth, (req, res) => {
  const player = currentPlayer(req);
  ok(res, { player: playerView(player), save: buildSave(player.id) });
});

router.post('/logout', requireCsrf, requireAuth, (req, res) => {
  if (req.sessionId) logout(req.sessionId);
  clearSessionCookies(res);
  ok(res, { loggedOut: true });
});

/**
 * 正式注册：为当前会话身份设置密码（游客身份升级为可找回账号）。
 * requireAuth 在前保证未登录拿到 401；写操作必须携带 CSRF。
 */
router.post('/register', requireAuth, requireCsrf, rateLimit({ windowMs: 60_000, max: 10, scope: 'auth-register' }), (req, res) => {
  const player = currentPlayer(req);
  const schema = z.object({ password: z.string() });
  const { password } = parseBody(schema, req.body);
  const { accountId } = registerPassword(player.id, password);
  ok(res, { accountId, nickname: playerView(player).nickname }, 201);
});

/** 密码登录：账号 ID + 密码找回身份；限流防爆破（10 次/分钟）。 */
router.post('/login', rateLimit({ windowMs: 60_000, max: 10, scope: 'auth-login' }), (req, res) => {
  const schema = z.object({ accountId: z.string().min(1), password: z.string() });
  const { accountId, password } = parseBody(schema, req.body);
  const result = loginWithPassword(accountId, password);
  issueSessionCookies(res, result.token);
  ok(res, {
    token: result.token,
    expiresAt: result.expiresAt,
    player: playerView(result.player),
    save: buildSave(result.player.id),
  });
});

export default router;
