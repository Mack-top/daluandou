import { Router } from 'express';
import { env } from '../config/env.js';
import { forbidden } from '../lib/errors.js';
import { z } from 'zod';
import { ok, parseBody } from '../lib/http.js';
import { currentPlayer, requireAuth } from '../middleware/auth.js';
import { requireCsrf } from '../middleware/csrf.js';
import { createOrder, getOrder, handleGatewayCallback, mockGatewayPay } from '../services/payment.service.js';

const router = Router();

const createOrderSchema = z.object({
  packId: z.string().min(1).max(64),
  clientToken: z.string().regex(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i),
});

const callbackSchema = z.object({
  orderId: z.string().min(1).max(64),
  gatewayTxn: z.string().min(1).max(120),
  amount: z.number().int().positive(),
  packId: z.string().min(1).max(64),
  timestamp: z.number().int(),
  signature: z.string().length(64),
});

/** 下单：锁价快照 + 幂等键。requireAuth 在前保证未认证拿到 401 而非 CSRF 的 403。 */
router.post('/orders', requireAuth, requireCsrf, (req, res) => {
  const player = currentPlayer(req);
  const input = parseBody(createOrderSchema, req.body);
  const order = createOrder(player.id, input);
  ok(res, order, 201);
});

/** 模拟支付：本地构造签名回调并走真实回调入口（真实网关接入时移除此路由）。 */
router.post('/orders/:orderId/mock-pay', requireAuth, requireCsrf, (req, res) => {
  if (env.isProduction) throw forbidden('生产环境禁止模拟支付');
  const player = currentPlayer(req);
  const result = mockGatewayPay(player.id, String(req.params.orderId));
  ok(res, result);
});

router.get('/orders/:orderId', requireAuth, (req, res) => {
  const player = currentPlayer(req);
  ok(res, { order: getOrder(player.id, String(req.params.orderId)) });
});

/**
 * 支付回调（网关服务器对服务器）：无会话鉴权、无 CSRF——
 * 鉴权手段是 HMAC 签名 + 时间窗 + 交易号唯一索引，见 handleGatewayCallback。
 */
router.post('/callback', (req, res) => {
  const payload = parseBody(callbackSchema, req.body);
  const result = handleGatewayCallback(payload);
  ok(res, result);
});

export default router;
