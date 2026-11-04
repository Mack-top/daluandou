import type { BattleRecord } from './battle-types';
import { assetUrl } from './assets';
import { equipmentBonuses, equipmentPower, type ChestReceipt, type EquipmentInstance, type EquipmentSlot } from './equipment';
import { createSocialSave, type SocialSave } from './social';

export type MainScreen = 'login' | 'lobby';
export type DialogName =
  | 'servers' | 'notice' | 'create' | 'guide'
  | 'contract' | 'level' | 'first' | 'daily' | 'seven'
  | 'settings' | 'ranking' | 'preview' | 'policy'
  | 'collection' | 'summon' | 'bag' | 'account' | 'purchase'
  | 'chat' | 'mail' | 'quest' | 'record' | 'friend'
  | 'hero' | 'manor' | 'guild' | 'battle'
  | 'workshop' | 'timehouse' | 'market' | 'astrology' | 'worldtree' | 'activity'
  | 'trade' | 'chronicle' | 'shop' | 'ascend' | 'events'
  | 'combat' | 'battle-result';
export type OfferName = 'contract' | 'level' | 'first' | 'daily' | 'seven';
export type FacilityId = 'workshop' | 'timehouse' | 'market' | 'astrology' | 'worldtree';
export type ItemKind = 'gem' | 'book' | 'leaf' | 'potion' | 'coin' | 'chest' | 'medal' | 'character' | 'exp';
export type Reward = { kind: ItemKind; amount: number; label: string; image?: string };
export type Profile = { name: string; gender: 'male' | 'female'; createdAt: string };
export type Preferences = { theme: 'moon' | 'jade' | 'amber'; particles: boolean; music: boolean; volume: number };
export type GameSave = {
  profile: Profile | null;
  server: number;
  coins: number;
  gems: number;
  books: number;
  leaves: number;
  potions: number;
  chests: number;
  medals: number;
  /** v17：掌灶人经验余额（服务端权威覆盖；世界树升级的消耗资源） */
  expEarned: number;
  characters: string[];
  purchases: string[];
  firstPurchasedAt: string | null;
  firstClaimed: number[];
  sevenClaimed: number[];
  extraClaimed: boolean;
  dailyDate: string;
  dailyPaid: number;
  dailyClaimed: number[];
  guideCompleted: boolean;
  claimedQuests: string[];
  claimedMail: string[];
  battleWins: number;
  /** 每日挑战次数（本地演示口径；服务端权威计数在 battle_passes 表） */
  dailyBattleDate?: string | null;
  dailyBattlesUsed?: number;
  battlePassesPurchased?: number;
  crafted: number;
  idleClaimAt: string | null;
  marketDate: string;
  marketBought: string[];
  astrology: string[];
  worldtree: number;
  bpClaimed: number[];
  fundPurchased: boolean;
  fundClaimed: string[];
  packsOpened: number;
  chroniclePoints: number;
  chronicleClaimed: string[];
  tradeDate: string;
  tradeCounts: Record<string, number>;
  stars: Record<string, number>;
  shopBought: string[];
  formation: string[];
  pendingBattle: BattleRecord | null;
  battleHistory: BattleRecord[];
  firstClears: string[];
  chronicleDate: string;
  dailySummons: number;
  dailyLoginRewards: number;
  equipment: EquipmentInstance[];
  equipped: Partial<Record<EquipmentSlot, string>>;
  starterEquipmentClaimed: boolean;
  equipmentChestsOpened: number;
  chestOperations: string[];
  lastChestOpening: ChestReceipt | null;
  social: SocialSave;
  /* v14 主线任务链：关卡胜场分布（服务端权威覆盖）与累计登录天数 */
  stageClears: Record<string, number>;
  loginDays: number;
};

export const artwork = {
  login: assetUrl('images/moonlit-sanctuary.jpg'),
  mobile: assetUrl('images/moonlit-sanctuary-mobile.jpg'),
  lobby: assetUrl('images/verdant-realm.jpg'),
  contract: assetUrl('images/golden-contract.jpg'),
  level: assetUrl('images/royal-curry.jpg'),
  first: assetUrl('images/azure-witch.jpg'),
  seven: assetUrl('images/crimson-feast.jpg'),
  battlefield: assetUrl('images/moonbridge-battle.jpg'),
  market: assetUrl('images/night-market.jpg'),
  chronicle: assetUrl('images/food-god-chronicle.jpg'),
  ascension: assetUrl('images/star-ascension.jpg'),
};

export const defaultSave: GameSave = {
  profile: null, server: 17, coins: 50000, gems: 100,
  books: 10, leaves: 0, potions: 0, chests: 0, medals: 0, expEarned: 0,
  characters: ['青团'], purchases: [], firstPurchasedAt: null, firstClaimed: [], sevenClaimed: [], extraClaimed: false,
  dailyDate: new Date().toLocaleDateString('sv-SE'), dailyPaid: 0,
  dailyClaimed: [], guideCompleted: false,
  claimedQuests: [], claimedMail: [], battleWins: 0,
  crafted: 0, idleClaimAt: null,
  marketDate: new Date().toLocaleDateString('sv-SE'), marketBought: [],
  astrology: [], worldtree: 1, bpClaimed: [], fundPurchased: false, fundClaimed: [], packsOpened: 0,
  chroniclePoints: 0, chronicleClaimed: [],
  tradeDate: new Date().toLocaleDateString('sv-SE'), tradeCounts: {},
  stars: {}, shopBought: [],
  formation: ['青团'], pendingBattle: null, battleHistory: [], firstClears: [],
  chronicleDate: new Date().toLocaleDateString('sv-SE'), dailySummons: 0, dailyLoginRewards: 0,
  equipment: [], equipped: {}, starterEquipmentClaimed: false, equipmentChestsOpened: 0, chestOperations: [], lastChestOpening: null,
  social: createSocialSave(),
  stageClears: {}, loginDays: 1,
};

export function localDateKey(date = new Date()): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

export function createDefaultSave(date = new Date()): GameSave {
  const today = localDateKey(date);
  return { ...structuredClone(defaultSave), dailyDate: today, marketDate: today, tradeDate: today, chronicleDate: today };
}

/* ------------------------------ 每日挑战次数 ------------------------------ */

export const FREE_BATTLES_PER_DAY = 4;   // 每日免费挑战次数
export const MAX_BATTLES_PER_DAY = 10;   // 每日总上限（含购买）
export const MAX_PASSES_PER_DAY = 6;     // 挑战卡每日限购
export const BATTLE_PASS_COST_GEMS = 15; // 挑战卡单价（灵晶）

export type BattleChargesView = { used: number; purchased: number; remaining: number; canBuy: boolean };

/** 本地演示口径的挑战次数视图（服务端权威计数见 /api/game/state 的 battleCharges）。 */
export function battleChargesOf(save: GameSave): BattleChargesView {
  const used = save.dailyBattlesUsed ?? 0;
  const purchased = save.battlePassesPurchased ?? 0;
  const allowed = FREE_BATTLES_PER_DAY + purchased;
  return {
    used,
    purchased,
    remaining: Math.max(0, allowed - used),
    canBuy: used >= FREE_BATTLES_PER_DAY && purchased < MAX_PASSES_PER_DAY && used < MAX_BATTLES_PER_DAY,
  };
}

export function rolloverDailyState(save: GameSave, today = localDateKey()): GameSave {
  let next = save;
  if (save.dailyDate !== today) {
    const dailyIds = new Set(quests.filter(quest => quest.group === '日常').map(quest => quest.id));
    next = { ...next, dailyDate: today, dailyPaid: 0, dailyClaimed: [], dailySummons: 0, dailyLoginRewards: 0, claimedQuests: next.claimedQuests.filter(id => !dailyIds.has(id)), loginDays: next.loginDays + 1 };
  }
  if (save.marketDate !== today) next = { ...next, marketDate: today, marketBought: [] };
  if (save.tradeDate !== today) next = { ...next, tradeDate: today, tradeCounts: {} };
  if (save.chronicleDate !== today) next = { ...next, chronicleDate: today, chroniclePoints: 0, chronicleClaimed: [] };
  if ((save.dailyBattleDate ?? null) !== today) next = { ...next, dailyBattleDate: today, dailyBattlesUsed: 0, battlePassesPurchased: 0 };
  return next;
}

