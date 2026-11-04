import { Router } from 'express';
import { z } from 'zod';
import { ok, parseBody } from '../lib/http.js';
import { currentPlayer, requireAuth } from '../middleware/auth.js';
import { requireCsrf } from '../middleware/csrf.js';
import { buildSave } from '../services/state.service.js';
import {
  buyMarketOffer,
  claimIdleRewards,
  craft,
  exchange,
  purchasePack,
  upgradeWorldtree,
} from '../services/economy.service.js';
import { purchaseBattlePass } from '../services/battle.service.js';
import {
  ascendCharacter,
  claimStarterChests,
  equip,
  enhanceEquipment,
  openEquipmentChests,
  reforgeEquipment,
  salvageEquipment,
  setFormation,
  unequip,
  unlockAstrology,
} from '../services/roster.service.js';
import { claimMail, claimQuest, listMailbox, listQuestsWithProgress } from '../services/progress.service.js';
import { getSaveDocument, putSaveDocument } from '../services/save-sync.service.js';
import { listBackpack, useItem } from '../services/item.service.js';
import { claimActivityTier, listPlayerActivities } from '../services/activity.service.js';
import { claimSystemMail, listSystemMailbox, readSystemMail } from '../services/system-mail.service.js';

const router = Router();
router.use(requireCsrf);
router.use(requireAuth);

/**
 * 所有写操作统一返回最新 save。
 * 客户端无需自行推算余额，避免前后端各算一套导致状态漂移。
 */
const withSave = (playerId: string, extra: Record<string, unknown> = {}) => ({
  save: buildSave(playerId),
  ...extra,
});

/* ------------------------------ 存档 ------------------------------ */

router.get('/state', (req, res) => {
  const player = currentPlayer(req);
  ok(res, { save: buildSave(player.id) });
});

/* ------------------------- 云端存档文档（多端同步） ------------------------- */

router.get('/state/document', (req, res) => {
  const player = currentPlayer(req);
  const payload = getSaveDocument(player.id);
  ok(res, payload ?? { document: null, version: 0 });
});

router.put('/state/document', (req, res) => {
  const player = currentPlayer(req);
  const input = parseBody(
    z.object({
      document: z.record(z.string(), z.unknown()),
      version: z.number().int().min(1).optional(),
    }),
    req.body,
  );
  const payload = putSaveDocument(player.id, input.document, input.version);
  ok(res, payload);
});

/* ------------------------------ 交易与研制 ------------------------------ */

router.post('/trade/:rateId', (req, res) => {
  const player = currentPlayer(req);
  exchange(player.id, req.params.rateId);
  ok(res, withSave(player.id));
});

router.post('/craft', (req, res) => {
  const player = currentPlayer(req);
  const { times } = parseBody(z.object({ times: z.union([z.literal(1), z.literal(5)]) }), req.body);
  craft(player.id, times);
  ok(res, withSave(player.id));
});

router.post('/market/buy', (req, res) => {
  const player = currentPlayer(req);
  const { offerId } = parseBody(z.object({ offerId: z.string().min(1) }), req.body);
  buyMarketOffer(player.id, offerId);
  ok(res, withSave(player.id));
});

router.post('/worldtree/upgrade', (req, res) => {
  const player = currentPlayer(req);
  upgradeWorldtree(player.id);
  ok(res, withSave(player.id));
});

router.post('/battle-passes', (req, res) => {
  const player = currentPlayer(req);
  const { charges } = purchaseBattlePass(player.id);
  ok(res, withSave(player.id, { charges }));
});

router.post('/idle/claim', (req, res) => {
  const player = currentPlayer(req);
  const result = claimIdleRewards(player.id);
  ok(res, withSave(player.id, { claimed: result }));
});

router.post('/shop/purchase', (req, res) => {
  const player = currentPlayer(req);
  const { packId } = parseBody(z.object({ packId: z.string().min(1) }), req.body);
  const result = purchasePack(player.id, packId);
  ok(res, withSave(player.id, { purchase: result }), 201);
});

/* ------------------------------ 养成 ------------------------------ */

router.post('/characters/:name/ascend', (req, res) => {
  const player = currentPlayer(req);
  const result = ascendCharacter(player.id, req.params.name);
  ok(res, withSave(player.id, { ascend: result }));
});

router.put('/formation', (req, res) => {
  const player = currentPlayer(req);
  const { characters } = parseBody(
    z.object({ characters: z.array(z.string().min(1)).min(1).max(3) }),
    req.body,
  );
  setFormation(player.id, characters);
  ok(res, withSave(player.id));
});

router.post('/equipment/equip', (req, res) => {
  const player = currentPlayer(req);
  const { equipmentId } = parseBody(z.object({ equipmentId: z.string().min(1) }), req.body);
  const result = equip(player.id, equipmentId);
  ok(res, withSave(player.id, { equipped: result }));
});

