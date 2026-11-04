/* =============================================================================
 * 领域类型：数据库行结构 + 对外 DTO
 * DTO 的字段命名刻意与前端 src/game-data.ts 的 GameSave 保持一致，
 * 这样后端可以直接作为前端本地存档的替代数据源，无需改一层字段映射。
 * ============================================================================= */

export const CURRENCIES = ['coin', 'gem', 'book', 'leaf', 'potion', 'chest', 'medal'] as const;
export type Currency = (typeof CURRENCIES)[number];

/** 货币标识 → player_resources 列名 */
export const RESOURCE_COLUMN: Record<Currency, string> = {
  coin: 'coins',
  gem: 'gems',
  book: 'books',
  leaf: 'leaves',
  potion: 'potions',
  chest: 'chests',
  medal: 'medals',
};

export const CURRENCY_LABEL: Record<Currency, string> = {
  coin: '金币',
  gem: '灵晶',
  book: '食灵契约',
  leaf: '食灵精华',
  // v17 数值正名（设计 §2.4）：potion 实为升星/突破材料，不再是「经验」语义
  potion: '灵味原浆',
  chest: '宝箱',
  medal: '徽章',
};

export type Balances = Record<Currency, number>;

export type Reward = {
  /** v17：'exp' = 掌灶人经验（非交易货币，走 player_progress.exp，不走 resource_ledger） */
  kind: Currency | 'character' | 'item' | 'exp';
  amount: number;
  label: string;
  image?: string;
  /** kind = 'item' 时必填：item_defs.id */
  itemId?: string;
};

/* ------------------------------ 数据库行 ------------------------------ */

export type PlayerRow = {
  id: string;
  nickname: string;
  gender: 'male' | 'female';
  server: number;
  worldtree_level: number;
  created_at: string;
  updated_at: string;
};

export type SessionRow = {
  id: string;
  player_id: string;
  token_hash: string;
  issued_at: string;
  expires_at: string;
  revoked_at: string | null;
};

export type ResourceRow = Record<(typeof RESOURCE_COLUMN)[Currency], number> & {
  player_id: string;
  updated_at: string;
};

export type ProgressRow = {
  player_id: string;
  battle_wins: number;
  /** v17：掌灶人经验余额（服务端权威；战斗/任务/挂机入账，世界树升级消费） */
  exp: number;
  crafted: number;
  packs_opened: number;
  chronicle_points: number;
  guide_completed: number;
  extra_claimed: number;
  fund_purchased: number;
  starter_equipment_claimed: number;
  equipment_chests_opened: number;
  first_purchased_at: string | null;
  idle_claim_at: string | null;
  first_claimed_json: string;
  seven_claimed_json: string;
  bp_claimed_json: string;
  fund_claimed_json: string;
  chronicle_claimed_json: string;
  chest_operations_json: string;
  last_chest_opening_json: string | null;
  updated_at: string;
};

export type DailyStateRow = {
  player_id: string;
  day_key: string;
  daily_paid: number;
  claimed_tiers_json: string;
  summons: number;
  login_rewards: number;
};

/** v15：经验表——等级 → 升级所需/累计经验（满级 exp_required = 0 封顶标记）。 */
export type LevelExpDefRow = {
  level: number;
  exp_required: number;
  exp_total: number;
};

/** v15：等级表——等级 → 属性成长数据（growth_bp 万分比系数；暴击/抗性为加法增量）。 */
export type LevelStatsDefRow = {
  level: number;
  growth_bp: number;
  crit_add: number;
  res_add: number;
};

/** v15：职业表——五大职业的基础（1 级）属性与特性。 */
export type ClassDefRow = {
  id: string;
  name: string;
  detail: string;
  trait: string;
  health: number;
  attack: number;
  defense: number;
  speed: number;
  critical: number;
  resistance: number;
};

export type CharacterDefRow = {
  id: string;
  name: string;
  title: string;
  element: string;
  rarity: 'R' | 'SR' | 'SSR';
  role: string;
  detail: string;
  portrait: string;
  base_power: number;
};