export const defaultPreferences: Preferences = { theme: 'moon', particles: true, music: false, volume: 35 };

export const previewScreens: { id: string; name: string; description: string; screen: MainScreen; dialog: DialogName | null }[] = [
  { id: '01', name: '启程之门', description: '启动页 / 登录', screen: 'login', dialog: null },
  { id: '02', name: '选择服务器', description: '分区 / 服务器状态', screen: 'login', dialog: 'servers' },
  { id: '03', name: '开服公告', description: '公告 / 冒险指南', screen: 'login', dialog: 'notice' },
  { id: '04', name: '初识灵界', description: '角色命名 / 性别选择', screen: 'lobby', dialog: 'create' },
  { id: '05', name: '命运的指引', description: '主城 / 新手引导', screen: 'lobby', dialog: 'guide' },
  { id: '06', name: '契约特惠', description: '开服限定 / 契约礼包', screen: 'lobby', dialog: 'contract' },
  { id: '07', name: '等级礼包', description: '成长礼遇 / 资源礼包', screen: 'lobby', dialog: 'level' },
  { id: '08', name: '首充赠礼', description: '蓝纹奶酪 / 三日礼遇', screen: 'lobby', dialog: 'first' },
  { id: '09', name: '每日充值', description: '每日礼遇 / 档位切换', screen: 'lobby', dialog: 'daily' },
  { id: '10', name: '七日之约', description: '七日登录 / 每日奖励', screen: 'lobby', dialog: 'seven' },
];

export const contractRewards: Reward[] = [
  { kind: 'gem', amount: 360, label: '灵晶' },
  { kind: 'book', amount: 15, label: '食灵契约' },
  { kind: 'leaf', amount: 300, label: '食灵精华' },
  { kind: 'potion', amount: 600000, label: '灵味原浆' },
];
export const levelRewards: Reward[] = [
  { kind: 'gem', amount: 60, label: '灵晶' },
  { kind: 'book', amount: 10, label: '食灵契约' },
  { kind: 'leaf', amount: 500, label: '食灵精华' },
];
export const firstRewards: Reward[][] = [
  [{ kind: 'character', amount: 1, label: '蓝纹奶酪', image: artwork.first }, { kind: 'leaf', amount: 500, label: '食灵精华' }, { kind: 'potion', amount: 1000000, label: '灵味原浆' }],
  [{ kind: 'chest', amount: 1, label: '史诗装备' }, { kind: 'gem', amount: 100, label: '灵晶' }, { kind: 'potion', amount: 1000000, label: '灵味原浆' }],
  [{ kind: 'medal', amount: 1, label: '专属徽章' }, { kind: 'book', amount: 3, label: '食灵契约' }, { kind: 'coin', amount: 2000000, label: '金币' }],
];
export const dailyTiers = [6, 12, 30];
export const dailyRewards: Reward[][] = [
  [{ kind: 'book', amount: 2, label: '食灵契约' }, { kind: 'coin', amount: 200000, label: '金币' }, { kind: 'chest', amount: 1, label: '每日宝箱' }],
  [{ kind: 'book', amount: 4, label: '食灵契约' }, { kind: 'coin', amount: 500000, label: '金币' }, { kind: 'chest', amount: 2, label: '每日宝箱' }],
  [{ kind: 'book', amount: 10, label: '食灵契约' }, { kind: 'coin', amount: 1200000, label: '金币' }, { kind: 'chest', amount: 5, label: '每日宝箱' }],
];
export const sevenRewards: Reward[][] = [
  [{ kind: 'book', amount: 10, label: '食灵契约' }, { kind: 'gem', amount: 50, label: '灵晶' }],
  [{ kind: 'character', amount: 1, label: '冬阴功', image: artwork.seven }, { kind: 'gem', amount: 50, label: '灵晶' }, { kind: 'leaf', amount: 100, label: '食灵精华' }, { kind: 'potion', amount: 30000, label: '灵味原浆' }],
  [{ kind: 'chest', amount: 1, label: '史诗装备' }, { kind: 'coin', amount: 100000, label: '金币' }],
  [{ kind: 'medal', amount: 1, label: '稀有徽章' }, { kind: 'gem', amount: 100, label: '灵晶' }],
  [{ kind: 'leaf', amount: 500, label: '食灵精华' }, { kind: 'coin', amount: 150000, label: '金币' }],
  [{ kind: 'book', amount: 2, label: '食灵契约' }, { kind: 'potion', amount: 100000, label: '灵味原浆' }],
  [{ kind: 'character', amount: 1, label: '拉菲', image: artwork.contract }, { kind: 'book', amount: 5, label: '食灵契约' }],
];

export const characters = [
  { name: '青团', title: '春山的来信', image: artwork.lobby, element: '自然', rarity: 'SR', role: '治疗', detail: '温柔的灵界引路人，擅长以自然之力治愈伙伴。', position: '52% 28%' },
  { name: '蓝纹奶酪', title: '星夜的咏叹', image: artwork.first, element: '水', rarity: 'SSR', role: '法术', detail: '掌控冰蓝星辉的魔法师，以群体魔法守护重要之人。', position: '50% 24%' },
  { name: '冬阴功', title: '绯色的盛宴', image: artwork.seven, element: '火', rarity: 'SSR', role: '输出', detail: '来自炽热国度的食灵，奏响热烈而坚定的生命乐章。', position: '50% 22%' },
  { name: '拉菲', title: '金色的约定', image: artwork.contract, element: '光', rarity: 'SSR', role: '辅助', detail: '优雅从容的契约使者，愿与你一同探索世界的滋味。', position: '50% 24%' },
  { name: '咖喱', title: '流金的祝福', image: artwork.level, element: '土', rarity: 'SSR', role: '防御', detail: '被黄金守护灵眷顾的旅者，以温暖的力量支援同伴。', position: '50% 28%' },
];

/**
 * v17 §6 职业成长权重（与后端 power.ts CLASS_GROWTH_WEIGHTS 逐字一致）：
 * 成长增量（growth-1 部分）按职业相对权重分化；等级 1（growth=1）时权重不生效。
 * defense 权重暂无承载面（面板 defense 无基础值），保留字段供未来引入基础防御。
 */
export const CLASS_GROWTH_WEIGHTS: Record<string, { health: number; attack: number; defense: number; speed: number }> = {
  治疗: { health: 1.10, attack: 0.85, defense: 1.00, speed: 1.00 },
  法术: { health: 0.90, attack: 1.15, defense: 0.85, speed: 1.00 },
  输出: { health: 0.95, attack: 1.20, defense: 0.90, speed: 1.05 },
  辅助: { health: 0.95, attack: 0.90, defense: 0.95, speed: 1.15 },
  防御: { health: 1.20, attack: 0.85, defense: 1.25, speed: 0.85 },
};

const DEFAULT_GROWTH_WEIGHTS = { health: 1, attack: 1, defense: 1, speed: 1 };

/** 职业成长权重取值：未知职业回退全 1（与旧行为一致）。 */
export function growthWeightsOf(role: string | null | undefined): { health: number; attack: number; defense: number; speed: number } {
  return (role && CLASS_GROWTH_WEIGHTS[role]) || DEFAULT_GROWTH_WEIGHTS;
}

/** 成长增量按职业权重缩放：basePart × (1 + (growth-1)×weight)。growth=1 时恒等于 basePart。 */
export function growthScaled(basePart: number, growth: number, weight: number): number {
  return basePart * (1 + (growth - 1) * weight);
}

export function compactNumber(value: number): string {
  if (value >= 1000000) return `${(value / 1000000).toFixed(value % 1000000 === 0 ? 0 : 1)}M`;
  if (value >= 1000) return `${(value / 1000).toFixed(value % 1000 === 0 ? 0 : 1)}K`;
  return String(value);
}

export function elapsedDays(date: string | null | undefined): number {
  if (!date) return 1;
  const start = new Date(date);
  const now = new Date();
  if (Number.isNaN(start.getTime())) return 1;
  const startDay = Date.UTC(start.getFullYear(), start.getMonth(), start.getDate());
  const today = Date.UTC(now.getFullYear(), now.getMonth(), now.getDate());
  return Math.max(1, Math.floor((today - startDay) / 86400000) + 1);
}

