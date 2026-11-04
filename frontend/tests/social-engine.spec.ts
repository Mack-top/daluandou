import { test, expect } from '@playwright/test';
import { createFreshSave, rolloverDaily } from '../src/game-clock';
import { parseSave } from '../src/save-store';
import {
  acceptFriend, applyToGuild, approveGuildLocally, canUseThread, cancelGuildApplication, checkInGuild, clearLocalMessages,
  dismissFriendRequest, donateToGuild, leaveGuild, MAX_LOCAL_MESSAGES, MAX_MESSAGES_PER_THREAD, normalizeMessage,
  parseSocialSave, removeFriend, requestFriend, sendLocalMessage, validThread, writeChatDraft,
} from '../src/social';
import type { GameSave } from '../src/game-data';

function traveler(): GameSave {
  return { ...createFreshSave(), profile: { name: '同行旅人', gender: 'female', createdAt: new Date().toISOString() } };
}

test('friend requests require valid contacts and explicit local acceptance', () => {
  const save = traveler();
  const pending = requestFriend(save, 'moon');
  expect(pending.social.sentRequests).toEqual(['moon']);
  expect(pending.social.friends).toEqual(['qing']);
  expect(requestFriend(pending, 'moon')).toBe(pending);
  expect(requestFriend(pending, 'unknown')).toBe(pending);
  expect(requestFriend(pending, 'tea')).toBe(pending);
  expect(acceptFriend(save, 'moon', 'outgoing')).toBe(save);
  const accepted = acceptFriend(pending, 'moon', 'outgoing');
  expect(accepted.social.friends).toEqual(['qing', 'moon']);
  expect(accepted.social.sentRequests).toEqual([]);
  expect(acceptFriend(accepted, 'moon', 'outgoing')).toBe(accepted);
});

test('incoming invitations can be accepted or declined without coming back on reload', () => {
  const save = traveler();
  const accepted = acceptFriend(save, 'tea', 'incoming');
  expect(accepted.social.friends).toEqual(['qing', 'tea']);
  expect(accepted.social.incomingRequests).toEqual([]);
  const declined = dismissFriendRequest(save, 'tea', 'incoming');
  expect(parseSave(declined).social.incomingRequests).toEqual([]);
  const pending = requestFriend(save, 'moon');
  const cancelled = dismissFriendRequest(pending, 'moon', 'outgoing');
  expect(cancelled.social.sentRequests).toEqual([]);
  expect(dismissFriendRequest(cancelled, 'moon', 'outgoing')).toBe(cancelled);
});

test('messages and drafts are isolated by channel and recipient', () => {
  let save = traveler();
  save = writeChatDraft(save, 'world', '世界草稿');
  save = writeChatDraft(save, 'dm:qing', '青团草稿');
  save = sendLocalMessage(save, 'world', ' 世界问候 ', 'world-one');
  expect(save.social.drafts.world).toBeUndefined();
  expect(save.social.drafts['dm:qing']).toBe('青团草稿');
  save = sendLocalMessage(save, 'dm:qing', '给青团的问候', 'private-one');
  expect(save.social.messages.map(message => message.thread)).toEqual(['world', 'dm:qing']);
  expect(save.social.messages[0].text).toBe('世界问候');
  expect(parseSave(save).social.messages).toEqual(save.social.messages);
});

test('invalid, blank or duplicate messages cannot be stored', () => {
  const save = traveler();
  expect(sendLocalMessage(save, 'guild:osmanthus', '越权', 'bad-guild')).toBe(save);
  expect(sendLocalMessage(save, 'dm:moon', '未加好友', 'bad-friend')).toBe(save);
  expect(sendLocalMessage(save, 'world', '   ', 'blank')).toBe(save);
  expect(sendLocalMessage(save, 'world', '长'.repeat(121), 'long')).toBe(save);
  expect(sendLocalMessage(save, 'world', '文本', '<invalid>')).toBe(save);
  expect(validThread('dm:qing:')).toBe(false);
  expect(validThread('guild:osmanthus:extra')).toBe(false);
  expect(validThread('__proto__')).toBe(false);
  const sent = sendLocalMessage(save, 'world', '一份记录', 'once');
  expect(sendLocalMessage(sent, 'world', '重复记录', 'once')).toBe(sent);
  expect(normalizeMessage('问'.repeat(120))).toHaveLength(120);
  expect(normalizeMessage('无效\u0000内容')).toBeNull();
});

test('history stays bounded per conversation and across all channels', () => {
  let save = acceptFriend(requestFriend(traveler(), 'moon'), 'moon', 'outgoing');
  for (const thread of ['world', 'dm:qing', 'dm:moon']) {
    for (let i = 0; i < 90; i++) save = sendLocalMessage(save, thread, `问候 ${i}`, `msg-${thread.replace(':', '-')}-${i}`);
    expect(save.social.messages.filter(message => message.thread === thread)).toHaveLength(MAX_MESSAGES_PER_THREAD);
  }
  expect(save.social.messages).toHaveLength(MAX_LOCAL_MESSAGES);
  expect(parseSave(save).social.messages).toHaveLength(MAX_LOCAL_MESSAGES);
});

test('clearing one channel or removing a friend does not erase other conversations', () => {
  let save = traveler();
  save = sendLocalMessage(save, 'world', '世界', 'world');
  save = sendLocalMessage(save, 'dm:qing', '伙伴', 'friend');
  const cleared = clearLocalMessages(save, 'world');
  expect(cleared.social.messages).toHaveLength(1);
  expect(cleared.social.messages[0].thread).toBe('dm:qing');
  const removed = removeFriend(cleared, 'qing');
  expect(removed.social.friends).toEqual([]);
  expect(removed.social.messages).toHaveLength(1);
  expect(canUseThread(removed, 'dm:qing')).toBe(false);
  expect(parseSave(removed).social.friends).toEqual([]);
});

