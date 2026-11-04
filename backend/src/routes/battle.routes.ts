import { Router } from 'express';
import { z } from 'zod';
import { ok, parseBody } from '../lib/http.js';
import { currentPlayer, requireAuth } from '../middleware/auth.js';
import { requireCsrf } from '../middleware/csrf.js';
import { buildSave } from '../services/state.service.js';
import { getBattle, listBattleHistory, settleBattle, startBattle } from '../services/battle.service.js';

const router = Router();
router.use(requireCsrf);
router.use(requireAuth);

/** 开战：服务端生成种子并落库，战斗结果不可由客户端伪造。 */
router.post('/', (req, res) => {
  const player = currentPlayer(req);
  const { stageId } = parseBody(z.object({ stageId: z.string().min(1) }), req.body);
  const battle = startBattle(player.id, stageId);
  ok(res, { battle, save: buildSave(player.id) }, 201);
});

/** 结算：以开战时固化的单位快照 + 种子重算，保证结果可复现。 */
router.post('/:battleId/settle', (req, res) => {
  const player = currentPlayer(req);
  const result = settleBattle(player.id, req.params.battleId);
  ok(res, { battle: result.battle, rewards: result.rewards, win: result.win, save: buildSave(player.id) });
});

router.get('/:battleId', (req, res) => {
  const player = currentPlayer(req);
  ok(res, { battle: getBattle(player.id, req.params.battleId) });
});

router.get('/', (req, res) => {
  const player = currentPlayer(req);
  ok(res, { battles: listBattleHistory(player.id) });
});

export default router;