export function grantRewards(save: GameSave, rewards: Reward[]): GameSave {
  const next = { ...save, characters: [...save.characters] };
  const fields = { gem: 'gems', book: 'books', leaf: 'leaves', potion: 'potions', coin: 'coins', chest: 'chests', medal: 'medals', exp: 'expEarned' } as const;
  for (const reward of rewards) {
    if (reward.kind === 'character') {
      if (!next.characters.includes(reward.label)) next.characters.push(reward.label);
    } else {
      next[fields[reward.kind]] += reward.amount;
    }
  }
  return next;
}

/* ---------- 主城功能界面数据（参考图 04-10 的完整界面元素） ---------- */

export const lobbyLeftRail = [
  { id: 'chat', label: '聊天' },
  { id: 'mail', label: '邮件' },
  { id: 'quest', label: '任务' },
  { id: 'record', label: '录像' },
  { id: 'ranking', label: '排行' },
  { id: 'friend', label: '好友' },
] as const;

export const lobbyRightRail = [
  { id: 'bag', label: '背包' },
  { id: 'workshop', label: '研制坊' },
  { id: 'timehouse', label: '时光屋' },
  { id: 'market', label: '集市' },
  { id: 'astrology', label: '占星' },
  { id: 'worldtree', label: '世界树' },
] as const;

export const lobbyBottomNav = [
  { id: 'lobby', label: '大厅' },
  { id: 'collection', label: '食灵' },
  { id: 'hero', label: '主角' },
  { id: 'manor', label: '庄园' },
  { id: 'guild', label: '协会' },
  { id: 'battle', label: '副本' },
] as const;

export const featureScreens: { id: string; name: string; description: string; screen: MainScreen; dialog: DialogName }[] = [
  { id: '11', name: '灵界信使', description: '聊天 / 频道发言', screen: 'lobby', dialog: 'chat' },
  { id: '12', name: '旅者信箱', description: '邮件 / 附件领取', screen: 'lobby', dialog: 'mail' },
  { id: '13', name: '旅途委托', description: '任务 / 进度与奖励', screen: 'lobby', dialog: 'quest' },
  { id: '14', name: '战斗回放', description: '录像 / 战报列表', screen: 'lobby', dialog: 'record' },
  { id: '15', name: '同行伙伴', description: '好友 / 在线状态', screen: 'lobby', dialog: 'friend' },
  { id: '16', name: '主角养成', description: '属性 / 装备栏', screen: 'lobby', dialog: 'hero' },
  { id: '17', name: '灵界庄园', description: '建筑 / 升级消耗', screen: 'lobby', dialog: 'manor' },
  { id: '18', name: '食灵协会', description: '协会 / 成员一览', screen: 'lobby', dialog: 'guild' },
  { id: '19', name: '灵界远征', description: '关卡 / 出战阵容', screen: 'lobby', dialog: 'battle' },
  { id: '20', name: '研制坊', description: '炼制 / 灵味原浆', screen: 'lobby', dialog: 'workshop' },
  { id: '21', name: '时光屋', description: '挂机 / 累积收益', screen: 'lobby', dialog: 'timehouse' },
  { id: '22', name: '集市', description: '每日刷新 / 兑换', screen: 'lobby', dialog: 'market' },
  { id: '23', name: '占星', description: '星图 / 属性加成', screen: 'lobby', dialog: 'astrology' },
  { id: '24', name: '世界树', description: '产出效率 / 升级', screen: 'lobby', dialog: 'worldtree' },
  { id: '25', name: '活动中心', description: '战令 / 基金 / 卡包', screen: 'lobby', dialog: 'activity' },
  { id: '26', name: '交易坊', description: '资源兑换 / 每日限额', screen: 'lobby', dialog: 'trade' },
  { id: '27', name: '街巷食神记', description: '限时活动 / 里程碑', screen: 'lobby', dialog: 'chronicle' },
  { id: '28', name: '灵晶商城', description: '演示充值 / 灵晶礼包', screen: 'lobby', dialog: 'shop' },
  { id: '29', name: '升星豪礼', description: '食灵升星 / 阶段奖励', screen: 'lobby', dialog: 'ascend' },
  { id: '30', name: '开服活动', description: '活动总览 / 限时倒计时', screen: 'lobby', dialog: 'events' },
];

export type Quest = {
  id: string;
  group: '日常' | '成长' | '主线';
  name: string;
  detail: string;
  rewards: Reward[];
  progress: (save: GameSave) => [number, number];
};