export type PlayerCharacterRow = {
  player_id: string;
  character_id: string;
  star: number;
  level: number;
  unlocked_at: string;
};

export type EquipmentDefRow = {
  id: string;
  name: string;
  slot: 'weapon' | 'crown' | 'armor' | 'charm' | 'relic' | 'crest';
  rarity: 'rare' | 'epic' | 'legendary';
  story: string;
  health: number;
  attack: number;
  defense: number;
  speed: number;
  critical: number;
  resistance: number;
  /** v15：穿戴等级需求（1..100，外键指向 level_exp_defs.level） */
  required_level: number;
};

export type PlayerEquipmentRow = {
  id: string;
  player_id: string;
  template_id: string;
  level: number;
  equipped_slot: EquipmentDefRow['slot'] | null;
  /** v20 §4.3：副属性（至多 1 条，key ∈ 池），未洗练为 NULL */
  substat_key: 'critical' | 'resistance' | 'speed' | 'health' | null;
  substat_value: number | null;
  /** 累计洗练次数（决定洗练成本） */
  wash_count: number;
  obtained_at: string;
};

export type StageDefRow = {
  id: string;
  chapter: string;
  name: string;
  order_index: number;
  suggested_power: number;
  scene_id?: string | null;
  /** v21：所属副本（dungeon_defs.id）；种子为全部关卡写值，NULL 仅作历史兜底 */
  dungeon_id?: string | null;
  reward_json: string;
};

/* ------------------------------ v21：副本定义 / 功能活动开关 ------------------------------ */

export type DungeonDefRow = {
  id: string;
  name: string;
  english: string;
  description: string;
  order_index: number;
  unlock_level: number;
  unlock_open_day: number;
};

export type FeatureToggleRow = {
  key: string;
  name: string;
  category: 'feature' | 'activity' | 'system';
  enabled: number;
  open_day: number | null;
  close_day: number | null;
  sort_index: number;
  detail: string;
};

export type BattleRow = {
  id: string;
  player_id: string;
  stage_id: string;
  seed: number;
  status: 'pending' | 'claimed' | 'lost';
  win: number | null;
  rounds: number;
  power: number;
  enemy_power: number;
  first_clear: number;
  units_json: string;
  started_at: string;
  settled_at: string | null;
};

export type BattleTurnRow = {
  battle_id: string;
  round: number;
  seq: number;
  actor_id: string;
  target_id: string;
  kind: 'attack' | 'skill' | 'heal';
  skill: string;
  amount: number;
  critical: number;
  health_json: string;
};

export type QuestDefRow = {
  id: string;
  group_name: string;
  name: string;
  detail: string;
  target: number;
  metric: string;
  /** v14：metric 上下文引用（stage_clear 存关卡 id；其余 metric 为 NULL） */
  ref_id: string | null;
  reward_json: string;
  sort_index: number;
};

export type MailDefRow = {
  id: string;
  sender: string;
  title: string;
  excerpt: string;
  time_label: string;
  reward_json: string;
  sort_index: number;
};

export type ShopPackRow = {
  id: string;
  name: string;
  price: number;
  gems: number;
  books: number;
  label: string;
  note: string;
  daily_limit: number;
  sort_index: number;
};

export type TradeRateRow = {
  id: string;
  give_currency: Currency;
  give_amount: number;
  get_currency: Currency;
  get_amount: number;
  daily_limit: number;
  sort_index: number;
};

export type MarketOfferRow = {
  id: string;
  currency: Currency;
  amount: number;
  price: number;
  label: string;
  sort_index: number;
};

export type AstrologyNodeRow = {
  id: string;
  name: string;
  gem_cost: number;
  order_index: number;
};

export type GuildRow = {
  id: string;
  name: string;
  english: string;
  level: number;
  capacity: number;
  motto: string;
  notice: string;
  created_at: string;
};

/* ------------------------------ 数据库行（v7–v13 新增） ------------------------------ */

export type VfxDefRow = {
  id: string;
  name: string;
  type: 'hit' | 'skill' | 'buff' | 'ui';
  asset_path: string;
  duration_ms: number;
  sort_index: number;
  updated_at: string;
};