router.post('/equipment/starter', (req, res) => {
  const player = currentPlayer(req);
  const result = claimStarterChests(player.id);
  ok(res, withSave(player.id, { starter: result }));
});

router.post('/equipment/chest/open', (req, res) => {
  const player = currentPlayer(req);
  const input = parseBody(
    z.object({
      count: z.union([z.literal(1), z.literal(5)]),
      operationId: z.string().regex(/^[a-zA-Z0-9-]{1,80}$/),
      seed: z.number().int().min(0).max(4294967295),
    }),
    req.body,
  );
  const result = openEquipmentChests(player.id, input);
  ok(res, withSave(player.id, { drops: result.drops }));
});

router.post('/equipment/unequip', (req, res) => {
  const player = currentPlayer(req);
  const { slot } = parseBody(
    z.object({ slot: z.enum(['weapon', 'crown', 'armor', 'charm', 'relic', 'crest']) }),
    req.body,
  );
  unequip(player.id, slot);
  ok(res, withSave(player.id));
});

router.post('/equipment/enhance', (req, res) => {
  const player = currentPlayer(req);
  const { equipmentId, expectedLevel } = parseBody(
    z.object({ equipmentId: z.string().min(1), expectedLevel: z.number().int().min(0).max(11) }),
    req.body,
  );
  const result = enhanceEquipment(player.id, equipmentId, expectedLevel);
  ok(res, withSave(player.id, { enhance: result }));
});

router.post('/equipment/salvage', (req, res) => {
  const player = currentPlayer(req);
  const { equipmentId } = parseBody(z.object({ equipmentId: z.string().min(1) }), req.body);
  const result = salvageEquipment(player.id, equipmentId);
  ok(res, withSave(player.id, { salvage: result }));
});

// v20 §4.3：副属性洗练（60 级解锁；expectedWashCount 乐观锁防连点重复扣费）
router.post('/equipment/reforge', (req, res) => {
  const player = currentPlayer(req);
  const { equipmentId, expectedWashCount } = parseBody(
    z.object({ equipmentId: z.string().min(1), expectedWashCount: z.number().int().min(0).max(998) }),
    req.body,
  );
  const result = reforgeEquipment(player.id, equipmentId, expectedWashCount);
  ok(res, withSave(player.id, { reforge: result }));
});

router.post('/astrology/unlock', (req, res) => {
  const player = currentPlayer(req);
  const { nodeId } = parseBody(z.object({ nodeId: z.string().min(1) }), req.body);
  const result = unlockAstrology(player.id, nodeId);
  ok(res, withSave(player.id, { astrology: result }));
});

/* ------------------------------ 任务与邮件 ------------------------------ */

router.get('/quests', (req, res) => {
  const player = currentPlayer(req);
  ok(res, { quests: listQuestsWithProgress(player.id) });
});

router.post('/quests/:questId/claim', (req, res) => {
  const player = currentPlayer(req);
  const result = claimQuest(player.id, req.params.questId);
  ok(res, withSave(player.id, { rewards: result.rewards }));
});

router.get('/mail', (req, res) => {
  const player = currentPlayer(req);
  ok(res, { mails: listMailbox(player.id) });
});

router.post('/mail/:mailId/claim', (req, res) => {
  const player = currentPlayer(req);
  const result = claimMail(player.id, req.params.mailId);
  ok(res, withSave(player.id, { rewards: result.rewards }));
});

/* ------------------------------ 背包（v9） ------------------------------ */

router.get('/items', (req, res) => {
  const player = currentPlayer(req);
  ok(res, { items: listBackpack(player.id) });
});

router.post('/items/:itemId/use', (req, res) => {
  const player = currentPlayer(req);
  const result = useItem(player.id, req.params.itemId);
  ok(res, { ...result, items: listBackpack(player.id), save: buildSave(player.id) });
});

/* ------------------------------ 运营活动（v10） ------------------------------ */

router.get('/activities', (req, res) => {
  const player = currentPlayer(req);
  ok(res, { activities: listPlayerActivities(player.id) });
});

router.post('/activities/:activityId/claim', (req, res) => {
  const player = currentPlayer(req);
  const { tier } = parseBody(z.object({ tier: z.string().min(1) }), req.body);
  const result = claimActivityTier(player.id, req.params.activityId, tier);
  ok(res, { ...result, activities: listPlayerActivities(player.id), save: buildSave(player.id) });
});

/* ------------------------------ 个性化系统邮件（v11） ------------------------------ */

router.get('/mail/system', (req, res) => {
  const player = currentPlayer(req);
  ok(res, { mails: listSystemMailbox(player.id) });
});

router.post('/mail/system/:mailId/read', (req, res) => {
  const player = currentPlayer(req);
  ok(res, { mail: readSystemMail(player.id, req.params.mailId) });
});

router.post('/mail/system/:mailId/claim', (req, res) => {
  const player = currentPlayer(req);
  const result = claimSystemMail(player.id, req.params.mailId);
  ok(res, withSave(player.id, { rewards: result.rewards }));
});

export default router;