export const quests: Quest[] = [
  { id: 'summon', group: '日常', name: '食灵召唤', detail: '今日召唤 1 次食灵', rewards: [{ kind: 'coin', amount: 50000, label: '金币' }], progress: save => [Math.min(1, save.dailySummons), 1] },
  { id: 'daily-gift', group: '日常', name: '领取每日礼遇', detail: '在每日充值中领取任意档位奖励', rewards: [{ kind: 'gem', amount: 20, label: '灵晶' }], progress: save => [Math.min(1, save.dailyClaimed.length), 1] },
  { id: 'seven-day', group: '日常', name: '七日之约', detail: '今日领取 1 次登录赠礼', rewards: [{ kind: 'leaf', amount: 50, label: '食灵精华' }], progress: save => [Math.min(1, save.dailyLoginRewards), 1] },
  /* v18 §3.3②：每日任务 leaf 档 ×2（与后端 seed 同步；daily-battle 前端以今日出战数近似，领取以服务端胜场进度为准） */
  { id: 'daily-battle', group: '日常', name: '灶火不熄', detail: '今日取得 2 场战斗胜利', rewards: [{ kind: 'leaf', amount: 60, label: '食灵精华' }], progress: save => [Math.min(2, save.dailyBattlesUsed ?? 0), 2] },
  { id: 'daily-market', group: '日常', name: '赶集的清晨', detail: '今日在集市兑换 1 次', rewards: [{ kind: 'leaf', amount: 80, label: '食灵精华' }], progress: save => [save.marketBought.length >= 1 ? 1 : 0, 1] },
  { id: 'first-charge', group: '成长', name: '首充赠礼', detail: '解锁首充值礼遇，结识蓝纹奶酪', rewards: [{ kind: 'book', amount: 2, label: '食灵契约' }], progress: save => [save.firstPurchasedAt ? 1 : 0, 1] },
  { id: 'collection', group: '成长', name: '结识 3 位食灵', detail: '通过召唤或活动收集食灵', rewards: [{ kind: 'exp', amount: 400, label: '掌灶人经验' }], progress: save => [Math.min(3, save.characters.length), 3] },
  { id: 'manor', group: '成长', name: '滋养世界树', detail: '将世界树升至 2 级', rewards: [{ kind: 'coin', amount: 80000, label: '金币' }], progress: save => [save.worldtree >= 2 ? 1 : 0, 1] },
  { id: 'battle', group: '主线', name: '挑战主线 2-4', detail: '在灵界远征中取得 1 场胜利', rewards: [{ kind: 'chest', amount: 1, label: '冒险宝箱' }], progress: save => [Math.min(1, save.battleWins), 1] },
  { id: 'covenant', group: '主线', name: '缔结金色契约', detail: '查看并领取契约特惠', rewards: [{ kind: 'gem', amount: 60, label: '灵晶' }], progress: save => [save.purchases.includes('contract') ? 1 : 0, 1] },

  /* ------- v14 主线任务链 P0（1–30 级，26 个，与后端 seed QUESTS 一一对应） ------- */
  { id: 'MQ-1-01', group: '主线', name: '点火的人', detail: '完成角色创建，在味契上按下指印', rewards: [{ kind: 'coin', amount: 5000, label: '金币' }], progress: () => [1, 1] },
  { id: 'MQ-1-02', group: '主线', name: '夜市初行', detail: '初访千灯夜市（登录游戏）', rewards: [{ kind: 'coin', amount: 5000, label: '金币' }], progress: save => [Math.min(1, save.loginDays), 1] },
  { id: 'MQ-1-03', group: '主线', name: '听见声音', detail: '拥有 1 位食灵伙伴（青团已与你同行）', rewards: [{ kind: 'leaf', amount: 20, label: '食灵精华' }], progress: save => [Math.min(1, save.characters.length), 1] },
  { id: 'MQ-1-04', group: '主线', name: '初春试炼', detail: '通关 1-1 初春试炼', rewards: [{ kind: 'coin', amount: 10000, label: '金币' }, { kind: 'leaf', amount: 30, label: '食灵精华' }], progress: save => [Math.min(1, stageClears(save, '1-1')), 1] },
  { id: 'MQ-1-05', group: '主线', name: '味契缔约', detail: '完成首次食灵召唤', rewards: [{ kind: 'leaf', amount: 30, label: '食灵精华' }], progress: save => [Math.min(1, save.packsOpened), 1] },
  { id: 'MQ-1-06', group: '主线', name: '三足鼎立', detail: '编排 3 人出战阵容', rewards: [{ kind: 'coin', amount: 8000, label: '金币' }], progress: save => [Math.min(3, save.formation.length), 3] },
  { id: 'MQ-1-07', group: '主线', name: '开刃', detail: '获得 1 件装备并穿戴', rewards: [{ kind: 'coin', amount: 8000, label: '金币' }], progress: save => [Object.keys(save.equipped).length >= 1 ? 1 : 0, 1] },
  { id: 'MQ-1-08', group: '主线', name: '灶婆婆的灶', detail: '在研制坊炼制 1 次灵味原浆', rewards: [{ kind: 'exp', amount: 600, label: '掌灶人经验' }], progress: save => [Math.min(1, save.crafted), 1] },
  { id: 'MQ-1-09', group: '主线', name: '第一封信', detail: '在邮件系统领取 1 封邮件附件', rewards: [{ kind: 'gem', amount: 10, label: '灵晶' }], progress: save => [Math.min(1, save.claimedMail.length), 1] },
  { id: 'MQ-1-10', group: '主线', name: '树初长成', detail: '将世界树升至 2 级', rewards: [{ kind: 'coin', amount: 8000, label: '金币' }], progress: save => [save.worldtree >= 2 ? 1 : 0, 1] },
  { id: 'MQ-1-11', group: '主线', name: '茶田疑云', detail: '通关 2-3 茶庭小径', rewards: [{ kind: 'coin', amount: 60000, label: '金币' }, { kind: 'leaf', amount: 60, label: '食灵精华' }], progress: save => [Math.min(1, stageClears(save, '2-3')), 1] },
  { id: 'MQ-1-12', group: '主线', name: '说书人的价码', detail: '结识 1 位好友（好友系统）', rewards: [{ kind: 'leaf', amount: 50, label: '食灵精华' }], progress: save => [Math.min(1, Math.max(0, save.social.friends.length - 1)), 1] },
  { id: 'MQ-1-13', group: '主线', name: '集市的秤', detail: '在集市完成 1 次兑换（今日）', rewards: [{ kind: 'coin', amount: 20000, label: '金币' }], progress: save => [Math.min(1, save.marketBought.length), 1] },
  { id: 'MQ-1-14', group: '主线', name: '占星的灯', detail: '在占星台解锁 1 个星位', rewards: [{ kind: 'gem', amount: 15, label: '灵晶' }], progress: save => [Math.min(1, save.astrology.length), 1] },
  { id: 'MQ-1-15', group: '主线', name: '递出去的伞', detail: '累计取得 5 场战斗胜利', rewards: [{ kind: 'coin', amount: 50000, label: '金币' }], progress: save => [Math.min(5, save.battleWins), 5] },
  { id: 'MQ-1-16', group: '主线', name: '灶婆婆的储备', detail: '开启 1 次装备宝箱', rewards: [{ kind: 'exp', amount: 1300, label: '掌灶人经验' }], progress: save => [Math.min(1, save.equipmentChestsOpened), 1] },
  { id: 'MQ-1-17', group: '主线', name: '贪味饕童', detail: '通关茶庭小径 3 次，逼出抱食盒的身影', rewards: [{ kind: 'gem', amount: 30, label: '灵晶' }, { kind: 'chest', amount: 1, label: '冒险宝箱' }], progress: save => [Math.min(3, stageClears(save, '2-3')), 3] },
  { id: 'MQ-1-18', group: '主线', name: '茶寮小帮工', detail: '净化囡囡后回访茶庭：通关茶庭小径 5 次', rewards: [{ kind: 'leaf', amount: 80, label: '食灵精华' }], progress: save => [Math.min(5, stageClears(save, '2-3')), 5] },
  { id: 'MQ-2-01', group: '主线', name: '九桥夜雨', detail: '通关 2-4 石桥夜雨', rewards: [{ kind: 'coin', amount: 80000, label: '金币' }, { kind: 'gem', amount: 15, label: '灵晶' }], progress: save => [Math.min(1, stageClears(save, '2-4')), 1] },
  { id: 'MQ-2-02', group: '主线', name: '咸境·淡境', detail: '累计取得 8 场战斗胜利，练习看环境配队', rewards: [{ kind: 'leaf', amount: 80, label: '食灵精华' }], progress: save => [Math.min(8, save.battleWins), 8] },
  { id: 'MQ-2-03', group: '主线', name: '时光的褶皱', detail: '在时光屋领取 1 次挂机收益', rewards: [{ kind: 'coin', amount: 30000, label: '金币' }], progress: save => [save.idleClaimAt ? 1 : 0, 1] },
  { id: 'MQ-2-04', group: '主线', name: '交易坊的规矩', detail: '在交易坊完成 1 次资源兑换（今日）', rewards: [{ kind: 'coin', amount: 30000, label: '金币' }], progress: save => [Math.min(1, Object.values(save.tradeCounts).reduce((sum, used) => sum + used, 0)), 1] },
  { id: 'MQ-2-05', group: '主线', name: '世界树的年轮', detail: '将世界树升至 5 级', rewards: [{ kind: 'gem', amount: 20, label: '灵晶' }], progress: save => [save.worldtree >= 5 ? 1 : 0, 1] },
  { id: 'MQ-2-06', group: '主线', name: '一碗端', detail: '将 3 名食灵升至 3 星', rewards: [{ kind: 'leaf', amount: 120, label: '食灵精华' }], progress: save => [Math.min(3, Object.values(save.stars).filter(level => level >= 3).length), 3] },
  { id: 'MQ-2-07', group: '主线', name: '双勺判官', detail: '通关石桥夜雨 3 次，让判官尝出对方的甜', rewards: [{ kind: 'gem', amount: 40, label: '灵晶' }, { kind: 'chest', amount: 2, label: '冒险宝箱' }], progress: save => [Math.min(3, stageClears(save, '2-4')), 3] },
  { id: 'MQ-2-08', group: '主线', name: '忘技之人', detail: '累计取得 20 场战斗胜利', rewards: [{ kind: 'exp', amount: 2500, label: '掌灶人经验' }], progress: save => [Math.min(20, save.battleWins), 20] },
];

/** 关卡胜场进度：云端同步后用服务端权威 stageClears；本地演示用战报回退近似。 */
function stageClears(save: GameSave, stageId: string): number {
  const authoritative = save.stageClears?.[stageId];
  if (typeof authoritative === 'number') return authoritative;
  const historyWins = save.battleHistory.filter(record => record.stageId === stageId && record.win).length;
  return Math.max(historyWins, save.firstClears.includes(stageId) ? 1 : 0);
}

export type MailItem = {
  id: string;
  sender: string;
  title: string;
  excerpt: string;
  time: string;
  rewards: Reward[];
};

export const mailList: MailItem[] = [
  { id: 'open', sender: '灵界事务所', title: '开服贺礼', excerpt: '感谢你来到灵界大陆，这份贺礼请收下。', time: '今日', rewards: [{ kind: 'book', amount: 2, label: '食灵契约' }, { kind: 'coin', amount: 100000, label: '金币' }] },
  { id: 'guide', sender: '青团', title: '引路人的叮嘱', excerpt: '记得每天来看看七日之约，成长资源不会缺席。', time: '今日', rewards: [{ kind: 'leaf', amount: 100, label: '食灵精华' }] },
  { id: 'maintain', sender: '运营团队', title: '维护补偿说明', excerpt: '本次维护补偿将随邮件发放，请在有效期内领取。', time: '昨日', rewards: [{ kind: 'gem', amount: 50, label: '灵晶' }] },
  { id: 'ranking', sender: '灵界竞技场', title: '排行结算奖励', excerpt: '上赛季结算已完成，奖励以邮件形式补发。', time: '3 天前', rewards: [{ kind: 'medal', amount: 1, label: '稀有徽章' }] },
];

