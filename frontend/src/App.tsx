import { useEffect, useRef, useState, type ReactNode } from 'react';
import { ArrowLeftRight, ArrowRight, BookOpen, CalendarClock, Check, ChevronRight, CircleHelp, Clock3, Compass, Crown, Flame, FlaskConical, Gift, Grid2X2, Hammer, Home, Hourglass, Leaf, LogOut, Mail, Megaphone, MessageSquare, Music2, Package, PartyPopper, Plus, ScrollText, Settings2, Shield, ShieldCheck, Sparkle, Sparkles, Star, Store, Swords, TreePine, Trophy, UserRound, Users, Video, VolumeX } from 'lucide-react';
import {
  artwork, badges, battleChargesOf, battlePassLevel, battlePassRewards, BATTLE_PASS_COST_GEMS, catalogFeatures, catalogServerOpenDay, chronicleMilestones, characters, compactNumber, dailyRewards, dailyTiers,
  elapsedDays, featureScreens, firstRewards, fundMilestones, grantRewards, onCatalogChanged,
  lobbyBottomNav, lobbyLeftRail, lobbyRightRail, previewScreens, rolloverDailyState, sevenRewards, tradeRates,
  marqueeLines, shopPacks, type DialogName, type FeatureToggle, type MailItem, type MainScreen,
  type MarketEntry, type OfferName, type Quest,
} from './game-data';
import { readStoredScreen, useGame, writeStoredScreen } from './use-game';
import { loginWithPassword, readIdentitySnapshot, registerPassword } from './api/identity';
import { createOrder, mockPay } from './api/payments';
import { buyBattlePass } from './api/battle-passes';
import { BadgeDot, Dialog, GoldButton, ItemArt, NavAction, Ornament, Particles, Rewards, Sigil, onArtworkError } from './components/GameUi';
import Offers, { type Purchase } from './components/Offers';
import { AccountPanel, CollectionPanel, CreatePanel, GuidePanel, NoticePanel, PolicyPanel, PreviewPanel, RankingPanel, ServerPanel, SettingsPanel, SummonPanel } from './components/Panels';
import { MailPanel, QuestPanel } from './components/Lobby';
import { ChatPanel, FriendPanel, GuildPanel, type SocialActions } from './components/Social';
import { acceptFriend, applyToGuild, approveGuildLocally, cancelGuildApplication, checkInGuild, clearLocalMessages, dismissFriendRequest, donateToGuild, leaveGuild, removeFriend, requestFriend, sendLocalMessage, writeChatDraft, type ChatLocation } from './social';
import { BagPanel, HeroPanel, type BagLocation, type EquipmentActions } from './components/Equipment';
import { claimStarterEquipment, enhanceItem, equipBestItems, equipItem, formatSubstat, openEquipmentChests, reforgeItem, REFORGE_UNLOCK_LEVEL, salvageItem, unequipItem, type EquipmentSlot } from './equipment';
import { BattlePanel, CombatPanel, RecordPanel, ResultPanel } from './components/Battle';
import { beginBattle, settleBattle } from './battle-engine';
import { createFreshSave } from './game-clock';
import { ascendCharacter, buyMarketTransaction, claimIdleRewards, craftPotionsTransaction, exchangeResources, unlockStarNode, upgradeTree } from './game-transactions';
import { ActivityCenterPanel, EstatePanel, type EstateActions } from './components/Estate';
import { AscendPanel, ChroniclePanel, ShopPanel, TradePanel } from './components/Extras';
import { LaunchEventsPanel } from './components/LaunchEvents';
import { MidnightCountdown, SevenDayCountdown } from './components/LiveCountdown';
import './battle.css';

