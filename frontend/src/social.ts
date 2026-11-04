import type { GameSave } from './game-data';
import { assetUrl } from './assets';

export type SocialContact = { id: string; code: string; name: string; level: number; server: number; online: boolean; note: string; image: string; position: string };
export const socialContacts: SocialContact[] = [
  { id: 'qing', code: '10001', name: '青团', level: 1, server: 17, online: true, note: '你的灵界引路人', image: assetUrl('images/verdant-realm.jpg'), position: '51% 25%' },
  { id: 'moon', code: '10017', name: '月下拾味人', level: 44, server: 17, online: true, note: '沿月色寻找新的滋味', image: assetUrl('images/moonlit-sanctuary.jpg'), position: '72% 27%' },
  { id: 'cheese', code: '10016', name: '风中的奶酪', level: 39, server: 16, online: true, note: '让星辉照亮每一次相遇', image: assetUrl('images/azure-witch.jpg'), position: '50% 23%' },
  { id: 'tea', code: '10031', name: '半盏桂花茶', level: 31, server: 17, online: false, note: '一盏清茶，静候故人', image: assetUrl('images/royal-curry.jpg'), position: '50% 26%' },
  { id: 'sweet', code: '10027', name: '星河甜梦', level: 27, server: 15, online: false, note: '把旅途酿成一场甜梦', image: assetUrl('images/crimson-feast.jpg'), position: '50% 22%' },
  { id: 'snow', code: '10022', name: '春山煮雪', level: 22, server: 17, online: true, note: '且将春色，煮入一杯茶', image: assetUrl('images/golden-contract.jpg'), position: '50% 24%' },
];

export const socialGuilds = [
  { id: 'osmanthus', name: '桂花小筑', english: 'THE OSMANTHUS COVENANT', level: 6, members: 38, capacity: 50, image: assetUrl('images/verdant-realm.jpg'), motto: '让每一位归来的旅者，都有一盏温热的茶。', notice: '欢迎在此停留。签到、捐献与会话仅用于体验本地协会流程，不会联系真实成员。', contacts: ['tea', 'moon', 'qing'] },
  { id: 'starlight', name: '星河食盟', english: 'A FEAST AMONG THE STARS', level: 5, members: 27, capacity: 50, image: assetUrl('images/moonlit-sanctuary.jpg'), motto: '在星光下相聚，把冒险写成共同的故事。', notice: '愿每场相遇，都成为值得回味的篇章。这里的成员均为演示旅人。', contacts: ['cheese', 'sweet', 'moon'] },
  { id: 'moonlit', name: '月下茶会', english: 'THE MOONLIT TEA SOCIETY', level: 4, members: 19, capacity: 50, image: assetUrl('images/moonbridge-battle.jpg'), motto: '以一杯月色，敬与你同行的时光。', notice: '不必匆忙，旅途也值得慢慢品味。所有申请和审批均在当前设备模拟。', contacts: ['snow', 'tea', 'qing'] },
];

export type ChatChannel = 'world' | 'guild' | 'whisper';
export type ChatLocation = { channel: ChatChannel; contactId?: string };
export type LocalMessage = { id: string; thread: string; text: string; createdAt: string };
export type GuildEventType = 'applied' | 'cancelled' | 'joined' | 'left' | 'checked-in' | 'donated';
export type GuildEvent = { id: string; guildId: string; type: GuildEventType; createdAt: string };
export type SocialSave = {
  friends: string[];
  incomingRequests: string[];
  sentRequests: string[];
  messages: LocalMessage[];
  drafts: Record<string, string>;
  guildId: string | null;
  guildApplication: string | null;
  guildJoinedAt: string | null;
  guildCheckInDate: string | null;
  guildDonationDate: string | null;
  contribution: number;
  guildEvents: GuildEvent[];
  guildEventSequence: number;
};

