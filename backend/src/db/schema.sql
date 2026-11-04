-- =============================================================================
-- 食灵月城 · 后端数据库结构（SQLite 3.37+ / node:sqlite 内置驱动）
-- -----------------------------------------------------------------------------
-- 约定
--   1. 主键统一使用应用侧生成的 UUID 文本（见 src/lib/ids.ts），便于分库与幂等。
--   2. 时间统一存 ISO-8601 UTC 文本（如 2026-11-03T00:30:00.000Z），可直接排序比较。
--   3. 布尔统一用 INTEGER 0/1（SQLite 无布尔类型，驱动也不接受 JS boolean 绑定）。
--   4. 金额/资源全部为整数，禁止浮点，避免累计误差。
--   5. *_defs 为静态配置表（策划数据），由 seed 写入；player_* 为玩家动态数据。
--   6. 表结构由 schema_migrations 记录版本，migrate 幂等执行。
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 0. 迁移记录
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS schema_migrations (
  version    INTEGER PRIMARY KEY,
  name       TEXT NOT NULL,
  applied_at TEXT NOT NULL
);

-- -----------------------------------------------------------------------------
-- 1. 账号与会话
-- -----------------------------------------------------------------------------
-- v16 按服隔离：昵称唯一约束从全局改为「按服唯一」——同一昵称可在不同服各建一号。
-- 存量库由 v16 迁移重建（原全局 UNIQUE 严格于按服唯一，迁移不会因数据冲突失败）。
-- v17 数值核心：worldtree_level 上限 30 → 100（掌灶人等级=世界树语义合一，存量库由 v17 重建）。
-- v19 §2.5：等级域 100 → 150（100+ 无墙延伸，存量库由 v19 重建）。
CREATE TABLE IF NOT EXISTS players (
  id              TEXT PRIMARY KEY,
  nickname        TEXT NOT NULL,
  gender          TEXT NOT NULL CHECK (gender IN ('male', 'female')),
  server          INTEGER NOT NULL DEFAULT 17 CHECK (server BETWEEN 1 AND 99),
  worldtree_level INTEGER NOT NULL DEFAULT 1 CHECK (worldtree_level BETWEEN 1 AND 150),
  created_at      TEXT NOT NULL,
  updated_at      TEXT NOT NULL,
  UNIQUE (server, nickname)
);

-- 游客令牌：库中只保留 SHA-256 摘要，明文只在签发那一刻返回给客户端
CREATE TABLE IF NOT EXISTS player_sessions (
  id         TEXT PRIMARY KEY,
  player_id  TEXT NOT NULL REFERENCES players (id) ON DELETE CASCADE,
  token_hash TEXT NOT NULL UNIQUE,
  issued_at  TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  revoked_at TEXT
);
CREATE INDEX IF NOT EXISTS idx_player_sessions_player ON player_sessions (player_id);

-- -----------------------------------------------------------------------------
-- 2. 货币与资源
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS player_resources (
  player_id  TEXT PRIMARY KEY REFERENCES players (id) ON DELETE CASCADE,
  coins      INTEGER NOT NULL DEFAULT 0 CHECK (coins >= 0),
  gems       INTEGER NOT NULL DEFAULT 0 CHECK (gems >= 0),
  books      INTEGER NOT NULL DEFAULT 0 CHECK (books >= 0),
  leaves     INTEGER NOT NULL DEFAULT 0 CHECK (leaves >= 0),
  potions    INTEGER NOT NULL DEFAULT 0 CHECK (potions >= 0),
  chests     INTEGER NOT NULL DEFAULT 0 CHECK (chests >= 0),
  medals     INTEGER NOT NULL DEFAULT 0 CHECK (medals >= 0),
  updated_at TEXT NOT NULL
);