export type SkillDefRow = {
  id: string;
  name: string;
  kind: 'attack' | 'heal' | 'buff' | 'debuff';
  target_type: 'self' | 'ally' | 'ally_all' | 'enemy' | 'enemy_all';
  coefficient_bp: number;
  cooldown: number;
  vfx_id: string | null;
  detail: string;
  updated_at: string;
};

export type EnemyDefRow = {
  id: string;
  name: string;
  kind: 'normal' | 'elite' | 'boss';
  element: string;
  power: number;
  health: number;
  attack: number;
  defense: number;
  speed: number;
  skill_ids: string;
  vfx_id: string | null;
  drop_json: string;
  phase_json: string | null;
  portrait: string;
  updated_at: string;
};

export type CatalogMetaRow = {
  domain: string;
  version: number;
  updated_at: string;
};

export type SceneDefRow = {
  id: string;
  name: string;
  type: 'battle' | 'idle' | 'guild' | 'manor' | 'activity';
  background: string;
  music: string;
  unlock_worldtree_level: number;
  order_index: number;
  updated_at: string;
};

export type ItemDefRow = {
  id: string;
  name: string;
  type: 'material' | 'consumable' | 'chest' | 'fragment' | 'gift';
  rarity: 'common' | 'rare' | 'epic' | 'legendary';
  stackable: number;
  max_stack: number;
  effect_json: string;
  value: number;
  icon: string;
  detail: string;
  updated_at: string;
};

export type PlayerItemRow = {
  id: string;
  player_id: string;
  item_id: string;
  quantity: number;
  stackable: number;
  obtained_at: string;
  updated_at: string;
};

export type ActivityDefRow = {
  id: string;
  name: string;
  type: 'login' | 'charge' | 'collect' | 'period';
  start_at: string;
  end_at: string;
  config_json: string;
  reward_json: string;
  sort_index: number;
  updated_at: string;
};

export type PlayerActivityProgressRow = {
  player_id: string;
  activity_id: string;
  progress: number;
  claimed_json: string;
  updated_at: string;
};

export type GmAccountRow = {
  id: string;
  username: string;
  password_hash: string;
  role: 'super' | 'ops' | 'support' | 'readonly';
  status: 'active' | 'disabled';
  created_at: string;
  last_login_at: string | null;
};

export type GmAuditLogRow = {
  id: string;
  gm_id: string;
  action: 'login' | 'send_mail' | 'send_compensation' | 'grant_resource' | 'ban' | 'unban' | 'kick' | 'edit_config';
  target_type: 'player' | 'guild' | 'config' | 'system';
  target_id: string | null;
  payload_json: string;
  result: 'ok' | 'failed' | 'denied';
  ip: string;
  created_at: string;
};

export type GmPlayerBanRow = {
  id: string;
  player_id: string;
  reason: string;
  banned_by: string;
  banned_at: string;
  expires_at: string | null;
  lifted_at: string | null;
  active: number;
};

export type PlayerSystemMailRow = {
  id: string;
  player_id: string;
  template_id: string | null;
  title: string;
  body: string;
  attachments_json: string;
  source: 'system' | 'gm' | 'compensation';
  created_by: string | null;
  expire_at: string | null;
  read_at: string | null;
  claimed_at: string | null;
  created_at: string;
};

export type LeaderboardDefRow = {
  id: string;
  name: string;
  metric: 'battle_wins' | 'power' | 'worldtree_level' | 'chronicle_points';
  period: 'all' | 'season' | 'daily';
  season_key: string | null;
  capacity: number;
  updated_at: string;
};

export type LeaderboardEntryRow = {
  leaderboard_id: string;
  player_id: string;
  score: number;
  updated_at: string;
};

export type LeaderboardSnapshotRow = {
  id: string;
  leaderboard_id: string;
  season_key: string;
  player_id: string;
  rank: number;
  score: number;
  rewarded: number;
  snapshot_at: string;
};

export type OpLogRow = {
  id: string;
  player_id: string | null;
  action: string;
  detail_json: string;
  ip: string;
  created_at: string;
};

