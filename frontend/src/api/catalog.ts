/**
 * 静态配置拉取（v21 数据持久化通道 / v22 配置生效链路）
 * -----------------------------------------------------------------------------
 * /api/catalog 是公开端点（无需身份），启动时拉一次：
 *   - stages：服务端权威关卡表 → 原位替换本地 battleStages（移除前端假数据双轨）；
 *   - equipment：服务端 108 件装备模板 → 原位替换本地 equipmentCatalogue；
 *   - dungeons / features / serverOpenDate：副本解锁与功能开关的运营数据源。
 * 离线/失败时保持本地兜底数据（与服务端种子同源），游戏继续可玩。
 *
 * v22：每次响应都带 versions（各配置域版本戳），记在模块内。
 * refreshCatalog() 会在页面重新可见时带着上次版本重拉 —— GM 后台改配置后
 * 服务端会 bump 对应域版本，客户端下次拉取即生效（不要求重启页面）。
 * 注意：/api/catalog 始终返回全量 catalog，since 只用于让服务端在响应里
 * 附带 changes（变更域明细），因此该改动不影响启动拉取与离线兜底。
 */

import { applyCatalog, type CatalogPayload } from '../game-data';
import { applyCatalogEquipment } from '../equipment';
import { apiUrl } from './base';

let inFlight: Promise<CatalogPayload | null> | null = null;
let lastVersions: Record<string, number> | null = null;

/** 最近一次成功拉取到的配置域版本映射（供诊断 / 下一次增量请求使用）。 */
export function getCatalogVersions(): Record<string, number> | null {
  return lastVersions;
}

/** 拉取并应用 catalog；返回是否成功。重复并发调用共享同一个请求。 */
export function fetchCatalog(since?: Record<string, number>): Promise<boolean> {
  if (!inFlight) {
    inFlight = (async () => {
      try {
        const query = since && Object.keys(since).length
          ? `?since=${encodeURIComponent(JSON.stringify(since))}`
          : '';
        const response = await fetch(apiUrl(`/api/catalog${query}`), { cache: 'no-store' });
        if (!response.ok) return null;
        const payload = await response.json().catch(() => null);
        const data: unknown = payload?.data;
        if (!data || typeof data !== 'object') return null;
        const catalog = data as CatalogPayload & { versions?: Record<string, number> };
        if (catalog.versions && typeof catalog.versions === 'object') lastVersions = catalog.versions;
        applyCatalog(catalog);
        if (Array.isArray(catalog.equipment)) applyCatalogEquipment(catalog.equipment);
        return catalog;
      } catch {
        return null;
      } finally {
        inFlight = null;
      }
    })();
  }
  return inFlight.then(payload => payload !== null);
}

/** 页面重新可见 / 重新进入时调用：带上上次版本戳重拉，让 GM 配置变更尽快生效。 */
export function refreshCatalog(): Promise<boolean> {
  return fetchCatalog(lastVersions ?? undefined);
}
