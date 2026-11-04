/**
 * 存档文档服务端校验器
 * -----------------------------------------------------------------------------
 * 与前端 save-store.ts 的 parseSave 同一套口径：白名单逐字段校验，
 * 未知字段丢弃、非法字段回退默认值，绝不整体拒绝（避免一次脏数据让玩家丢档）。
 * 与配置表绑定的字段（食灵/装备/关卡/任务/邮件/商店/交易/星象）以数据库配置为准。
 * 社交模块的演示联系人 id 为前端展示数据，仅做结构性校验。
 */

export type SaveDocumentCatalog = {
  characters: string[]; // 食灵名
  equipmentTemplates: Array<{ id: string; slot: string }>;
  stages: string[];
  quests: string[];
  mails: string[];
  shopPacks: string[];
  tradeRates: Array<{ id: string; dailyLimit: number }>;
  marketOffers: string[];
  astrologyNodes: string[];
  guilds: string[];
};

// 128KB：低于 HTTP 层 256KB 请求体上限，确保「清洗后仍超限」的文档能走到这里的 422
export const MAX_SAVE_DOCUMENT_BYTES = 128 * 1024;
const MAX_EQUIPMENT = 120;
// v17 数值核心 v2：强化上限 5 → 12（设计 §4.2）
const MAX_ENHANCEMENT = 12;
const MAX_BATTLE_HISTORY = 20;
const MAX_BATTLE_ROUNDS = 12;
const MAX_LOCAL_MESSAGES = 200;
const MAX_MESSAGES_PER_THREAD = 80;
const MAX_MESSAGE_LENGTH = 120;
const EQUIPMENT_SLOTS = ['weapon', 'crown', 'armor', 'charm', 'relic', 'crest'] as const;
// v17：'exp' = 掌灶人经验（战斗结算奖励可出现在战斗记录里）
const REWARD_KINDS = ['coin', 'gem', 'book', 'leaf', 'potion', 'chest', 'medal', 'exp'] as const;

const object = (value: unknown): value is Record<string, unknown> =>
  !!value && typeof value === 'object' && !Array.isArray(value);
const number = (value: unknown, max = 1e12): value is number =>
  typeof value === 'number' && Number.isSafeInteger(value) && value >= 0 && value <= max;
const positive = (value: unknown): value is number =>
  typeof value === 'number' && Number.isSafeInteger(value) && value > 0 && value < 1e9;
const date = (value: unknown): value is string =>
  typeof value === 'string' && value.length <= 40 && !Number.isNaN(Date.parse(value));
const day = (value: unknown): value is string =>
  typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value) && date(value);

function strings(value: unknown, allowed: Set<string>): string[] {
  if (!Array.isArray(value)) return [];
  return [...new Set(value.filter((item): item is string => typeof item === 'string' && allowed.has(item)))];
}

function numbers(value: unknown, allowed: number[]): number[] {
  if (!Array.isArray(value)) return [];
  const whitelist = new Set(allowed);
  return [...new Set(value.filter((item): item is number => typeof item === 'number' && whitelist.has(item)))];
}

