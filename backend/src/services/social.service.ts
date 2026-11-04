import { transaction } from '../db/index.js';
import { dayKey } from '../lib/clock.js';
import { badRequest, conflict, notFound } from '../lib/errors.js';
import { applyResourceDelta, findPlayerById, requirePlayer } from '../repositories/player.repository.js';
import {
  addContribution,
  countFriends,
  countGuildMembers,
  deleteFriendship,
  findFriendship,
  findGuild,
  findMembership,
  insertMembership,
  insertMessage,
  leaveMembership,
  listFriendships,
  listGuilds,
  listIncomingRequests,
  listMessages,
  listOtherPlayers,
  setCheckInDate,
  upsertFriendship,
} from '../repositories/social.repository.js';

export const MAX_FRIENDS = 50;
export const MAX_MESSAGE_LENGTH = 120;
export const CHECK_IN_COINS = 5_000;
export const CHECK_IN_CONTRIBUTION = 20;

/* ------------------------------ 协会 ------------------------------ */

export function listGuildOverview(): Array<{
  id: string;
  name: string;
  english: string;
  level: number;
  members: number;
  capacity: number;
  motto: string;
  notice: string;
  joinable: boolean;
}> {
  return listGuilds().map(guild => ({
    id: guild.id,
    name: guild.name,
    english: guild.english,
    level: guild.level,
    members: Number(guild.members),
    capacity: guild.capacity,
    motto: guild.motto,
    notice: guild.notice,
    joinable: Number(guild.members) < guild.capacity,
  }));
}

export function joinGuild(playerId: string, guildId: string): { guildId: string } {
  return transaction(() => {
    const guild = findGuild(guildId);
    if (!guild) throw notFound('协会不存在');
    if (findMembership(playerId)) throw conflict('已加入其他协会，请先退出');

    const members = countGuildMembers(guildId);
    if (members >= guild.capacity) throw conflict('该协会人数已满');

    insertMembership(guildId, playerId, new Date().toISOString());
    return { guildId };
  });
}

export function leaveGuild(playerId: string): void {
  transaction(() => {
    if (!findMembership(playerId)) throw conflict('当前未加入协会');
    leaveMembership(playerId);
  });
}

/** 协会签到：每人每日一次，产出金币与贡献。 */
export function checkIn(playerId: string): { coins: number; contribution: number } {
  return transaction(() => {
    const membership = findMembership(playerId);
    if (!membership) throw conflict('当前未加入协会');

    const today = dayKey();
    if (membership.check_in_date === today) throw conflict('今日已签到');

    applyResourceDelta(playerId, { coin: CHECK_IN_COINS }, 'guild.checkin', membership.guild_id);
    const contribution = addContribution(membership.guild_id, playerId, CHECK_IN_CONTRIBUTION);
    setCheckInDate(membership.guild_id, playerId, today);

    return { coins: CHECK_IN_COINS, contribution };
  });
}

/* ------------------------------ 好友 ------------------------------ */

export type FriendView = {
  playerId: string;
  nickname: string;
  server: number;
  status: string;
  direction: 'incoming' | 'outgoing' | 'friend';
};

export function listFriends(playerId: string): {
  friends: FriendView[];
  incoming: FriendView[];
  suggestions: Array<{ playerId: string; nickname: string; server: number }>;
} {
  const self = requirePlayer(playerId);
  const accepted = listFriendships(playerId).filter(row => row.status === 'accepted');
  const incoming = listIncomingRequests(playerId);

  const asView = (id: string, status: string, direction: FriendView['direction']): FriendView => ({
    playerId: id,
    nickname: id,
    server: 0,
    status,
    direction,
  });

  return {
    friends: accepted.map(row => asView(row.friend_id, row.status, 'friend')),
    incoming: incoming.map(row => asView(row.player_id, row.status, 'incoming')),
    // v16 按服隔离：推荐候选只来自同一服务器
    suggestions: listOtherPlayers(playerId, self.server, 10)
      .filter(candidate => !accepted.some(row => row.friend_id === candidate.id))
      .map(candidate => ({ playerId: candidate.id, nickname: candidate.nickname, server: candidate.server })),
  };
}

export function requestFriend(playerId: string, targetPlayerId: string): void {
  if (playerId === targetPlayerId) throw badRequest('不能添加自己为好友');
  transaction(() => {
    if (countFriends(playerId) >= MAX_FRIENDS) throw conflict('好友数量已达上限');
    const target = findPlayerById(targetPlayerId);
    if (!target) throw notFound('对方账号不存在');
    // v16 按服隔离：跨服玩家无法结成好友
    const self = requirePlayer(playerId);
    if (target.server !== self.server) throw conflict('不同服务器的玩家无法成为好友');

    const existing = findFriendship(playerId, targetPlayerId);
    if (existing?.status === 'accepted') throw conflict('对方已经是好友');
    if (existing?.status === 'pending') throw conflict('好友申请已发送，请等待对方回应');

    upsertFriendship(playerId, targetPlayerId, 'pending');
  });
}

/** 接受好友申请：双向写入 accepted，保证关系对称。 */
export function acceptFriend(playerId: string, requesterId: string): void {
  transaction(() => {
    const incoming = findFriendship(requesterId, playerId);
    if (!incoming || incoming.status !== 'pending') throw notFound('没有待处理的好友申请');
    if (countFriends(playerId) >= MAX_FRIENDS) throw conflict('好友数量已达上限');

    upsertFriendship(playerId, requesterId, 'accepted');
    upsertFriendship(requesterId, playerId, 'accepted');
  });
}

export function removeFriend(playerId: string, friendId: string): void {
  transaction(() => {
    deleteFriendship(playerId, friendId);
    deleteFriendship(friendId, playerId);
  });
}

/* ------------------------------ 聊天 ------------------------------ */

export function listChat(input: { playerId: string; channel: 'world' | 'guild'; limit?: number }) {
  if (input.channel === 'guild') {
    const membership = findMembership(input.playerId);
    if (!membership) throw conflict('加入协会后才能查看协会频道');
    return listMessages({ channel: 'guild', guildId: membership.guild_id, limit: input.limit });
  }
  return listMessages({ channel: 'world', limit: input.limit });
}

export function sendChat(input: { playerId: string; channel: 'world' | 'guild'; body: string }) {
  const body = input.body.trim();
  if (!body) throw badRequest('消息内容不能为空');
  if (body.length > MAX_MESSAGE_LENGTH) throw badRequest(`消息长度不能超过 ${MAX_MESSAGE_LENGTH} 字`);

  let guildId: string | null = null;
  if (input.channel === 'guild') {
    const membership = findMembership(input.playerId);
    if (!membership) throw conflict('加入协会后才能在此发言');
    guildId = membership.guild_id;
  }

  return insertMessage({ playerId: input.playerId, channel: input.channel, guildId, body });
}