export const heroProfile = {
  title: '命运之子',
  level: 1,
  power: 67136,
  attributes: [
    { label: '生命', value: '12,480' },
    { label: '攻击', value: '1,860' },
    { label: '防御', value: '940' },
    { label: '速度', value: '112' },
    { label: '暴击', value: '15%' },
    { label: '抗暴', value: '8%' },
  ],
  slots: ['武器', '头饰', '衣甲', '饰品', '秘宝', '徽记'],
  talents: [
    { name: '百味归一', detail: '提升全体食灵 3% 攻击。' },
    { name: '灵厨心得', detail: '提升队伍 2% 生命上限。' },
  ],
};

export type BattleStage = { id: string; chapter: string; name: string; suggest: number; dungeonId?: string | null; rewards: Reward[] };

/** v21：副本定义（随 catalog 下发；解锁条件 = 玩家等级 + 开服天数） */
export type DungeonDef = {
  id: string;
  name: string;
  english: string;
  description: string;
  order: number;
  unlockLevel: number;
  unlockOpenDay: number;
};

/** v21：功能与活动开关（主界面入口显隐与活动窗口的唯一数据源） */
export type FeatureToggle = {
  key: string;
  name: string;
  category: 'feature' | 'activity' | 'system';
  enabled: boolean;
  openDay: number | null;
  closeDay: number | null;
  detail: string;
};

/**
 * v17 seed v2：21 关（与后端 seed STAGES 逐字一致，锚点 = 可达战力 × 0.6~0.75，全程单调）。
 * v21 起该表优先由服务端 catalog 下发（applyCatalog 原位替换内容，保持模块引用稳定，
 * battle-engine / save-store 的既有导入零改动）；本地数组仅作离线兜底，与服务端种子同源。
 */
export const battleStages: BattleStage[] = [
  { id: '1-1', chapter: '第一章', name: '初春试炼', suggest: 7000, rewards: [{ kind: 'coin', amount: 10000, label: '金币' }, { kind: 'leaf', amount: 30, label: '食灵精华' }] },
  { id: '1-2', chapter: '第一章', name: '月桥晨集', suggest: 16000, rewards: [{ kind: 'coin', amount: 20000, label: '金币' }, { kind: 'leaf', amount: 40, label: '食灵精华' }] },
  { id: '2-1', chapter: '第二章', name: '茶田小筑', suggest: 28000, rewards: [{ kind: 'coin', amount: 35000, label: '金币' }, { kind: 'leaf', amount: 50, label: '食灵精华' }] },
  { id: '2-2', chapter: '第二章', name: '桂香巷', suggest: 34000, rewards: [{ kind: 'coin', amount: 45000, label: '金币' }, { kind: 'gem', amount: 10, label: '灵晶' }] },
  { id: '2-3', chapter: '第二章', name: '茶庭小径', suggest: 40000, rewards: [{ kind: 'coin', amount: 60000, label: '金币' }, { kind: 'leaf', amount: 60, label: '食灵精华' }] },
  { id: '2-4', chapter: '第二章', name: '石桥夜雨', suggest: 55000, rewards: [{ kind: 'coin', amount: 80000, label: '金币' }, { kind: 'gem', amount: 15, label: '灵晶' }] },
  { id: '3-1', chapter: '第三章', name: '月下酒窖', suggest: 68000, rewards: [{ kind: 'coin', amount: 120000, label: '金币' }, { kind: 'potion', amount: 60000, label: '灵味原浆' }] },
  { id: '3-2', chapter: '第三章', name: '钟塔回廊', suggest: 95000, rewards: [{ kind: 'book', amount: 1, label: '食灵契约' }, { kind: 'coin', amount: 150000, label: '金币' }] },
  { id: '3-3', chapter: '第三章', name: '星辉酒窖', suggest: 108000, rewards: [{ kind: 'coin', amount: 170000, label: '金币' }, { kind: 'leaf', amount: 80, label: '食灵精华' }] },
  { id: '3-4', chapter: '第三章', name: '醉月天台', suggest: 120000, rewards: [{ kind: 'coin', amount: 200000, label: '金币' }, { kind: 'gem', amount: 20, label: '灵晶' }] },
  { id: '4-1', chapter: '第四章', name: '雾隐后厨 · 冷房', suggest: 130000, rewards: [{ kind: 'coin', amount: 220000, label: '金币' }, { kind: 'leaf', amount: 90, label: '食灵精华' }] },
  { id: '4-2', chapter: '第四章', name: '雾隐后厨 · 灶山火径', suggest: 145000, rewards: [{ kind: 'coin', amount: 260000, label: '金币' }, { kind: 'potion', amount: 90000, label: '灵味原浆' }] },
  { id: '4-3', chapter: '第四章', name: '试味之厅', suggest: 160000, rewards: [{ kind: 'gem', amount: 25, label: '灵晶' }, { kind: 'coin', amount: 280000, label: '金币' }] },
  { id: '4-4', chapter: '第四章', name: '雾隐后厨 · 蒸笼巷', suggest: 175000, rewards: [{ kind: 'coin', amount: 320000, label: '金币' }, { kind: 'leaf', amount: 100, label: '食灵精华' }] },
  { id: '4-5', chapter: '第四章', name: '雾隐后厨 · 灶王殿', suggest: 190000, rewards: [{ kind: 'coin', amount: 360000, label: '金币' }, { kind: 'gem', amount: 30, label: '灵晶' }] },
  { id: '5-1', chapter: '终章', name: '忘川宴席', suggest: 205000, rewards: [{ kind: 'book', amount: 2, label: '食灵契约' }, { kind: 'coin', amount: 360000, label: '金币' }] },
  { id: '5-2', chapter: '终章', name: '忘川渡口', suggest: 235000, rewards: [{ kind: 'coin', amount: 420000, label: '金币' }, { kind: 'leaf', amount: 120, label: '食灵精华' }] },
  { id: '5-3', chapter: '终章', name: '月城之巅', suggest: 265000, rewards: [{ kind: 'gem', amount: 40, label: '灵晶' }, { kind: 'coin', amount: 480000, label: '金币' }] },
  { id: '6-1', chapter: '无尽回廊', name: '无尽回廊 · 一巡', suggest: 350000, rewards: [{ kind: 'coin', amount: 600000, label: '金币' }, { kind: 'book', amount: 1, label: '食灵契约' }] },
  { id: '6-2', chapter: '无尽回廊', name: '无尽回廊 · 二巡', suggest: 371000, rewards: [{ kind: 'coin', amount: 700000, label: '金币' }, { kind: 'gem', amount: 60, label: '灵晶' }] },
  { id: '6-3', chapter: '无尽回廊', name: '无尽回廊 · 三巡', suggest: 393000, rewards: [{ kind: 'book', amount: 3, label: '食灵契约' }, { kind: 'coin', amount: 900000, label: '金币' }, { kind: 'medal', amount: 1, label: '稀有徽章' }] },
];

/** 章节 → 副本映射（与后端 seed DUNGEON_BY_CHAPTER 同源；离线兜底数据的副本归属推断用） */
const DUNGEON_BY_CHAPTER: Record<string, string> = {
  '第一章': 'dungeon-ch1',
  '第二章': 'dungeon-ch2',
  '第三章': 'dungeon-ch3',
  '第四章': 'dungeon-ch4',
  '终章': 'dungeon-final',
  '无尽回廊': 'dungeon-endless',
};

/** 已随 catalog 下发过（battleStages 已被服务端数据原位替换） */
let catalogApplied = false;
const catalogListeners = new Set<() => void>();

/** 订阅 catalog 应用完成事件（模块级数据变更不会触发 React 重渲，组件需自行订阅）。 */
export function onCatalogChanged(listener: () => void): () => void {
  catalogListeners.add(listener);
  return () => catalogListeners.delete(listener);
}

export function isCatalogApplied(): boolean {
  return catalogApplied;
}

