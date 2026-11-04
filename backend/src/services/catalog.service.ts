import { execute, queryAll, queryOne } from '../db/index.js';
import { dayKey, nowIso } from '../lib/clock.js';
import { env } from '../config/env.js';
import { CATALOG_VERSION_DOMAINS, getConfigDomainByVersion } from '../config/config-domains.js';
import { parseJsonArray, parseJsonObject, type Reward } from '../domain/types.js';
import { getAllCatalogVersions, getCatalogVersion } from '../repositories/catalog-meta.repository.js';
import {
  listAstrologyNodes,
  listCharacterDefs,
  listClassDefs,
  listDungeonDefs,
  listEquipmentDefs,
  listFeatureToggles,
  listLevelExpDefs,
  listLevelStatsDefs,
  listMails,
  listMarketOffers,
  listQuests,
  listShopPacks,
  listStages,
  listTradeRates,
  marketStockFor,
} from '../repositories/catalog.repository.js';
import { listEnemyDefs } from '../repositories/enemy.repository.js';
import { listSkillDefs } from '../repositories/skill.repository.js';
import { listVfxDefs } from '../repositories/vfx.repository.js';
import { listSceneDefs } from '../repositories/scene.repository.js';
import { listItemDefs } from '../repositories/item.repository.js';
import { listAllActivities } from '../repositories/activity.repository.js';
import { listLeaderboardDefs } from '../repositories/leaderboard.repository.js';

/** 静态配置统一出口：客户端启动时拉一次即可缓存。 */
export function getCatalog() {
  return {
    characters: listCharacterDefs().map(row => ({
      id: row.id,
      name: row.name,
      title: row.title,
      element: row.element,
      rarity: row.rarity,
      role: row.role,
      detail: row.detail,
      basePower: row.base_power,
    })),
    stages: listStages().map(row => ({
      id: row.id,
      chapter: row.chapter,
      name: row.name,
      suggestedPower: row.suggested_power,
      /* v21：副本归属（前端按副本分组展示；NULL 兜底为 null，前端归入「未分组」不展示） */
      dungeonId: row.dungeon_id ?? null,
      rewards: parseJsonArray<Reward>(row.reward_json),
    })),
    /* v21：副本定义——解锁条件（unlockLevel 玩家等级 / unlockOpenDay 开服天数）随行下发，
       具体解锁态由前端用玩家等级 + serverOpenDate 自行计算（catalog 为全服静态配置，无玩家上下文） */
    dungeons: listDungeonDefs().map(row => ({
      id: row.id,
      name: row.name,
      english: row.english,
      description: row.description,
      order: row.order_index,
      unlockLevel: row.unlock_level,
      unlockOpenDay: row.unlock_open_day,
    })),
    /* v21：功能与活动开关——前端主界面入口显隐与活动窗口的唯一数据源 */
    features: listFeatureToggles().map(row => ({
      key: row.key,
      name: row.name,
      category: row.category,
      enabled: row.enabled === 1,
      openDay: row.open_day,
      closeDay: row.close_day,
      detail: row.detail,
    })),
    quests: listQuests().map(row => ({
      id: row.id,
      group: row.group_name,
      name: row.name,
      detail: row.detail,
      target: row.target,
      rewards: parseJsonArray<Reward>(row.reward_json),
    })),
    mails: listMails().map(row => ({
      id: row.id,
      sender: row.sender,
      title: row.title,
      excerpt: row.excerpt,
      time: row.time_label,
      rewards: parseJsonArray<Reward>(row.reward_json),
    })),
    shopPacks: listShopPacks().map(row => ({
      id: row.id,
      name: row.name,
      price: row.price,
      gems: row.gems,
      books: row.books,
      label: row.label,
      note: row.note,
    })),
    tradeRates: listTradeRates().map(row => ({
      id: row.id,
      give: { kind: row.give_currency, amount: row.give_amount },
      get: { kind: row.get_currency, amount: row.get_amount },
      dailyLimit: row.daily_limit,
    })),
    marketOffers: listMarketOffers().map(row => ({
      id: row.id,
      label: row.label,
      kind: row.currency,
      price: row.price,
      amount: row.amount,
    })),
    astrology: listAstrologyNodes().map(row => ({
      id: row.id,
      name: row.name,
      cost: row.gem_cost,
    })),
    equipment: listEquipmentDefs().map(row => ({
      id: row.id,
      name: row.name,
      slot: row.slot,
      rarity: row.rarity,
      story: row.story,
      stats: {
        health: row.health,
        attack: row.attack,
        defense: row.defense,
        speed: row.speed,
        critical: row.critical,
        resistance: row.resistance,
      },
      requiredLevel: row.required_level,
    })),
    /* v15：等级维度（经验表 + 等级表 1:1 合并下发；growthBp 为万分比成长系数） */
    levels: (() => {
      const statsByLevel = new Map(listLevelStatsDefs().map(row => [row.level, row]));
      return listLevelExpDefs().map(row => {
        const stats = statsByLevel.get(row.level);
        return {
          level: row.level,
          expRequired: row.exp_required,
          expTotal: row.exp_total,
          growthBp: stats?.growth_bp ?? 10000,
          critAdd: stats?.crit_add ?? 0,
          resAdd: stats?.res_add ?? 0,
        };
      });
    })(),
    /* v15：职业表（基础 1 级属性与特性） */
    classes: listClassDefs().map(row => ({
      id: row.id,
      name: row.name,
      detail: row.detail,
      trait: row.trait,
      baseStats: {
        health: row.health,
        attack: row.attack,
        defense: row.defense,
        speed: row.speed,
        critical: row.critical,
        resistance: row.resistance,
      },
    })),
    /* v21：开服时间——副本/功能「开服第 N 天」解锁窗口的计算基准（开服日当天 = 第 1 天） */
    serverOpenDate: resolveServerOpenDate(),
    serverOpenDay: serverOpenDay(),
  };
}