const offers: OfferName[] = ['contract', 'level', 'first', 'daily', 'seven'];
const titles: Record<DialogName, string> = {
  servers: '选择服务器', notice: '开服公告', create: '初识灵界', guide: '命运的指引',
  contract: '契约特惠', level: '等级礼包', first: '首充赠礼', daily: '每日充值', seven: '七日之约',
  settings: '游戏设置', ranking: '灵界排行榜', preview: '灵界画卷', policy: '游戏用户协议',
  collection: '食灵图鉴', summon: '食灵召唤', bag: '旅者行囊', account: '旅者账户', purchase: '确认演示充值',
  chat: '灵界信使', mail: '旅者信箱', quest: '旅途委托', record: '战斗回放', friend: '同行伙伴',
  hero: '主角养成', manor: '灵界庄园', guild: '食灵协会', battle: '副本',
  workshop: '研制坊', timehouse: '时光屋', market: '集市', astrology: '占星', worldtree: '世界树', activity: '活动中心',
  trade: '交易坊', chronicle: '街巷食神记', shop: '灵晶商城', ascend: '升星豪礼', events: '开服活动',
  combat: '月桥战场', 'battle-result': '远征结算',
};
const subtitles: Partial<Record<DialogName, string>> = {
  servers: 'CHOOSE YOUR REALM', notice: 'NEWS FROM THE SPIRIT WORLD', settings: 'MAKE YOURSELF AT HOME', ranking: 'LEGENDS OF THE REALM', preview: 'TEN SCENES, ONE FANTASY', collection: 'THE SOUL OF EVERY FLAVOR', summon: 'A FATEFUL ENCOUNTER', bag: 'TREASURES OF YOUR JOURNEY', account: 'YOUR STORY IN THIS REALM', purchase: 'LOCAL DEMONSTRATION ONLY',
  chat: 'MESSAGES OF THE REALM', mail: 'LETTERS FOR YOU', quest: 'COMMISSIONS AHEAD', record: 'REPLAY ARCHIVE', friend: 'FELLOW TRAVELERS', hero: 'THE CHOSEN ONE', manor: 'YOUR SANCTUARY', guild: 'BROTHERHOOD OF TASTE', battle: 'MARCH FORWARD',
  workshop: 'CRAFTING ALCHEMY', timehouse: 'IDLE TREASURES', market: 'DAILY BARGAINS', astrology: 'STAR CHART', worldtree: 'GROWTH ENGINE', activity: 'EVENTS & REWARDS',
  trade: 'FAIR EXCHANGE', chronicle: 'A LIMITED TALE', shop: 'CRYSTAL SHOP', ascend: 'RAISE THE STARS',
};
const activityOptions: { id: DialogName; icon: ReactNode; name: string; detail: string }[] = [
  { id: 'first', icon: <Crown />, name: '首充赠礼', detail: '邂逅五星食灵' },
  { id: 'contract', icon: <Sparkles />, name: '契约特惠', detail: '缔结金色之约' },
  { id: 'level', icon: <Star />, name: '等级礼包', detail: '珍藏每一步成长' },
  { id: 'daily', icon: <Gift />, name: '每日充值', detail: '每日一份小确幸' },
  { id: 'trade', icon: <ArrowLeftRight />, name: '交易坊', detail: '闲置资源每日兑换' },
  { id: 'activity', icon: <PartyPopper />, name: '活动中心', detail: '战令 / 基金 / 卡包' },
  { id: 'chronicle', icon: <Flame />, name: '街巷食神记', detail: '每日限时活动' },
  { id: 'events', icon: <CalendarClock />, name: '开服活动', detail: '全部限时活动总览' },
];
const railIcons: Record<string, ReactNode> = {
  chat: <MessageSquare />, mail: <Mail />, quest: <ScrollText />, record: <Video />, ranking: <Trophy />, friend: <Users />,
  bag: <Package />, manor: <Hammer />, collection: <BookOpen />, summon: <Sigil />, hero: <UserRound />, guild: <Shield />, battle: <Swords />,
  workshop: <FlaskConical />, timehouse: <Hourglass />, market: <Store />, astrology: <Sparkle />, worldtree: <TreePine />, activity: <PartyPopper />,
  trade: <ArrowLeftRight />, chronicle: <Flame />,
};
const estateDialogs = ['workshop', 'timehouse', 'market', 'astrology', 'worldtree', 'manor'] as const;
type EstateDialog = (typeof estateDialogs)[number];
const isEstateDialog = (value: DialogName): value is EstateDialog => (estateDialogs as readonly string[]).includes(value);

const dialogForKind = (kind: Purchase['kind']): DialogName => (kind === 'fund' ? 'activity' : kind);

function getInitialView() {
  const query = new URLSearchParams(window.location.search).get('view');
  // 没有 ?view 参数时交还给上次的界面，而不是默认匹配第一项。
  if (!query) return undefined;
  return [...previewScreens, ...featureScreens].find(item => item.id === query || item.dialog === query || (query === 'login' && item.id === '01'));
}