/** 战斗记录校验：与前端 battle-engine.ts 的 isBattleRecord 一致。 */
function sanitizeBattleRecord(value: unknown, characters: Set<string>, stages: Set<string>): Record<string, unknown> | null {
  if (!object(value)) return null;
  const record = value;
  if (record.version !== 1 || typeof record.id !== 'string' || !record.id || record.id.length > 100) return null;
  if (typeof record.seed !== 'number' || !Number.isFinite(record.seed)) return null;
  if (typeof record.stageId !== 'string' || !stages.has(record.stageId)) return null;
  if (typeof record.stageName !== 'string' || record.stageName.length > 40) return null;
  if (typeof record.chapter !== 'string' || record.chapter.length > 20) return null;
  if (!date(record.startedAt) || (record.settledAt !== null && !date(record.settledAt))) return null;
  if (!['pending', 'claimed', 'lost'].includes(record.status as string)) return null;
  if (typeof record.win !== 'boolean' || typeof record.firstClear !== 'boolean') return null;
  if (!positive(record.power) || !positive(record.enemyPower) || !positive(record.rounds) || record.rounds > MAX_BATTLE_ROUNDS) return null;
  if (!Array.isArray(record.units) || record.units.length < 2 || record.units.length > 6) return null;
  const units = record.units as Array<Record<string, unknown>>;
  for (const unit of units) {
    if (!object(unit)) return null;
    if (typeof unit.id !== 'string' || !unit.id || unit.id.length > 110) return null;
    if (typeof unit.name !== 'string' || unit.name.length > 20) return null;
    if (!['ally', 'enemy'].includes(unit.side as string)) return null;
    if (!positive(unit.maxHp) || !positive(unit.attack) || !positive(unit.speed)) return null;
    if (!positive(unit.star) || (unit.star as number) > 5) return null;
    if (unit.character !== null && (typeof unit.character !== 'string' || !characters.has(unit.character))) return null;
    for (const key of ['defense', 'critical', 'resistance']) {
      const stat = unit[key];
      if (stat !== undefined && !(typeof stat === 'number' && Number.isSafeInteger(stat) && stat >= 0 && stat < 1e6)) return null;
    }
    if (unit.side === 'ally' && unit.character !== unit.name) return null;
  }
  const ids = new Set(units.map(unit => unit.id as string));
  if (ids.size !== units.length) return null;
  if (!units.some(unit => unit.side === 'ally') || !units.some(unit => unit.side === 'enemy')) return null;
  if (!Array.isArray(record.turns) || record.turns.length === 0 || record.turns.length > MAX_BATTLE_ROUNDS * 6) return null;
  const turns: Record<string, unknown>[] = [];
  for (const raw of record.turns as unknown[]) {
    if (!object(raw)) return null;
    if (typeof raw.actor !== 'string' || !ids.has(raw.actor)) return null;
    if (typeof raw.target !== 'string' || !ids.has(raw.target)) return null;
    if (!positive(raw.round) || (raw.round as number) > MAX_BATTLE_ROUNDS) return null;
    if (!['attack', 'skill', 'heal'].includes(raw.kind as string)) return null;
    if (typeof raw.skill !== 'string' || raw.skill.length > 20) return null;
    if (typeof raw.critical !== 'boolean') return null;
    if (!number(raw.amount, 1e9)) return null;
    if (!object(raw.health)) return null;
    const health: Record<string, number> = {};
    for (const unit of units) {
      const hp = (raw.health as Record<string, unknown>)[unit.id as string];
      if (typeof hp !== 'number' || !Number.isFinite(hp) || hp < 0 || hp > (unit.maxHp as number)) return null;
      health[unit.id as string] = hp;
    }
    turns.push({
      round: raw.round, actor: raw.actor, target: raw.target, kind: raw.kind,
      skill: raw.skill, amount: raw.amount, critical: raw.critical, health,
    });
  }
  if (!Array.isArray(record.rewards) || record.rewards.length > 5) return null;
  const rewards: Record<string, unknown>[] = [];
  for (const raw of record.rewards as unknown[]) {
    if (!object(raw)) return null;
    if (!REWARD_KINDS.includes(raw.kind as (typeof REWARD_KINDS)[number])) return null;
    if (!positive(raw.amount)) return null;
    if (typeof raw.label !== 'string' || raw.label.length > 20) return null;
    rewards.push({ kind: raw.kind, amount: raw.amount, label: raw.label });
  }
  return {
    version: 1,
    id: record.id,
    seed: record.seed,
    stageId: record.stageId,
    stageName: record.stageName,
    chapter: record.chapter,
    startedAt: record.startedAt,
    settledAt: record.settledAt,
    power: record.power,
    enemyPower: record.enemyPower,
    units: units.map(unit => {
      const clean: Record<string, unknown> = {
        id: unit.id, name: unit.name, side: unit.side, character: unit.character,
        star: unit.star, maxHp: unit.maxHp, attack: unit.attack, speed: unit.speed,
      };
      for (const key of ['defense', 'critical', 'resistance']) if (unit[key] !== undefined) clean[key] = unit[key];
      return clean;
    }),
    turns,
    win: record.win,
    rounds: record.rounds,
    firstClear: record.firstClear,
    rewards,
    status: record.status,
  };
}

