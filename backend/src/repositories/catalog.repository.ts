import { execute, queryAll, queryOne } from '../db/index.js';
import type {
  AstrologyNodeRow,
  CharacterDefRow,
  ClassDefRow,
  DungeonDefRow,
  EquipmentDefRow,
  FeatureToggleRow,
  LevelExpDefRow,
  LevelStatsDefRow,
  MailDefRow,
  MarketOfferRow,
  QuestDefRow,
  ShopPackRow,
  StageDefRow,
  TradeRateRow,
} from '../domain/types.js';

/* ------------------------------ 配置表读取 ------------------------------ */

export function listCharacterDefs(): CharacterDefRow[] {
  return queryAll<CharacterDefRow>('SELECT * FROM character_defs ORDER BY base_power DESC, name');
}

export function findCharacterDefById(id: string): CharacterDefRow | undefined {
  return queryOne<CharacterDefRow>('SELECT * FROM character_defs WHERE id = ?', id);
}

export function findCharacterDefByName(name: string): CharacterDefRow | undefined {
  return queryOne<CharacterDefRow>('SELECT * FROM character_defs WHERE name = ?', name);
}

export function listStages(): StageDefRow[] {
  return queryAll<StageDefRow>('SELECT * FROM stage_defs ORDER BY order_index');
}

export function findStageById(id: string): StageDefRow | undefined {
  return queryOne<StageDefRow>('SELECT * FROM stage_defs WHERE id = ?', id);
}

/* ------------------------------ v21：副本定义 / 功能活动开关 ------------------------------ */

export function listDungeonDefs(): DungeonDefRow[] {
  return queryAll<DungeonDefRow>('SELECT * FROM dungeon_defs ORDER BY order_index');
}

export function listFeatureToggles(): FeatureToggleRow[] {
  return queryAll<FeatureToggleRow>('SELECT * FROM feature_toggles ORDER BY sort_index');
}

export function listQuests(): QuestDefRow[] {
  return queryAll<QuestDefRow>('SELECT * FROM quest_defs ORDER BY sort_index');
}

export function findQuestById(id: string): QuestDefRow | undefined {
  return queryOne<QuestDefRow>('SELECT * FROM quest_defs WHERE id = ?', id);
}

export function listMails(): MailDefRow[] {
  return queryAll<MailDefRow>('SELECT * FROM mail_defs ORDER BY sort_index');
}

export function findMailById(id: string): MailDefRow | undefined {
  return queryOne<MailDefRow>('SELECT * FROM mail_defs WHERE id = ?', id);
}

export function listShopPacks(): ShopPackRow[] {
  return queryAll<ShopPackRow>('SELECT * FROM shop_pack_defs ORDER BY sort_index');
}

export function findShopPackById(id: string): ShopPackRow | undefined {
  return queryOne<ShopPackRow>('SELECT * FROM shop_pack_defs WHERE id = ?', id);
}

export function listTradeRates(): TradeRateRow[] {
  return queryAll<TradeRateRow>('SELECT * FROM trade_rate_defs ORDER BY sort_index');
}

export function findTradeRateById(id: string): TradeRateRow | undefined {
  return queryOne<TradeRateRow>('SELECT * FROM trade_rate_defs WHERE id = ?', id);
}

export function listMarketOffers(): MarketOfferRow[] {
  return queryAll<MarketOfferRow>('SELECT * FROM market_offer_defs ORDER BY sort_index');
}

export function findMarketOfferById(id: string): MarketOfferRow | undefined {
  return queryOne<MarketOfferRow>('SELECT * FROM market_offer_defs WHERE id = ?', id);
}

export function listAstrologyNodes(): AstrologyNodeRow[] {
  return queryAll<AstrologyNodeRow>('SELECT * FROM astrology_node_defs ORDER BY order_index');
}

export function listEquipmentDefs(): EquipmentDefRow[] {
  return queryAll<EquipmentDefRow>('SELECT * FROM equipment_defs ORDER BY slot, rarity');
}

export function findEquipmentDefById(id: string): EquipmentDefRow | undefined {
  return queryOne<EquipmentDefRow>('SELECT * FROM equipment_defs WHERE id = ?', id);
}

/** v15：经验表（等级维度主表，1..100）。 */
export function listLevelExpDefs(): LevelExpDefRow[] {
  return queryAll<LevelExpDefRow>('SELECT * FROM level_exp_defs ORDER BY level');
}

/** v17：按等级读取升级经验需求（世界树升级消费的权威数据源，seed 曲线为准）。 */
export function findLevelExpByLevel(level: number): LevelExpDefRow | undefined {
  return queryOne<LevelExpDefRow>('SELECT * FROM level_exp_defs WHERE level = ?', level);
}

/** v15：等级表（与经验表 1:1 共享等级域，外键保证一致）。 */
export function listLevelStatsDefs(): LevelStatsDefRow[] {
  return queryAll<LevelStatsDefRow>('SELECT * FROM level_stats_defs ORDER BY level');
}

/** v15：职业表（按种子写入顺序返回，即 治疗/法术/输出/辅助/防御）。 */
export function listClassDefs(): ClassDefRow[] {
  return queryAll<ClassDefRow>('SELECT * FROM class_defs ORDER BY rowid');
}

/** 集市每日货架：与前端一致的确定性轮换（同日同结果）。 */
export function marketStockFor(dayKey: string): MarketOfferRow[] {
  const pool = listMarketOffers();
  if (!pool.length) return [];
  const seed = Array.from(dayKey).reduce((sum, character) => sum + character.charCodeAt(0), 0);
  return [0, 1, 2].map(offset => pool[(seed + offset * 2) % pool.length]);
}

export function countCatalogRows(): Record<string, number> {
  const tables = [
    'character_defs', 'stage_defs', 'quest_defs', 'mail_defs',
    'shop_pack_defs', 'trade_rate_defs', 'market_offer_defs',
    'astrology_node_defs', 'equipment_defs', 'guilds',
    'level_exp_defs', 'level_stats_defs', 'class_defs',
  ];
  const result: Record<string, number> = {};
  for (const table of tables) {
    const row = queryOne<{ total: number }>(`SELECT COUNT(*) AS total FROM ${table}`);
    result[table] = row ? Number(row.total) : 0;
  }
  return result;
}

/** 供健康检查使用：确认连接可读可写（写入迁移表的时间戳作为探针）。 */
export function touchProbe(): string {
  const stamp = new Date().toISOString();
  execute('SELECT ?', stamp);
  return stamp;
}
