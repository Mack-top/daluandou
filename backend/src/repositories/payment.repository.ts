import { execute, queryOne } from '../db/index.js';
import { nowIso } from '../lib/clock.js';

export type PaymentOrderRow = {
  id: string;
  player_id: string;
  pack_id: string;
  amount: number;
  status: 'created' | 'paid' | 'failed' | 'expired';
  client_token: string;
  gateway_txn: string | null;
  signature: string;
  created_at: string;
  paid_at: string | null;
};

export function insertOrder(input: {
  id: string;
  playerId: string;
  packId: string;
  amount: number;
  clientToken: string;
  signature: string;
}): void {
  execute(
    `INSERT INTO payment_orders (id, player_id, pack_id, amount, status, client_token, signature, created_at)
     VALUES (?, ?, ?, ?, 'created', ?, ?, ?)`,
    input.id,
    input.playerId,
    input.packId,
    input.amount,
    input.clientToken,
    input.signature,
    nowIso(),
  );
}

export function findOrderById(orderId: string): PaymentOrderRow | undefined {
  return queryOne<PaymentOrderRow>('SELECT * FROM payment_orders WHERE id = ?', orderId);
}

export function findOrderByIdempotencyKey(playerId: string, clientToken: string): PaymentOrderRow | undefined {
  return queryOne<PaymentOrderRow>(
    'SELECT * FROM payment_orders WHERE player_id = ? AND client_token = ?',
    playerId,
    clientToken,
  );
}

/** 置为已支付：仅在 status='created' 时生效（返回 false 表示已被并发处理）。 */
export function markPaid(orderId: string, gatewayTxn: string): boolean {
  const result = execute(
    `UPDATE payment_orders SET status = 'paid', gateway_txn = ?, paid_at = ? WHERE id = ? AND status = 'created'`,
    gatewayTxn,
    nowIso(),
    orderId,
  );
  return result.changes > 0;
}

export function markFailed(orderId: string, gatewayTxn: string | null): void {
  execute(
    `UPDATE payment_orders SET status = 'failed', gateway_txn = ? WHERE id = ? AND status = 'created'`,
    gatewayTxn,
    orderId,
  );
}

/** 未支付订单保留限购名额，直至支付或经网关确认关闭。 */
export function countPendingOrders(playerId: string, packId: string): number {
  const row = queryOne<{ total: number }>(
    "SELECT COUNT(*) AS total FROM payment_orders WHERE player_id = ? AND pack_id = ? AND status = 'created'",
    playerId, packId,
  );
  return Number(row?.total ?? 0);
}