function sanitizeSocial(value: unknown, guilds: Set<string>): Record<string, unknown> {
  const next: Record<string, unknown> = {
    friends: [], incomingRequests: [], sentRequests: [], messages: [], drafts: {},
    guildId: null, guildApplication: null, guildJoinedAt: null,
    guildCheckInDate: null, guildDonationDate: null, contribution: 0, guildEvents: [], guildEventSequence: 0,
  };
  if (!object(value)) return next;
  const contactId = (id: unknown): id is string => typeof id === 'string' && /^[a-z0-9-]{1,40}$/.test(id);
  const ids = (source: unknown): string[] =>
    Array.isArray(source) ? [...new Set(source.filter(contactId))] : [];
  next.friends = ids(value.friends).slice(0, 50);
  next.incomingRequests = ids(value.incomingRequests).filter(id => !(next.friends as string[]).includes(id));
  next.sentRequests = ids(value.sentRequests)
    .filter(id => !(next.friends as string[]).includes(id) && !(next.incomingRequests as string[]).includes(id));
  next.guildId = typeof value.guildId === 'string' && guilds.has(value.guildId) ? value.guildId : null;
  next.guildApplication = !next.guildId && typeof value.guildApplication === 'string' && guilds.has(value.guildApplication)
    ? value.guildApplication
    : null;
  next.guildJoinedAt = next.guildId && date(value.guildJoinedAt) ? value.guildJoinedAt : null;
  for (const field of ['guildCheckInDate', 'guildDonationDate']) {
    if (day(value[field])) next[field] = value[field];
  }
  for (const field of ['contribution', 'guildEventSequence']) {
    if (number(value[field], 1e9)) next[field] = value[field];
  }
  const validThread = (thread: unknown): thread is string => {
    if (typeof thread !== 'string') return false;
    if (thread === 'world') return true;
    const parts = thread.split(':');
    if (parts.length !== 2) return false;
    const [channel, id] = parts;
    return channel === 'dm' ? contactId(id) : channel === 'guild' && guilds.has(id);
  };
  const normalizeMessage = (text: string): string | null => {
    const normalized = text.replace(/\r\n?/g, '\n').trim();
    if (!normalized || Array.from(normalized).length > MAX_MESSAGE_LENGTH) return null;
    if (/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/.test(normalized)) return null;
    return normalized;
  };
  if (Array.isArray(value.messages)) {
    const seen = new Set<string>();
    const perThread: Record<string, number> = {};
    const messages: Array<Record<string, unknown>> = [];
    for (const raw of [...value.messages].reverse()) {
      if (!object(raw)) continue;
      if (typeof raw.id !== 'string' || !/^[a-zA-Z0-9-]{1,96}$/.test(raw.id) || seen.has(raw.id)) continue;
      if (!validThread(raw.thread) || typeof raw.text !== 'string' || !date(raw.createdAt)) continue;
      const text = normalizeMessage(raw.text);
      if (!text || (perThread[raw.thread] ?? 0) >= MAX_MESSAGES_PER_THREAD) continue;
      seen.add(raw.id);
      perThread[raw.thread] = (perThread[raw.thread] ?? 0) + 1;
      messages.unshift({ id: raw.id, thread: raw.thread, text, createdAt: raw.createdAt });
      if (messages.length >= MAX_LOCAL_MESSAGES) break;
    }
    next.messages = messages;
  }
  if (object(value.drafts)) {
    const drafts: Record<string, string> = {};
    for (const [thread, text] of Object.entries(value.drafts)) {
      if (validThread(thread) && typeof text === 'string') drafts[thread] = Array.from(text).slice(0, MAX_MESSAGE_LENGTH).join('');
    }
    next.drafts = drafts;
  }
  if (Array.isArray(value.guildEvents)) {
    const seen = new Set<string>();
    const types = new Set(['applied', 'cancelled', 'joined', 'left', 'checked-in', 'donated']);
    const events: Array<Record<string, unknown>> = [];
    for (const raw of value.guildEvents) {
      if (!object(raw)) continue;
      if (typeof raw.id !== 'string' || !/^event-\d{1,10}$/.test(raw.id) || seen.has(raw.id)) continue;
      if (typeof raw.guildId !== 'string' || !guilds.has(raw.guildId)) continue;
      if (!types.has(raw.type as string) || !date(raw.createdAt)) continue;
      seen.add(raw.id);
      next.guildEventSequence = Math.max(next.guildEventSequence as number, Number((raw.id as string).slice(6)));
      events.push({ id: raw.id, guildId: raw.guildId, type: raw.type, createdAt: raw.createdAt });
      if (events.length >= 40) break;
    }
    next.guildEvents = events;
  }
  return next;
}