-- 资源流水：每一次增减都留痕，可用于对账与反作弊复盘
CREATE TABLE IF NOT EXISTS resource_ledger (
  id            TEXT PRIMARY KEY,
  player_id     TEXT NOT NULL REFERENCES players (id) ON DELETE CASCADE,
  currency      TEXT NOT NULL CHECK (currency IN ('coin', 'gem', 'book', 'leaf', 'potion', 'chest', 'medal')),
  delta         INTEGER NOT NULL,
  balance_after INTEGER NOT NULL CHECK (balance_after >= 0),
  reason        TEXT NOT NULL,
  ref_id        TEXT,
  created_at    TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_resource_ledger_player ON resource_ledger (player_id, created_at DESC);

-- -----------------------------------------------------------------------------
-- 3. 玩家进度（客户端展示型数据 + 累计计数）
--    JSON 列只承载"只读展示列表"，不参与服务端校验，故不做拆表。
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS player_progress (
  player_id                TEXT PRIMARY KEY REFERENCES players (id) ON DELETE CASCADE,
  battle_wins              INTEGER NOT NULL DEFAULT 0 CHECK (battle_wins >= 0),
  -- v17 数值核心：掌灶人经验余额（服务端权威货币，来源=战斗/任务/挂机；消费=世界树升级）
  exp                      INTEGER NOT NULL DEFAULT 0 CHECK (exp >= 0),
  crafted                  INTEGER NOT NULL DEFAULT 0 CHECK (crafted >= 0),
  packs_opened             INTEGER NOT NULL DEFAULT 0 CHECK (packs_opened >= 0),
  chronicle_points         INTEGER NOT NULL DEFAULT 0 CHECK (chronicle_points >= 0),
  guide_completed          INTEGER NOT NULL DEFAULT 0 CHECK (guide_completed IN (0, 1)),
  extra_claimed            INTEGER NOT NULL DEFAULT 0 CHECK (extra_claimed IN (0, 1)),
  fund_purchased           INTEGER NOT NULL DEFAULT 0 CHECK (fund_purchased IN (0, 1)),
  starter_equipment_claimed INTEGER NOT NULL DEFAULT 0 CHECK (starter_equipment_claimed IN (0, 1)),
  equipment_chests_opened  INTEGER NOT NULL DEFAULT 0 CHECK (equipment_chests_opened >= 0),
  first_purchased_at       TEXT,
  idle_claim_at            TEXT,
  first_claimed_json       TEXT NOT NULL DEFAULT '[]',
  seven_claimed_json       TEXT NOT NULL DEFAULT '[]',
  bp_claimed_json          TEXT NOT NULL DEFAULT '[]',
  fund_claimed_json        TEXT NOT NULL DEFAULT '[]',
  chronicle_claimed_json   TEXT NOT NULL DEFAULT '[]',
  chest_operations_json    TEXT NOT NULL DEFAULT '[]',
  last_chest_opening_json  TEXT,
  updated_at               TEXT NOT NULL
);

-- 按自然日重置的字段：独立成表，跨日只需换 day_key，无需批量回写
CREATE TABLE IF NOT EXISTS player_daily_state (
  player_id          TEXT NOT NULL REFERENCES players (id) ON DELETE CASCADE,
  day_key            TEXT NOT NULL,
  daily_paid         INTEGER NOT NULL DEFAULT 0 CHECK (daily_paid >= 0),
  claimed_tiers_json TEXT NOT NULL DEFAULT '[]',
  summons            INTEGER NOT NULL DEFAULT 0 CHECK (summons >= 0),
  login_rewards      INTEGER NOT NULL DEFAULT 0 CHECK (login_rewards >= 0),
  PRIMARY KEY (player_id, day_key)
);

-- -----------------------------------------------------------------------------
-- 3.5 成长维度：经验表 / 等级表 / 职业表（v15）
--     三表构成等级体系的主外键骨架，表间一致性由约束 + 种子自检双重保证：
--       level_stats_defs.level       → level_exp_defs.level（1:1，等级域一致由 FK 保证）
--       character_defs.role          → class_defs.id（角色必须挂靠已定义职业）
--       equipment_defs.required_level → level_exp_defs.level（穿戴等级必须在等级域内）
-- -----------------------------------------------------------------------------

-- 经验表：等级 → 升到下一级所需经验（exp_required）与从 1 级累计所需经验（exp_total）。
-- exp_total(1) = 0；满级（150）的 exp_required = 0，作为封顶标记。
-- v19 §2.5：等级域 100 → 150，61+ 级恒以 1.07 续接（闭式公式，无新增曲线段）。
CREATE TABLE IF NOT EXISTS level_exp_defs (
  level        INTEGER PRIMARY KEY CHECK (level BETWEEN 1 AND 150),
  exp_required INTEGER NOT NULL CHECK (exp_required >= 0),
  exp_total    INTEGER NOT NULL CHECK (exp_total >= 0)
);

-- 等级表：等级 → 属性成长数据。growth_bp 为相对 1 级的整体成长系数（万分比，1 级 = 10000）；
-- 暴击/抗性走加法增量（crit_add / res_add），避免万分比在小数值上失真。
-- 属性换算：属性(L) = floor(职业基础属性 × growth_bp(L) / 10000)，暴击/抗性另加增量。
CREATE TABLE IF NOT EXISTS level_stats_defs (
  level     INTEGER PRIMARY KEY REFERENCES level_exp_defs (level) ON DELETE CASCADE,
  growth_bp INTEGER NOT NULL CHECK (growth_bp >= 10000),
  crit_add  INTEGER NOT NULL CHECK (crit_add >= 0),
  res_add   INTEGER NOT NULL CHECK (res_add >= 0)
);

-- 职业表：五大职业的基础（1 级）属性与特性。id 沿用既有 role 文案（治疗/法术/输出/辅助/防御），
-- 存量角色数据零迁移即可挂靠外键。
CREATE TABLE IF NOT EXISTS class_defs (
  id         TEXT PRIMARY KEY,
  name       TEXT NOT NULL UNIQUE,
  detail     TEXT NOT NULL DEFAULT '',
  trait      TEXT NOT NULL DEFAULT '',
  health     INTEGER NOT NULL CHECK (health > 0),
  attack     INTEGER NOT NULL CHECK (attack > 0),
  defense    INTEGER NOT NULL CHECK (defense > 0),
  speed      INTEGER NOT NULL CHECK (speed > 0),
  critical   INTEGER NOT NULL CHECK (critical >= 0),
  resistance INTEGER NOT NULL CHECK (resistance >= 0)
);

-- -----------------------------------------------------------------------------
-- 4. 食灵（角色）
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS character_defs (
  id          TEXT PRIMARY KEY,
  name        TEXT NOT NULL UNIQUE,
  title       TEXT NOT NULL,
  element     TEXT NOT NULL,
  rarity      TEXT NOT NULL CHECK (rarity IN ('R', 'SR', 'SSR')),
  -- v15：角色职业必须挂靠 class_defs 中已定义的职业（存量库由 v15 迁移重建补约束）
  role        TEXT NOT NULL REFERENCES class_defs (id),
  detail      TEXT NOT NULL DEFAULT '',
  portrait    TEXT NOT NULL DEFAULT '',
  base_power  INTEGER NOT NULL CHECK (base_power > 0)
);

CREATE TABLE IF NOT EXISTS player_characters (
  player_id    TEXT NOT NULL REFERENCES players (id) ON DELETE CASCADE,
  character_id TEXT NOT NULL REFERENCES character_defs (id),
  star         INTEGER NOT NULL DEFAULT 1 CHECK (star BETWEEN 1 AND 5),
  level        INTEGER NOT NULL DEFAULT 1 CHECK (level >= 1),
  unlocked_at  TEXT NOT NULL,
  PRIMARY KEY (player_id, character_id)
);

-- 出战阵容，每人最多 3 个槽位
CREATE TABLE IF NOT EXISTS player_formation (
  player_id    TEXT NOT NULL REFERENCES players (id) ON DELETE CASCADE,
  slot         INTEGER NOT NULL CHECK (slot BETWEEN 1 AND 3),
  character_id TEXT NOT NULL REFERENCES character_defs (id),
  PRIMARY KEY (player_id, slot)
);

-- -----------------------------------------------------------------------------
-- 5. 装备
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS equipment_defs (
  id         TEXT PRIMARY KEY,
  name       TEXT NOT NULL,
  slot       TEXT NOT NULL CHECK (slot IN ('weapon', 'crown', 'armor', 'charm', 'relic', 'crest')),
  rarity     TEXT NOT NULL CHECK (rarity IN ('rare', 'epic', 'legendary')),
  story      TEXT NOT NULL DEFAULT '',
  health     INTEGER NOT NULL DEFAULT 0,
  attack     INTEGER NOT NULL DEFAULT 0,
  defense    INTEGER NOT NULL DEFAULT 0,
  speed      INTEGER NOT NULL DEFAULT 0,
  critical   INTEGER NOT NULL DEFAULT 0,
  resistance INTEGER NOT NULL DEFAULT 0,
  -- v15：穿戴等级需求，必须落在等级域（1..150，v19 放开）内；稀有度越高需求越高
  --（存量库由 v15/v19 迁移重建，全新建库直接建全）
  required_level INTEGER NOT NULL DEFAULT 1
    CHECK (required_level BETWEEN 1 AND 150)
    REFERENCES level_exp_defs (level)
);

CREATE TABLE IF NOT EXISTS player_equipment (
  id           TEXT PRIMARY KEY,
  player_id    TEXT NOT NULL REFERENCES players (id) ON DELETE CASCADE,
  template_id  TEXT NOT NULL REFERENCES equipment_defs (id),
  -- 强化等级：0 = 未强化，上限 12（v17 数值核心：5 → 12，与前端 MAX_ENHANCEMENT 口径一致；
  -- 存量库由 v17 迁移重建放开）
  level        INTEGER NOT NULL DEFAULT 0 CHECK (level BETWEEN 0 AND 12),
  equipped_slot TEXT CHECK (equipped_slot IN ('weapon', 'crown', 'armor', 'charm', 'relic', 'crest')),
  -- v20 §4.3：副属性洗练——每件至多 1 条（key ∈ 池），value ∈ 2..6（生命按 ×100 计入面板），
  -- wash_count 为累计洗练次数（决定洗练成本 2 万 × (1 + 0.5 × 次数)）；存量库由 v20 补列
  substat_key   TEXT CHECK (substat_key IN ('critical', 'resistance', 'speed', 'health')),
  substat_value INTEGER CHECK (substat_value BETWEEN 2 AND 6),
  wash_count    INTEGER NOT NULL DEFAULT 0,
  obtained_at  TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_player_equipment_player ON player_equipment (player_id);
-- 同一玩家同一槽位只能装备一件
CREATE UNIQUE INDEX IF NOT EXISTS uq_player_equipment_slot
  ON player_equipment (player_id, equipped_slot)
  WHERE equipped_slot IS NOT NULL;

-- -----------------------------------------------------------------------------
-- 6. 关卡与战斗
-- -----------------------------------------------------------------------------
-- v21：副本定义——关卡的上层组织单位。解锁双条件：玩家等级 ≥ unlock_level 且
-- 开服天数 ≥ unlock_open_day（开服天数 = 今天 − 开服日期 + 1，见 catalog 下发 serverOpenDate）。
CREATE TABLE IF NOT EXISTS dungeon_defs (
  id              TEXT PRIMARY KEY,
  name            TEXT NOT NULL,
  english         TEXT NOT NULL DEFAULT '',
  description     TEXT NOT NULL DEFAULT '',
  order_index     INTEGER NOT NULL,
  unlock_level    INTEGER NOT NULL DEFAULT 1 CHECK (unlock_level BETWEEN 1 AND 150),
  unlock_open_day INTEGER NOT NULL DEFAULT 1 CHECK (unlock_open_day >= 1)
);

CREATE TABLE IF NOT EXISTS stage_defs (
  id               TEXT PRIMARY KEY,
  chapter          TEXT NOT NULL,
  name             TEXT NOT NULL,
  order_index      INTEGER NOT NULL,
  suggested_power  INTEGER NOT NULL CHECK (suggested_power > 0),
  -- v8：场景归属。ALTER ADD COLUMN 带 REFERENCES 合法；存量库由 v8 迁移钩子补列，
  -- 全新建库时直接建全，迁移钩子探测到该列即跳过（幂等）。NULL = 回退默认战斗场景。
  scene_id         TEXT REFERENCES scene_defs (id),
  -- v21：副本归属。NULL = 不属于任何副本（对外不可见的历史兜底），种子会为全部关卡写值。
  dungeon_id       TEXT REFERENCES dungeon_defs (id),
  reward_json      TEXT NOT NULL DEFAULT '[]'
);

-- v21：功能与活动配置表——运营开关的单一数据源（§对应任务：功能/活动配置表）。
-- category：feature=功能入口（背包/占星等） / activity=限时活动（七日之约等） / system=系统级。
-- enabled=总开关；open_day/close_day 为开服天窗口（NULL=无界）；前端按此过滤主界面入口显隐。
CREATE TABLE IF NOT EXISTS feature_toggles (
  key        TEXT PRIMARY KEY,
  name       TEXT NOT NULL,
  category   TEXT NOT NULL CHECK (category IN ('feature', 'activity', 'system')),
  enabled    INTEGER NOT NULL DEFAULT 1 CHECK (enabled IN (0, 1)),
  open_day   INTEGER CHECK (open_day IS NULL OR open_day >= 1),
  close_day  INTEGER CHECK (close_day IS NULL OR close_day >= 1),
  sort_index INTEGER NOT NULL DEFAULT 0,
  detail     TEXT NOT NULL DEFAULT ''
);

CREATE TABLE IF NOT EXISTS battles (
  id           TEXT PRIMARY KEY,
  player_id    TEXT NOT NULL REFERENCES players (id) ON DELETE CASCADE,
  stage_id     TEXT NOT NULL REFERENCES stage_defs (id),
  seed         INTEGER NOT NULL,
  status       TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'claimed', 'lost')),
  win          INTEGER CHECK (win IS NULL OR win IN (0, 1)),
  rounds       INTEGER NOT NULL DEFAULT 0 CHECK (rounds >= 0),
  power        INTEGER NOT NULL DEFAULT 0 CHECK (power >= 0),
  enemy_power  INTEGER NOT NULL DEFAULT 0 CHECK (enemy_power >= 0),
  first_clear  INTEGER NOT NULL DEFAULT 0 CHECK (first_clear IN (0, 1)),
  units_json   TEXT NOT NULL DEFAULT '[]',
  started_at   TEXT NOT NULL,
  settled_at   TEXT
);
CREATE INDEX IF NOT EXISTS idx_battles_player ON battles (player_id, started_at DESC);
-- 同一玩家同一关卡只允许一场未结算战斗，避免刷奖励
CREATE UNIQUE INDEX IF NOT EXISTS uq_battles_pending
  ON battles (player_id, stage_id)
  WHERE status = 'pending';

