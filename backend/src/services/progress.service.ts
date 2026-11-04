import { transaction, queryAll, queryOne } from '../db/index.js';
import { dayKey } from '../lib/clock.js';
import { conflict, notFound } from '../lib/errors.js';
import type { Reward } from '../domain/types.js';
import { parseJsonArray, type QuestDefRow } from '../domain/types.js';
import {
  ensureDailyState,
  getProgress,
  grantRewards,
  requirePlayer,
} from '../repositories/player.repository.js';
import { listOwnedCharacters } from '../repositories/roster.repository.js';
import { findMailById, findQuestById, listMails, listQuests } from '../repositories/catalog.repository.js';
import {
  findQuestClaim,
  insertQuestClaim,
  listMailStates,
  markMailClaimed,
} from '../repositories/reward.repository.js';

export type QuestView = {
  id: string;
  group: string;
  name: string;
  detail: string;
  target: number;
  progress: number;
  claimed: boolean;
  claimable: boolean;
  rewards: Reward[];
};

type QuestContext = {
  today: string;
  summons: number;
  claimedTiers: number;
  loginRewards: number;
  firstPurchasedAt: string | null;
  characterCount: number;
  worldtreeLevel: number;
  battleWins: number;
  packsOpened: number;
  /* ------- v14 主线任务链（P0）------- */
  /** 关卡胜场数：stage_id → 累计胜场 */
  stageClears: Record<string, number>;
  mailClaimed: number;
  formationCount: number;
  equipmentWorn: number;
  craftedTotal: number;
  friendCount: number;
  marketToday: number;
  astrologyCount: number;
  equipmentChests: number;
  idleClaimed: number;
  tradeToday: number;
  starsReached: number;
  loginDays: number;
  /** v18 §3.3②：今日战斗胜利（服务器本地日界，battles.settled_at 比较） */
  battleWinsToday: number;
};

function measure(quest: QuestDefRow, context: QuestContext): number {
  switch (quest.metric) {
    case 'daily_summons':
      return context.summons;
    case 'daily_claimed_tiers':
      return context.claimedTiers;
    case 'daily_login_rewards':
      return context.loginRewards;
    case 'first_purchase':
      return context.firstPurchasedAt ? 1 : 0;
    case 'character_count':
      return context.characterCount;
    case 'worldtree_level':
      return context.worldtreeLevel;
    case 'battle_wins':
      return context.battleWins;
    case 'contract_purchase':
      return context.packsOpened > 0 ? 1 : 0;
    /* ------- v14 主线任务链 ------- */
    case 'none':
      // 建号即完成（序章引导型任务，如 MQ-1-01）
      return quest.target;
    case 'stage_clear':
      return context.stageClears[quest.ref_id ?? ''] ?? 0;
    case 'mail_claimed':
      return context.mailClaimed;
    case 'formation_slots':
      return context.formationCount;
    case 'summons_total':
      // 累计召唤 = 累计开包数（滋味卡包），跨日累计而非当日
      return context.packsOpened;
    case 'equipment_worn':
      return context.equipmentWorn;
    case 'crafted_total':
      return context.craftedTotal;
    case 'friend_count':
      return context.friendCount;
    case 'market_today':
      return context.marketToday;
    case 'astrology_nodes':
      return context.astrologyCount;
    case 'equipment_chests':
      return context.equipmentChests;
    case 'idle_claimed':
      return context.idleClaimed;
    case 'trade_used':
      return context.tradeToday;
    case 'stars_reached':
      return context.starsReached;
    case 'login_days':
      return context.loginDays;
    case 'daily_battle_wins':
      // v18 §3.3②：每日任务「今日战斗胜利」——按服务器本地日界统计当日已结算胜场
      return context.battleWinsToday;
    default:
      return 0;
  }
}

