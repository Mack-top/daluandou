import { execute, queryAll, queryOne } from '../db/index.js';
import { nowIso } from '../lib/clock.js';
import { newId } from '../lib/ids.js';
import type { GuildRow, PlayerRow } from '../domain/types.js';

/* ------------------------------ 协会 ------------------------------ */

export function listGuilds(): Array<GuildRow & { members: number }> {
  return queryAll<GuildRow & { members: number }>(
    `SELECT g.*, (SELECT COUNT(*) FROM guild_members m WHERE m.guild_id = g.id) AS members
       FROM guilds g
      ORDER BY g.level DESC, g.name`,
  );
}

export function findGuild(guildId: string): GuildRow | undefined {
  return queryOne<GuildRow>('SELECT * FROM guilds WHERE id = ?', guildId);
}

export type MembershipRow = {
  guild_id: string;
  player_id: string;
  role: string;
  contribution: number;
  check_in_date: string | null;
  joined_at: string;
};

export function findMembership(playerId: string): MembershipRow | undefined {
  return queryOne<MembershipRow>('SELECT * FROM guild_members WHERE player_id = ?', playerId);
}

export function countGuildMembers(guildId: string): number {
  const row = queryOne<{ total: number }>('SELECT COUNT(*) AS total FROM guild_members WHERE guild_id = ?', guildId);
  return row ? Number(row.total) : 0;
}

export function insertMembership(guildId: string, playerId: string, joinedAt: string): void {
  execute(
    `INSERT INTO guild_members (guild_id, player_id, role, contribution, joined_at)
     VALUES (?, ?, 'member', 0, ?)`,
    guildId,
    playerId,
    joinedAt,
  );
}

export function leaveMembership(playerId: string): void {
  execute('DELETE FROM guild_members WHERE player_id = ?', playerId);
}

export function addContribution(guildId: string, playerId: string, amount: number): number {
  execute(
    'UPDATE guild_members SET contribution = contribution + ? WHERE guild_id = ? AND player_id = ?',
    amount,
    guildId,
    playerId,
  );
  const row = queryOne<{ contribution: number }>(
    'SELECT contribution FROM guild_members WHERE guild_id = ? AND player_id = ?',
    guildId,
    playerId,
  );
  return row ? Number(row.contribution) : 0;
}

export function setCheckInDate(guildId: string, playerId: string, date: string): void {
  execute(
    'UPDATE guild_members SET check_in_date = ? WHERE guild_id = ? AND player_id = ?',
    date,
    guildId,
    playerId,
  );
}

/* ------------------------------ 好友 ------------------------------ */

export type FriendshipRow = { player_id: string; friend_id: string; status: string; created_at: string };

export function listFriendships(playerId: string): FriendshipRow[] {
  return queryAll<FriendshipRow>('SELECT * FROM friendships WHERE player_id = ? ORDER BY created_at DESC', playerId);
}

export function findFriendship(playerId: string, friendId: string): FriendshipRow | undefined {
  return queryOne<FriendshipRow>(
    'SELECT * FROM friendships WHERE player_id = ? AND friend_id = ?',
    playerId,
    friendId,
  );
}

/** 别人发给我的待处理好友申请 */
export function listIncomingRequests(playerId: string): FriendshipRow[] {
  return queryAll<FriendshipRow>(
    "SELECT * FROM friendships WHERE friend_id = ? AND status = 'pending' ORDER BY created_at DESC",
    playerId,
  );
}

export function upsertFriendship(playerId: string, friendId: string, status: 'pending' | 'accepted' | 'blocked'): void {
  execute(
    `INSERT INTO friendships (player_id, friend_id, status, created_at) VALUES (?, ?, ?, ?)
     ON CONFLICT(player_id, friend_id) DO UPDATE SET status = excluded.status`,
    playerId,
    friendId,
    status,
    nowIso(),
  );
}

export function deleteFriendship(playerId: string, friendId: string): void {
  execute('DELETE FROM friendships WHERE player_id = ? AND friend_id = ?', playerId, friendId);
}

export function countFriends(playerId: string): number {
  const row = queryOne<{ total: number }>(
    "SELECT COUNT(*) AS total FROM friendships WHERE player_id = ? AND status = 'accepted'",
    playerId,
  );
  return row ? Number(row.total) : 0;
}

/* ------------------------------ 聊天 ------------------------------ */

export type ChatRow = { id: string; player_id: string | null; guild_id: string | null; channel: string; body: string; created_at: string };

export function listMessages(input: { channel: 'world' | 'guild'; guildId?: string | null; limit?: number }): ChatRow[] {
  const limit = input.limit ?? 50;
  if (input.channel === 'guild') {
    return queryAll<ChatRow>(
      `SELECT * FROM chat_messages WHERE channel = 'guild' AND guild_id = ? ORDER BY created_at DESC LIMIT ?`,
      input.guildId ?? '',
      limit,
    ).reverse();
  }
  return queryAll<ChatRow>(
    `SELECT * FROM chat_messages WHERE channel = 'world' ORDER BY created_at DESC LIMIT ?`,
    limit,
  ).reverse();
}

export function insertMessage(input: {  playerId: string;
  channel: 'world' | 'guild';
  guildId: string | null;
  body: string;
}): ChatRow {
  const id = newId();
  const createdAt = nowIso();
  execute(
    `INSERT INTO chat_messages (id, player_id, guild_id, channel, body, created_at)
     VALUES (?, ?, ?, ?, ?, ?)`,
    id,
    input.playerId,
    input.guildId,
    input.channel,
    input.body,
    createdAt,
  );
  return { id, player_id: input.playerId, guild_id: input.guildId, channel: input.channel, body: input.body, created_at: createdAt };
}

/** 玩家自己发出的消息（按时间正序，便于直接渲染聊天记录） */
export function listPlayerMessages(playerId: string, limit = 50): ChatRow[] {
  return queryAll<ChatRow>(
    'SELECT * FROM chat_messages WHERE player_id = ? ORDER BY created_at DESC LIMIT ?',
    playerId,
    limit,
  ).reverse();
}

/* ------------------------------ 可交友玩家 ------------------------------ */

/** v16 按服隔离：可交友玩家只返回同一服务器的账号。 */
export function listOtherPlayers(excludeId: string, server: number, limit = 20): Array<Pick<PlayerRow, 'id' | 'nickname' | 'server' | 'created_at'>> {
  return queryAll<Pick<PlayerRow, 'id' | 'nickname' | 'server' | 'created_at'>>(
    'SELECT id, nickname, server, created_at FROM players WHERE id <> ? AND server = ? ORDER BY created_at DESC LIMIT ?',
    excludeId,
    server,
    limit,
  );
}

export function countAllPlayers(): number {
  const row = queryOne<{ total: number }>('SELECT COUNT(*) AS total FROM players');
  return row ? Number(row.total) : 0;
}
