import { Router } from 'express';
import { ok } from '../lib/http.js';
import { listServerStatus } from '../services/servers.service.js';

/**
 * 分服实时状态（v16）：选服界面的正式数据源。
 * 玩家数实时统计自 players 表；维护名单来自 SERVERS_MAINTENANCE 环境变量。
 * 公开端点（无鉴权）：只有聚合计数，不含任何玩家可识别信息。
 */
const router = Router();

router.get('/', (_req, res) => {
  ok(res, listServerStatus());
});

export default router;
