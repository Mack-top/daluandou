import { Router } from 'express';
import adminRoutes from './admin.routes.js';
import authRoutes from './auth.routes.js';
import battleRoutes from './battle.routes.js';
import catalogRoutes from './catalog.routes.js';
import gameRoutes from './game.routes.js';
import healthRoutes from './health.routes.js';
import leaderboardRoutes from './leaderboard.routes.js';
import paymentRoutes from './payment.routes.js';
import serversRoutes from './servers.routes.js';
import socialRoutes from './social.routes.js';

const router = Router();

router.use('/health', healthRoutes);
router.use('/auth', authRoutes);
router.use('/catalog', catalogRoutes);
router.use('/game', gameRoutes);
router.use('/battles', battleRoutes);
router.use('/social', socialRoutes);
router.use('/payments', paymentRoutes);
router.use('/leaderboards', leaderboardRoutes);
// 分服实时状态：选服界面数据源（v16 按服隔离配套）
router.use('/servers', serversRoutes);
// GM 管理端点：独立前缀 + IP 白名单 + 独立会话（不复用玩家鉴权轨道）
router.use('/admin', adminRoutes);

export default router;