/** 今日集市货架（按服务器自然日确定性轮换）。 */
export function getTodayMarket() {
  return {
    date: dayKey(),
    offers: marketStockFor(dayKey()).map(row => ({
      id: row.id,
      label: row.label,
      kind: row.currency,
      price: row.price,
      amount: row.amount,
    })),
  };
}

/**
 * 配置热更新（v7 catalog_meta，§5.2；v22 扩展到全部可写配置域）。
 * 版本域清单统一取自 config/config-domains.ts —— 后台改任意配置都会 bump 对应域，
 * 增量客户端只要比对 since 就能拿到全部变化，不再只覆盖 7 个旧域。
 *
 * 生效语义：配置值写库即生效，并同步 bump 该域版本；客户端下次启动拉取
 * /api/catalog 时拿到全量新值（或带 since 拉取时从 changes 感知变更域）。
 * 前端 v22 起在页面重新可见时也会带上次版本戳重拉，无需重启页面。
 */
const CATALOG_DOMAINS = CATALOG_VERSION_DOMAINS;

/* ------------------------------ v21：开服日期与开服天数 ------------------------------ */

const SERVER_OPEN_DATE_DOMAIN = 'server_open_date';
const ISO_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

/**
 * 开服日期（YYYY-MM-DD）。优先级：env SERVER_OPEN_DATE > catalog_meta 首次持久化日期。
 * 未配置 env 时把首次启动日期写入 catalog_meta（domain=server_open_date，updated_at
 * 承载日期；version 写 1 以满足该表 CHECK(version >= 1)，数值本身无语义），
 * 之后重启稳定复用——开服天数只增不减。
 */
export function resolveServerOpenDate(): string {
  const fromEnv = env.serverOpenDate?.trim();
  if (fromEnv && ISO_DATE_PATTERN.test(fromEnv)) return fromEnv;

  const row = queryOne<{ updated_at: string }>(
    'SELECT updated_at FROM catalog_meta WHERE domain = ?',
    SERVER_OPEN_DATE_DOMAIN,
  );
  if (row) return row.updated_at.slice(0, 10);

  const today = nowIso().slice(0, 10);
  execute(
    'INSERT INTO catalog_meta (domain, version, updated_at) VALUES (?, 1, ?) ON CONFLICT(domain) DO NOTHING',
    SERVER_OPEN_DATE_DOMAIN,
    today,
  );
  return today;
}

/** 今天是开服第几天（开服日当天 = 1，最小 1）。 */
export function serverOpenDay(): number {
  const open = new Date(`${resolveServerOpenDate()}T00:00:00`);
  const today = new Date(`${dayKey()}T00:00:00`);
  const days = Math.floor((today.getTime() - open.getTime()) / 86_400_000) + 1;
  return Math.max(1, days);
}