/** v21：副本列表 catalog 状态（未下发时为空，副本面板回退本地章节映射） */
export let catalogDungeons: DungeonDef[] = [];
export let catalogFeatures: FeatureToggle[] = [];
export let catalogServerOpenDate: string | null = null;
export let catalogServerOpenDay = 1;

export type CatalogPayload = {
  stages?: Array<{ id: string; chapter: string; name: string; suggestedPower: number; dungeonId?: string | null; rewards: Reward[] }>;
  dungeons?: DungeonDef[];
  features?: FeatureToggle[];
  /** 服务端装备模板（v33 数据持久化：下发后原位替换本地 equipmentCatalogue） */
  equipment?: Array<{ id: string; name: string; slot: string; rarity: string; story: string; stats: Record<string, number>; requiredLevel: number }>;
  serverOpenDate?: string | null;
  serverOpenDay?: number;
};

/**
 * 应用服务端 catalog（v21 数据持久化通道）：
 *   - battleStages 原位替换（splice 保持数组引用，battle-engine/save-store 零感知）；
 *   - 副本/功能开关/开服时间写入模块状态，并通知订阅者。
 */
export function applyCatalog(payload: CatalogPayload): void {
  if (Array.isArray(payload.stages) && payload.stages.length) {
    const next = payload.stages.map(stage => ({
      id: stage.id,
      chapter: stage.chapter,
      name: stage.name,
      suggest: stage.suggestedPower,
      dungeonId: stage.dungeonId ?? DUNGEON_BY_CHAPTER[stage.chapter] ?? null,
      rewards: stage.rewards,
    }));
    battleStages.splice(0, battleStages.length, ...next);
  }
  catalogDungeons = Array.isArray(payload.dungeons) ? payload.dungeons : [];
  catalogFeatures = Array.isArray(payload.features) ? payload.features : [];
  catalogServerOpenDate = payload.serverOpenDate ?? null;
  catalogServerOpenDay = typeof payload.serverOpenDay === 'number' && payload.serverOpenDay >= 1 ? payload.serverOpenDay : 1;
  catalogApplied = true;
  catalogListeners.forEach(listener => listener());
}

/** 关卡所属副本 id（优先服务端下发值，离线兜底按章节映射推断）。 */
export function dungeonIdOf(stage: BattleStage): string | null {
  return stage.dungeonId ?? DUNGEON_BY_CHAPTER[stage.chapter] ?? null;
}

/** 未乘成长系数的基础战力（基础 × 星级 × 星象）；power 口径在此基础上乘 growth。 */
function baseCharacterFactor(save: GameSave, name: string): number {
  const character = characters.find(item => item.name === name);
  if (!character || !save.characters.includes(name)) return 0;
  const base = character.rarity === 'SSR' ? 12000 : 9000;
  return base * (1 + (starLevel(save, name) - 1) * 0.28) * (1 + save.astrology.length * 0.02);
}

export function baseCharacterPower(save: GameSave, name: string): number {
  const factor = baseCharacterFactor(save, name);
  if (!factor) return 0;
  // v17 §2.3：掌灶人等级成长系数（1.0→2.6）乘入基础战力，等级重新成为战力主轴；与后端 buildSquad 同式
  return Math.round(factor * growthMultiplier(save.worldtree));
}

export function characterPower(save: GameSave, name: string): number {
  const base = baseCharacterPower(save, name);
  return base ? base + equipmentPower(save) : 0;
}

export function characterBattleStats(save: GameSave, name: string, index = 0) {
  // v17 §6 职业成长权重：成长增量（growth-1）按职业分化，从「未乘 growth 的基础值」派生，与后端 buildSquad 同式
  const baseFactor = baseCharacterFactor(save, name);
  const gear = equipmentBonuses(save);
  const role = characters.find(item => item.name === name)?.role;
  const weights = growthWeightsOf(role);
  const growth = growthMultiplier(save.worldtree);
  return {
    health: Math.round(growthScaled(baseFactor / 4, growth, weights.health)) + gear.health,
    attack: Math.round(growthScaled(baseFactor / 24, growth, weights.attack)) + gear.attack,
    speed: Math.round(growthScaled(116 - index * 3, growth, weights.speed)) + gear.speed,
    defense: gear.defense,
    critical: Math.min(60, 18 + gear.critical),
    resistance: Math.min(50, gear.resistance),
  };
}

export function validFormation(save: GameSave, names = save.formation): string[] {
  return Array.from(new Set(names)).filter(name => characters.some(item => item.name === name) && save.characters.includes(name)).slice(0, 3);
}

export function squadPower(save: GameSave, formation = save.formation): number {
  return validFormation(save, formation).reduce((sum, name) => sum + characterPower(save, name), 0);
}

/* ---------- 交易坊与限时活动 ---------- */

export const tradeRates: { id: string; give: Reward; get: Reward; dailyLimit: number }[] = [
  { id: 't1', give: { kind: 'coin', amount: 150000, label: '金币' }, get: { kind: 'book', amount: 1, label: '食灵契约' }, dailyLimit: 3 },
  { id: 't2', give: { kind: 'leaf', amount: 200, label: '食灵精华' }, get: { kind: 'gem', amount: 30, label: '灵晶' }, dailyLimit: 2 },
  { id: 't3', give: { kind: 'gem', amount: 100, label: '灵晶' }, get: { kind: 'potion', amount: 300000, label: '灵味原浆' }, dailyLimit: 5 },
  { id: 't4', give: { kind: 'coin', amount: 90000, label: '金币' }, get: { kind: 'leaf', amount: 120, label: '食灵精华' }, dailyLimit: 4 },
];

export function tradeUsed(save: GameSave, id: string): number {
  return save.tradeCounts[id] ?? 0;
}

export const chronicleName = '街巷食神记';
export const chronicleEnglish = 'STREET FOOD CHRONICLE';

export const chronicleMilestones: { id: string; need: number; label: string; rewards: Reward[] }[] = [
  { id: 'c1', need: 1, label: '击败 1 名街头食客', rewards: [{ kind: 'coin', amount: 80000, label: '金币' }, { kind: 'leaf', amount: 80, label: '食灵精华' }] },
  { id: 'c2', need: 2, label: '击败 2 名街头食客', rewards: [{ kind: 'book', amount: 1, label: '食灵契约' }] },
  { id: 'c4', need: 4, label: '击败 4 名街头食客', rewards: [{ kind: 'chest', amount: 1, label: '冒险宝箱' }, { kind: 'gem', amount: 40, label: '灵晶' }] },
  { id: 'c6', need: 6, label: '击败 6 名街头食客', rewards: [{ kind: 'medal', amount: 1, label: '稀有徽章' }, { kind: 'book', amount: 2, label: '食灵契约' }] },
];

/** 计算距离下一个本地午夜的剩余时间文案。 */
export function countdownToMidnight(now = new Date()): string {
  const end = new Date(now);
  end.setHours(24, 0, 0, 0);
  const total = Math.max(0, Math.floor((end.getTime() - now.getTime()) / 1000));
  const pad = (value: number) => String(value).padStart(2, '0');
  return `${pad(Math.floor(total / 3600))}:${pad(Math.floor((total % 3600) / 60))}:${pad(total % 60)}`;
}

export type BadgeKey =
  | 'mail' | 'quest' | 'seven' | 'first' | 'daily' | 'activity' | 'bag' | 'friend'
  | 'summon' | 'timehouse' | 'worldtree' | 'market' | 'workshop' | 'trade' | 'chronicle';