function buildContext(playerId: string): QuestContext {
  const player = requirePlayer(playerId);
  const progress = getProgress(playerId);
  const daily = ensureDailyState(playerId, dayKey());

  const stageWins = queryAll<{ stage_id: string; total: number }>(
    'SELECT stage_id, COUNT(*) AS total FROM battles WHERE player_id = ? AND win = 1 GROUP BY stage_id',
    playerId,
  );
  const stageClears: Record<string, number> = {};
  for (const row of stageWins) stageClears[row.stage_id] = Number(row.total);

  const scalar = (sql: string, ...params: string[]): number => {
    const row = queryOne<{ total: number }>(sql, playerId, ...params);
    return row ? Number(row.total) : 0;
  };

  return {
    today: dayKey(),
    summons: Number(daily.summons),
    claimedTiers: parseJsonArray<number>(daily.claimed_tiers_json).length,
    loginRewards: Number(daily.login_rewards),
    firstPurchasedAt: progress.first_purchased_at,
    characterCount: listOwnedCharacters(playerId).length,
    worldtreeLevel: player.worldtree_level,
    battleWins: Number(progress.battle_wins),
    packsOpened: Number(progress.packs_opened),
    stageClears,
    mailClaimed: scalar("SELECT COUNT(*) AS total FROM player_mail WHERE player_id = ? AND claimed_at IS NOT NULL"),
    formationCount: scalar('SELECT COUNT(*) AS total FROM player_formation WHERE player_id = ?'),
    equipmentWorn: scalar('SELECT COUNT(*) AS total FROM player_equipment WHERE player_id = ? AND equipped_slot IS NOT NULL'),
    craftedTotal: Number(progress.crafted),
    friendCount: scalar("SELECT COUNT(*) AS total FROM friendships WHERE player_id = ? AND status = 'accepted'"),
    marketToday: scalar('SELECT COUNT(*) AS total FROM player_market_purchases WHERE player_id = ? AND day_key = ?', dayKey()),
    astrologyCount: scalar('SELECT COUNT(*) AS total FROM player_astrology WHERE player_id = ?'),
    equipmentChests: Number(progress.equipment_chests_opened),
    idleClaimed: progress.idle_claim_at ? 1 : 0,
    tradeToday: scalar('SELECT COALESCE(SUM(used), 0) AS total FROM player_trade_usage WHERE player_id = ? AND day_key = ?', dayKey()),
    starsReached: scalar('SELECT COUNT(*) AS total FROM player_characters WHERE player_id = ? AND star >= 3'),
    loginDays: scalar('SELECT COUNT(*) AS total FROM player_daily_state WHERE player_id = ?'),
    // settled_at 为 UTC ISO，与服务器本地日界的零点（按本地时区解析后转 UTC）比较
    battleWinsToday: scalar(
      'SELECT COUNT(*) AS total FROM battles WHERE player_id = ? AND win = 1 AND settled_at >= ?',
      new Date(`${dayKey()}T00:00:00`).toISOString(),
    ),
  };
}

/** 任务列表（含服务端计算的进度与可领取状态）。 */
export function listQuestsWithProgress(playerId: string): QuestView[] {
  const context = buildContext(playerId);

  return listQuests().map(quest => {
    const progress = Math.min(quest.target, measure(quest, context));
    const claim = findQuestClaim(playerId, quest.id);
    const daily = quest.group_name === '日常';
    const claimed = Boolean(claim) && (!daily || claim?.day_key === context.today);
    return {
      id: quest.id,
      group: quest.group_name,
      name: quest.name,
      detail: quest.detail,
      target: quest.target,
      progress,
      claimed,
      claimable: !claimed && progress >= quest.target,
      rewards: parseJsonArray<Reward>(quest.reward_json),
    };
  });
}

/** 领取任务奖励：进度由服务端计算，客户端无法伪造成已完成。 */
export function claimQuest(playerId: string, questId: string): { rewards: Reward[] } {
  return transaction(() => {
    const quest = findQuestById(questId);
    if (!quest) throw notFound('任务不存在');

    const isDaily = quest.group_name === '日常';
    const today = dayKey();
    const existing = findQuestClaim(playerId, questId);
    if (existing && (!isDaily || existing.day_key === today)) {
      throw conflict(isDaily ? '今日已领取过该任务奖励' : '该任务奖励已领取');
    }

    const context = buildContext(playerId);
    const progress = Math.min(quest.target, measure(quest, context));
    if (progress < quest.target) {
      throw conflict('任务尚未完成', { progress, target: quest.target });
    }

    const rewards = parseJsonArray<Reward>(quest.reward_json);
    grantRewards(playerId, rewards, 'quest.claim', quest.id);
    insertQuestClaim(playerId, questId, isDaily ? today : null);

    return { rewards };
  });
}

/* ------------------------------ 邮件 ------------------------------ */

export type MailView = {
  id: string;
  sender: string;
  title: string;
  excerpt: string;
  time: string;
  rewards: Reward[];
  read: boolean;
  claimed: boolean;
};

export function listMailbox(playerId: string): MailView[] {
  const states = new Map(listMailStates(playerId).map(state => [state.mail_id, state]));
  return listMails().map(mail => {
    const state = states.get(mail.id);
    return {
      id: mail.id,
      sender: mail.sender,
      title: mail.title,
      excerpt: mail.excerpt,
      time: mail.time_label,
      rewards: parseJsonArray<Reward>(mail.reward_json),
      read: Boolean(state?.read_at),
      claimed: Boolean(state?.claimed_at),
    };
  });
}

export function claimMail(playerId: string, mailId: string): { rewards: Reward[] } {
  return transaction(() => {
    const mail = findMailById(mailId);
    if (!mail) throw notFound('邮件不存在');

    const state = listMailStates(playerId).find(row => row.mail_id === mailId);
    if (state?.claimed_at) throw conflict('该邮件奖励已领取');

    const rewards = parseJsonArray<Reward>(mail.reward_json);
    grantRewards(playerId, rewards, 'mail.claim', mailId);
    markMailClaimed(playerId, mailId);

    return { rewards };
  });
}