/** 按域下发配置（camelCase DTO，客户端增量合入）。 */
export function listDomainConfigs(domain: string): unknown {
  switch (domain) {
    case 'enemy':
      return listEnemyDefs().map(row => ({
        id: row.id,
        name: row.name,
        kind: row.kind,
        element: row.element,
        power: row.power,
        health: row.health,
        attack: row.attack,
        defense: row.defense,
        speed: row.speed,
        skills: parseJsonArray<string>(row.skill_ids),
        vfxId: row.vfx_id,
        drops: parseJsonArray<{ kind: string; amount: number; rate_bp: number }>(row.drop_json),
        phases: parseJsonObject<unknown[]>(row.phase_json),
        portrait: row.portrait,
      }));
    case 'skill':
      return listSkillDefs().map(row => ({
        id: row.id,
        name: row.name,
        kind: row.kind,
        targetType: row.target_type,
        coefficientBp: row.coefficient_bp,
        cooldown: row.cooldown,
        vfxId: row.vfx_id,
        detail: row.detail,
      }));
    case 'vfx':
      return listVfxDefs().map(row => ({
        id: row.id,
        name: row.name,
        type: row.type,
        assetPath: row.asset_path,
        durationMs: row.duration_ms,
      }));
    case 'scene':
      return listSceneDefs().map(row => ({
        id: row.id,
        name: row.name,
        type: row.type,
        background: row.background,
        music: row.music,
        unlockWorldtreeLevel: row.unlock_worldtree_level,
      }));
    case 'item':
      return listItemDefs().map(row => ({
        id: row.id,
        name: row.name,
        type: row.type,
        rarity: row.rarity,
        stackable: row.stackable === 1,
        maxStack: row.max_stack,
        value: row.value,
        icon: row.icon,
        detail: row.detail,
      }));
    case 'activity':
      return listAllActivities().map(row => ({
        id: row.id,
        name: row.name,
        type: row.type,
        startAt: row.start_at,
        endAt: row.end_at,
      }));
    case 'leaderboard':
      return listLeaderboardDefs().map(row => ({
        id: row.id,
        name: row.name,
        metric: row.metric,
        period: row.period,
        seasonKey: row.season_key,
        capacity: row.capacity,
      }));
    default: {
      // v22：其余配置域（副本/关卡/装备/任务/商店/等级表…）由注册表兜底回传「原始行」
      // （snake_case 列名，未经 camelCase DTO 转换）。版本戳由写操作统一 bump，
      // 客户端可仅凭 versions 判定变化；像 level_exp_defs 150 行这类大表若不需要
      // 全量内容，可只消费 versions 变化通知而不使用 changes 明细。
      const spec = getConfigDomainByVersion(domain);
      if (!spec || !spec.table) return [];
      const allowed = new Set(spec.columns.map(column => column.key));
      const orderTokens = spec.orderBy.split(',').map(part => part.trim().split(/\s+/)[0]);
      if (orderTokens.some(token => !allowed.has(token))) return [];
      return queryAll(`SELECT * FROM "${spec.table}" ORDER BY ${spec.orderBy}`);
    }
  }
}

/**
 * 增量下发：客户端携带上次同步的版本映射，服务端只回传有变化的域。
 * since 缺省时 changes 为空对象（客户端首次拉全量 getCatalog）。
 *
 * v22：版本为 0 且客户端从未上报过该域的，视为「从未变更」，不进入 changes ——
 * 否则首次带 since 的请求会把 150 行 level_exp_defs 等大表一起塞进响应。
 * 所有域的当前版本始终通过 versions 全量返回（即「只走版本变化通知」的通道）。
 */
export function getCatalogDelta(since?: Record<string, number>): { versions: Record<string, number>; changes: Record<string, unknown> } {
  const versions = getAllCatalogVersions();
  const changes: Record<string, unknown> = {};
  if (since) {
    for (const domain of CATALOG_DOMAINS) {
      const current = getCatalogVersion(domain);
      const known = since[domain];
      if (known === current) continue;
      if (known === undefined && current === 0) continue;
      changes[domain] = listDomainConfigs(domain);
    }
  }
  return { versions, changes };
}