test('guild applications survive reload and must be manually approved', () => {
  const save = traveler();
  expect(approveGuildLocally(save)).toBe(save);
  const pending = applyToGuild(save, 'osmanthus');
  expect(pending.social.guildId).toBeNull();
  expect(parseSave(pending).social.guildApplication).toBe('osmanthus');
  expect(applyToGuild(pending, 'starlight')).toBe(pending);
  const joined = approveGuildLocally(pending);
  expect(joined.social.guildId).toBe('osmanthus');
  expect(joined.social.guildApplication).toBeNull();
  expect(approveGuildLocally(joined)).toBe(joined);
  expect(joined.social.guildEvents.map(event => event.type)).toEqual(['joined', 'applied']);
  const cancelled = cancelGuildApplication(pending);
  expect(cancelled.social.guildApplication).toBeNull();
});

test('guild check-in and donation validate resources and pay once per day', () => {
  const joined = approveGuildLocally(applyToGuild(traveler(), 'osmanthus'));
  const now = new Date();
  const signed = checkInGuild(joined, now);
  expect(signed.coins).toBe(55000);
  expect(signed.social.contribution).toBe(20);
  expect(checkInGuild(signed, now)).toBe(signed);
  const donated = donateToGuild(signed, now);
  expect(donated.coins).toBe(45000);
  expect(donated.social.contribution).toBe(50);
  expect(donateToGuild(donated, now)).toBe(donated);
  const poor = { ...joined, coins: 9000 };
  expect(donateToGuild(poor)).toBe(poor);
});

test('leaving and rejoining a different guild cannot reset daily payouts', () => {
  const now = new Date();
  let save = approveGuildLocally(applyToGuild(traveler(), 'osmanthus', now), now);
  save = donateToGuild(checkInGuild(save, now), now);
  const before = { coins: save.coins, contribution: save.social.contribution };
  save = leaveGuild(save, now);
  save = approveGuildLocally(applyToGuild(save, 'starlight', now), now);
  expect(checkInGuild(save, now)).toBe(save);
  expect(donateToGuild(save, now)).toBe(save);
  expect(save.coins).toBe(before.coins);
  expect(save.social.contribution).toBe(before.contribution);
  const tomorrow = new Date(now); tomorrow.setDate(tomorrow.getDate() + 1);
  expect(checkInGuild(save, tomorrow).coins).toBe(before.coins + 5000);
});

test('guild conversations cannot leak across memberships and old archives are retained', () => {
  let save = approveGuildLocally(applyToGuild(traveler(), 'osmanthus'));
  save = sendLocalMessage(save, 'guild:osmanthus', '第一家协会', 'guild-first');
  save = approveGuildLocally(applyToGuild(leaveGuild(save), 'starlight'));
  expect(canUseThread(save, 'guild:osmanthus')).toBe(false);
  expect(canUseThread(save, 'guild:starlight')).toBe(true);
  save = sendLocalMessage(save, 'guild:starlight', '第二家协会', 'guild-second');
  expect(save.social.messages.map(message => message.thread)).toEqual(['guild:osmanthus', 'guild:starlight']);
});

test('social migration rejects corrupt records and preserves valid game progress', () => {
  const save = traveler();
  const parsed = parseSave({ ...save, coins: 98765, social: {
    friends: ['qing', 'qing', 'unknown'], incomingRequests: ['qing', 'tea'], sentRequests: ['tea', 'moon'], guildId: 'unknown',
    messages: [{ id: 'good', thread: 'world', text: '有效记录', createdAt: new Date().toISOString() }, { id: 'evil', thread: '__proto__', text: '不合法', createdAt: 'bad-date' }],
    drafts: { world: '草'.repeat(200), '__proto__': '无效' }, contribution: -5,
  } });
  expect(parsed.coins).toBe(98765);
  expect(parsed.social.friends).toEqual(['qing']);
  expect(parsed.social.incomingRequests).toEqual(['tea']);
  expect(parsed.social.sentRequests).toEqual(['moon']);
  expect(parsed.social.messages).toHaveLength(1);
  expect(Array.from(parsed.social.drafts.world)).toHaveLength(120);
  expect(parsed.social.guildId).toBeNull();
  expect(parsed.social.contribution).toBe(0);
  const legacy = { ...save } as Partial<GameSave>; delete legacy.social;
  expect(parseSave(legacy).social.friends).toEqual(['qing']);
});

test('guild journal remains bounded and long-term social state survives day changes', () => {
  let save = traveler();
  for (let i = 0; i < 30; i++) save = cancelGuildApplication(applyToGuild(save, 'osmanthus'));
  expect(save.social.guildEvents).toHaveLength(40);
  expect(new Set(save.social.guildEvents.map(event => event.id)).size).toBe(40);
  expect(parseSocialSave(save.social).guildEvents).toHaveLength(40);
  const tomorrow = new Date(); tomorrow.setDate(tomorrow.getDate() + 1);
  expect(rolloverDaily(save, tomorrow).social).toBe(save.social);
});

test('guests cannot mutate friends, channels, guild membership or rewards', () => {
  const save = createFreshSave();
  expect(requestFriend(save, 'moon')).toBe(save);
  expect(acceptFriend(save, 'tea', 'incoming')).toBe(save);
  expect(sendLocalMessage(save, 'world', '游客', 'guest')).toBe(save);
  expect(writeChatDraft(save, 'world', '草稿')).toBe(save);
  expect(applyToGuild(save, 'osmanthus')).toBe(save);
  expect(checkInGuild(save)).toBe(save);
  expect(donateToGuild(save)).toBe(save);
});