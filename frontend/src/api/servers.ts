/**
 * 分服实时状态（v16 按服隔离配套）：GET /api/servers 的客户端封装。
 * 正式数据来源为后端实时统计（players 表 + 运维维护名单）；
 * 任何网络异常/超时返回 null，调用方必须降级为本地展示，不得阻塞选服流程。
 */
import { apiUrl } from './base';

export type ServerStat = {
  server: number;
  players: number;
  maintenance: boolean;
  status: 'busy' | 'online' | 'offline';
};

export async function fetchServerStats(timeoutMs = 3000): Promise<ServerStat[] | null> {
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    const response = await fetch(apiUrl('/api/servers'), { signal: controller.signal });
    clearTimeout(timer);
    if (!response.ok) return null;
    const payload = await response.json();
    const servers = payload?.data?.servers;
    if (!Array.isArray(servers)) return null;
    return servers.filter((row: unknown): row is ServerStat => {
      const stat = row as Partial<ServerStat> | null;
      return typeof stat?.server === 'number'
        && typeof stat?.players === 'number'
        && typeof stat?.maintenance === 'boolean'
        && (stat.status === 'busy' || stat.status === 'online' || stat.status === 'offline');
    });
  } catch {
    return null; // 离线/超时：由调用方降级
  }
}
