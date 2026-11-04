/**
 * 全量配置域注册表（v22 后台配置管理）。
 *
 * 这是「游戏现有全部配置项」的唯一清单：既驱动 GM 后台的通用 CRUD，
 * 也驱动 catalog 增量下发的版本域，保证任何配置改动都能被客户端感知。
 *
 * 安全边界：只登记静态配置表（*_defs / 开关 / 定义表）与只读运维表，
 * 绝不登记 player_* / 会话 / 凭据 / 订单 / 日志等玩家动态数据，
 * 因此后台改配置不会影响现有玩法与玩家资产。
 */
export type ColumnType = 'string' | 'text' | 'integer' | 'boolean' | 'json' | 'enum' | 'datetime';

export type ColumnSpec = {
  key: string;
  label: string;
  type: ColumnType;
  /** 新建时必填（主键默认必填） */
  required?: boolean;
  /** 编辑态只读（主键、自动时间戳） */
  readOnly?: boolean;
  /** 允许 NULL / 空串（如 season_key、phase_json） */
  nullable?: boolean;
  /** enum 可选值 */
  options?: readonly string[];
  min?: number;
  max?: number;
  maxLength?: number;
  /** 自动写入当前 ISO 时间（创建与更新都刷新） */
  autoNow?: boolean;
  /** 新建时的默认值 */
  default?: string | number | null;
  help?: string;
};

export type ConfigDomain = {
  /** URL slug，同时作为 GM 后台域标识 */
  key: string;
  label: string;
  group: string;
  description: string;
  /** 物理表名；虚拟域（runtime）为空串，由服务层特殊处理 */
  table: string;
  pk: string;
  /** 排序（必须来自白名单列，服务层会校验） */
  orderBy: string;
  /** catalog_meta 版本域；只读域为空 */
  versionDomain?: string;
  readOnly?: boolean;
  columns: ColumnSpec[];
  /** 契约别名（= pk / versionDomain），由下方 CONFIG_DOMAINS 导出时自动补齐 */
  primaryKey?: string;
  domain?: string | null;
};

type Extra = Partial<Omit<ColumnSpec, 'key' | 'label' | 'type'>>;
const col = (key: string, label: string, type: ColumnType, extra: Extra = {}): ColumnSpec => ({ key, label, type, ...extra });
const S = (key: string, label: string, extra: Extra = {}) => col(key, label, 'string', extra);
const T = (key: string, label: string, extra: Extra = {}) => col(key, label, 'text', extra);
const I = (key: string, label: string, extra: Extra = {}) => col(key, label, 'integer', extra);
const B = (key: string, label: string, extra: Extra = {}) => col(key, label, 'boolean', extra);
const J = (key: string, label: string, extra: Extra = {}) => col(key, label, 'json', extra);
const E = (key: string, label: string, options: readonly string[], extra: Extra = {}) => col(key, label, 'enum', { options, ...extra });
const PK = (key: string, label: string, type: ColumnType = 'string') => col(key, label, type, { required: true, readOnly: true, maxLength: 128 });
const NOW = (key = 'updated_at') => col(key, '更新时间', 'datetime', { readOnly: true, autoNow: true });

const CURRENCIES = ['coin', 'gem', 'book', 'leaf', 'potion', 'chest', 'medal'] as const;
const QUEST_METRICS = [
  'daily_summons', 'daily_claimed_tiers', 'daily_login_rewards', 'first_purchase',
  'character_count', 'worldtree_level', 'battle_wins', 'contract_purchase', 'none',
  'stage_clear', 'mail_claimed', 'formation_slots', 'summons_total', 'equipment_worn',
  'crafted_total', 'friend_count', 'market_today', 'astrology_nodes', 'equipment_chests',
  'idle_claimed', 'trade_used', 'stars_reached', 'login_days', 'daily_battle_wins',
] as const;

/** 虚拟只读域：运行时 env 参数不落库，服务层直接读 env 组装行。 */
export const RUNTIME_DOMAIN_KEY = 'runtime';