/** 由本地存档推算各入口的红点数量，用于还原参考图中的角标提醒。 */
export function badges(save: GameSave): Partial<Record<BadgeKey, number>> {
  const claimableQuests = quests.filter(quest => {
    const [current, target] = quest.progress(save);
    return current >= target && !save.claimedQuests.includes(quest.id);
  }).length;
  const unclaimedMail = mailList.filter(item => !save.claimedMail.includes(item.id)).length;
  const loginDays = save.profile ? Math.min(7, elapsedDays(save.profile.createdAt)) : 0;
  const claimableSeven = save.profile && loginDays > save.sevenClaimed.length ? 1 : 0;
  const claimableDaily = save.dailyClaimed.length < dailyTiers.filter(tier => save.dailyPaid >= tier).length ? 1 : 0;
  const claimableBp = battlePassRewards.some((_, index) => battlePassLevel(save) >= index + 1 && !save.bpClaimed.includes(index + 1)) ? 1 : 0;
  const claimableFund = save.fundPurchased ? fundMilestones.some(m => save.characters.length >= m.need && !save.fundClaimed.includes(m.id)) ? 1 : 0 : 0;
  const idle = idleAccrual(save);
  const stock = marketStockFor(save.marketDate);
  const affordableMarket = stock.filter(entry => {
    const price = Math.round(entry.price * (save.worldtree >= 3 ? 0.9 : 1));
    return !save.marketBought.includes(entry.id) && save.coins >= price;
  }).length;
  const craft = craftCost(1);
  const affordableCraft = save.coins >= craft.coins && save.leaves >= craft.leaves ? 1 : 0;
  const affordableTrade = tradeRates.filter(rate =>
    tradeUsed(save, rate.id) < rate.dailyLimit &&
    (rate.give.kind === 'coin' ? save.coins : rate.give.kind === 'leaf' ? save.leaves : save.gems) >= rate.give.amount,
  ).length;
  const chronicleReady = chronicleMilestones.some(m =>
    save.chroniclePoints >= m.need && !save.chronicleClaimed.includes(m.id),
  ) ? 1 : 0;
  // v17：世界树升级需 exp_required(L) + coins×0.2 + leaves 全额（与后端 upgradeWorldtree 同口径）
  const treeCost = worldtreeCost(save.worldtree);
  const treeExp = expRequiredAt(save.worldtree);

  return {
    friend: save.profile ? save.social.incomingRequests.length : 0,
    bag: save.profile ? save.chests : 0,
    mail: unclaimedMail,
    quest: claimableQuests,
    seven: claimableSeven,
    first: save.firstPurchasedAt && save.firstClaimed.length < Math.min(3, elapsedDays(save.firstPurchasedAt)) ? 1 : 0,
    daily: claimableDaily,
    activity: claimableBp + claimableFund,
    summon: save.books >= 10 ? 1 : 0,
    timehouse: idle.coins > 0 ? 1 : 0,
    worldtree: save.worldtree < WORLD_TREE_MAX && treeExp > 0 && save.expEarned >= treeExp && save.coins >= Math.round(treeCost.coins * 0.2) && save.leaves >= treeCost.leaves ? 1 : 0,
    market: affordableMarket,
    workshop: affordableCraft,
    trade: affordableTrade,
    chronicle: chronicleReady,
  };
}

