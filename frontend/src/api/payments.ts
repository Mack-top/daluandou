/**
 * 支付订单客户端（模拟网关）。
 * 职责：有身份时把商城礼包购买升级为「下单 → 模拟支付 → 服务端发放」的真实订单流。
 * 会话走 HttpOnly Cookie（同源自动携带），写请求附 CSRF 双提交头；失败由调用方降级为本地入账。
 */

import { apiUrl } from './base';

export async function request(path: string, init: RequestInit = {}): Promise<Response> {
  const headers: Record<string, string> = {
    ...((init.headers as Record<string, string>) ?? {}),
    ...(init.body !== undefined ? { 'content-type': 'application/json' } : {}),
  };
  if (init.method !== undefined && init.method !== 'GET') {
    const csrf = readCsrf();
    if (csrf) headers['x-csrf-token'] = csrf;
  }
  return fetch(apiUrl(path), { ...init, headers });
}

function readCsrf(): string | null {
  for (const part of document.cookie.split(';')) {
    const eq = part.indexOf('=');
    if (eq > -1 && part.slice(0, eq).trim() === 'csrf') {
      try {
        return decodeURIComponent(part.slice(eq + 1).trim());
      } catch {
        return part.slice(eq + 1).trim();
      }
    }
  }
  return null;
}

export type ServerOrder = { orderId: string; amount: number; status: 'created'; existing: boolean };
export type ServerPayResult = { order: { orderId: string; status: string; gatewayTxn: string | null }; save: unknown };

/** 下单：锁价快照 + 幂等键（由调用方生成 UUID）。 */
export async function createOrder(packId: string, clientToken: string): Promise<ServerOrder> {
  const response = await request('/api/payments/orders', {
    method: 'POST',
    body: JSON.stringify({ packId, clientToken }),
  });
  if (!response.ok) throw new Error(`下单失败：${response.status}`);
  const payload = await response.json();
  const data = payload?.data;
  if (typeof data?.orderId !== 'string') throw new Error('下单响应格式异常');
  return data as ServerOrder;
}

/** 模拟支付：本地触发签名回调，服务端验签发放并返回最新存档。 */
export async function mockPay(orderId: string): Promise<ServerPayResult> {
  const response = await request(`/api/payments/orders/${encodeURIComponent(orderId)}/mock-pay`, {
    method: 'POST',
    body: '{}',
  });
  if (!response.ok) throw new Error(`模拟支付失败：${response.status}`);
  const payload = await response.json();
  if (!payload?.data?.order) throw new Error('支付响应格式异常');
  return payload.data as ServerPayResult;
}
