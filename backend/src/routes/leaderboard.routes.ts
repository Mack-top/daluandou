import { Router } from 'express';
import { z } from 'zod';
import { ok } from '../lib/http.js';
import { currentPlayer, requireAuth } from '../middleware/auth.js';
import { getLeaderboardView, getPlayerRank, listLeaderboards } from '../services/leaderboard.service.js';

/**
 * 排行榜读取端点（v12）。榜单分数只由服务端在结算/阵容变更事务内写入，
 * 这里不提供任何写入路径（防作弊：无客户端上报端点）。
 */
const router = Router();

/** v16 按服隔离：?server=N 过滤（1-99）；缺省返回全服聚合视图。 */
const serverQuery = z.object({
  server: z.coerce.number().int().min(1).max(99).optional(),
  limit: z.coerce.number().int().min(1).max(500).optional(),
});

const parseServer = (value: unknown): number | undefined => {
  const parsed = serverQuery.safeParse(value);
  return parsed.success ? parsed.data.server : undefined;
};

/** 全榜单总览（公开配置，无需鉴权）。 */
router.get('/', (req, res) => {
  ok(res, { leaderboards: listLeaderboards(parseServer(req.query)) });
});

router.get('/:leaderboardId', (req, res) => {
  const query = serverQuery.safeParse(req.query);
  ok(res, getLeaderboardView(
    String(req.params.leaderboardId),
    query.success ? query.data.limit : undefined,
    query.success ? query.data.server : undefined,
  ));
});

/** 玩家自己的名次（需登录）。v16 起名次按玩家所在服独立计算。 */
router.get('/:leaderboardId/me', requireAuth, (req, res) => {
  const player = currentPlayer(req);
  ok(res, { rank: getPlayerRank(String(req.params.leaderboardId), player.id) });
});

// 快照/赛季发奖由运维脚本或 GM 指令触发，不暴露 HTTP 写端点（score 只能服务端写）

export default router;
