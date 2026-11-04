import { dayKey } from '../lib/clock.js';
import { listAstrology, listFormation, listOwnedCharacters, listPlayerEquipment } from '../repositories/roster.repository.js';
import { findStageById, listQuests } from '../repositories/catalog.repository.js';
import { listBattles, listBattleTurns, listFirstClears, ensureBattleCharge } from '../repositories/battle.repository.js';
import { computeBattleCharges } from '../domain/battle-charges.js';
import { listMarketPurchases, listShopPurchases, listTradeUsage } from '../repositories/economy.repository.js';
import { listMailStates, listQuestClaims } from '../repositories/reward.repository.js';
import { ensureDailyState, getBalances, getProgress, requirePlayer } from '../repositories/player.repository.js';
import { findMembership, listFriendships, listIncomingRequests, listPlayerMessages } from '../repositories/social.repository.js';
import {
  parseJsonArray,
  parseJsonObject,
  type BattleDto,
  type BattleRow,
  type BattleTurnDto,
  type BattleUnitDto,
  type GameSaveDto,
  type Reward,
} from '../domain/types.js';

const DAILY_GROUP = '日常';

function toBattleDto(row: BattleRow, stage: { name: string; chapter: string; reward_json: string } | undefined): BattleDto {
  const turns = listBattleTurns(row.id).map<BattleTurnDto>(turn => ({
    round: turn.round,
    actor: turn.actor_id,
    target: turn.target_id,
    kind: turn.kind,
    skill: turn.skill,
    amount: turn.amount,
    critical: turn.critical === 1,
    health: parseJsonObject<Record<string, number>>(turn.health_json) ?? {},
  }));

  return {
    version: 1,
    id: row.id,
    seed: row.seed,
    stageId: row.stage_id,
    stageName: stage?.name ?? row.stage_id,
    chapter: stage?.chapter ?? '',
    startedAt: row.started_at,
    settledAt: row.settled_at,
    power: row.power,
    enemyPower: row.enemy_power,
    units: parseJsonArray<BattleUnitDto>(row.units_json),
    turns,
    win: row.win === 1,
    rounds: row.rounds,
    firstClear: row.first_clear === 1,
    rewards: parseJsonArray<Reward>(stage?.reward_json),
    status: row.status,
  };
}

/**
 * 聚合玩家完整存档视图。
 * 单一入口：所有接口在写操作后都返回同一份 save，保证客户端状态与库内一致。
 */