/** 以本地时钟计算距离指定小时数的剩余时间文案。 */
export function countdownFromHours(hours: number, now = new Date()): string {
  const end = new Date(now);
  end.setHours(0, 0, 0, 0);
  end.setTime(end.getTime() + hours * 3600000);
  const diff = Math.max(0, end.getTime() - now.getTime());
  const total = Math.floor(diff / 1000);
  const days = Math.floor(total / 86400);
  const hoursLeft = Math.floor((total % 86400) / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const seconds = total % 60;
  const pad = (value: number) => String(value).padStart(2, '0');
  return days > 0 ? `${pad(days)}天${pad(hoursLeft)}时${pad(minutes)}分` : `${pad(hoursLeft)}:${pad(minutes)}:${pad(seconds)}`;
}

export function countdownToWeekEnd(now = new Date()): string {
  const end = new Date(now);
  const daysUntilMonday = ((8 - now.getDay()) % 7) || 7;
  end.setDate(end.getDate() + daysUntilMonday);
  end.setHours(0, 0, 0, 0);
  const total = Math.max(0, Math.floor((end.getTime() - now.getTime()) / 1000));
  const days = Math.floor(total / 86400);
  const hours = Math.floor((total % 86400) / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const seconds = total % 60;
  const pad = (value: number) => String(value).padStart(2, '0');
  return days > 0 ? `${pad(days)}天${pad(hours)}时${pad(minutes)}分` : `${pad(hours)}:${pad(minutes)}:${pad(seconds)}`;
}

/* ---------- 庄园设施与活动中心（参考图主城右侧入口的完整功能） ---------- */

export const facilities: { id: FacilityId; name: string; english: string; detail: string }[] = [
  { id: 'workshop', name: '研制坊', english: 'WORKSHOP', detail: '以金币与食灵精华炼制灵味原浆，缩短食灵养成时间。' },
  { id: 'timehouse', name: '时光屋', english: 'TIMEHOUSE', detail: '离线时持续累积金币与灵味原浆，回来后一次性领取。' },
  { id: 'market', name: '集市', english: 'MARKET', detail: '每日刷新三件商品，使用金币兑换养成资源。' },
  { id: 'astrology', name: '占星', english: 'ASTROLOGY', detail: '消耗灵晶点亮星图，为全队提供永久属性加成。' },
  { id: 'worldtree', name: '世界树', english: 'WORLD TREE', detail: '世界树等级即掌灶人等级：消耗掌灶人经验升级，提升全队成长与庄园产出。' },
];

export function worldtreeBonus(save: GameSave): number {
  return 1 + (save.worldtree - 1) * 0.05 + save.astrology.length * 0.02;
}

export function craftCost(times: number): { coins: number; leaves: number } {
  return { coins: 22000 * times, leaves: 24 * times };
}

export function idleAccrual(save: GameSave, now = Date.now()): { capHours: number; hours: number; coins: number; potions: number; exp: number } {
  const capHours = save.worldtree >= 2 ? 12 : 8;
  const start = save.idleClaimAt ?? save.profile?.createdAt ?? new Date().toISOString();
  const hours = Math.min(capHours, Math.max(0, (now - new Date(start).getTime()) / 3600000));
  const bonus = worldtreeBonus(save);
  // v17 数值核心 v2（设计 §3.2）：金币/灵味原浆线性阶、经验随树等差；与后端 power.ts idleAccrual 同式
  return {
    capHours,
    hours,
    coins: Math.floor(15000 * (1 + 0.22 * (save.worldtree - 1)) * hours * bonus),
    potions: Math.floor(4200 * (1 + 0.12 * (save.worldtree - 1)) * hours * bonus),
    exp: Math.floor(1800 * save.worldtree * hours * bonus),
  };
}

/** v17 世界树升级消耗（设计 §3.1）：多项式 28000×L^1.55 / 15×L^1.55；实际升级另耗 coins×0.2 + exp_required(L)。 */
export function worldtreeCost(level: number): { coins: number; leaves: number } {
  return { coins: Math.round(28000 * Math.pow(level, 1.55)), leaves: Math.round(15 * Math.pow(level, 1.55)) };
}

/** 世界树（=掌灶人等级）上限，与后端 WORLD_TREE_MAX / players.worldtree_level CHECK 一致（v19 §2.5 延伸至 150）。 */
export const WORLD_TREE_MAX = 150;
/** 存量成长曲线锚：1→100 级线性铺满 2.6x（与后端 GROWTH_ANCHOR_LEVEL 一致），100+ 级封顶续用（§2.5）。 */
export const GROWTH_ANCHOR_LEVEL = 100;

/** 升到下一级所需掌灶人经验（与后端 seed expRequiredAt 同式：分段几何 80×r^(L-1)，r=1.05/1.06/1.07，取整到 10；61+ 恒 1.07 续接，满级返回 0）。 */
export function expRequiredAt(level: number): number {
  if (level >= WORLD_TREE_MAX) return 0;
  const rate = level < 31 ? 1.05 : level < 61 ? 1.06 : 1.07;
  return Math.max(10, Math.round((80 * Math.pow(rate, level - 1)) / 10) * 10);
}

/**
 * 掌灶人整体成长系数（与后端 power.ts growthBp 同式）：1 级 1.0 → 100 级 2.6，100+ 封顶续用。
 * 分母钉死 99（GROWTH_ANCHOR_LEVEL-1）而非 WORLD_TREE_MAX-1——等级域延伸到 150 时 1–100 级曲线零漂移。
 */
export function growthMultiplier(level: number): number {
  const capped = Math.min(level - 1, GROWTH_ANCHOR_LEVEL - 1);
  return (10000 + Math.round(16000 * capped / (GROWTH_ANCHOR_LEVEL - 1))) / 10000;
}

/** 战斗胜利经验（与后端 power.ts battleExpGain 同式）：round(锚/90)，首通 ×3；战力 ≥ 锚×1.5 视为碾压，收益减半。 */
export function battleExpGain(anchorPower: number, firstClear: boolean, squadPowerValue: number): number {
  let exp = Math.round(anchorPower / 90) * (firstClear ? 3 : 1);
  if (squadPowerValue >= anchorPower * 1.5) exp = Math.floor(exp / 2);
  return exp;
}

/**
 * 活动/战令奖励等级缩放（与后端 power.ts activityRewardScale 同式，设计 §9）：
 * 1 + 0.03 × max(0, 等级 − 30)，上限 2.1（§9 锚点「100 级时 ×2.1」，67 级封顶）。
 * 仅金币/食灵精华/经验参与缩放；灵晶/契约/物品等稀缺资源不缩放（服务端发放同口径）。
 */
export const ACTIVITY_REWARD_SCALE_CAP = 2.1;

export function activityRewardScale(level: number): number {
  return Math.min(1 + 0.03 * Math.max(0, level - 30), ACTIVITY_REWARD_SCALE_CAP);
}

export const astrologyNodes = [
  { id: 'star-1', name: '天枢', cost: 60, bonus: 2 },
  { id: 'star-2', name: '天璇', cost: 80, bonus: 2 },
  { id: 'star-3', name: '天玑', cost: 100, bonus: 2 },
  { id: 'star-4', name: '天权', cost: 140, bonus: 2 },
  { id: 'star-5', name: '玉衡', cost: 180, bonus: 2 },
  { id: 'star-6', name: '开阳', cost: 240, bonus: 2 },
];

export type MarketEntry = { id: string; label: string; kind: Reward['kind']; price: number; amount: number };

const marketPool: MarketEntry[] = [
  { id: 'm1', label: '食灵契约', kind: 'book', price: 120000, amount: 2 },
  { id: 'm2', label: '灵晶', kind: 'gem', price: 90000, amount: 30 },
  { id: 'm3', label: '灵味原浆', kind: 'potion', price: 60000, amount: 80000 },
  { id: 'm4', label: '食灵精华', kind: 'leaf', price: 75000, amount: 150 },
  { id: 'm5', label: '冒险宝箱', kind: 'chest', price: 150000, amount: 1 },
  { id: 'm6', label: '稀有徽章', kind: 'medal', price: 260000, amount: 1 },
];

/** 集市货架按日期确定，同一天刷新结果一致。 */
export function marketStockFor(date: string): MarketEntry[] {
  const seed = Array.from(date).reduce((sum, ch) => sum + ch.charCodeAt(0), 0);
  return [0, 1, 2].map(offset => marketPool[(seed + offset * 2) % marketPool.length]);
}

export function battlePassLevel(save: GameSave): number {
  return Math.min(10, save.characters.length + save.claimedQuests.length + save.battleWins);
}

export const battlePassRewards: Reward[][] = [
  [{ kind: 'coin', amount: 50000, label: '金币' }],
  [{ kind: 'book', amount: 1, label: '食灵契约' }],
  [{ kind: 'gem', amount: 30, label: '灵晶' }],
  [{ kind: 'leaf', amount: 120, label: '食灵精华' }],
  [{ kind: 'potion', amount: 80000, label: '灵味原浆' }],
  [{ kind: 'book', amount: 2, label: '食灵契约' }],
  [{ kind: 'chest', amount: 1, label: '冒险宝箱' }],
  [{ kind: 'gem', amount: 60, label: '灵晶' }],
  [{ kind: 'medal', amount: 1, label: '稀有徽章' }],
  [{ kind: 'book', amount: 3, label: '食灵契约' }],
];

export const fundMilestones: { id: string; need: number; label: string; rewards: Reward[] }[] = [
  { id: 'fund-2', need: 2, label: '拥有 2 位食灵', rewards: [{ kind: 'book', amount: 3, label: '食灵契约' }, { kind: 'gem', amount: 50, label: '灵晶' }] },
  { id: 'fund-3', need: 3, label: '拥有 3 位食灵', rewards: [{ kind: 'chest', amount: 1, label: '冒险宝箱' }, { kind: 'coin', amount: 200000, label: '金币' }] },
  { id: 'fund-5', need: 5, label: '拥有 5 位食灵', rewards: [{ kind: 'medal', amount: 1, label: '稀有徽章' }, { kind: 'gem', amount: 120, label: '灵晶' }] },
];

export const cardPacks = [
  { id: 'tasty', name: '滋味卡包', cost: 1, detail: '随机结识 1 位尚未缔结契约的食灵' },
  { id: 'feast', name: '盛宴卡包', cost: 3, detail: '随机结识 1 位 SSR 食灵，并额外获得 2 份契约' },
];

export const privileges: { id: string; name: string; detail: string; active: (save: GameSave) => boolean }[] = [
  { id: 'p1', name: '离线收益延长', detail: '时光屋累积上限由 8 小时延长至 12 小时。', active: save => save.worldtree >= 2 },
  { id: 'p2', name: '全队属性加成', detail: '每点亮一颗星图节点，全队属性提升 2%。', active: save => save.astrology.length > 0 },
  { id: 'p3', name: '集市折扣', detail: '世界树达到 3 级后，集市商品价格打九折。', active: save => save.worldtree >= 3 },
  { id: 'p4', name: '炼制效率提升', detail: '研制坊累计炼制 5 次后，单次产出提升 10%。', active: save => save.crafted >= 5 },
];


export const shopPacks: { id: string; price: number; gems: number; books: number; label: string; note: string }[] = [
  { id: 'gem-6', price: 6, gems: 60, books: 0, label: '一小袋灵晶', note: '新手补给' },
  { id: 'gem-30', price: 30, gems: 330, books: 1, label: '灵晶礼匣', note: '附赠 1 份契约' },
  { id: 'gem-68', price: 68, gems: 780, books: 3, label: '星辉宝匣', note: '附赠 3 份契约' },
];

export function starLevel(save: GameSave, name: string): number {
  return save.stars[name] ?? 1;
}

export function ascendCost(star: number): { potions: number; leaves: number } {
  return { potions: 40000 * star, leaves: 30 * star };
}

export const marqueeLines = [
  '恭喜命运之子在高级召唤中结识五星食灵',
  '街巷食神记进行中，击败食客可领取秘传配方',
  '时光屋正在累积离线收益，记得回来领取',
  '七日之约每日可领，次日结识冬阴功',
];


/* ---------- 开服活动总览 ---------- */

export const launchEvents: {
  id: string;
  name: string;
  english: string;
  detail: string;
  image: string;
  dialog: DialogName;
  until: 'midnight' | 'week' | 'permanent';
  tone: 'gold' | 'coral' | 'green' | 'blue';
}[] = [
  { id: 'e1', name: '七日之约', english: 'SEVEN DAYS', detail: '累计登录领取冬阴功与限定食灵', image: artwork.seven, dialog: 'seven', until: 'week', tone: 'gold' },
  { id: 'e2', name: '首充赠礼', english: 'FIRST ENCOUNTER', detail: '结识五星 SSR 蓝纹奶酪，三日豪礼', image: artwork.first, dialog: 'first', until: 'permanent', tone: 'blue' },
  { id: 'e3', name: '契约特惠', english: 'GOLDEN COVENANT', detail: '开服限定礼遇，1688% 超值返利', image: artwork.contract, dialog: 'contract', until: 'week', tone: 'gold' },
  { id: 'e4', name: '街巷食神记', english: 'STREET CHRONICLE', detail: '限时远征，击败街头食客赢秘传配方', image: artwork.chronicle, dialog: 'chronicle', until: 'midnight', tone: 'coral' },
  { id: 'e5', name: '升星豪礼', english: 'STAR ASCENSION', detail: '食灵升星，三星赠徽章、五星赠契约', image: artwork.ascension, dialog: 'ascend', until: 'permanent', tone: 'green' },
  { id: 'e6', name: '灵晶商城', english: 'CRYSTAL SHOP', detail: '演示额度兑换灵晶与食灵契约', image: artwork.market, dialog: 'shop', until: 'permanent', tone: 'blue' },
];
