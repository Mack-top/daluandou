import { createHmac, timingSafeEqual } from 'node:crypto';
import { transaction } from '../db/index.js';
import { env } from '../config/env.js';
import { conflict, forbidden, notFound, ApiError } from '../lib/errors.js';
import { newId } from '../lib/ids.js';
import { dayKey, nowIso } from '../lib/clock.js';
import { applyResourceDelta, getProgress, updateProgress } from '../repositories/player.repository.js';
import { countPackPurchasesOn, insertShopPurchase } from '../repositories/economy.repository.js';
import { findShopPackById } from '../repositories/catalog.repository.js';
import {
  countPendingOrders,
  findOrderById,
  findOrderByIdempotencyKey,
  insertOrder,
  markFailed,
  markPaid,
  type PaymentOrderRow,
} from '../repositories/payment.repository.js';
import type { Currency } from '../domain/types.js';
import { buildSave } from './state.service.js';

/** 回调时间窗：超过视为重放，拒收。 */
const CALLBACK_TTL_MS = 10 * 60 * 1000;

function sign(payload: string): string {
  return createHmac('sha256', env.paymentSecret).update(payload).digest('hex');
}

function sameSignature(left: string, right: string): boolean {
  const a = Buffer.from(left);
  const b = Buffer.from(right);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

export type OrderView = {
  orderId: string;
  packId: string;
  amount: number;
  status: PaymentOrderRow['status'];
  createdAt: string;
  paidAt: string | null;
  gatewayTxn: string | null;
};

const orderView = (order: PaymentOrderRow): OrderView => ({
  orderId: order.id,
  packId: order.pack_id,
  amount: order.amount,
  status: order.status,
  createdAt: order.created_at,
  paidAt: order.paid_at,
  gatewayTxn: order.gateway_txn,
});

/**
 * 下单：锁价快照（价格/礼包写入订单与签名）+ 幂等键。
 * 同一 clientToken 重复提交返回同一订单（existing=true）；日限购包含待支付订单。
 * 待支付名额跨日保留，只有确认网关订单关闭后才能释放，避免迟到付款无法兑现。
 */
export function createOrder(
  playerId: string,
  input: { packId: string; clientToken: string },
): { orderId: string; amount: number; status: 'created'; existing: boolean } {
  return transaction(() => {
    const existing = findOrderByIdempotencyKey(playerId, input.clientToken);
    if (existing) {
      if (existing.pack_id !== input.packId) throw conflict('幂等键已绑定其他礼包');
      if (existing.status !== 'created') throw conflict('该订单已处理，请勿重复支付');
      return { orderId: existing.id, amount: existing.amount, status: 'created', existing: true };
    }
    const pack = findShopPackById(input.packId);
    if (!pack) throw notFound('礼包不存在');
    if (pack.daily_limit > 0 && countPackPurchasesOn(playerId, pack.id, dayKey()) + countPendingOrders(playerId, pack.id) >= pack.daily_limit) {
      throw conflict('该礼包今日购买次数已达上限');
    }
    const orderId = newId();
    // 锁价签名：回调时校验订单未被篡改
    const signature = sign(`order|${orderId}|${pack.id}|${pack.price}`);
    insertOrder({ id: orderId, playerId, packId: pack.id, amount: pack.price, clientToken: input.clientToken, signature });
    return { orderId, amount: pack.price, status: 'created', existing: false };
  });
}

export type GatewayCallbackPayload = {
  orderId: string;
  gatewayTxn: string;
  amount: number;
  packId: string;
  timestamp: number;
  signature: string;
};

export type CallbackResult = { status: 'paid' | 'duplicate'; order: OrderView };

/**
 * 网关回调（真实网关只需把验签算法替换为对应渠道规则）：
 * 1. 时间窗防重放；2. HMAC-SHA256 常量时间验签；
 * 3. 事务内：状态机校验 → 锁价三重校验（packId/金额/下单签名）→ markPaid → 发放；
 * 4. 同交易号重复通知幂等返回 duplicate；不同交易号重复支付拒绝。
 */
export function handleGatewayCallback(payload: GatewayCallbackPayload): CallbackResult {
  if (!Number.isFinite(payload.timestamp) || Math.abs(Date.now() - payload.timestamp) > CALLBACK_TTL_MS) {
    throw forbidden('回调时间戳超出允许窗口');
  }
  const expected = sign(`pay|${payload.orderId}|${payload.gatewayTxn}|${payload.amount}|${payload.packId}|${payload.timestamp}`);
  if (!sameSignature(expected, payload.signature)) {
    throw forbidden('回调签名校验失败');
  }

  // 校验阶段在事务外（markFailed 的状态变更不会被事务回滚撤销）
  const order = findOrderById(payload.orderId);
  if (!order) throw notFound('订单不存在');
  if (order.status === 'paid') {
    if (order.gateway_txn === payload.gatewayTxn) return { status: 'duplicate', order: orderView(order) };
    throw conflict('该订单已支付');
  }
  if (order.status !== 'created') throw conflict(`订单状态异常：${order.status}`);
  // 锁价三重校验（HMAC 已通过，视为网关可信消息）：packId / 金额 / 下单签名
  if (order.pack_id !== payload.packId) {
    markFailed(order.id, payload.gatewayTxn);
    throw conflict('回调礼包与订单不一致');
  }
  if (order.amount !== payload.amount) {
    markFailed(order.id, payload.gatewayTxn);
    throw conflict('回调金额与订单不一致');
  }
  if (!sameSignature(order.signature, sign(`order|${order.id}|${order.pack_id}|${order.amount}`))) {
    markFailed(order.id, payload.gatewayTxn);
    throw conflict('订单锁价签名校验失败');
  }
  const pack = findShopPackById(order.pack_id);
  if (!pack) {
    markFailed(order.id, payload.gatewayTxn);
    throw notFound('礼包不存在');
  }

  try {
    return transaction(() => {
      let paid: boolean;
      try {
        paid = markPaid(order.id, payload.gatewayTxn);
      } catch {
        // gateway_txn 唯一索引拦截：同一交易号已被其他订单使用（疑似重放/伪造）
        throw conflict('网关交易号已被使用（疑似重放）');
      }
      if (!paid) {
        const latest = findOrderById(order.id);
        if (latest?.status === 'paid' && latest.gateway_txn === payload.gatewayTxn) {
          return { status: 'duplicate' as const, order: orderView(latest) };
        }
        throw conflict('订单已被并发处理');
      }

      // 发放口径与 purchasePack 一致（reason 用 payment.callback，ref=订单号，流水可对账）
      const deltas: Partial<Record<Currency, number>> = {};
      if (pack.gems) deltas.gem = pack.gems;
      if (pack.books) deltas.book = pack.books;
      applyResourceDelta(order.player_id, deltas, 'payment.callback', order.id);
      insertShopPurchase({ playerId: order.player_id, packId: order.pack_id, price: order.amount });
      const progress = getProgress(order.player_id);
      updateProgress(order.player_id, {
        packs_opened: progress.packs_opened + 1,
        first_purchased_at: progress.first_purchased_at ?? nowIso(),
      });

      return {
        status: 'paid' as const,
        order: orderView({ ...order, status: 'paid', gateway_txn: payload.gatewayTxn, paid_at: nowIso() }),
      };
    });
  } catch (error) {
    // 交易号冲突（409）时把本单置 failed；其余错误保持 created 等待重试
    if (error instanceof ApiError && error.status === 409 && /网关交易号已被使用/.test(error.message)) {
      markFailed(order.id, payload.gatewayTxn);
    }
    throw error;
  }
}

/** 模拟网关支付：本地构造签名回调并走 handleGatewayCallback 同一入口（真实网关接入点即此处替换）。 */
export function mockGatewayPay(playerId: string, orderId: string): { order: OrderView; save: ReturnType<typeof buildSave> } {
  if (env.isProduction) throw forbidden('生产环境禁止模拟支付');
  const order = findOrderById(orderId);
  if (!order) throw notFound('订单不存在');
  if (order.player_id !== playerId) throw forbidden('无权操作该订单');
  if (order.status !== 'created') throw conflict('该订单已处理');
  const timestamp = Date.now();
  const gatewayTxn = `mock-${newId()}`;
  const signature = sign(`pay|${orderId}|${gatewayTxn}|${order.amount}|${order.pack_id}|${timestamp}`);
  const result = handleGatewayCallback({ orderId, gatewayTxn, amount: order.amount, packId: order.pack_id, timestamp, signature });
  return { order: result.order, save: buildSave(playerId) };
}

/** 订单状态查询（仅本人）。 */
export function getOrder(playerId: string, orderId: string): OrderView {
  const order = findOrderById(orderId);
  if (!order) throw notFound('订单不存在');
  if (order.player_id !== playerId) throw forbidden('无权查看该订单');
  return orderView(order);
}