/**
 * 校验并清洗存档文档。返回的对象只含已知字段，且所有值都在合法范围内。
 * 输入不是对象时返回 null（调用方翻译成 400）。
 */
export function sanitizeSaveDocument(raw: unknown, catalog: SaveDocumentCatalog): Record<string, unknown> | null {
  if (!object(raw)) return null;
  const stored = raw;

  const characters = new Set(catalog.characters);
  const stages = new Set(catalog.stages);
  const quests = new Set(catalog.quests);
  const mails = new Set(catalog.mails);
  const shopPacks = new Set(catalog.shopPacks);
  const marketOffers = new Set(catalog.marketOffers);
  const astrologyNodes = new Set(catalog.astrologyNodes);
  const guilds = new Set(catalog.guilds);
  const equipmentTemplates = new Map(catalog.equipmentTemplates.map(item => [item.id, item.slot]));
  const tradeLimits = new Map(catalog.tradeRates.map(rate => [rate.id, rate.dailyLimit]));

  const next: Record<string, unknown> = {
    profile: null, server: 17, coins: 50000, gems: 100, books: 10, leaves: 0, potions: 0, chests: 0, medals: 0,
    // v17：expEarned 为掌灶人经验余额展示位（服务端权威覆盖，见 applyAuthoritativeFields）
    expEarned: 0,
    characters: ['青团'], purchases: [], firstPurchasedAt: null, firstClaimed: [], sevenClaimed: [], extraClaimed: false,
    dailyDate: null, dailyPaid: 0, dailyClaimed: [], guideCompleted: false,
    claimedQuests: [], claimedMail: [], battleWins: 0, crafted: 0, idleClaimAt: null,
    marketDate: null, marketBought: [], astrology: [], worldtree: 1,
    bpClaimed: [], fundPurchased: false, fundClaimed: [], packsOpened: 0,
    chroniclePoints: 0, chronicleClaimed: [], tradeDate: null, tradeCounts: {},
    stars: {}, shopBought: [], formation: [], pendingBattle: null, battleHistory: [], firstClears: [],
    chronicleDate: null, dailySummons: 0, dailyLoginRewards: 0,
    battleChargeDate: null, dailyBattlesUsed: 0, battlePassesPurchased: 0,
    equipment: [], equipped: {}, starterEquipmentClaimed: false, equipmentChestsOpened: 0,
    chestOperations: [], lastChestOpening: null,
    /* v14 主线任务链：关卡胜场分布（服务端权威覆盖）与累计登录天数 */
    stageClears: {}, loginDays: 1,
    social: sanitizeSocial(undefined, guilds),
  };

  const numeric = [
    'coins', 'gems', 'books', 'leaves', 'potions', 'chests', 'medals', 'expEarned',
    'dailyPaid', 'battleWins', 'crafted', 'packsOpened', 'chroniclePoints', 'dailySummons', 'dailyLoginRewards',
  ];
  for (const key of numeric) if (number(stored[key])) next[key] = stored[key];
  for (const key of ['dailyDate', 'marketDate', 'tradeDate', 'chronicleDate', 'battleChargeDate']) if (day(stored[key])) next[key] = stored[key];

  const ownedCharacters = strings(stored.characters, characters);
  next.characters = ownedCharacters.length ? ownedCharacters : ['青团'];
  next.purchases = strings(stored.purchases, new Set(['contract', 'level', 'first', 'fund']));
  next.claimedQuests = strings(stored.claimedQuests, quests);
  next.claimedMail = strings(stored.claimedMail, mails);
  next.firstClaimed = numbers(stored.firstClaimed, [1, 2, 3]);
  next.sevenClaimed = numbers(stored.sevenClaimed, [1, 2, 3, 4, 5, 6, 7]);
  next.dailyClaimed = numbers(stored.dailyClaimed, [6, 12, 30]);
  next.bpClaimed = numbers(stored.bpClaimed, Array.from({ length: 10 }, (_, index) => index + 1));
  next.fundClaimed = strings(stored.fundClaimed, new Set(['fund-2', 'fund-3', 'fund-5']));
  next.marketBought = strings(stored.marketBought, marketOffers);
  next.chronicleClaimed = strings(stored.chronicleClaimed, new Set(['c1', 'c2', 'c4', 'c6']));
  next.shopBought = strings(stored.shopBought, shopPacks);
  next.astrology = strings(stored.astrology, astrologyNodes);
  next.firstClears = strings(stored.firstClears, stages);
  const formation = strings(stored.formation, new Set(next.characters as string[])).slice(0, 3);
  next.formation = formation.length ? formation : (next.characters as string[]).slice(0, 3);

  if (object(stored.stars)) {
    const stars: Record<string, number> = {};
    for (const name of catalog.characters) {
      const level = stored.stars[name];
      if (number(level, 5) && level >= 1) stars[name] = level;
    }
    next.stars = stars;
  }
  if (object(stored.tradeCounts)) {
    const counts: Record<string, number> = {};
    for (const [id, limit] of tradeLimits) {
      const used = stored.tradeCounts[id];
      if (number(used)) counts[id] = Math.min(used, limit);
    }
    next.tradeCounts = counts;
  }

  if (Array.isArray(stored.equipment)) {
    const seen = new Set<string>();
    const items: Array<Record<string, unknown>> = [];
    for (const raw of stored.equipment) {
      if (!object(raw)) continue;
      if (typeof raw.id !== 'string' || !/^[a-zA-Z0-9-]{1,110}$/.test(raw.id) || seen.has(raw.id)) continue;
      if (typeof raw.templateId !== 'string' || !equipmentTemplates.has(raw.templateId)) continue;
      if (!number(raw.level, MAX_ENHANCEMENT)) continue;
      if (!date(raw.acquiredAt)) continue;
      seen.add(raw.id);
      // v20 §4.3：副属性白名单放行（key ∈ 池、value 2..6）；缺省/非法一律归 null，洗练次数 0..999
      let substat: { key: string; value: number } | null = null;
      if (
        object(raw.substat)
        && typeof raw.substat.key === 'string'
        && ['critical', 'resistance', 'speed', 'health'].includes(raw.substat.key)
        && number(raw.substat.value, 6)
        && raw.substat.value >= 2
      ) {
        substat = { key: raw.substat.key, value: raw.substat.value };
      }
      items.push({
        id: raw.id, templateId: raw.templateId, level: raw.level, acquiredAt: raw.acquiredAt,
        substat, washCount: number(raw.washCount, 999) ? raw.washCount : 0,
      });
      if (items.length >= MAX_EQUIPMENT) break;
    }
    next.equipment = items;
  }
  const equipmentList = next.equipment as Array<{ id: string; templateId: string }>;
  if (object(stored.equipped)) {
    const equipped: Record<string, string> = {};
    for (const slot of EQUIPMENT_SLOTS) {
      const id = stored.equipped[slot];
      const item = equipmentList.find(candidate => candidate.id === id);
      if (item && equipmentTemplates.get(item.templateId) === slot) equipped[slot] = id as string;
    }
    next.equipped = equipped;
  }

  next.starterEquipmentClaimed = stored.starterEquipmentClaimed === true;
  if (number(stored.equipmentChestsOpened)) next.equipmentChestsOpened = stored.equipmentChestsOpened;
  if (Array.isArray(stored.chestOperations)) {
    next.chestOperations = [
      ...new Set(stored.chestOperations.filter((id): id is string => typeof id === 'string' && /^[a-zA-Z0-9-]{1,80}$/.test(id))),
    ].slice(-100);
  }
  const receipt = stored.lastChestOpening;
  if (
    object(receipt) && typeof receipt.id === 'string'
    && (next.chestOperations as string[]).includes(receipt.id)
    && date(receipt.openedAt) && (receipt.count === 1 || receipt.count === 5)
    && Array.isArray(receipt.equipmentIds)
  ) {
    const owned = new Set(equipmentList.map(item => item.id));
    next.lastChestOpening = {
      id: receipt.id,
      openedAt: receipt.openedAt,
      count: receipt.count,
      equipmentIds: strings(receipt.equipmentIds, owned).slice(0, 5),
    };
  }

  if (
    object(stored.profile) && typeof stored.profile.name === 'string'
    && /^[\p{L}\p{N}]{2,8}$/u.test(stored.profile.name)
    && (stored.profile.gender === 'male' || stored.profile.gender === 'female')
    && date(stored.profile.createdAt)
  ) {
    next.profile = { name: stored.profile.name, gender: stored.profile.gender, createdAt: stored.profile.createdAt };
  }
  if (number(stored.server, 18) && stored.server >= 1) next.server = stored.server;
  // v17：世界树（=掌灶人等级）上限 30 → 100，与 players CHECK 一致
  if (number(stored.worldtree, 100) && stored.worldtree >= 1) next.worldtree = stored.worldtree;
  if (date(stored.firstPurchasedAt)) next.firstPurchasedAt = stored.firstPurchasedAt;
  if (date(stored.idleClaimAt)) next.idleClaimAt = stored.idleClaimAt;
  // v14：stageClears 仅接受已知关卡 id，胜场计数封顶；loginDays 由服务端权威覆盖
  if (object(stored.stageClears)) {
    const clears: Record<string, number> = {};
    for (const [stageId, count] of Object.entries(stored.stageClears)) {
      if (stages.has(stageId) && number(count, 1e6)) clears[stageId] = count;
    }
    next.stageClears = clears;
  }
  if (number(stored.loginDays, 36500) && stored.loginDays >= 1) next.loginDays = stored.loginDays;
  for (const key of ['extraClaimed', 'guideCompleted', 'fundPurchased']) next[key] = stored[key] === true;

  if (Array.isArray(stored.battleHistory)) {
    const seen = new Set<string>();
    const history: Array<Record<string, unknown>> = [];
    for (const raw of stored.battleHistory) {
      const record = sanitizeBattleRecord(raw, characters, stages);
      if (!record || record.status === 'pending') continue;
      if (seen.has(record.id as string)) continue;
      seen.add(record.id as string);
      history.push(record);
      if (history.length >= MAX_BATTLE_HISTORY) break;
    }
    next.battleHistory = history;
  }
  const pending = sanitizeBattleRecord(stored.pendingBattle, characters, stages);
  if (next.profile && pending && pending.status === 'pending'
    && !(next.battleHistory as Array<{ id: string }>).some(record => record.id === pending.id)) {
    next.pendingBattle = pending;
  }

  next.social = sanitizeSocial(stored.social, guilds);
  return next;
}
