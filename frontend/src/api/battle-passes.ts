/**
 * 每日挑战次数与挑战卡客户端。
 * 购买规则：免费 4 次用尽后可购（15 灵晶/张，每日限 6 张），每日总上限 10 次，跨日重置。
 * 会话走 HttpOnly Cookie（同源自动携带），写请求附 CSRF 双提交头；失败由调用方降级为本地演示。
 */
import { request } from './payments';

export type ServerBattleCharges = {
  dayKey: string;
  used: number;
  purchased: number;
  freeLimit: number;
  totalLimit: number;
  remaining: number;
  canBuy: boolean;
};

export type BuyPassResult = { charges: ServerBattleCharges; save: { gems: number } };

/** 购买一张挑战卡：服务端硬校验（免费未用尽/已购满/达总上限均 409），返回最新次数视图与余额。 */
export async function buyBattlePass(): Promise<BuyPassResult> {
  const response = await request('/api/game/battle-passes', { method: 'POST', body: '{}' });
  if (!response.ok) throw new Error(`挑战卡购买失败：${response.status}`);
  const payload = await response.json();
  const data = payload?.data;
  if (typeof data?.charges?.remaining !== 'number') throw new Error('购买响应格式异常');
  return { charges: data.charges, save: { gems: data.save?.gems ?? 0 } };
}