export const MAX_MESSAGE_LENGTH = 120;
export const MAX_MESSAGES_PER_THREAD = 80;
export const MAX_LOCAL_MESSAGES = 200;
export const GUILD_DONATION_COST = 10000;
export const GUILD_CHECKIN_COINS = 5000;
export const guildEventLabels: Record<GuildEventType, string> = { applied: '提交协会申请', cancelled: '撤回协会申请', joined: '在本地模拟加入协会', left: '离开协会', 'checked-in': '完成今日签到，贡献 +20', donated: '完成今日捐献，贡献 +30' };

export function createSocialSave(): SocialSave {
  return { friends: ['qing'], incomingRequests: ['tea'], sentRequests: [], messages: [], drafts: {}, guildId: null, guildApplication: null, guildJoinedAt: null, guildCheckInDate: null, guildDonationDate: null, contribution: 0, guildEvents: [], guildEventSequence: 0 };
}

const contactExists = (id: string) => socialContacts.some(contact => contact.id === id);
const guildExists = (id: string) => socialGuilds.some(guild => guild.id === id);
export const socialDay = (now = new Date()) => `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;

export function requestFriend(save: GameSave, id: string): GameSave {
  const social = save.social;
  if (!save.profile || !contactExists(id) || social.friends.includes(id) || social.sentRequests.includes(id) || social.incomingRequests.includes(id)) return save;
  return { ...save, social: { ...social, sentRequests: [...social.sentRequests, id] } };
}

export function acceptFriend(save: GameSave, id: string, source: 'incoming' | 'outgoing'): GameSave {
  const social = save.social;
  const requests = source === 'incoming' ? social.incomingRequests : social.sentRequests;
  if (!save.profile || !contactExists(id) || !requests.includes(id) || social.friends.includes(id) || social.friends.length >= 50) return save;
  return { ...save, social: { ...social, friends: [...social.friends, id], incomingRequests: social.incomingRequests.filter(value => value !== id), sentRequests: social.sentRequests.filter(value => value !== id) } };
}

export function dismissFriendRequest(save: GameSave, id: string, source: 'incoming' | 'outgoing'): GameSave {
  const key = source === 'incoming' ? 'incomingRequests' : 'sentRequests';
  if (!save.profile || !save.social[key].includes(id)) return save;
  return { ...save, social: { ...save.social, [key]: save.social[key].filter(value => value !== id) } };
}

export function removeFriend(save: GameSave, id: string): GameSave {
  if (!save.profile || !save.social.friends.includes(id)) return save;
  return { ...save, social: { ...save.social, friends: save.social.friends.filter(value => value !== id) } };
}

export function validThread(thread: unknown): thread is string {
  if (typeof thread !== 'string') return false;
  if (thread === 'world') return true;
  const parts = thread.split(':');
  if (parts.length !== 2) return false;
  const [channel, id] = parts;
  return channel === 'dm' ? contactExists(id) : channel === 'guild' && guildExists(id);
}

export function canUseThread(save: GameSave, thread: string): boolean {
  if (!save.profile || !validThread(thread)) return false;
  if (thread === 'world') return true;
  const [channel, id] = thread.split(':');
  return channel === 'dm' ? save.social.friends.includes(id) : save.social.guildId === id;
}

export function normalizeMessage(text: string): string | null {
  const normalized = text.replace(/\r\n?/g, '\n').trim();
  if (!normalized || Array.from(normalized).length > MAX_MESSAGE_LENGTH || /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/.test(normalized)) return null;
  return normalized;
}

export function writeChatDraft(save: GameSave, thread: string, text: string): GameSave {
  if (!canUseThread(save, thread)) return save;
  const value = Array.from(text).slice(0, MAX_MESSAGE_LENGTH).join('');
  if ((save.social.drafts[thread] || '') === value) return save;
  const drafts = { ...save.social.drafts };
  if (value) drafts[thread] = value; else delete drafts[thread];
  return { ...save, social: { ...save.social, drafts } };
}

export function sendLocalMessage(save: GameSave, thread: string, text: string, id: string, now = new Date()): GameSave {
  const normalized = normalizeMessage(text);
  if (!normalized || !canUseThread(save, thread) || !/^[a-zA-Z0-9-]{1,96}$/.test(id) || save.social.messages.some(message => message.id === id)) return save;
  const drafts = { ...save.social.drafts }; delete drafts[thread];
  let messages = [...save.social.messages, { id, thread, text: normalized, createdAt: now.toISOString() }];
  const threadIds = new Set(messages.filter(message => message.thread === thread).slice(-MAX_MESSAGES_PER_THREAD).map(message => message.id));
  messages = messages.filter(message => message.thread !== thread || threadIds.has(message.id)).slice(-MAX_LOCAL_MESSAGES);
  return { ...save, social: { ...save.social, messages, drafts } };
}

export function clearLocalMessages(save: GameSave, thread: string): GameSave {
  if (!canUseThread(save, thread) || !save.social.messages.some(message => message.thread === thread)) return save;
  return { ...save, social: { ...save.social, messages: save.social.messages.filter(message => message.thread !== thread) } };
}

function guildEvent(social: SocialSave, guildId: string, type: GuildEventType, now: Date): SocialSave {
  const sequence = social.guildEventSequence + 1;
  return { ...social, guildEventSequence: sequence, guildEvents: [{ id: `event-${sequence}`, guildId, type, createdAt: now.toISOString() }, ...social.guildEvents].slice(0, 40) };
}

export function applyToGuild(save: GameSave, id: string, now = new Date()): GameSave {
  if (!save.profile || !guildExists(id) || save.social.guildId || save.social.guildApplication) return save;
  return { ...save, social: guildEvent({ ...save.social, guildApplication: id }, id, 'applied', now) };
}

export function cancelGuildApplication(save: GameSave, now = new Date()): GameSave {
  if (!save.profile || !save.social.guildApplication) return save;
  return { ...save, social: guildEvent({ ...save.social, guildApplication: null }, save.social.guildApplication, 'cancelled', now) };
}

export function approveGuildLocally(save: GameSave, now = new Date()): GameSave {
  const id = save.social.guildApplication;
  if (!save.profile || !id || !guildExists(id) || save.social.guildId) return save;
  return { ...save, social: guildEvent({ ...save.social, guildId: id, guildApplication: null, guildJoinedAt: now.toISOString() }, id, 'joined', now) };
}

export function leaveGuild(save: GameSave, now = new Date()): GameSave {
  const id = save.social.guildId;
  if (!save.profile || !id) return save;
  return { ...save, social: guildEvent({ ...save.social, guildId: null, guildApplication: null, guildJoinedAt: null }, id, 'left', now) };
}

export function checkInGuild(save: GameSave, now = new Date()): GameSave {
  const id = save.social.guildId;
  const today = socialDay(now);
  if (!save.profile || !id || save.social.guildCheckInDate === today) return save;
  return { ...save, coins: save.coins + GUILD_CHECKIN_COINS, social: guildEvent({ ...save.social, guildCheckInDate: today, contribution: save.social.contribution + 20 }, id, 'checked-in', now) };
}

export function donateToGuild(save: GameSave, now = new Date()): GameSave {
  const id = save.social.guildId;
  const today = socialDay(now);
  if (!save.profile || !id || save.social.guildDonationDate === today || save.coins < GUILD_DONATION_COST) return save;
  return { ...save, coins: save.coins - GUILD_DONATION_COST, social: guildEvent({ ...save.social, guildDonationDate: today, contribution: save.social.contribution + 30 }, id, 'donated', now) };
}

export type SampleMessage = { contactId: string; text: string };
export function sampleMessages(thread: string): SampleMessage[] {
  if (thread === 'world') return [{ contactId: 'moon', text: '今晚的月桥，似乎又亮起了新的灯。' }, { contactId: 'cheese', text: '准备好食灵阵容，再去看看更远的风景吧。' }];
  if (thread.startsWith('guild:')) {
    const guild = socialGuilds.find(item => item.id === thread.split(':')[1]);
    return guild ? [{ contactId: guild.contacts[0], text: '愿每位旅者的到来，都为这里添一份温暖。' }] : [];
  }
  if (thread === 'dm:qing') return [{ contactId: 'qing', text: '这里是一封为你准备的示例问候。你写下的话只会保存在这台设备上。' }];
  return [];
}

export function parseSocialSave(value: unknown): SocialSave {
  const next = createSocialSave();
  if (!value || typeof value !== 'object' || Array.isArray(value)) return next;
  const stored = value as Record<string, unknown>;
  const ids = (source: unknown, allowed: (id: string) => boolean) => Array.isArray(source) ? [...new Set(source.filter((id): id is string => typeof id === 'string' && allowed(id)))] : [];
  const date = (source: unknown): source is string => typeof source === 'string' && !Number.isNaN(Date.parse(source));
  next.friends = ids(stored.friends, contactExists).slice(0, 50);
  next.incomingRequests = ids(stored.incomingRequests, contactExists).filter(id => !next.friends.includes(id));
  next.sentRequests = ids(stored.sentRequests, contactExists).filter(id => !next.friends.includes(id) && !next.incomingRequests.includes(id));
  next.guildId = typeof stored.guildId === 'string' && guildExists(stored.guildId) ? stored.guildId : null;
  next.guildApplication = !next.guildId && typeof stored.guildApplication === 'string' && guildExists(stored.guildApplication) ? stored.guildApplication : null;
  next.guildJoinedAt = next.guildId && date(stored.guildJoinedAt) ? stored.guildJoinedAt : null;
  for (const field of ['guildCheckInDate', 'guildDonationDate'] as const) if (typeof stored[field] === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(stored[field]) && date(stored[field])) next[field] = stored[field];
  for (const field of ['contribution', 'guildEventSequence'] as const) if (typeof stored[field] === 'number' && Number.isSafeInteger(stored[field]) && stored[field] >= 0 && stored[field] <= 1e9) next[field] = stored[field];
  if (Array.isArray(stored.messages)) {
    const seen = new Set<string>();
    const perThread: Record<string, number> = {};
    const messages: LocalMessage[] = [];
    for (const value of [...stored.messages].reverse()) {
      if (!value || typeof value !== 'object') continue;
      const message = value as LocalMessage;
      if (typeof message.id !== 'string' || !/^[a-zA-Z0-9-]{1,96}$/.test(message.id) || seen.has(message.id) || !validThread(message.thread) || typeof message.text !== 'string' || !date(message.createdAt)) continue;
      const text = normalizeMessage(message.text);
      if (!text || (perThread[message.thread] || 0) >= MAX_MESSAGES_PER_THREAD) continue;
      seen.add(message.id); perThread[message.thread] = (perThread[message.thread] || 0) + 1;
      messages.unshift({ id: message.id, thread: message.thread, text, createdAt: message.createdAt });
      if (messages.length >= MAX_LOCAL_MESSAGES) break;
    }
    next.messages = messages;
  }
  if (stored.drafts && typeof stored.drafts === 'object' && !Array.isArray(stored.drafts)) {
    for (const [thread, text] of Object.entries(stored.drafts)) if (validThread(thread) && typeof text === 'string') next.drafts[thread] = Array.from(text).slice(0, MAX_MESSAGE_LENGTH).join('');
  }
  if (Array.isArray(stored.guildEvents)) {
    const seen = new Set<string>();
    next.guildEvents = stored.guildEvents.flatMap((value): GuildEvent[] => {
      if (!value || typeof value !== 'object') return [];
      const event = value as GuildEvent;
      if (typeof event.id !== 'string' || !/^event-\d{1,10}$/.test(event.id) || seen.has(event.id) || !guildExists(event.guildId) || !Object.prototype.hasOwnProperty.call(guildEventLabels, event.type) || !date(event.createdAt)) return [];
      seen.add(event.id);
      next.guildEventSequence = Math.max(next.guildEventSequence, Number(event.id.slice(6)));
      return [{ id: event.id, guildId: event.guildId, type: event.type, createdAt: event.createdAt }];
    }).slice(0, 40);
  }
  return next;
}