-- 战斗回放：逐回合逐次出手落库，前端可按相同数据重放
CREATE TABLE IF NOT EXISTS battle_turns (
  battle_id  TEXT NOT NULL REFERENCES battles (id) ON DELETE CASCADE,
  round      INTEGER NOT NULL CHECK (round >= 1),
  seq        INTEGER NOT NULL CHECK (seq >= 1),
  actor_id   TEXT NOT NULL,
  target_id  TEXT NOT NULL,
  kind       TEXT NOT NULL CHECK (kind IN ('attack', 'skill', 'heal')),
  skill      TEXT NOT NULL,
  amount     INTEGER NOT NULL,
  critical   INTEGER NOT NULL DEFAULT 0 CHECK (critical IN (0, 1)),
  health_json TEXT NOT NULL DEFAULT '{}',
  PRIMARY KEY (battle_id, round, seq)
);

-- -----------------------------------------------------------------------------
-- 7. 任务、邮件、商店
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS quest_defs (
  id          TEXT PRIMARY KEY,
  group_name  TEXT NOT NULL CHECK (group_name IN ('日常', '成长', '主线')),
  name        TEXT NOT NULL,
  detail      TEXT NOT NULL,
  target      INTEGER NOT NULL CHECK (target > 0),
  -- 进度指标：服务端据此计算当前进度，避免只由客户端上报
  -- v14 扩展：stage_clear（ref_id=关卡 id）/ mail_claimed / formation_slots /
  --          summons_total / equipment_worn / crafted_total / friend_count /
  --          market_today / astrology_nodes / equipment_chests / idle_claimed /
  --          trade_used / stars_reached / login_days；none = 建号即完成
  metric      TEXT NOT NULL DEFAULT 'none' CHECK (metric IN (
                'daily_summons', 'daily_claimed_tiers', 'daily_login_rewards',
                'first_purchase', 'character_count', 'worldtree_level',
                'battle_wins', 'contract_purchase', 'none',
                'stage_clear', 'mail_claimed', 'formation_slots', 'summons_total',
                'equipment_worn', 'crafted_total', 'friend_count', 'market_today',
                'astrology_nodes', 'equipment_chests', 'idle_claimed', 'trade_used',
                'stars_reached', 'login_days', 'daily_battle_wins')),
  -- metric 上下文引用（stage_clear 存 stage_defs.id；其余为 NULL）
  ref_id      TEXT,
  reward_json TEXT NOT NULL DEFAULT '[]',
  sort_index  INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS player_quest_claims (
  player_id  TEXT NOT NULL REFERENCES players (id) ON DELETE CASCADE,
  quest_id   TEXT NOT NULL REFERENCES quest_defs (id),
  day_key    TEXT,
  claimed_at TEXT NOT NULL,
  PRIMARY KEY (player_id, quest_id)
);

CREATE TABLE IF NOT EXISTS mail_defs (
  id            TEXT PRIMARY KEY,
  sender        TEXT NOT NULL,
  title         TEXT NOT NULL,
  excerpt       TEXT NOT NULL,
  time_label    TEXT NOT NULL,
  reward_json   TEXT NOT NULL DEFAULT '[]',
  sort_index    INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS player_mail (
  player_id  TEXT NOT NULL REFERENCES players (id) ON DELETE CASCADE,
  mail_id    TEXT NOT NULL REFERENCES mail_defs (id),
  read_at    TEXT,
  claimed_at TEXT,
  PRIMARY KEY (player_id, mail_id)
);

CREATE TABLE IF NOT EXISTS shop_pack_defs (
  id         TEXT PRIMARY KEY,
  name       TEXT NOT NULL,
  price      INTEGER NOT NULL CHECK (price >= 0),
  gems       INTEGER NOT NULL DEFAULT 0 CHECK (gems >= 0),
  books      INTEGER NOT NULL DEFAULT 0 CHECK (books >= 0),
  label      TEXT NOT NULL,
  note       TEXT NOT NULL DEFAULT '',
  daily_limit INTEGER NOT NULL DEFAULT 0 CHECK (daily_limit >= 0),
  sort_index INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS player_purchases (
  id           TEXT PRIMARY KEY,
  player_id    TEXT NOT NULL REFERENCES players (id) ON DELETE CASCADE,
  pack_id      TEXT NOT NULL REFERENCES shop_pack_defs (id),
  price        INTEGER NOT NULL,
  purchased_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_player_purchases_player ON player_purchases (player_id, purchased_at DESC);

-- -----------------------------------------------------------------------------
-- 8. 交易坊与每日轮换商店
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS trade_rate_defs (
  id           TEXT PRIMARY KEY,
  give_currency TEXT NOT NULL CHECK (give_currency IN ('coin', 'gem', 'book', 'leaf', 'potion', 'chest', 'medal')),
  give_amount  INTEGER NOT NULL CHECK (give_amount > 0),
  get_currency TEXT NOT NULL CHECK (get_currency IN ('coin', 'gem', 'book', 'leaf', 'potion', 'chest', 'medal')),
  get_amount   INTEGER NOT NULL CHECK (get_amount > 0),
  daily_limit  INTEGER NOT NULL CHECK (daily_limit > 0),
  sort_index   INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS player_trade_usage (
  player_id TEXT NOT NULL REFERENCES players (id) ON DELETE CASCADE,
  day_key   TEXT NOT NULL,
  rate_id   TEXT NOT NULL REFERENCES trade_rate_defs (id),
  used      INTEGER NOT NULL DEFAULT 0 CHECK (used >= 0),
  PRIMARY KEY (player_id, day_key, rate_id)
);

CREATE TABLE IF NOT EXISTS market_offer_defs (
  id         TEXT PRIMARY KEY,
  currency   TEXT NOT NULL CHECK (currency IN ('coin', 'gem', 'book', 'leaf', 'potion', 'chest', 'medal')),
  amount     INTEGER NOT NULL CHECK (amount > 0),
  price      INTEGER NOT NULL CHECK (price > 0),
  label      TEXT NOT NULL,
  sort_index INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS player_market_purchases (
  player_id    TEXT NOT NULL REFERENCES players (id) ON DELETE CASCADE,
  day_key      TEXT NOT NULL,
  offer_id     TEXT NOT NULL REFERENCES market_offer_defs (id),
  price        INTEGER NOT NULL CHECK (price >= 0),
  purchased_at TEXT NOT NULL,
  PRIMARY KEY (player_id, day_key, offer_id)
);

-- -----------------------------------------------------------------------------
-- 9. 星象
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS astrology_node_defs (
  id           TEXT PRIMARY KEY,
  name         TEXT NOT NULL,
  gem_cost     INTEGER NOT NULL DEFAULT 0 CHECK (gem_cost >= 0),
  order_index  INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS player_astrology (
  player_id  TEXT NOT NULL REFERENCES players (id) ON DELETE CASCADE,
  node_id    TEXT NOT NULL REFERENCES astrology_node_defs (id),
  unlocked_at TEXT NOT NULL,
  PRIMARY KEY (player_id, node_id)
);

-- -----------------------------------------------------------------------------
-- 10. 社交：好友、协会、聊天
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS guilds (
  id          TEXT PRIMARY KEY,
  name        TEXT NOT NULL UNIQUE,
  english     TEXT NOT NULL,
  level       INTEGER NOT NULL DEFAULT 1 CHECK (level >= 1),
  capacity    INTEGER NOT NULL DEFAULT 50 CHECK (capacity > 0),
  motto       TEXT NOT NULL DEFAULT '',
  notice      TEXT NOT NULL DEFAULT '',
  created_at  TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS guild_members (
  guild_id     TEXT NOT NULL REFERENCES guilds (id) ON DELETE CASCADE,
  player_id    TEXT NOT NULL REFERENCES players (id) ON DELETE CASCADE,
  role         TEXT NOT NULL DEFAULT 'member' CHECK (role IN ('leader', 'officer', 'member')),
  contribution INTEGER NOT NULL DEFAULT 0 CHECK (contribution >= 0),
  check_in_date TEXT,
  joined_at    TEXT NOT NULL,
  PRIMARY KEY (guild_id, player_id)
);

-- 好友关系双向存储，status 表示 player_id → friend_id 的方向状态
CREATE TABLE IF NOT EXISTS friendships (
  player_id  TEXT NOT NULL REFERENCES players (id) ON DELETE CASCADE,
  friend_id  TEXT NOT NULL REFERENCES players (id) ON DELETE CASCADE,
  status     TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'blocked')),
  created_at TEXT NOT NULL,
  PRIMARY KEY (player_id, friend_id),
  CHECK (player_id <> friend_id)
);

CREATE TABLE IF NOT EXISTS chat_messages (
  id         TEXT PRIMARY KEY,
  player_id  TEXT REFERENCES players (id) ON DELETE SET NULL,
  guild_id   TEXT REFERENCES guilds (id) ON DELETE CASCADE,
  channel    TEXT NOT NULL CHECK (channel IN ('world', 'guild')),
  body       TEXT NOT NULL CHECK (length(body) BETWEEN 1 AND 120),
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_chat_messages_channel ON chat_messages (channel, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_chat_messages_guild ON chat_messages (guild_id, created_at DESC);

-- -----------------------------------------------------------------------------
-- 11. 账号级云端存档文档（前端完整存档 JSON，按账号隔离，乐观锁版本控制）
-- -----------------------------------------------------------------------------
-- 业务表（资源/装备/战斗等）仍是权威数据源；本表保存前端整体存档文档，
-- 用于多端同步与无感迁移。document 为服务端校验清洗后的 JSON 文本。
CREATE TABLE IF NOT EXISTS player_save_documents (
  player_id  TEXT PRIMARY KEY REFERENCES players (id) ON DELETE CASCADE,
  document   TEXT NOT NULL,
  version    INTEGER NOT NULL DEFAULT 1 CHECK (version >= 1),
  updated_at TEXT NOT NULL
);

-- -----------------------------------------------------------------------------
-- 12. 支付订单（模拟网关；预留真实渠道接入点）
-- -----------------------------------------------------------------------------
-- 状态机：created → paid（回调验签通过，事务内发放）；created → failed（验签/金额不符）。
-- 回调防重放：gateway_txn 部分唯一索引 + 10 分钟时间窗 + 锁价签名三重校验。
CREATE TABLE IF NOT EXISTS payment_orders (
  id           TEXT PRIMARY KEY,
  player_id    TEXT NOT NULL REFERENCES players (id) ON DELETE CASCADE,
  pack_id      TEXT NOT NULL REFERENCES shop_pack_defs (id),
  amount       INTEGER NOT NULL CHECK (amount > 0),
  status       TEXT NOT NULL DEFAULT 'created' CHECK (status IN ('created', 'paid', 'failed', 'expired')),
  client_token TEXT NOT NULL,
  gateway_txn  TEXT,
  signature    TEXT NOT NULL,
  created_at   TEXT NOT NULL,
  paid_at      TEXT,
  UNIQUE (player_id, client_token)
);
CREATE INDEX IF NOT EXISTS idx_payment_orders_player ON payment_orders (player_id, created_at DESC);
CREATE UNIQUE INDEX IF NOT EXISTS uq_payment_orders_gateway_txn
  ON payment_orders (gateway_txn) WHERE gateway_txn IS NOT NULL;

-- -----------------------------------------------------------------------------
-- 13. 关卡挑战次数（每日免费 + 挑战卡购买）
-- -----------------------------------------------------------------------------
-- 每日免费 4 次；挑战卡 15 灵晶/张、每日最多购 6 张；每日总上限 10 次。
-- 主键 (player_id, day_key)：跨日自然产生新行，旧记录天然作废——重置零操作。
CREATE TABLE IF NOT EXISTS battle_passes (
  player_id  TEXT NOT NULL REFERENCES players (id) ON DELETE CASCADE,
  day_key    TEXT NOT NULL,
  used       INTEGER NOT NULL DEFAULT 0 CHECK (used >= 0),
  purchased  INTEGER NOT NULL DEFAULT 0 CHECK (purchased >= 0 AND purchased <= 6),
  PRIMARY KEY (player_id, day_key)
);

-- -----------------------------------------------------------------------------
-- 14. 账号密码凭据（正式注册：为游客身份补设密码，支持跨设备登录找回）
-- -----------------------------------------------------------------------------
-- player_id 即 accountId；一个身份至多一套凭据。密码只存 scrypt 摘要（含独立盐与参数）。
CREATE TABLE IF NOT EXISTS account_credentials (
  player_id     TEXT PRIMARY KEY REFERENCES players (id) ON DELETE CASCADE,
  password_hash TEXT NOT NULL,
  created_at    TEXT NOT NULL,
  updated_at    TEXT NOT NULL
);

-- -----------------------------------------------------------------------------
-- 15. 特效定义（v7）—— 客户端表现资产的登记表，服务端只存引用与元信息。
--     先于 enemy_defs / skill_defs 定义（二者外键引用本表）。
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS vfx_defs (
  id          TEXT PRIMARY KEY,
  name        TEXT NOT NULL,
  type        TEXT NOT NULL CHECK (type IN ('hit', 'skill', 'buff', 'ui')),
  asset_path  TEXT NOT NULL,
  duration_ms INTEGER NOT NULL DEFAULT 0 CHECK (duration_ms >= 0),
  sort_index  INTEGER NOT NULL DEFAULT 0,
  updated_at  TEXT NOT NULL
);

-- -----------------------------------------------------------------------------
-- 16. 技能定义（v7）
-- -----------------------------------------------------------------------------
-- 数值系数一律整数万分比（coefficient_bp）：1.25 倍攻击存 12500，杜绝浮点。
-- battle_turns.skill 保持裸 TEXT（设计决策 D-2）：历史回放不重建表，
-- 服务层写入前以 findSkillDef 白名单校验（逻辑外键）。
CREATE TABLE IF NOT EXISTS skill_defs (
  id             TEXT PRIMARY KEY,
  name           TEXT NOT NULL UNIQUE,
  kind           TEXT NOT NULL CHECK (kind IN ('attack', 'heal', 'buff', 'debuff')),
  target_type    TEXT NOT NULL CHECK (target_type IN ('self', 'ally', 'ally_all', 'enemy', 'enemy_all')),
  coefficient_bp INTEGER NOT NULL CHECK (coefficient_bp > 0),
  cooldown       INTEGER NOT NULL DEFAULT 0 CHECK (cooldown >= 0),
  vfx_id         TEXT REFERENCES vfx_defs (id),
  detail         TEXT NOT NULL DEFAULT '',
  updated_at     TEXT NOT NULL
);

-- -----------------------------------------------------------------------------
-- 17. 战斗内容：怪物 / Boss（v7）
-- -----------------------------------------------------------------------------
-- 敌方单位定义。Boss 不单独建表，以 kind 判别（设计决策 D-1）：
--   normal：普通怪，直接参与战斗快照；
--   elite ：精英怪，可携带 1-2 个技能；
--   boss  ：Boss，额外使用 phase_json 描述阶段机制。
CREATE TABLE IF NOT EXISTS enemy_defs (
  id          TEXT PRIMARY KEY,
  name        TEXT NOT NULL,
  kind        TEXT NOT NULL CHECK (kind IN ('normal', 'elite', 'boss')),
  element     TEXT NOT NULL,
  power       INTEGER NOT NULL CHECK (power > 0),
  health      INTEGER NOT NULL CHECK (health > 0),
  attack      INTEGER NOT NULL CHECK (attack > 0),
  defense     INTEGER NOT NULL DEFAULT 0 CHECK (defense >= 0),
  speed       INTEGER NOT NULL DEFAULT 0 CHECK (speed >= 0),
  -- 技能列表：JSON 数组，按出手优先级引用 skill_defs.id，服务端结算前校验存在性
  skill_ids   TEXT NOT NULL DEFAULT '[]',
  vfx_id      TEXT REFERENCES vfx_defs (id),
  -- 掉落：JSON 数组 [{ kind, amount, rate_bp }]，rate_bp 为万分比概率（0-10000）
  drop_json   TEXT NOT NULL DEFAULT '[]',
  -- Boss 专属：阶段机制（血量阈值 → 触发技能/增益），非 Boss 必须为 NULL
  phase_json  TEXT,
  portrait    TEXT NOT NULL DEFAULT '',
  updated_at  TEXT NOT NULL,
  CHECK (kind = 'boss' OR phase_json IS NULL)
);
CREATE INDEX IF NOT EXISTS idx_enemy_defs_kind ON enemy_defs (kind, power);

-- -----------------------------------------------------------------------------
-- 18. 配置域版本戳（v7，配套 §5.2 配置热更新）
-- -----------------------------------------------------------------------------
-- 任何配置变更（GM edit_config 或 seed 重跑）写通本表并 version = version + 1，
-- 服务端与客户端缓存以版本比对失效，无 TTL 竞态。
CREATE TABLE IF NOT EXISTS catalog_meta (
  domain     TEXT PRIMARY KEY,     -- 'enemy' | 'skill' | 'vfx' | 'scene' | 'item' | 'activity' | ...
  version    INTEGER NOT NULL CHECK (version >= 1),
  updated_at TEXT NOT NULL
);

-- -----------------------------------------------------------------------------
-- 19. 通用场景定义（v8）—— 主城 / 关卡 / 协会 / 经营 / 活动场景统一登记
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS scene_defs (
  id                     TEXT PRIMARY KEY,
  name                   TEXT NOT NULL,
  type                   TEXT NOT NULL CHECK (type IN ('battle', 'idle', 'guild', 'manor', 'activity')),
  background             TEXT NOT NULL DEFAULT '',
  music                  TEXT NOT NULL DEFAULT '',
  -- v17：解锁域随世界树上限 30 → 100 放开；v19 §2.5 随等级域放开至 150（存量库由迁移重建）
  unlock_worldtree_level INTEGER NOT NULL DEFAULT 1 CHECK (unlock_worldtree_level BETWEEN 1 AND 150),
  order_index            INTEGER NOT NULL DEFAULT 0,
  updated_at             TEXT NOT NULL
);

-- -----------------------------------------------------------------------------
-- 20. 通用物品与背包（v9）
-- -----------------------------------------------------------------------------
-- 7 种货币仍留在 player_resources 固定列（高频、强 CHECK、有流水），不迁入物品系统；
-- 本表承载货币之外的一切物品：材料、消耗品、宝箱、碎片、礼包。
CREATE TABLE IF NOT EXISTS item_defs (
  id          TEXT PRIMARY KEY,
  name        TEXT NOT NULL,
  type        TEXT NOT NULL CHECK (type IN ('material', 'consumable', 'chest', 'fragment', 'gift')),
  rarity      TEXT NOT NULL CHECK (rarity IN ('common', 'rare', 'epic', 'legendary')),
  -- 是否可堆叠：1 = 背包内同 id 合并计数；0 = 独立实例（一物一行）
  stackable   INTEGER NOT NULL DEFAULT 1 CHECK (stackable IN (0, 1)),
  max_stack   INTEGER NOT NULL DEFAULT 9999 CHECK (max_stack > 0),
  -- 使用效果（消耗品）：JSON，如 { kind: 'resource', currency: 'coin', amount: 50000 }
  effect_json TEXT NOT NULL DEFAULT '{}',
  value       INTEGER NOT NULL DEFAULT 0 CHECK (value >= 0),  -- 出售/分解所得（金币）
  icon        TEXT NOT NULL DEFAULT '',
  detail      TEXT NOT NULL DEFAULT '',
  updated_at  TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS player_items (
  id          TEXT PRIMARY KEY,
  player_id   TEXT NOT NULL REFERENCES players (id) ON DELETE CASCADE,
  item_id     TEXT NOT NULL REFERENCES item_defs (id),
  quantity    INTEGER NOT NULL CHECK (quantity > 0),
  -- 冗余自 item_defs.stackable：支撑下方部分唯一索引（SQLite 部分索引 WHERE 不引用其他表）
  stackable   INTEGER NOT NULL DEFAULT 1 CHECK (stackable IN (0, 1)),
  obtained_at TEXT NOT NULL,
  updated_at  TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_player_items_player ON player_items (player_id, updated_at DESC);
-- 可堆叠物品「一玩家一物品一行」由本索引保证（设计决策 D-3，仓库层 ON CONFLICT 依赖它）
CREATE UNIQUE INDEX IF NOT EXISTS uq_player_items_stack
  ON player_items (player_id, item_id) WHERE stackable = 1;

-- -----------------------------------------------------------------------------
-- 21. 运营活动（v10）—— 把散落在 player_progress JSON 列的活动领取状态拆出成表
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS activity_defs (
  id          TEXT PRIMARY KEY,
  name        TEXT NOT NULL,
  type        TEXT NOT NULL CHECK (type IN ('login', 'charge', 'collect', 'period')),
  start_at    TEXT NOT NULL,
  end_at      TEXT NOT NULL,
  -- 活动规则参数：JSON，如 { tiers: [{ key, need, rewards }] }
  config_json TEXT NOT NULL DEFAULT '{}',
  reward_json TEXT NOT NULL DEFAULT '[]',
  sort_index  INTEGER NOT NULL DEFAULT 0,
  updated_at  TEXT NOT NULL,
  CHECK (end_at > start_at)
);
CREATE INDEX IF NOT EXISTS idx_activity_defs_window ON activity_defs (start_at, end_at);

CREATE TABLE IF NOT EXISTS player_activity_progress (
  player_id    TEXT NOT NULL REFERENCES players (id) ON DELETE CASCADE,
  activity_id  TEXT NOT NULL REFERENCES activity_defs (id),
  progress     INTEGER NOT NULL DEFAULT 0 CHECK (progress >= 0),
  -- 已领取的档位/批次（JSON 数组，与 activity_defs.config_json 的档位 key 对应）
  claimed_json TEXT NOT NULL DEFAULT '[]',
  updated_at   TEXT NOT NULL,
  PRIMARY KEY (player_id, activity_id)
);

-- -----------------------------------------------------------------------------
-- 22. GM 账号与权限（v11）
-- -----------------------------------------------------------------------------
-- 角色即权限：super > ops > support > readonly，权限清单硬编码在
-- backend/src/domain/gm-permissions.ts，不做库内细粒度权限表（规模不需要）。
CREATE TABLE IF NOT EXISTS gm_accounts (
  id            TEXT PRIMARY KEY,
  username      TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,        -- scrypt 摘要（同 account_credentials 做法，含独立盐与参数）
  role          TEXT NOT NULL DEFAULT 'support' CHECK (role IN ('super', 'ops', 'support', 'readonly')),
  status        TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'disabled')),
  created_at    TEXT NOT NULL,
  last_login_at TEXT
);

-- -----------------------------------------------------------------------------
-- 23. GM 操作审计日志（v11）—— append-only：无 UPDATE/DELETE 路径，代码评审卡点
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS gm_audit_logs (
  id           TEXT PRIMARY KEY,
  gm_id        TEXT NOT NULL REFERENCES gm_accounts (id),
  action       TEXT NOT NULL CHECK (action IN (
                 'login', 'send_mail', 'send_compensation', 'grant_resource',
                 'ban', 'unban', 'kick', 'edit_config')),
  target_type  TEXT NOT NULL CHECK (target_type IN ('player', 'guild', 'config', 'system')),
  target_id    TEXT,
  payload_json TEXT NOT NULL DEFAULT '{}',
  result       TEXT NOT NULL DEFAULT 'ok' CHECK (result IN ('ok', 'failed', 'denied')),
  ip           TEXT NOT NULL DEFAULT '',
  created_at   TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_gm_audit_logs_gm    ON gm_audit_logs (gm_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_gm_audit_logs_target ON gm_audit_logs (target_type, target_id, created_at DESC);

-- -----------------------------------------------------------------------------
-- 24. 封禁（v11）—— 登录与请求中间件每次检查 active = 1 且未过期的记录
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS gm_player_bans (
  id         TEXT PRIMARY KEY,
  player_id  TEXT NOT NULL REFERENCES players (id) ON DELETE CASCADE,
  reason     TEXT NOT NULL,
  banned_by  TEXT NOT NULL REFERENCES gm_accounts (id),
  banned_at  TEXT NOT NULL,
  expires_at TEXT,                      -- NULL = 永久
  lifted_at  TEXT,                      -- 解封时间
  active     INTEGER NOT NULL DEFAULT 1 CHECK (active IN (0, 1))
);
CREATE INDEX IF NOT EXISTS idx_gm_player_bans_player ON gm_player_bans (player_id, active);

-- -----------------------------------------------------------------------------
-- 25. 个性化系统邮件（v11）—— 附件 / 过期 / 逐玩家发放 / 来源标记
-- -----------------------------------------------------------------------------
-- mail_defs + player_mail 继续承载纯模板邮件（全服广播，零行级成本）；
-- 本表承载一切个性化邮件（GM 补偿、结算奖励邮件），客户端合并两路展示。
CREATE TABLE IF NOT EXISTS player_system_mails (
  id               TEXT PRIMARY KEY,
  player_id        TEXT NOT NULL REFERENCES players (id) ON DELETE CASCADE,
  template_id      TEXT REFERENCES mail_defs (id),   -- 可选：基于模板邮件二次下发
  title            TEXT NOT NULL,
  body             TEXT NOT NULL DEFAULT '',
  attachments_json TEXT NOT NULL DEFAULT '[]',       -- [{ kind, amount, itemId? }]
  source           TEXT NOT NULL DEFAULT 'system' CHECK (source IN ('system', 'gm', 'compensation')),
  created_by       TEXT,                             -- gm_accounts.id；NULL = 系统自动
  expire_at        TEXT,                             -- NULL = 永不过期
  read_at          TEXT,
  claimed_at       TEXT,
  created_at       TEXT NOT NULL,
  CHECK (claimed_at IS NULL OR expire_at IS NULL OR claimed_at <= expire_at)
);
CREATE INDEX IF NOT EXISTS idx_player_system_mails_player ON player_system_mails (player_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_player_system_mails_unclaimed
  ON player_system_mails (expire_at) WHERE claimed_at IS NULL;

-- -----------------------------------------------------------------------------
-- 26. 排行榜（v12）
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS leaderboard_defs (
  id         TEXT PRIMARY KEY,
  name       TEXT NOT NULL,
  metric     TEXT NOT NULL CHECK (metric IN ('battle_wins', 'power', 'worldtree_level', 'chronicle_points')),
  period     TEXT NOT NULL DEFAULT 'all' CHECK (period IN ('all', 'season', 'daily')),
  season_key TEXT,                                 -- period='season' 时必填，如 '2026W45'
  capacity   INTEGER NOT NULL DEFAULT 100 CHECK (capacity > 0),
  updated_at TEXT NOT NULL,
  CHECK (period <> 'season' OR season_key IS NOT NULL)
);

CREATE TABLE IF NOT EXISTS leaderboard_entries (
  leaderboard_id TEXT NOT NULL REFERENCES leaderboard_defs (id) ON DELETE CASCADE,
  player_id      TEXT NOT NULL REFERENCES players (id) ON DELETE CASCADE,
  score          INTEGER NOT NULL DEFAULT 0 CHECK (score >= 0),
  updated_at     TEXT NOT NULL,
  PRIMARY KEY (leaderboard_id, player_id)
);
CREATE INDEX IF NOT EXISTS idx_leaderboard_entries_score
  ON leaderboard_entries (leaderboard_id, score DESC);

-- 赛季结算快照（发奖依据，append-only）
CREATE TABLE IF NOT EXISTS leaderboard_snapshots (
  id             TEXT PRIMARY KEY,
  leaderboard_id TEXT NOT NULL REFERENCES leaderboard_defs (id) ON DELETE CASCADE,
  season_key     TEXT NOT NULL,
  player_id      TEXT NOT NULL REFERENCES players (id) ON DELETE CASCADE,
  rank           INTEGER NOT NULL CHECK (rank > 0),
  score          INTEGER NOT NULL CHECK (score >= 0),
  rewarded       INTEGER NOT NULL DEFAULT 0 CHECK (rewarded IN (0, 1)),
  snapshot_at    TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_leaderboard_snapshots_rank
  ON leaderboard_snapshots (leaderboard_id, season_key, rank);

-- -----------------------------------------------------------------------------
-- 27. 运营与安全日志（v13）—— append-only，与 gm_audit_logs 同规约
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS op_logs (
  id          TEXT PRIMARY KEY,
  player_id   TEXT REFERENCES players (id) ON DELETE SET NULL,   -- 删号后日志保留
  action      TEXT NOT NULL,                                     -- 如 'item_use', 'formation_change', 'guild_kick'
  detail_json TEXT NOT NULL DEFAULT '{}',
  ip          TEXT NOT NULL DEFAULT '',
  created_at  TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_op_logs_player ON op_logs (player_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_op_logs_action ON op_logs (action, created_at DESC);

CREATE TABLE IF NOT EXISTS security_logs (
  id          TEXT PRIMARY KEY,
  player_id   TEXT,                                              -- 可能来自未认证请求，允许 NULL 无外键
  event       TEXT NOT NULL CHECK (event IN (
                'login_fail', 'csrf_fail', 'signature_mismatch',
                'replay_blocked', 'rate_limited', 'save_rejected', 'ban_hit')),
  detail_json TEXT NOT NULL DEFAULT '{}',
  ip          TEXT NOT NULL DEFAULT '',
  created_at  TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_security_logs_event ON security_logs (event, created_at DESC);