export function buildSave(playerId: string): GameSaveDto {
  const player = requirePlayer(playerId);
  const today = dayKey();
  const balances = getBalances(playerId);
  const progress = getProgress(playerId);
  const daily = ensureDailyState(playerId, today);

  const owned = listOwnedCharacters(playerId);
  const formation = listFormation(playerId);
  const equipment = listPlayerEquipment(playerId);
  const astrology = listAstrology(playerId);
  const claims = listQuestClaims(playerId);
  const mailStates = listMailStates(playerId);
  const tradeUsage = listTradeUsage(playerId, today);
  const marketBought = listMarketPurchases(playerId, today);
  const shopBought = listShopPurchases(playerId);
  const memberships = findMembership(playerId);
  const friends = listFriendships(playerId);
  const incoming = listIncomingRequests(playerId);

  const dailyQuestIds = new Set(listQuests().filter(quest => quest.group_name === DAILY_GROUP).map(quest => quest.id));

  const battles = listBattles(playerId, 20);
  const history = battles
    .filter(battle => battle.status !== 'pending')
    .map(battle => toBattleDto(battle, findStageById(battle.stage_id)));
  const pendingRow = battles.find(battle => battle.status === 'pending');

  const equippedSlots: GameSaveDto['equipped'] = {};
  for (const item of equipment) {
    if (item.equipped_slot) equippedSlots[item.equipped_slot] = item.id;
  }

  const stars: Record<string, number> = {};
  for (const character of owned) stars[character.name] = character.star;

  return {
    profile: { name: player.nickname, gender: player.gender, createdAt: player.created_at },
    server: player.server,
    coins: balances.coin,
    gems: balances.gem,
    books: balances.book,
    leaves: balances.leaf,
    potions: balances.potion,
    chests: balances.chest,
    medals: balances.medal,
    expEarned: progress.exp,
    characters: owned.map(character => character.name),
    purchases: shopBought,
    firstPurchasedAt: progress.first_purchased_at,
    firstClaimed: parseJsonArray<number>(progress.first_claimed_json),
    sevenClaimed: parseJsonArray<number>(progress.seven_claimed_json),
    extraClaimed: progress.extra_claimed === 1,
    dailyDate: today,
    dailyPaid: daily.daily_paid,
    dailyClaimed: parseJsonArray<number>(daily.claimed_tiers_json),
    guideCompleted: progress.guide_completed === 1,
    claimedQuests: claims
      .filter(claim => !dailyQuestIds.has(claim.quest_id) || claim.day_key === today)
      .map(claim => claim.quest_id),
    claimedMail: mailStates.filter(state => state.claimed_at).map(state => state.mail_id),
    battleWins: progress.battle_wins,
    battleCharges: computeBattleCharges(ensureBattleCharge(playerId, today)),
    crafted: progress.crafted,
    idleClaimAt: progress.idle_claim_at,
    marketDate: today,
    marketBought,
    astrology: astrology.map(node => node.node_id),
    worldtree: player.worldtree_level,
    bpClaimed: parseJsonArray<number>(progress.bp_claimed_json),
    fundPurchased: progress.fund_purchased === 1,
    fundClaimed: parseJsonArray<string>(progress.fund_claimed_json),
    packsOpened: progress.packs_opened,
    chroniclePoints: progress.chronicle_points,
    chronicleClaimed: parseJsonArray<string>(progress.chronicle_claimed_json),
    tradeDate: today,
    tradeCounts: tradeUsage,
    stars,
    shopBought,
    formation: formation.map(slot => slot.name),
    pendingBattle: pendingRow ? toBattleDto(pendingRow, findStageById(pendingRow.stage_id)) : null,
    battleHistory: history,
    firstClears: listFirstClears(playerId),
    chronicleDate: today,
    dailySummons: daily.summons,
    dailyLoginRewards: daily.login_rewards,
    equipment: equipment.map(item => ({
      id: item.id,
      templateId: item.template_id,
      level: item.level,
      acquiredAt: item.obtained_at,
      // v20 §4.3：副属性与洗练次数随存档下发（前端展示/本地口径一致）
      substat: item.substat_key && item.substat_value
        ? { key: item.substat_key, value: Number(item.substat_value) }
        : null,
      washCount: Number(item.wash_count ?? 0),
    })),
    equipped: equippedSlots,
    starterEquipmentClaimed: progress.starter_equipment_claimed === 1,
    equipmentChestsOpened: progress.equipment_chests_opened,
    chestOperations: parseJsonArray<string>(progress.chest_operations_json),
    lastChestOpening: parseJsonObject<GameSaveDto['lastChestOpening']>(progress.last_chest_opening_json),
    social: {
      friends: friends.filter(row => row.status === 'accepted').map(row => row.friend_id),
      incomingRequests: incoming.map(row => row.player_id),
      sentRequests: friends.filter(row => row.status === 'pending').map(row => row.friend_id),
      messages: listPlayerMessages(playerId, 50).map(message => ({
        id: message.id,
        thread: message.channel === 'guild' ? `guild:${message.guild_id ?? ''}` : 'world',
        text: message.body,
        createdAt: message.created_at,
      })),
      drafts: {},
      guildId: memberships?.guild_id ?? null,
      guildApplication: null,
      guildJoinedAt: memberships?.joined_at ?? null,
      guildCheckInDate: memberships?.check_in_date ?? null,
      guildDonationDate: null,
      contribution: memberships?.contribution ?? 0,
      guildEvents: [],
      guildEventSequence: 0,
    },
  };
}

export { toBattleDto };
