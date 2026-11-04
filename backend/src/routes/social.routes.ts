import { Router } from 'express';
import { z } from 'zod';
import { ok, parseBody } from '../lib/http.js';
import { currentPlayer, requireAuth } from '../middleware/auth.js';
import { requireCsrf } from '../middleware/csrf.js';
import { buildSave } from '../services/state.service.js';
import {
  acceptFriend,
  checkIn,
  joinGuild,
  leaveGuild,
  listChat,
  listFriends,
  listGuildOverview,
  removeFriend,
  requestFriend,
  sendChat,
} from '../services/social.service.js';

const router = Router();
router.use(requireCsrf);
router.use(requireAuth);

/* ------------------------------ 协会 ------------------------------ */

router.get('/guilds', (_req, res) => {
  ok(res, { guilds: listGuildOverview() });
});

router.post('/guilds/:guildId/join', (req, res) => {
  const player = currentPlayer(req);
  joinGuild(player.id, req.params.guildId);
  ok(res, { save: buildSave(player.id) });
});

router.post('/guilds/leave', (req, res) => {
  const player = currentPlayer(req);
  leaveGuild(player.id);
  ok(res, { save: buildSave(player.id) });
});

router.post('/guilds/checkin', (req, res) => {
  const player = currentPlayer(req);
  const result = checkIn(player.id);
  ok(res, { checkIn: result, save: buildSave(player.id) });
});

/* ------------------------------ 好友 ------------------------------ */

router.get('/friends', (req, res) => {
  const player = currentPlayer(req);
  ok(res, listFriends(player.id));
});

router.post('/friends/request', (req, res) => {
  const player = currentPlayer(req);
  const { playerId } = parseBody(z.object({ playerId: z.string().min(1) }), req.body);
  requestFriend(player.id, playerId);
  ok(res, listFriends(player.id), 201);
});

router.post('/friends/accept', (req, res) => {
  const player = currentPlayer(req);
  const { playerId } = parseBody(z.object({ playerId: z.string().min(1) }), req.body);
  acceptFriend(player.id, playerId);
  ok(res, listFriends(player.id));
});

router.delete('/friends/:playerId', (req, res) => {
  const player = currentPlayer(req);
  removeFriend(player.id, req.params.playerId);
  ok(res, listFriends(player.id));
});

/* ------------------------------ 聊天 ------------------------------ */

router.get('/chat', (req, res) => {
  const player = currentPlayer(req);
  const channel = req.query.channel === 'guild' ? 'guild' : 'world';
  ok(res, { channel, messages: listChat({ playerId: player.id, channel, limit: 50 }) });
});

router.post('/chat', (req, res) => {
  const player = currentPlayer(req);
  const input = parseBody(
    z.object({ channel: z.enum(['world', 'guild']), body: z.string().min(1).max(120) }),
    req.body,
  );
  const message = sendChat({ playerId: player.id, channel: input.channel, body: input.body });
  ok(res, { message }, 201);
});

export default router;
