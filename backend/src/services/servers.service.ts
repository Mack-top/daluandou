import { countPlayersByServer } from '../repositories/player.repository.js';
import { env } from '../config/env.js';

/**
 * 分服实时状态（v16 按服隔离配套）。
 * 正式数据来源：玩家数来自 players 表实时统计；维护名单与热度阈值来自运维环境变量
 * （SERVERS_MAINTENANCE / SERVER_BUSY_THRESHOLD），界面不再写死任何演示状态。
 */
export type ServerStatus = {
  server: number;
  players: number;
  maintenance: boolean;
  status: 'busy' | 'online' | 'offline';
};

/** 分区大小：与客户端「食灵一区」一致（1..18）。 */
export const SERVER_ZONE_SIZE = 18;

export function listServerStatus(): { zoneSize: number; servers: ServerStatus[] } {
  const population = new Map(
    countPlayersByServer(SERVER_ZONE_SIZE).map(row => [row.server, Number(row.total)]),
  );
  const maintenance = new Set(
    env.serversMaintenance
      .map(value => Number(value))
      .filter(value => Number.isInteger(value) && value >= 1),
  );

  const servers: ServerStatus[] = Array.from({ length: SERVER_ZONE_SIZE }, (_, index) => {
    const server = index + 1;
    const players = population.get(server) ?? 0;
    const isMaintenance = maintenance.has(server);
    return {
      server,
      players,
      maintenance: isMaintenance,
      status: isMaintenance ? 'offline' : players >= env.serverBusyThreshold ? 'busy' : 'online',
    };
  });

  return { zoneSize: SERVER_ZONE_SIZE, servers };
}