export default function App() {
  const { save, setSave, preferences, setPreferences, storageError } = useGame();
  const [screen, setScreen] = useState<MainScreen>(() => getInitialView()?.screen ?? readStoredScreen('login'));
  const [dialog, setDialog] = useState<DialogName | null>(() => getInitialView()?.dialog || null);
  const [agreed, setAgreed] = useState(false);
  const [agreementError, setAgreementError] = useState(false);
  const [toast, setToast] = useState('');
  const [policyType, setPolicyType] = useState<'terms' | 'privacy'>('terms');
  const [pendingPurchase, setPendingPurchase] = useState<Purchase | null>(null);
  const [battleId, setBattleId] = useState<string | null>(save.pendingBattle?.id || null);
  const [replayMode, setReplayMode] = useState(false);
  const [bagLocation, setBagLocation] = useState<BagLocation>({ tab: 'resources' });
  const [chatLocation, setChatLocation] = useState<ChatLocation>({ channel: 'world' });
  const [, refreshClock] = useState(0);
  // v21：catalog（功能开关/副本/关卡）异步到达后重渲，主界面入口显隐随之更新
  const [, refreshCatalog] = useState(0);
  const consentRef = useRef<HTMLInputElement>(null);
  const selectedBattle = save.pendingBattle?.id === battleId ? save.pendingBattle : save.battleHistory.find(record => record.id === battleId);

  useEffect(() => onCatalogChanged(() => refreshCatalog(value => value + 1)), []);

  /** v21 功能开关：key → 开关行（服务端 features 为唯一数据源；未下发时为空 = 全部显示） */
  const featureMap = new Map<string, FeatureToggle>(catalogFeatures.map(feature => [feature.key, feature]));
  const featureVisible = (key: string): boolean => {
    const feature = featureMap.get(key);
    if (!feature) return true; // 无开关定义的入口（背包/回放等基础功能）恒显示
    if (!feature.enabled) return false;
    const day = catalogServerOpenDay;
    if (feature.openDay !== null && day < feature.openDay) return false;
    if (feature.closeDay !== null && day > feature.closeDay) return false;
    return true;
  };
  const visibleFeatures = <T extends { id: string }>(items: readonly T[]): T[] => items.filter(item => featureVisible(item.id));

  useEffect(() => { writeStoredScreen(screen); }, [screen]);

  useEffect(() => {
    if (screen !== 'lobby') return;
    const timer = window.setInterval(() => refreshClock(value => value + 1), 1000);
    return () => window.clearInterval(timer);
  }, [screen]);

  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(''), 4200);
    return () => window.clearTimeout(timer);
  }, [toast]);

  const open = (name: DialogName) => {
    if (name === 'bag') setBagLocation({ tab: 'resources' });
    if (name === 'chat') setChatLocation({ channel: 'world' });
    setDialog(name);
  };
  const close = () => {
    if (dialog === 'purchase' && pendingPurchase) setDialog(dialogForKind(pendingPurchase.kind));
    else if (dialog === 'combat' || dialog === 'battle-result') setDialog(replayMode ? 'record' : 'battle');
    else setDialog(null);
  };
  const notify = (message: string) => setToast(message);
  const view = (item: typeof previewScreens[number] | typeof featureScreens[number]) => { setScreen('screen' in item ? item.screen : 'lobby'); setDialog(item.dialog); };
  const showPolicy = (type: 'terms' | 'privacy') => { setPolicyType(type); open('policy'); };

  const start = () => {
    if (!agreed) { setAgreementError(true); consentRef.current?.focus(); return; }
    if (!save.profile) { open('create'); return; }
    setScreen('lobby');
    if (!save.guideCompleted) open('guide');
  };

  const create = (name: string, gender: 'male' | 'female') => {
    const editing = !!save.profile;
    setSave(current => ({ ...current, profile: { name, gender, createdAt: current.profile?.createdAt || new Date().toISOString() } }));
    setScreen('lobby');
    setDialog(editing ? null : 'guide');
    if (editing) notify('旅者信息已保存。愿新的故事与你相伴。');
  };

  const finishGuide = (summon = false) => {
    setSave(current => ({ ...current, guideCompleted: true }));
    setDialog(summon ? 'summon' : null);
  };

  const purchase = (item: Purchase) => {
    if (!save.profile) { notify('先写下你的名字，再领取专属礼遇。'); open('create'); return; }
    setPendingPurchase(item);
    open('purchase');
  };

  const applyLocalPurchase = (item: Purchase) => {
    setSave(current => {
      if (item.kind !== 'daily' && item.kind !== 'shop' && current.purchases.includes(item.kind)) return current;
      const next = grantRewards(current, item.rewards);
      return {
        ...next,
        dailyPaid: next.dailyPaid + item.price,
        purchases: item.kind === 'daily' || item.kind === 'shop' ? next.purchases : [...next.purchases, item.kind],
        shopBought: item.packId ? Array.from(new Set([...next.shopBought, item.packId])) : next.shopBought,
        firstPurchasedAt: item.kind === 'first' ? new Date().toISOString() : next.firstPurchasedAt,
        firstClaimed: item.kind === 'first' ? [1] : next.firstClaimed,
        fundPurchased: item.kind === 'fund' ? true : next.fundPurchased,
      };
    });
  };

  // 有身份时商城礼包走真实订单流：下单 → 模拟网关回调验签 → 服务端发放，本地同步入账；
  // 无身份（自动化/离线）或非商城购买保持纯本地演示，236 个既有页面用例零改动。
  const purchaseViaServer = async (item: Purchase) => {
    try {
      const order = await createOrder(item.packId!, crypto.randomUUID());
      const result = await mockPay(order.orderId);
      applyLocalPurchase(item);
      setDialog(dialogForKind(item.kind));
      notify(`支付成功，礼遇已放入旅者行囊（订单 ${result.order.orderId.slice(0, 8)}）。`);
    } catch {
      applyLocalPurchase(item);
      setDialog(dialogForKind(item.kind));
      notify('云端支付暂不可用，已按演示模式入账。');
    }
  };

  const confirmPurchase = () => {
    if (!pendingPurchase) return;
    const item = pendingPurchase;
    const identity = readIdentitySnapshot();
    if (item.kind === 'shop' && item.packId && identity) {
      void purchaseViaServer(item);
      return;
    }
    applyLocalPurchase(item);
    setDialog(dialogForKind(item.kind));
    notify(item.kind === 'daily' ? '演示额度已更新，可领取对应档位的每日奖励。未产生真实扣款。' : '礼遇已放入旅者行囊。此操作仅为本地演示，未产生真实扣款。');
  };

  // 正式注册：为当前云端身份设置密码；登录：账号 ID + 密码找回远端存档。
  const registerPasswordHandler = async (password: string) => {
    const { accountId } = await registerPassword(password);
    notify(`密码已设置。账号 ID ${accountId} 是找回凭证，请妥善保存。`);
  };

  const loginHandler = async (accountId: string, password: string) => {
    const { save: remoteSave } = await loginWithPassword(accountId, password);
    if (remoteSave) setSave(remoteSave);
    notify('登录成功，云端存档已找回。');
    setDialog(null);
  };

  // 每日挑战卡：有身份走服务端购买（硬校验+权威计数），无身份/失败降级为本地演示口径。
  const buyPass = async () => {
    const identity = readIdentitySnapshot();
    if (identity) {
      try {
        const result = await buyBattlePass();
        setSave(current => ({
          ...current,
          gems: result.save.gems,
          dailyBattleDate: result.charges.dayKey,
          dailyBattlesUsed: result.charges.used,
          battlePassesPurchased: result.charges.purchased,
        }));
        notify(`挑战卡购买成功，今日还可挑战 ${result.charges.remaining} 次。`);
        return;
      } catch {
        notify('云端购买暂不可用，已按演示模式入账。');
      }
    }
    setSave(current => {
      const rolled = rolloverDailyState(current);
      const charges = battleChargesOf(rolled);
      if (!charges.canBuy || rolled.gems < BATTLE_PASS_COST_GEMS) return current;
      return { ...rolled, gems: rolled.gems - BATTLE_PASS_COST_GEMS, battlePassesPurchased: charges.purchased + 1 };
    });
    notify('挑战卡已购买，今日挑战次数 +1。');
  };

  const claimDaily = (tier: number) => {
    setSave(current => {
      if (current.dailyPaid < tier || current.dailyClaimed.includes(tier)) return current;
      return { ...grantRewards(current, dailyRewards[dailyTiers.indexOf(tier)]), dailyClaimed: [...current.dailyClaimed, tier] };
    });
    notify('每日赠礼已领取，可在旅者行囊中查看。');
  };

  const claimSeven = (day: number) => {
    setSave(current => {
      if (!current.profile || current.sevenClaimed.includes(day) || day > elapsedDays(current.profile.createdAt)) return current;
      return { ...grantRewards(current, sevenRewards[day - 1]), sevenClaimed: [...current.sevenClaimed, day], dailyLoginRewards: current.dailyLoginRewards + 1 };
    });
    notify(`第 ${day} 天的登录赠礼已收好。明天也要再见。`);
  };

  const claimFirst = (day: number) => {
    setSave(current => {
      if (!current.firstPurchasedAt || current.firstClaimed.includes(day) || day > elapsedDays(current.firstPurchasedAt)) return current;
      return { ...grantRewards(current, firstRewards[day - 1]), firstClaimed: [...current.firstClaimed, day] };
    });
    notify('今日首充赠礼已领取，资源已存入行囊。');
  };

  const claimExtra = () => {
    setSave(current => current.extraClaimed || current.sevenClaimed.length < 1 ? current : { ...grantRewards(current, [{ kind: 'chest', amount: 1, label: '冒险宝箱' }, { kind: 'gem', amount: 100, label: '灵晶' }]), extraClaimed: true });
    notify('限时追加礼遇已领取。');
  };

  const summon = (count: number) => {
    if (!save.profile || save.books < count) return null;
    const result = Array.from({ length: count }, () => characters[Math.floor(Math.random() * characters.length)]);
    setSave(current => current.books < count ? current : { ...current, books: current.books - count, dailySummons: current.dailySummons + count, characters: Array.from(new Set([...current.characters, ...result.map(item => item.name)])) });
    return result;
  };

  const claimQuest = (quest: Quest) => {
    const [progress, target] = quest.progress(save);
    const completable = progress >= target;
    setSave(current => current.claimedQuests.includes(quest.id) || quest.progress(current)[0] < quest.progress(current)[1] ? current : { ...grantRewards(current, quest.rewards), claimedQuests: [...current.claimedQuests, quest.id] });
    if (completable) notify(`委托「${quest.name}」已完成，奖励已放入行囊。`);
  };

  const claimMail = (item: MailItem) => {
    setSave(current => current.claimedMail.includes(item.id) ? current : { ...grantRewards(current, item.rewards), claimedMail: [...current.claimedMail, item.id] });
    notify(`「${item.title}」的附件已领取。`);
  };

  const craftPotions = (times: number) => {
    const next = craftPotionsTransaction(save, times);
    if (next === save) { notify('当前资源不足，无法炼制。'); return; }
    setSave(current => craftPotionsTransaction(current, times));
    notify(`炼制完成，获得灵味原浆 ×${compactNumber(next.potions - save.potions)}。`);
  };

  const claimIdle = () => {
    const now = new Date();
    if (claimIdleRewards(save, now) === save) { notify('时光屋还在累积中，稍后再来领取。'); return; }
    setSave(current => claimIdleRewards(current, now));
    notify('时光屋累积收益已存入行囊。');
  };

  const buyMarket = (entry: MarketEntry) => {
    setSave(current => buyMarketTransaction(current, entry.id));
    notify(`已在集市兑换「${entry.label}」×${compactNumber(entry.amount)}。`);
  };

  const unlockNode = (id: string) => {
    if (unlockStarNode(save, id) === save) { notify('请确认灵晶数量并按顺序点亮星图。'); return; }
    setSave(current => unlockStarNode(current, id));
    notify('星图节点已点亮，全队属性加成提升。');
  };

  const upgradeWorldtree = () => {
    if (upgradeTree(save) === save) { notify('资源不足或世界树已满级。'); return; }
    setSave(current => upgradeTree(current));
    notify(`世界树升至 Lv.${save.worldtree + 1}，庄园产出加成提升。`);
  };

  const claimBattlePass = (level: number) => {
    const rewards = battlePassRewards[level - 1];
    setSave(current => current.bpClaimed.includes(level) || battlePassLevel(current) < level ? current
      : { ...grantRewards(current, rewards), bpClaimed: [...current.bpClaimed, level] });
    notify(`战令 Lv.${level} 奖励已领取。`);
  };

  const openPack = (id: string, cost: number) => {
    if (!save.profile || save.books < cost) { notify('食灵契约不足，先去召唤或活动里获取吧。'); return; }
    const eligible = characters.filter(character => id !== 'feast' || character.rarity === 'SSR');
    const unowned = eligible.filter(character => !save.characters.includes(character.name));
    const pool = unowned.length > 0 ? unowned : eligible;
    const picked = pool[Math.floor(Math.random() * pool.length)];
    const bonus = id === 'feast' ? [{ kind: 'book' as const, amount: 2, label: '食灵契约' }] : [];
    setSave(current => {
      if (current.books < cost) return current;
      const next = grantRewards({ ...current, books: current.books - cost }, [{ kind: 'character', amount: 1, label: picked.name }, ...bonus]);
      return { ...next, packsOpened: next.packsOpened + 1, dailySummons: next.dailySummons + 1 };
    });
    notify(unowned.length > 0 ? `结识新食灵「${picked.name}」！` : `再次遇见「${picked.name}」，图鉴不重复收录。`);
  };

  const purchaseFund = () => purchase({ kind: 'fund', price: 30, label: '超值基金', rewards: [] });

  const claimFund = (id: string) => {
    const milestone = fundMilestones.find(item => item.id === id);
    if (!milestone) return;
    setSave(current => !current.fundPurchased || current.fundClaimed.includes(id) || current.characters.length < milestone.need ? current
      : { ...grantRewards(current, milestone.rewards), fundClaimed: [...current.fundClaimed, id] });
    notify(`超值基金「${milestone.label}」奖励已领取。`);
  };

  const trade = (id: string) => {
    const rate = tradeRates.find(item => item.id === id);
    if (!rate || exchangeResources(save, id) === save) { notify('当前资源不足或今日兑换次数已用完。'); return; }
    setSave(current => exchangeResources(current, id));
    notify(`交易坊兑换成功，获得${rate.get.label} ×${compactNumber(rate.get.amount)}。`);
  };

  const claimChronicle = (id: string) => {
    const milestone = chronicleMilestones.find(item => item.id === id);
    if (!milestone) return;
    setSave(current => current.chroniclePoints < milestone.need || current.chronicleClaimed.includes(id) ? current
      : { ...grantRewards(current, milestone.rewards), chronicleClaimed: [...current.chronicleClaimed, id] });
    notify(`「${milestone.label}」的秘传配方已放入行囊。`);
  };

  const buyPack = (id: string) => {
    const pack = shopPacks.find(item => item.id === id);
    if (!pack) return;
    purchase({
      kind: 'shop', packId: pack.id, price: pack.price, label: pack.label,
      rewards: [
        { kind: 'gem', amount: pack.gems, label: '灵晶' },
        ...(pack.books ? [{ kind: 'book' as const, amount: pack.books, label: '食灵契约' }] : []),
      ],
    });
  };

  const ascend = (name: string) => {
    const next = ascendCharacter(save, name);
    if (next === save) return;
    setSave(current => ascendCharacter(current, name));
    notify(`${name}升至 ${next.stars[name]} 星，出战战力同步提升。`);
  };

  const estateActions: EstateActions = {
    craft: craftPotions, claimIdle, buyMarket, unlockNode, upgradeWorldtree,
    claimBp: claimBattlePass, openPack, purchaseFund, claimFund,
  };

  const resumeBattle = () => {
    if (!save.pendingBattle) return;
    setBattleId(save.pendingBattle.id);
    setReplayMode(false);
    setDialog('combat');
  };

  const startBattle = (stage: string, formation: string[]) => {
    if (!save.profile) { open('create'); return; }
    if (save.pendingBattle) { resumeBattle(); return; }
    const id = `battle-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
    const seed = crypto.getRandomValues(new Uint32Array(1))[0];
    const now = new Date();
    setSave(current => beginBattle(current, stage, formation, seed, id, now));
    setBattleId(id);
    setReplayMode(false);
    setDialog('combat');
  };

  const replayBattle = (id: string) => {
    if (!save.battleHistory.some(record => record.id === id)) return;
    setBattleId(id);
    setReplayMode(true);
    setDialog('combat');
  };

  const claimBattle = () => {
    if (!selectedBattle || selectedBattle.status !== 'pending' || replayMode) return;
    const id = selectedBattle.id;
    setSave(current => settleBattle(current, id));
    notify(selectedBattle.win ? '战利品已存入行囊，本次战报已保存。' : '本次战报已收录，准备好后再启程。');
  };

  const goToBag = (location: BagLocation) => { setBagLocation(location); setDialog('bag'); };
  const equip = (id: string) => {
    if (equipItem(save, id) === save) return;
    setSave(current => equipItem(current, id));
    notify('装备已穿戴，旅者属性与队伍战力同步更新。');
  };
  const unequip = (slot: EquipmentSlot) => {
    if (unequipItem(save, slot) === save) return;
    setSave(current => unequipItem(current, slot));
    notify('装备已卸下，仍妥善保存在装备行囊。');
  };
  const autoEquip = () => {
    if (equipBestItems(save) === save) return;
    setSave(current => equipBestItems(current));
    notify('已为六个部位选择当前战力最高的装备。');
  };
  const enhance = (id: string, level: number) => {
    if (enhanceItem(save, id, level) === save) { notify('强化资源不足或装备状态已变化。'); return; }
    setSave(current => enhanceItem(current, id, level));
    notify(`强化成功，装备提升至 +${level + 1}。`);
  };
  const reforge = (id: string) => {
    const next = reforgeItem(save, id);
    if (next === save) { notify(save.worldtree < REFORGE_UNLOCK_LEVEL ? '副属性洗练在世界树 60 级解锁。' : '金币不足，无法洗练。'); return; }
    setSave(current => reforgeItem(current, id));
    const substat = next.equipment.find(entry => entry.id === id)?.substat;
    notify(substat ? `洗练完成：新副属性 ${formatSubstat(substat)} 已铭入装备。` : '洗练完成。');
  };
  const salvage = (id: string) => {
    if (salvageItem(save, id) === save) return;
    setSave(current => salvageItem(current, id));
    notify('闲置装备已分解，返还金币与食灵精华已入账。');
  };
  const openChests = (count: number) => {
    const id = crypto.randomUUID?.() || `chest-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
    const seed = crypto.getRandomValues(new Uint32Array(1))[0];
    const now = new Date();
    if (openEquipmentChests(save, count, id, seed, now) === save) { notify('请检查宝箱数量与装备行囊剩余空间。'); return; }
    setSave(current => openEquipmentChests(current, count, id, seed, now));
  };
  const claimStarter = () => {
    if (claimStarterEquipment(save) === save) return;
    setSave(current => claimStarterEquipment(current));
    notify('六只启程宝箱已放入行囊，愿每一份守护都与你相伴。');
  };
  const equipmentActions: EquipmentActions = { onEquip: equip, onUnequip: unequip, onAutoEquip: autoEquip, onEnhance: enhance, onReforge: reforge, onSalvage: salvage, onOpenChests: openChests, onStarter: claimStarter, onCreate: () => open('create') };

  const changeSocial = (operation: (current: typeof save) => typeof save, message: string) => {
    if (operation(save) === save) return;
    setSave(current => operation(current));
    notify(message);
  };
  const goToChat = (location: ChatLocation) => {
    setChatLocation(location);
    setDialog('chat');
  };
  const socialActions: SocialActions = {
    onRequest: id => changeSocial(current => requestFriend(current, id), '申请已保存在本地，可在申请页继续模拟。'),
    onAccept: (id, source) => changeSocial(current => acceptFriend(current, id, source), source === 'incoming' ? '演示邀请已接受，伙伴加入本地好友列表。' : '已在本地模拟通过好友申请，未联系真实玩家。'),
    onDismiss: (id, source) => changeSocial(current => dismissFriendRequest(current, id, source), source === 'incoming' ? '已婉拒这份演示邀请。' : '本地申请已撤回。'),
    onRemove: id => changeSocial(current => removeFriend(current, id), '已移除本地好友，私聊记录仍然保留。'),
    onApplyGuild: id => { const now = new Date(); changeSocial(current => applyToGuild(current, id, now), '协会申请已记录，请手动模拟审批流程。'); },
    onCancelGuild: () => { const now = new Date(); changeSocial(current => cancelGuildApplication(current, now), '本地协会申请已撤回。'); },
    onApproveGuild: () => { const now = new Date(); changeSocial(current => approveGuildLocally(current, now), '已在当前设备模拟加入协会，不涉及真实成员。'); },
    onLeaveGuild: () => { const now = new Date(); changeSocial(current => leaveGuild(current, now), '已退出本地协会，个人贡献和每日记录会保留。'); },
    onCheckIn: () => { const now = new Date(); changeSocial(current => checkInGuild(current, now), '今日协会签到已完成，金币与贡献已入账。'); },
    onDonate: () => { const now = new Date(); changeSocial(current => donateToGuild(current, now), '本地捐献完成，金币已扣除，贡献 +30。'); },
    onDraft: (thread, text) => setSave(current => writeChatDraft(current, thread, text)),
    onSend: (thread, text) => {
      const id = crypto.randomUUID?.() || `message-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
      const now = new Date();
      if (sendLocalMessage(save, thread, text, id, now) === save) return false;
      setSave(current => sendLocalMessage(current, thread, text, id, now));
      return true;
    },
    onClear: thread => changeSocial(current => clearLocalMessages(current, thread), '本会话中的本地发言已清空，其他会话不变。'),
  };

  let dialogContent: ReactNode = null;
  if (dialog === 'servers') dialogContent = <ServerPanel save={save} onSelect={number => { setSave(current => ({ ...current, server: number })); setDialog(null); notify(`已进入食灵 ${number} 服，新的冒险即将开启。`); }} />;
  if (dialog === 'notice') dialogContent = <NoticePanel />;
  if (dialog === 'create') dialogContent = <CreatePanel profile={save.profile} onCreate={create} />;
  if (dialog === 'guide') dialogContent = <GuidePanel name={save.profile?.name || '命运之子'} onFinish={() => finishGuide(true)} onSkip={() => finishGuide()} />;
  if (dialog && offers.includes(dialog as OfferName)) dialogContent = <Offers key={dialog} offer={dialog as OfferName} save={save} onNavigate={open} onPurchase={purchase} onClaimDaily={claimDaily} onClaimSeven={claimSeven} onClaimFirst={claimFirst} onClaimExtra={claimExtra} onCreate={() => open('create')} />;
  if (dialog === 'settings') dialogContent = <SettingsPanel preferences={preferences} setPreferences={setPreferences} />;
  if (dialog === 'ranking') dialogContent = <RankingPanel save={save} />;
  if (dialog === 'preview') dialogContent = <PreviewPanel onSelect={view} />;
  if (dialog === 'policy') dialogContent = <PolicyPanel type={policyType} />;
  if (dialog === 'collection') dialogContent = <CollectionPanel save={save} />;
  if (dialog === 'summon') dialogContent = <SummonPanel save={save} onSummon={summon} onCreate={() => open('create')} />;
  if (dialog === 'bag') dialogContent = <BagPanel save={save} actions={equipmentActions} location={bagLocation} onHero={() => open('hero')} onBattle={() => open('battle')} />;
  if (dialog === 'account') dialogContent = <AccountPanel save={save} identity={(() => { const snapshot = readIdentitySnapshot(); return snapshot ? { accountId: snapshot.accountId, nickname: snapshot.nickname } : null; })()} onEdit={() => open('create')} onLogout={() => { setScreen('login'); setDialog(null); }} onReset={() => { setSave(createFreshSave()); setBattleId(null); setReplayMode(false); setScreen('login'); setDialog(null); setAgreed(false); notify('本地演示进度已重置。'); }} onRegisterPassword={registerPasswordHandler} onLogin={loginHandler} />;
  if (dialog === 'chat') dialogContent = <ChatPanel save={save} actions={socialActions} location={chatLocation} onFriends={() => open('friend')} onGuild={() => open('guild')} onCreate={() => open('create')} />;
  if (dialog === 'mail') dialogContent = <MailPanel save={save} onClaim={claimMail} />;
  if (dialog === 'quest') dialogContent = <QuestPanel save={save} onClaim={claimQuest} />;
  if (dialog === 'record') dialogContent = <RecordPanel save={save} onReplay={replayBattle} onStart={() => open('battle')} onResume={resumeBattle} />;
  if (dialog === 'friend') dialogContent = <FriendPanel save={save} actions={socialActions} onChat={id => goToChat({ channel: 'whisper', contactId: id })} onCreate={() => open('create')} />;
  if (dialog === 'hero') dialogContent = <HeroPanel save={save} actions={equipmentActions} onAscend={() => open('ascend')} onBag={goToBag} />;
  if (dialog && isEstateDialog(dialog)) dialogContent = <EstatePanel save={save} facility={dialog === 'manor' ? 'workshop' : dialog} actions={estateActions} onPick={id => setDialog(id)} />;
  if (dialog === 'activity') dialogContent = <ActivityCenterPanel save={save} actions={estateActions} />;
  if (dialog === 'trade') dialogContent = <TradePanel save={save} onTrade={trade} />;
  if (dialog === 'chronicle') dialogContent = <ChroniclePanel save={save} onClaim={claimChronicle} onGoBattle={() => setDialog('battle')} />;
  if (dialog === 'shop') dialogContent = <ShopPanel save={save} onBuy={buyPack} />;
  if (dialog === 'ascend') dialogContent = <AscendPanel save={save} onAscend={ascend} />;
  if (dialog === 'events') dialogContent = <LaunchEventsPanel save={save} onOpen={next => setDialog(next)} />;
  if (dialog === 'guild') dialogContent = <GuildPanel key={save.social.guildId || 'discovery'} save={save} actions={socialActions} onChat={() => goToChat({ channel: 'guild' })} onFriends={() => open('friend')} onCreate={() => open('create')} />;
  if (dialog === 'battle') dialogContent = <BattlePanel save={save} onStart={startBattle} onResume={resumeBattle} onHistory={() => open('record')} onAscend={() => open('ascend')} onCreate={() => open('create')} onBuyPass={() => void buyPass()} />;
  if (dialog === 'combat' && selectedBattle) dialogContent = <CombatPanel key={`${selectedBattle.id}-${replayMode}`} record={selectedBattle} replay={replayMode} onResult={() => open('battle-result')} onExit={close} />;
  if (dialog === 'battle-result' && selectedBattle) dialogContent = <ResultPanel record={selectedBattle} replay={replayMode} onClaim={claimBattle} onReplay={() => { setReplayMode(selectedBattle.status !== 'pending'); open('combat'); }} onContinue={() => open(replayMode ? 'record' : 'battle')} onAscend={() => open('ascend')} />;
  if (dialog === 'purchase' && pendingPurchase) dialogContent = <div className="purchase-panel"><ShieldCheck className="purchase-shield" size={40} /><h3>这不是一次真实支付</h3><p>你将为「{pendingPurchase.label}」增加 <strong>¥ {pendingPurchase.price}</strong> 的本地演示额度。无需填写任何支付信息，不会扣款。</p>{pendingPurchase.rewards.length > 0 && <Rewards items={pendingPurchase.rewards} small />}<div className="purchase-actions"><button className="outline-button" onClick={close}>返回</button><GoldButton onClick={confirmPurchase}>确认模拟充值 ¥ {pendingPurchase.price}</GoldButton></div><p className="panel-note centered">仅用于体验界面与领取流程</p></div>;

  const badgeMap = badges(save);
  const isOffer = !!dialog && offers.includes(dialog as OfferName);
  const isBattleSurface = dialog === 'battle' || dialog === 'combat' || dialog === 'battle-result';
  return <div className={`game-app ${screen === 'login' ? 'login-screen' : 'lobby-screen'}`} data-theme={preferences.theme}>
    <div className={`scene-background ${screen === 'login' ? 'login-art' : 'lobby-art'}`} key={screen} aria-hidden="true" data-art>
      {screen === 'login' ? <picture><source media="(max-width: 700px)" srcSet={artwork.mobile} /><img src={artwork.login} alt="" fetchPriority="high" decoding="async" onError={onArtworkError} /></picture> : <img src={artwork.lobby} alt="" decoding="async" onError={onArtworkError} />}
      <div className="scene-shade" />
    </div>
    <div className="screen-border" aria-hidden="true"><i /><i /><i /><i /></div>
    {preferences.particles && <Particles />}

    {screen === 'login' ? <>
      <header className="login-header"><div className="header-identity"><button className="age-mark" aria-label="16岁以上适龄提示" onClick={() => showPolicy('terms')}><strong>16<span>+</span></strong><span>适龄提示</span></button><span className="identity-divider" /><span className="platform-label"><Sigil />灵界幻想<span>微信小游戏</span></span></div>
        <nav className="header-actions" aria-label="游戏工具"><NavAction icon={<Megaphone size={18} />} label="公告" onClick={() => open('notice')} /><NavAction icon={<Trophy size={18} />} label="排行榜" onClick={() => open('ranking')} /><NavAction icon={<Settings2 size={18} />} label="设置" onClick={() => open('settings')} /></nav>
      </header>

      <main className="login-main"><div className="brand-composition"><div className="brand-crest"><span /><Sigil /><span /></div><p className="brand-english">CITY OF FOOD SPIRITS</p><h1>食灵<span>月城</span></h1><Ornament className="brand-ornament" /><p className="brand-tagline">万千滋味，皆有灵魂</p><p className="brand-description">与命定食灵相遇，开启你的异世界冒险。</p>
        <div className="login-controls"><button className="realm-select" onClick={() => open('servers')} aria-label={`选择服务器，当前食灵${save.server}服`}><span className="realm-indicator"><i className="status-dot online" />推荐</span><strong>食灵 {save.server} 服</strong><span className="realm-change">选择服务器<ChevronRight size={15} /></span></button><GoldButton className="start-button" onClick={start}><span className="start-copy">开始游戏<small>BEGIN YOUR JOURNEY</small></span><ArrowRight className="start-arrow" size={21} strokeWidth={1.2} /></GoldButton><button className="account-link" onClick={() => open('account')}><UserRound size={13} />{save.profile ? `${save.profile.name} · 旅者账户` : '旅者账户'}<ChevronRight size={12} /></button></div>
      </div></main>

      <footer className="login-footer"><div className="footer-main"><button className="preview-link" onClick={() => open('preview')}><Grid2X2 size={14} /><span>界面预览</span><span className="preview-count">{previewScreens.length + featureScreens.length}</span></button><div className="consent-area"><div className={`consent-row ${agreementError ? 'invalid' : ''}`}><input ref={consentRef} id="agreement" type="checkbox" checked={agreed} onChange={event => { setAgreed(event.target.checked); setAgreementError(false); }} /><label htmlFor="agreement">我已阅读并同意</label><button onClick={() => showPolicy('terms')}>《用户协议》</button><span>和</span><button onClick={() => showPolicy('privacy')}>《隐私保护指引》</button></div>{agreementError && <p className="agreement-error" role="alert">请先阅读并同意用户协议和隐私保护指引。</p>}</div><button className="music-control" onClick={() => setPreferences(p => ({ ...p, music: !p.music }))} aria-label={preferences.music ? '关闭背景音乐' : '开启背景音乐'}>{preferences.music ? <Music2 size={15} /> : <VolumeX size={15} />}<span>{preferences.music ? '音乐已开启' : '音乐已关闭'}</span><span className="sound-bars"><i /><i /><i /><i /></span></button></div><div className="footer-rule" /><div className="footer-bottom"><p>抵制不良游戏 · 拒绝盗版游戏 · 注意自我保护 · 合理安排时间 · 享受健康生活</p><span>UI DEMO 1.0 <i />仅供界面体验</span></div></footer>
    </> : <>
      <header className="lobby-header"><button className="traveler-profile" onClick={() => open('account')}><span className="avatar-frame"><img src={artwork.lobby} alt="" onError={onArtworkError} /></span><span><small>LEVEL 01</small><strong>{save.profile?.name || '命运之子'}</strong><em>食灵 {save.server} 服</em></span></button><div className="resource-bar"><button onClick={() => open('bag')}><ItemArt kind="coin" /><span>{compactNumber(save.coins)}</span></button><button onClick={() => open('shop')} aria-label="打开灵晶商城"><ItemArt kind="gem" /><span>{compactNumber(save.gems)}</span><Plus size={14} /></button><button onClick={() => open('summon')}><ItemArt kind="book" /><span>{save.books}</span><Plus size={14} /></button></div><div className="lobby-top-actions"><button aria-label="界面预览" onClick={() => open('preview')}><Grid2X2 size={19} /></button><button aria-label="设置" onClick={() => open('settings')}><Settings2 size={19} /></button><button aria-label="返回启动页" onClick={() => { setScreen('login'); setDialog(null); }}><LogOut size={19} /></button></div></header>
      <div className="lobby-marquee" aria-label="灵界公告"><div>{marqueeLines.concat(marqueeLines).map((line, index) => <span key={index}>{line}</span>)}</div></div>
      <main className="lobby-main"><div className="location-title"><p className="eyebrow">THE VERDANT SANCTUARY</p><h1>翡翠茶庭</h1><Ornament /><span>一盏清茶，静候故人。</span></div>
        <nav className="lobby-left-actions" aria-label="主城功能">{visibleFeatures(lobbyLeftRail).map(item => <NavAction key={item.id} icon={railIcons[item.id]} label={item.label} onClick={() => open(item.id as DialogName)} badge={badgeMap[item.id as keyof typeof badgeMap] as number | undefined} />)}<NavAction icon={<Megaphone />} label="公告" onClick={() => open('notice')} /><NavAction icon={<CircleHelp />} label="指引" onClick={() => open('guide')} /></nav>
        <nav className="activity-menu" aria-label="活动与礼遇"><p className="activity-offer"><Clock3 size={12} /> 限时特惠 <strong><MidnightCountdown /></strong></p><button className="activity-feature" onClick={() => open('seven')}><span className="activity-emblem"><Gift size={25} /></span><span><small>与你相伴的每一天</small><strong>七日之约</strong><span className="feature-countdown">剩余 <SevenDayCountdown createdAt={save.profile?.createdAt} /></span></span><ChevronRight size={16} /></button><div className="activity-options">{visibleFeatures(activityOptions).map(item => <button key={item.id} className="activity-cell" onClick={() => open(item.id)}><span className="activity-cell-icon">{item.icon}<BadgeDot count={badgeMap[item.id as keyof typeof badgeMap] as number | undefined} /></span><strong>{item.name}</strong></button>)}</div><div className="activity-rail" aria-label="庄园与功能入口">{visibleFeatures(lobbyRightRail).map(item => <button key={item.id} onClick={() => open(item.id as DialogName)}><span className="activity-rail-icon">{railIcons[item.id]}<BadgeDot count={badgeMap[item.id as keyof typeof badgeMap] as number | undefined} /></span>{item.label}</button>)}</div></nav>
        <div className="lobby-character-caption"><span>QING TUAN</span><h2>青团</h2><p><Leaf size={13} /> 春山的来信</p></div>
        <button className="quest-strip" onClick={() => open(save.characters.length > 1 ? 'collection' : 'summon')}><span><Compass size={22} /></span><span><small>旅途的第一章</small><strong>{save.characters.length > 1 ? '新的伙伴，新的故事' : '与第一位伙伴相遇'}</strong><em>{save.characters.length > 1 ? '前往食灵图鉴了解你的伙伴' : '前往召唤之门，缔结食灵契约'}</em></span><ArrowRight size={18} /></button>
      </main>
      <footer className="lobby-footer"><nav aria-label="主导航">{visibleFeatures(lobbyBottomNav).map(item => item.id === 'lobby'
        ? <button key={item.id} className={dialog ? undefined : 'active'} aria-current={dialog ? undefined : 'page'} onClick={() => setDialog(null)}><Home /><span>{item.label}</span></button>
        : <button key={item.id} aria-current={dialog === item.id ? 'page' : undefined} className={dialog === item.id ? 'active' : undefined} onClick={() => open(item.id as DialogName)}>{item.id === 'battle' ? <Swords /> : railIcons[item.id]}<span>{item.label}</span></button>)}</nav><span className="lobby-demo-note">本地演示 · 无真实支付</span></footer>
    </>}

    {dialog && <Dialog key={dialog} title={dialog === 'policy' ? policyType === 'terms' ? '游戏用户协议' : '隐私保护指引' : titles[dialog]} subtitle={subtitles[dialog]} onClose={close} bare={isOffer || isBattleSurface || dialog === 'hero' || dialog === 'create' || dialog === 'guide'} className={`${isOffer ? 'offer-dialog' : `${dialog}-dialog`}`}>{dialogContent}</Dialog>}
    {toast && <div className="toast" role="status"><Check size={17} /><span>{toast}</span><button aria-label="关闭提示" onClick={() => setToast('')}>×</button></div>}
    {storageError && <div className="storage-warning" role="status">浏览器未允许本地存储，关闭页面后进度可能丢失。</div>}
  </div>;
}