export type SecurityEvent =
  | 'login_fail'
  | 'csrf_fail'
  | 'signature_mismatch'
  | 'replay_blocked'
  | 'rate_limited'
  | 'save_rejected'
  | 'ban_hit';

export type SecurityLogRow = {
  id: string;
  player_id: string | null;
  event: SecurityEvent;
  detail_json: string;
  ip: string;
  created_at: string;
};

/* ------------------------------ 对外 DTO ------------------------------ */

export type SaveProfile = { name: string; gender: 'male' | 'female'; createdAt: string };

export type EquipmentInstanceDto = {
  id: string;
  templateId: string;
  level: number;
  acquiredAt: string;
  /** v20 §4.3：副属性（至多 1 条），未洗练为 null */
  substat: { key: 'critical' | 'resistance' | 'speed' | 'health'; value: number } | null;
  /** 累计洗练次数 */
  washCount: number;
};

export type BattleUnitDto = {
  id: string;
  name: string;
  side: 'ally' | 'enemy';
  character: string | null;
  star: number;
  maxHp: number;
  attack: number;
  speed: number;
  defense: number;
  critical: number;
  resistance: number;
};

export type BattleTurnDto = {
  round: number;
  actor: string;
  target: string;
  kind: 'attack' | 'skill' | 'heal';
  skill: string;
  amount: number;
  critical: boolean;
  health: Record<string, number>;
};

export type BattleDto = {
  version: 1;
  id: string;
  seed: number;
  stageId: string;
  stageName: string;
  chapter: string;
  startedAt: string;
  settledAt: string | null;
  power: number;
  enemyPower: number;
  units: BattleUnitDto[];
  turns: BattleTurnDto[];
  win: boolean;
  rounds: number;
  firstClear: boolean;
  rewards: Reward[];
  status: 'pending' | 'claimed' | 'lost';
};

export type SocialSaveDto = {
  friends: string[];
  incomingRequests: string[];
  sentRequests: string[];
  messages: Array<{ id: string; thread: string; text: string; createdAt: string }>;
  drafts: Record<string, string>;
  guildId: string | null;
  guildApplication: string | null;
  guildJoinedAt: string | null;
  guildCheckInDate: string | null;
  guildDonationDate: string | null;
  contribution: number;
  guildEvents: Array<{ id: string; guildId: string; type: string; createdAt: string }>;
  guildEventSequence: number;
};

/** 与前端 GameSave 同构的存档视图 */
export type GameSaveDto = {
  profile: SaveProfile | null;
  server: number;
  coins: number;
  gems: number;
  books: number;
  leaves: number;
  potions: number;
  chests: number;
  medals: number;
  /** v17：掌灶人经验余额（服务端权威，世界树升级的消耗资源） */
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
  battleCharges: {
    dayKey: string;
    used: number;
    purchased: number;
    freeLimit: number;
    totalLimit: number;
    remaining: number;
    canBuy: boolean;
  };
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
  pendingBattle: BattleDto | null;
  battleHistory: BattleDto[];
  firstClears: string[];
  chronicleDate: string;
  dailySummons: number;
  dailyLoginRewards: number;
  equipment: EquipmentInstanceDto[];
  equipped: Partial<Record<EquipmentDefRow['slot'], string>>;
  starterEquipmentClaimed: boolean;
  equipmentChestsOpened: number;
  chestOperations: string[];
  lastChestOpening: null | { id: string; equipmentIds: string[]; openedAt: string; count: number };
  social: SocialSaveDto;
};

export function parseJsonArray<T>(raw: string | null | undefined): T[] {
  if (!raw) return [];
  try {
    const value: unknown = JSON.parse(raw);
    return Array.isArray(value) ? (value as T[]) : [];
  } catch {
    return [];
  }
}

export function parseJsonObject<T>(raw: string | null | undefined): T | null {
  if (!raw) return null;
  try {
    const value: unknown = JSON.parse(raw);
    return value && typeof value === 'object' ? (value as T) : null;
  } catch {
    return null;
  }
}