const DOMAIN_SPECS: ConfigDomain[] = [
  /* ------------------------------ 成长与角色 ------------------------------ */
  {
    key: 'level_exp', label: '等级经验表', group: '成长与角色', table: 'level_exp_defs', pk: 'level',
    orderBy: 'level', versionDomain: 'level_exp',
    description: '每级升到下一级所需经验与累计经验。等级域 1–150，末级 exp_required = 0 为封顶标记。',
    columns: [
      PK('level', '等级', 'integer'),
      I('exp_required', '本级所需经验', { min: 0, required: true }),
      I('exp_total', '累计经验', { min: 0, required: true }),
    ],
  },
  {
    key: 'level_stats', label: '等级属性表', group: '成长与角色', table: 'level_stats_defs', pk: 'level',
    orderBy: 'level', versionDomain: 'level_stats',
    description: '属性成长系数（万分比）与暴击/抗性增量。等级须与等级经验表一一对应。',
    columns: [
      PK('level', '等级', 'integer'),
      I('growth_bp', '成长系数(万分比)', { min: 10000, required: true }),
      I('crit_add', '暴击增量', { min: 0, required: true }),
      I('res_add', '抗性增量', { min: 0, required: true }),
    ],
  },
  {
    key: 'classes', label: '职业定义', group: '成长与角色', table: 'class_defs', pk: 'id',
    orderBy: 'id', versionDomain: 'class',
    description: '五大职业的 1 级基础属性与特性。角色通过 role 挂靠职业，删除被引用的职业会被拒绝。',
    columns: [
      PK('id', '职业 ID'), S('name', '职业名', { required: true, maxLength: 32 }),
      T('detail', '描述'), T('trait', '特性'),
      I('health', '生命', { min: 1, required: true }), I('attack', '攻击', { min: 1, required: true }),
      I('defense', '防御', { min: 1, required: true }), I('speed', '速度', { min: 1, required: true }),
      I('critical', '暴击', { min: 0, required: true }), I('resistance', '抗性', { min: 0, required: true }),
    ],
  },
  {
    key: 'characters', label: '食灵角色', group: '成长与角色', table: 'character_defs', pk: 'id',
    orderBy: 'id', versionDomain: 'character',
    description: '可召唤食灵的基础档案。role 必须指向已定义的职业 ID。',
    columns: [
      PK('id', '角色 ID'), S('name', '名称', { required: true, maxLength: 32 }),
      S('title', '称号', { required: true, maxLength: 64 }), S('element', '元素', { required: true, maxLength: 16 }),
      E('rarity', '稀有度', ['R', 'SR', 'SSR'], { required: true }),
      S('role', '职业 ID', { required: true, help: '须为「职业定义」中存在的 ID' }),
      T('detail', '背景故事'), S('portrait', '立绘路径'),
      I('base_power', '基础战力', { min: 1, required: true }),
    ],
  },
  {
    key: 'equipment', label: '装备模板', group: '成长与角色', table: 'equipment_defs', pk: 'id',
    orderBy: 'required_level, id', versionDomain: 'equipment',
    description: '108 件装备模板的属性与穿戴等级。前端启动时由 catalog 全量拉取。',
    columns: [
      PK('id', '装备 ID'), S('name', '名称', { required: true, maxLength: 64 }),
      E('slot', '槽位', ['weapon', 'crown', 'armor', 'charm', 'relic', 'crest'], { required: true }),
      E('rarity', '稀有度', ['rare', 'epic', 'legendary'], { required: true }),
      T('story', '装备故事'),
      I('health', '生命', { min: 0, required: true }), I('attack', '攻击', { min: 0, required: true }),
      I('defense', '防御', { min: 0, required: true }), I('speed', '速度', { min: 0, required: true }),
      I('critical', '暴击', { min: 0, required: true }), I('resistance', '抗性', { min: 0, required: true }),
      I('required_level', '穿戴等级', { min: 1, max: 150, required: true, help: '须落在等级经验表 1–150 内' }),
    ],
  },

  /* ------------------------------ 副本与关卡 ------------------------------ */
  {
    key: 'dungeons', label: '副本定义', group: '副本与关卡', table: 'dungeon_defs', pk: 'id',
    orderBy: 'order_index', versionDomain: 'dungeon',
    description: '副本的双条件解锁：玩家等级 ≥ 解锁等级 且 开服天数 ≥ 解锁开服天。',
    columns: [
      PK('id', '副本 ID'), S('name', '副本名', { required: true, maxLength: 64 }),
      S('english', '英文副标题'), T('description', '描述'),
      I('order_index', '排序', { min: 0, required: true }),
      I('unlock_level', '解锁等级', { min: 1, max: 150, required: true }),
      I('unlock_open_day', '解锁开服天', { min: 1, required: true }),
    ],
  },
  {
    key: 'stages', label: '关卡定义', group: '副本与关卡', table: 'stage_defs', pk: 'id',
    orderBy: 'order_index', versionDomain: 'stage',
    description: '章节关卡与掉落奖励。dungeon_id 决定关卡归属哪个副本；reward_json 为奖励数组。',
    columns: [
      PK('id', '关卡 ID'), S('chapter', '章节', { required: true, maxLength: 32 }),
      S('name', '关卡名', { required: true, maxLength: 64 }),
      I('order_index', '排序', { min: 0, required: true }),
      I('suggested_power', '推荐战力', { min: 1, required: true }),
      S('scene_id', '场景 ID', { nullable: true, help: '关联「场景定义」，可空' }),
      S('dungeon_id', '副本 ID', { nullable: true, help: '关联「副本定义」，可空表示未分组' }),
      J('reward_json', '奖励 JSON', { required: true, default: '[]', help: '数组，如 [{"kind":"coin","amount":100}]' }),
    ],
  },
  {
    key: 'features', label: '功能与活动开关', group: '副本与关卡', table: 'feature_toggles', pk: 'key',
    orderBy: 'sort_index', versionDomain: 'feature',
    description: '主界面入口显隐与活动窗口的唯一数据源。保存后版本自增，客户端下次拉取目录即生效。',
    columns: [
      PK('key', '开关 Key'), S('name', '名称', { required: true, maxLength: 64 }),
      E('category', '分类', ['feature', 'activity', 'system'], { required: true }),
      B('enabled', '启用', { required: true }),
      I('open_day', '开放开服天', { min: 1, nullable: true, help: '留空 = 无下限' }),
      I('close_day', '关闭开服天', { min: 1, nullable: true, help: '留空 = 无上限' }),
      I('sort_index', '排序', { min: 0, required: true }),
      T('detail', '说明'),
    ],
  },

  /* ------------------------------ 任务与邮件 ------------------------------ */
  {
    key: 'quests', label: '任务定义', group: '任务与邮件', table: 'quest_defs', pk: 'id',
    orderBy: 'sort_index', versionDomain: 'quest',
    description: '日常 / 成长 / 主线任务。metric 决定服务端如何计算进度。',
    columns: [
      PK('id', '任务 ID'), E('group_name', '分组', ['日常', '成长', '主线'], { required: true }),
      S('name', '任务名', { required: true, maxLength: 64 }), T('detail', '描述', { required: true }),
      I('target', '目标值', { min: 1, required: true }),
      E('metric', '进度指标', QUEST_METRICS, { required: true }),
      S('ref_id', '引用 ID', { nullable: true, help: 'stage_clear 时填关卡 ID，其余留空' }),
      J('reward_json', '奖励 JSON', { required: true, default: '[]' }),
      I('sort_index', '排序', { min: 0, required: true }),
    ],
  },
  {
    key: 'mails', label: '模板邮件', group: '任务与邮件', table: 'mail_defs', pk: 'id',
    orderBy: 'sort_index', versionDomain: 'mail',
    description: '全服广播的静态邮件模板，玩家在游戏内邮箱逐条领取。',
    columns: [
      PK('id', '邮件 ID'), S('sender', '发件人', { required: true, maxLength: 64 }),
      S('title', '标题', { required: true, maxLength: 64 }),
      T('excerpt', '摘要', { required: true }), S('time_label', '时间标签', { required: true }),
      J('reward_json', '奖励 JSON', { required: true, default: '[]' }),
      I('sort_index', '排序', { min: 0, required: true }),
    ],
  },

  /* ------------------------------ 商店与经济 ------------------------------ */
  {
    key: 'shop_packs', label: '商店礼包', group: '商店与经济', table: 'shop_pack_defs', pk: 'id',
    orderBy: 'sort_index', versionDomain: 'shop_pack',
    description: '灵晶商城礼包（价格、赠送内容、每日限购）。',
    columns: [
      PK('id', '礼包 ID'), S('name', '名称', { required: true, maxLength: 64 }),
      I('price', '价格', { min: 0, required: true }), I('gems', '赠送灵晶', { min: 0, required: true }),
      I('books', '赠送契约', { min: 0, required: true }), S('label', '角标', { required: true }),
      T('note', '备注'), I('daily_limit', '每日限购', { min: 0, required: true }),
      I('sort_index', '排序', { min: 0, required: true }),
    ],
  },
  {
    key: 'trade_rates', label: '兑换比率', group: '商店与经济', table: 'trade_rate_defs', pk: 'id',
    orderBy: 'sort_index', versionDomain: 'trade_rate',
    description: '交易坊货币兑换比率与每日次数上限。',
    columns: [
      PK('id', '比率 ID'), E('give_currency', '付出货币', CURRENCIES, { required: true }),
      I('give_amount', '付出数量', { min: 1, required: true }),
      E('get_currency', '获得货币', CURRENCIES, { required: true }),
      I('get_amount', '获得数量', { min: 1, required: true }),
      I('daily_limit', '每日上限', { min: 1, required: true }),
      I('sort_index', '排序', { min: 0, required: true }),
    ],
  },
  {
    key: 'market_offers', label: '集市货架', group: '商店与经济', table: 'market_offer_defs', pk: 'id',
    orderBy: 'sort_index', versionDomain: 'market_offer',
    description: '每日轮换商店的候选商品池（按服务器自然日确定性轮换）。',
    columns: [
      PK('id', '商品 ID'), E('currency', '货币', CURRENCIES, { required: true }),
      I('amount', '数量', { min: 1, required: true }), I('price', '价格', { min: 1, required: true }),
      S('label', '名称', { required: true, maxLength: 64 }), I('sort_index', '排序', { min: 0, required: true }),
    ],
  },
  {
    key: 'astrology', label: '星象节点', group: '商店与经济', table: 'astrology_node_defs', pk: 'id',
    orderBy: 'order_index', versionDomain: 'astrology',
    description: '占星节点的解锁顺序与灵晶消耗。',
    columns: [
      PK('id', '节点 ID'), S('name', '节点名', { required: true, maxLength: 64 }),
      I('gem_cost', '灵晶消耗', { min: 0, required: true }),
      I('order_index', '排序', { min: 0, required: true }),
    ],
  },

  /* ------------------------------ 战斗内容 ------------------------------ */
  {
    key: 'vfx', label: '特效定义', group: '战斗内容', table: 'vfx_defs', pk: 'id',
    orderBy: 'sort_index', versionDomain: 'vfx',
    description: '客户端表现资产登记表（服务端只存引用与元信息）。',
    columns: [
      PK('id', '特效 ID'), S('name', '名称', { required: true, maxLength: 64 }),
      E('type', '类型', ['hit', 'skill', 'buff', 'ui'], { required: true }),
      S('asset_path', '资源路径', { required: true }),
      I('duration_ms', '时长(ms)', { min: 0, required: true }),
      I('sort_index', '排序', { min: 0, required: true }), NOW(),
    ],
  },
  {
    key: 'skills', label: '技能定义', group: '战斗内容', table: 'skill_defs', pk: 'id',
    orderBy: 'id', versionDomain: 'skill',
    description: '技能系数一律整数万分比（1.25 倍 = 12500），杜绝浮点。',
    columns: [
      PK('id', '技能 ID'), S('name', '名称', { required: true, maxLength: 64 }),
      E('kind', '类型', ['attack', 'heal', 'buff', 'debuff'], { required: true }),
      E('target_type', '目标', ['self', 'ally', 'ally_all', 'enemy', 'enemy_all'], { required: true }),
      I('coefficient_bp', '系数(万分比)', { min: 1, required: true }),
      I('cooldown', '冷却', { min: 0, required: true }),
      S('vfx_id', '特效 ID', { nullable: true }), T('detail', '说明'), NOW(),
    ],
  },
  {
    key: 'enemies', label: '怪物 / Boss', group: '战斗内容', table: 'enemy_defs', pk: 'id',
    orderBy: 'power', versionDomain: 'enemy',
    description: '敌方单位定义。skill_ids / drop_json / phase_json 为 JSON；仅 Boss 可填 phase_json。',
    columns: [
      PK('id', '怪物 ID'), S('name', '名称', { required: true, maxLength: 64 }),
      E('kind', '种类', ['normal', 'elite', 'boss'], { required: true }),
      S('element', '元素', { required: true, maxLength: 16 }),
      I('power', '战力', { min: 1, required: true }), I('health', '生命', { min: 1, required: true }),
      I('attack', '攻击', { min: 1, required: true }), I('defense', '防御', { min: 0, required: true }),
      I('speed', '速度', { min: 0, required: true }),
      J('skill_ids', '技能 ID 数组', { required: true, default: '[]' }),
      S('vfx_id', '特效 ID', { nullable: true }),
      J('drop_json', '掉落 JSON', { required: true, default: '[]' }),
      J('phase_json', 'Boss 阶段 JSON', { nullable: true, help: '非 Boss 请留空' }),
      S('portrait', '立绘'), NOW(),
    ],
  },
  {
    key: 'scenes', label: '场景定义', group: '战斗内容', table: 'scene_defs', pk: 'id',
    orderBy: 'order_index', versionDomain: 'scene',
    description: '主城 / 关卡 / 协会 / 经营 / 活动场景统一登记。',
    columns: [
      PK('id', '场景 ID'), S('name', '名称', { required: true, maxLength: 64 }),
      E('type', '类型', ['battle', 'idle', 'guild', 'manor', 'activity'], { required: true }),
      S('background', '背景图'), S('music', '背景音乐'),
      I('unlock_worldtree_level', '解锁等级', { min: 1, max: 150, required: true }),
      I('order_index', '排序', { min: 0, required: true }), NOW(),
    ],
  },

  /* ------------------------------ 物品与活动 ------------------------------ */
  {
    key: 'items', label: '物品定义', group: '物品与活动', table: 'item_defs', pk: 'id',
    orderBy: 'id', versionDomain: 'item',
    description: '货币之外的材料 / 消耗品 / 宝箱 / 碎片 / 礼包。effect_json 为使用效果。',
    columns: [
      PK('id', '物品 ID'), S('name', '名称', { required: true, maxLength: 64 }),
      E('type', '类型', ['material', 'consumable', 'chest', 'fragment', 'gift'], { required: true }),
      E('rarity', '稀有度', ['common', 'rare', 'epic', 'legendary'], { required: true }),
      B('stackable', '可堆叠', { required: true }),
      I('max_stack', '堆叠上限', { min: 1, required: true }),
      J('effect_json', '使用效果 JSON', { required: true, default: '{}' }),
      I('value', '出售价值', { min: 0, required: true }),
      S('icon', '图标'), T('detail', '说明'), NOW(),
    ],
  },
  {
    key: 'activities', label: '运营活动', group: '物品与活动', table: 'activity_defs', pk: 'id',
    orderBy: 'sort_index', versionDomain: 'activity',
    description: '限时活动的时间窗与档位规则。start_at / end_at 为 ISO 日期时间，end_at 必须晚于 start_at。',
    columns: [
      PK('id', '活动 ID'), S('name', '名称', { required: true, maxLength: 64 }),
      E('type', '类型', ['login', 'charge', 'collect', 'period'], { required: true }),
      S('start_at', '开始时间', { required: true, help: 'ISO 8601，如 2026-11-01T00:00:00.000Z' }),
      S('end_at', '结束时间', { required: true, help: '必须晚于开始时间' }),
      J('config_json', '规则 JSON', { required: true, default: '{}' }),
      J('reward_json', '奖励 JSON', { required: true, default: '[]' }),
      I('sort_index', '排序', { min: 0, required: true }), NOW(),
    ],
  },
  {
    key: 'leaderboards', label: '排行榜定义', group: '物品与活动', table: 'leaderboard_defs', pk: 'id',
    orderBy: 'id', versionDomain: 'leaderboard',
    description: '榜单指标 / 周期 / 容量。period=season 时必须填写 season_key。',
    columns: [
      PK('id', '榜单 ID'), S('name', '名称', { required: true, maxLength: 64 }),
      E('metric', '指标', ['battle_wins', 'power', 'worldtree_level', 'chronicle_points'], { required: true }),
      E('period', '周期', ['all', 'season', 'daily'], { required: true }),
      S('season_key', '赛季 Key', { nullable: true, help: 'period=season 时必填' }),
      I('capacity', '容量', { min: 1, required: true }), NOW(),
    ],
  },
  {
    key: 'guilds', label: '协会（演示）', group: '物品与活动', table: 'guilds', pk: 'id',
    orderBy: 'id', versionDomain: 'guild',
    description: '预置协会档案。已有成员/玩家数据的协会禁止删除，避免影响现有玩法。',
    columns: [
      PK('id', '协会 ID'), S('name', '名称', { required: true, maxLength: 64 }),
      S('english', '英文名', { required: true }),
      I('level', '等级', { min: 1, required: true }), I('capacity', '容量', { min: 1, required: true }),
      T('motto', '宣言'), T('notice', '公告'),
      col('created_at', '创建时间', 'datetime', { readOnly: true, autoNow: true }),
    ],
  },

  /* ------------------------------ 只读运维视图 ------------------------------ */
  {
    key: RUNTIME_DOMAIN_KEY, label: '运行时参数', group: '运行时参数',
    table: '', pk: 'name', orderBy: 'category, name', readOnly: true,
    description: '来自服务器 .env / 进程环境的运行时参数，只读展示。修改需编辑 .env 并重启服务，不会由后台写库。' +
      '凭据类条目（支付签名密钥 / GM 初始口令）值一律打码为 ***，绝不明文回传。',
    columns: [
      PK('name', '参数名'), S('label', '中文名称', { required: true, maxLength: 64 }),
      S('value', '当前值', { required: true }), S('category', '分组', { required: true, maxLength: 32 }),
    ],
  },
  {
    key: 'battle_passes', label: '关卡挑战次数（只读）', group: '运维与版本',
    table: 'battle_passes', pk: 'player_id', orderBy: 'day_key DESC, player_id', readOnly: true,
    description: '玩家每日挑战次数，属于玩家动态数据而非静态配置（PRIMARY KEY (player_id, day_key)）。' +
      'v22 起在后台只读展示，禁止 GM 直接增改删；如需修复请走玩家数据流程，避免绕过服务端权威计数。',
    columns: [
      PK('player_id', '玩家 ID'), S('day_key', '自然日', { required: true, maxLength: 16 }),
      I('used', '已用次数', { min: 0, required: true }),
      I('purchased', '已购挑战卡', { min: 0, max: 6, required: true }),
    ],
  },
  {
    key: 'catalog_versions', label: '配置版本戳', group: '运维与版本', table: 'catalog_meta', pk: 'domain',
    orderBy: 'domain', readOnly: true,
    description: '各配置域的版本号与最后变更时间。每次保存/删除自动 +1，客户端据此判定是否需要重新拉取目录。',
    columns: [
      PK('domain', '配置域'), I('version', '版本', { readOnly: true }),
      col('updated_at', '最后变更', 'datetime', { readOnly: true }),
    ],
  },
  {
    key: 'migrations', label: '数据库迁移记录', group: '运维与版本', table: 'schema_migrations', pk: 'version',
    orderBy: 'version', readOnly: true,
    description: 'append-only 迁移历史，只读。当前结构版本应与最新迁移号一致。',
    columns: [
      PK('version', '版本', 'integer'), S('name', '迁移名', { readOnly: true }),
      col('applied_at', '执行时间', 'datetime', { readOnly: true }),
    ],
  },
];

