/**
 * 支付订单流程：下单幂等 → 模拟网关回调（HMAC 验签/防重放）→ 事务内发放 → 对账。
 */
import { after, before, test } from 'node:test';
import assert from 'node:assert/strict';
import { createHmac } from 'node:crypto';
import { rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import type { AddressInfo } from 'node:net';
import { closeDatabase, connectDatabase, queryAll } from '../src/db/index.js';
import { runMigrations } from '../src/db/migrate.js';
import { seedCatalog } from '../src/db/seed.js';
import { createGuest } from '../src/services/auth.service.js';
import { createOrder, getOrder, handleGatewayCallback, mockGatewayPay } from '../src/services/payment.service.js';
import { getBalances, getProgress } from '../src/repositories/player.repository.js';
import { env } from '../src/config/env.js';
import { createApp } from '../src/app.js';

const sign = (payload: string) => createHmac('sha256', env.paymentSecret).update(payload).digest('hex');
const tokenOf = (n: number) => `${String(n).repeat(8)}-${String(n).repeat(4)}-4${String(n).repeat(3)}-8${String(n).repeat(3)}-${String(n).repeat(12)}`.slice(0, 36);

const databaseFile = path.join(tmpdir(), `food-fantasy-payment-${process.pid}.db`);

before(() => {
  connectDatabase(databaseFile);
  runMigrations();
  seedCatalog();
});

after(() => {
  closeDatabase();
  for (const suffix of ['', '-wal', '-shm']) rmSync(`${databaseFile}${suffix}`, { force: true });
});

test('下单幂等：同幂等键返回同一订单，跨礼包复用幂等键被拒', () => {
  const { player } = createGuest({ nickname: '支付甲一', gender: 'male' });
  const first = createOrder(player.id, { packId: 'gem-30', clientToken: tokenOf(1) });
  assert.equal(first.existing, false);
  assert.equal(first.amount, 30);
  assert.equal(first.status, 'created');

  const again = createOrder(player.id, { packId: 'gem-30', clientToken: tokenOf(1) });
  assert.equal(again.existing, true);
  assert.equal(again.orderId, first.orderId);

  assert.throws(
    () => createOrder(player.id, { packId: 'gem-68', clientToken: tokenOf(1) }),
    /幂等键已绑定其他礼包/,
  );
});

test('模拟支付：发放、购买记录、进度与流水对账一次通过', () => {
  const { player } = createGuest({ nickname: '支付乙二', gender: 'female' });
  const order = createOrder(player.id, { packId: 'gem-30', clientToken: tokenOf(2) });
  const before = getBalances(player.id);

  const result = mockGatewayPay(player.id, order.orderId);
  assert.equal(result.order.status, 'paid');
  assert.ok(result.order.gatewayTxn?.startsWith('mock-'));
  assert.ok(result.order.paidAt);

  const after = getBalances(player.id);
  assert.equal(after.gem - before.gem, 330, 'gem-30 应发放 330 灵晶');
  assert.equal(after.book - before.book, 1, 'gem-30 应发放 1 份契约');
  assert.equal(getProgress(player.id).packs_opened, 1);

  // 流水对账：payment.callback 流水的 SUM(delta) 必须等于余额变动
  const ledger = queryAll<{ currency: string; delta: number }>(
    "SELECT currency, delta FROM resource_ledger WHERE player_id = ? AND reason = 'payment.callback' AND ref_id = ?",
    player.id,
    order.orderId,
  );
  const gemDelta = ledger.filter(row => row.currency === 'gem').reduce((sum, row) => sum + Number(row.delta), 0);
  const bookDelta = ledger.filter(row => row.currency === 'book').reduce((sum, row) => sum + Number(row.delta), 0);
  assert.equal(gemDelta, 330);
  assert.equal(bookDelta, 1);

  // 重复 mock 支付被拒（状态机）
  assert.throws(() => mockGatewayPay(player.id, order.orderId), /已处理/);
});

test('回调验签：同交易号重放幂等、坏签名拒收、过期时间窗拒收', () => {
  const { player } = createGuest({ nickname: '支付丙三', gender: 'male' });
  const order = createOrder(player.id, { packId: 'gem-6', clientToken: tokenOf(3) });
  const txn = 'gw-test-001';
  const timestamp = Date.now();
  const payload = {
    orderId: order.orderId, gatewayTxn: txn, amount: 6, packId: 'gem-6', timestamp,
    signature: sign(`pay|${order.orderId}|${txn}|6|gem-6|${timestamp}`),
  };

  const first = handleGatewayCallback(payload);
  assert.equal(first.status, 'paid');
  const gemsAfterPay = getBalances(player.id).gem;

  // 同交易号重放 → duplicate，不重复发放
  const replay = handleGatewayCallback(payload);
  assert.equal(replay.status, 'duplicate');
  assert.equal(getBalances(player.id).gem, gemsAfterPay);
});

test('回调验签：坏签名与过期时间戳不改状态，合法回调随后成功', () => {
  const { player } = createGuest({ nickname: '支付丁四', gender: 'female' });
  const order = createOrder(player.id, { packId: 'gem-6', clientToken: tokenOf(4) });
  const timestamp = Date.now();

  assert.throws(
    () => handleGatewayCallback({
      orderId: order.orderId, gatewayTxn: 'gw-bad-sig', amount: 6, packId: 'gem-6', timestamp, signature: '0'.repeat(64),
    }),
    /签名/,
  );
  const stale = Date.now() - 11 * 60_000;
  assert.throws(
    () => handleGatewayCallback({
      orderId: order.orderId, gatewayTxn: 'gw-stale', amount: 6, packId: 'gem-6', timestamp: stale,
      signature: sign(`pay|${order.orderId}|gw-stale|6|gem-6|${stale}`),
    }),
    /时间戳/,
  );
  assert.equal(getOrder(player.id, order.orderId).status, 'created', '失败回调不得改变订单状态');

  const paid = handleGatewayCallback({
    orderId: order.orderId, gatewayTxn: 'gw-ok', amount: 6, packId: 'gem-6', timestamp,
    signature: sign(`pay|${order.orderId}|gw-ok|6|gem-6|${timestamp}`),
  });
  assert.equal(paid.status, 'paid');
});

test('回调金额/礼包与订单不符：订单置 failed 并拒绝', () => {
  const { player } = createGuest({ nickname: '支付戊五', gender: 'male' });
  const order = createOrder(player.id, { packId: 'gem-6', clientToken: tokenOf(5) });
  const timestamp = Date.now();
  assert.throws(
    () => handleGatewayCallback({
      orderId: order.orderId, gatewayTxn: 'gw-wrong-amount', amount: 1, packId: 'gem-6', timestamp,
      signature: sign(`pay|${order.orderId}|gw-wrong-amount|1|gem-6|${timestamp}`),
    }),
    /金额与订单不一致/,
  );
  assert.equal(getOrder(player.id, order.orderId).status, 'failed');
});

test('他人订单不可支付/不可查看', () => {
  const a = createGuest({ nickname: '支付己六', gender: 'male' });
  const b = createGuest({ nickname: '支付庚七', gender: 'female' });
  const order = createOrder(a.player.id, { packId: 'gem-6', clientToken: tokenOf(6) });
  assert.throws(() => mockGatewayPay(b.player.id, order.orderId), /无权/);
  assert.throws(() => getOrder(b.player.id, order.orderId), /无权/);
});

test('HTTP 边界：订单接口需认证，回调接口仅凭签名（无会话）', async () => {
  const server = createApp().listen(0, '127.0.0.1');
  await new Promise<void>(resolve => server.once('listening', () => resolve()));
  const base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  const call = async (path: string, options: { method?: string; token?: string; body?: unknown } = {}) => {
    const headers: Record<string, string> = {};
    if (options.body !== undefined) headers['content-type'] = 'application/json';
    if (options.token) headers.authorization = `Bearer ${options.token}`;
    const response = await fetch(base + path, {
      method: options.method ?? 'GET', headers,
      body: options.body === undefined ? undefined : JSON.stringify(options.body),
    });
    return { status: response.status, body: await response.json().catch(() => null) };
  };

  try {
    assert.equal((await call('/api/payments/orders', { method: 'POST', body: {} })).status, 401);

    const guest = await call('/api/auth/guest', { method: 'POST', body: {} });
    const token = guest.body?.data?.token as string;
    const order = await call('/api/payments/orders', {
      method: 'POST', token, body: { packId: 'gem-6', clientToken: tokenOf(7) },
    });
    assert.equal(order.status, 201);
    const orderId = order.body?.data?.orderId as string;

    // 回调接口无会话也可达，但坏签名 → 403
    const badCallback = await call('/api/payments/callback', {
      method: 'POST',
      body: { orderId, gatewayTxn: 'gw-http-bad', amount: 6, packId: 'gem-6', timestamp: Date.now(), signature: '0'.repeat(64) },
    });
    assert.equal(badCallback.status, 403);

    // 正确签名 → 200 paid
    const timestamp = Date.now();
    const goodCallback = await call('/api/payments/callback', {
      method: 'POST',
      body: {
        orderId, gatewayTxn: 'gw-http-ok', amount: 6, packId: 'gem-6', timestamp,
        signature: sign(`pay|${orderId}|gw-http-ok|6|gem-6|${timestamp}`),
      },
    });
    assert.equal(goodCallback.status, 200);
    assert.equal(goodCallback.body?.data?.status, 'paid');

    // Bearer 轨道 mock-pay 另一单
    const order2 = await call('/api/payments/orders', {
      method: 'POST', token, body: { packId: 'gem-6', clientToken: tokenOf(8) },
    });
    const mockPay = await call(`/api/payments/orders/${order2.body?.data?.orderId}/mock-pay`, { method: 'POST', token });
    assert.equal(mockPay.status, 200);
    assert.equal(mockPay.body?.data?.order?.status, 'paid');
  } finally {
    server.close();
  }
});