/**
 * 对外注册表：补齐契约要求的 primaryKey / domain 别名，内部逻辑仍用 pk / versionDomain。
 * 这样 GM 后台拿到的域对象同时具备 { key, label, table, primaryKey, columns, domain, readOnly }。
 */
export const CONFIG_DOMAINS: ConfigDomain[] = DOMAIN_SPECS.map(spec => ({
  ...spec,
  primaryKey: spec.pk,
  domain: spec.versionDomain ?? null,
}));

export const CONFIG_DOMAIN_MAP = new Map(CONFIG_DOMAINS.map(domain => [domain.key, domain]));

export function getConfigDomain(key: string): ConfigDomain | undefined {
  return CONFIG_DOMAIN_MAP.get(key);
}

/** 所有可写配置域的 catalog_meta 版本域（供 catalog 增量下发使用）。 */
export const CATALOG_VERSION_DOMAINS: string[] = CONFIG_DOMAINS
  .filter(domain => !domain.readOnly && domain.versionDomain)
  .map(domain => domain.versionDomain as string);

/** 按版本域反查配置域（catalog 增量下发兜底用）。 */
export function getConfigDomainByVersion(versionDomain: string): ConfigDomain | undefined {
  return CONFIG_DOMAINS.find(domain => domain.versionDomain === versionDomain);
}

/** 静态配置表名集合：外键引用检查时用于区分「配置表」与「玩家数据表」；虚拟域无表名，排除。 */
export const CONFIG_TABLES = new Set(CONFIG_DOMAINS.map(domain => domain.table).filter(Boolean));
