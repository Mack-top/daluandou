import { closeDatabase, connectDatabase, execute, queryAll, queryOne, type SqlValue } from './index.js';
import { isMain } from '../lib/is-main.js';
import { nowIso } from '../lib/clock.js';
import { runMigrations } from './migrate.js';
import { env } from '../config/env.js';
import { hashPassword } from '../lib/password.js';
import { bumpCatalogVersion } from '../repositories/catalog-meta.repository.js';
import { insertEnemyDef, validateSkillIds } from '../repositories/enemy.repository.js';
import { insertSkillDef } from '../repositories/skill.repository.js';
import { insertVfxDef } from '../repositories/vfx.repository.js';
import { insertSceneDef } from '../repositories/scene.repository.js';
import { insertItemDef } from '../repositories/item.repository.js';
import { insertActivityDef } from '../repositories/activity.repository.js';
import { insertLeaderboardDef } from '../repositories/leaderboard.repository.js';
import { growthBp } from '../domain/power.js';
import { insertGmAccount, findGmByUsername } from '../repositories/gm.repository.js';
import { unprocessable } from '../lib/errors.js';

type Row = Record<string, SqlValue>;

/**
 * 通用 upsert：配置表以业务 id 为主键，重复执行只更新不删除。
 * 不使用 INSERT OR REPLACE —— 那是「先删后插」，会连带触发外键级联。
 */
function upsert(table: string, row: Row, key = 'id'): void {
  const columns = Object.keys(row);
  const placeholders = columns.map(() => '?').join(', ');
  const assignments = columns
    .filter(column => column !== key)
    .map(column => `${column} = excluded.${column}`)
    .join(', ');
  execute(
    `INSERT INTO ${table} (${columns.join(', ')}) VALUES (${placeholders})
     ON CONFLICT(${key}) DO UPDATE SET ${assignments}`,
    ...columns.map(column => row[column]),
  );
}

const json = (value: unknown): string => JSON.stringify(value);

/* ------------------------------ 食灵 ------------------------------ */
const CHARACTERS = [
  { id: 'qing', name: '青团', title: '春山的来信', element: '自然', rarity: 'SR', role: '治疗', power: 9000, detail: '温柔的灵界引路人，擅长以自然之力治愈伙伴。' },
  { id: 'blue-cheese', name: '蓝纹奶酪', title: '星夜的咏叹', element: '水', rarity: 'SSR', role: '法术', power: 12000, detail: '掌控冰蓝星辉的魔法师，以群体魔法守护重要之人。' },
  { id: 'tom-yum', name: '冬阴功', title: '绯色的盛宴', element: '火', rarity: 'SSR', role: '输出', power: 12000, detail: '来自炽热国度的食灵，奏响热烈而坚定的生命乐章。' },
  { id: 'lafite', name: '拉菲', title: '金色的约定', element: '光', rarity: 'SSR', role: '辅助', power: 12000, detail: '优雅从容的契约使者，愿与你一同探索世界的滋味。' },
  { id: 'curry', name: '咖喱', title: '流金的祝福', element: '土', rarity: 'SSR', role: '防御', power: 12000, detail: '被黄金守护灵眷顾的旅者，以温暖的力量支援同伴。' },
] as const;

/* ------------------------------ 关卡 ------------------------------ */
/**
 * v17 seed v2：9 → 21 关（设计 §1/§8）。
 * 锚点 = 可达战力曲线插值（suggest = 可达战力 × 0.6~0.75），全程单调递增：
 *   7000(1-1) → 393000(6-3)，旧 9 关锚全部重校（旧锚在 L46 后超出可达上限 33–55%）。
 * 关卡 id 保持稳定（MQ 任务链 / 存档 stageClears 引用不变）；无尽回廊 = 第六章 6-x。
 */
const STAGES = [
  { id: '1-1', chapter: '第一章', name: '初春试炼', order: 1, power: 7000, rewards: [{ kind: 'coin', amount: 10000, label: '金币' }, { kind: 'leaf', amount: 30, label: '食灵精华' }] },
  { id: '1-2', chapter: '第一章', name: '月桥晨集', order: 2, power: 16000, rewards: [{ kind: 'coin', amount: 20000, label: '金币' }, { kind: 'leaf', amount: 40, label: '食灵精华' }] },
  { id: '2-1', chapter: '第二章', name: '茶田小筑', order: 3, power: 28000, rewards: [{ kind: 'coin', amount: 35000, label: '金币' }, { kind: 'leaf', amount: 50, label: '食灵精华' }] },
  { id: '2-2', chapter: '第二章', name: '桂香巷', order: 4, power: 34000, rewards: [{ kind: 'coin', amount: 45000, label: '金币' }, { kind: 'gem', amount: 10, label: '灵晶' }] },
  { id: '2-3', chapter: '第二章', name: '茶庭小径', order: 5, power: 40000, rewards: [{ kind: 'coin', amount: 60000, label: '金币' }, { kind: 'leaf', amount: 60, label: '食灵精华' }] },
  { id: '2-4', chapter: '第二章', name: '石桥夜雨', order: 6, power: 55000, rewards: [{ kind: 'coin', amount: 80000, label: '金币' }, { kind: 'gem', amount: 15, label: '灵晶' }] },
  { id: '3-1', chapter: '第三章', name: '月下酒窖', order: 7, power: 68000, rewards: [{ kind: 'coin', amount: 120000, label: '金币' }, { kind: 'potion', amount: 60000, label: '灵味原浆' }] },
  { id: '3-2', chapter: '第三章', name: '钟塔回廊', order: 8, power: 95000, rewards: [{ kind: 'book', amount: 1, label: '食灵契约' }, { kind: 'coin', amount: 150000, label: '金币' }] },
  { id: '3-3', chapter: '第三章', name: '星辉酒窖', order: 9, power: 108000, rewards: [{ kind: 'coin', amount: 170000, label: '金币' }, { kind: 'leaf', amount: 80, label: '食灵精华' }] },
  { id: '3-4', chapter: '第三章', name: '醉月天台', order: 10, power: 120000, rewards: [{ kind: 'coin', amount: 200000, label: '金币' }, { kind: 'gem', amount: 20, label: '灵晶' }] },
  { id: '4-1', chapter: '第四章', name: '雾隐后厨 · 冷房', order: 11, power: 130000, rewards: [{ kind: 'coin', amount: 220000, label: '金币' }, { kind: 'leaf', amount: 90, label: '食灵精华' }] },
  { id: '4-2', chapter: '第四章', name: '雾隐后厨 · 灶山火径', order: 12, power: 145000, rewards: [{ kind: 'coin', amount: 260000, label: '金币' }, { kind: 'potion', amount: 90000, label: '灵味原浆' }] },
  { id: '4-3', chapter: '第四章', name: '试味之厅', order: 13, power: 160000, rewards: [{ kind: 'gem', amount: 25, label: '灵晶' }, { kind: 'coin', amount: 280000, label: '金币' }] },
  { id: '4-4', chapter: '第四章', name: '雾隐后厨 · 蒸笼巷', order: 14, power: 175000, rewards: [{ kind: 'coin', amount: 320000, label: '金币' }, { kind: 'leaf', amount: 100, label: '食灵精华' }] },
  { id: '4-5', chapter: '第四章', name: '雾隐后厨 · 灶王殿', order: 15, power: 190000, rewards: [{ kind: 'coin', amount: 360000, label: '金币' }, { kind: 'gem', amount: 30, label: '灵晶' }] },
  { id: '5-1', chapter: '终章', name: '忘川宴席', order: 16, power: 205000, rewards: [{ kind: 'book', amount: 2, label: '食灵契约' }, { kind: 'coin', amount: 360000, label: '金币' }] },
  { id: '5-2', chapter: '终章', name: '忘川渡口', order: 17, power: 235000, rewards: [{ kind: 'coin', amount: 420000, label: '金币' }, { kind: 'leaf', amount: 120, label: '食灵精华' }] },
  { id: '5-3', chapter: '终章', name: '月城之巅', order: 18, power: 265000, rewards: [{ kind: 'gem', amount: 40, label: '灵晶' }, { kind: 'coin', amount: 480000, label: '金币' }] },
  { id: '6-1', chapter: '无尽回廊', name: '无尽回廊 · 一巡', order: 19, power: 350000, rewards: [{ kind: 'coin', amount: 600000, label: '金币' }, { kind: 'book', amount: 1, label: '食灵契约' }] },
  { id: '6-2', chapter: '无尽回廊', name: '无尽回廊 · 二巡', order: 20, power: 371000, rewards: [{ kind: 'coin', amount: 700000, label: '金币' }, { kind: 'gem', amount: 60, label: '灵晶' }] },
  { id: '6-3', chapter: '无尽回廊', name: '无尽回廊 · 三巡', order: 21, power: 393000, rewards: [{ kind: 'book', amount: 3, label: '食灵契约' }, { kind: 'coin', amount: 900000, label: '金币' }, { kind: 'medal', amount: 1, label: '稀有徽章' }] },
] as const;

/* ------------------------------ 副本（v21） ------------------------------ */
/**
 * 关卡的上层组织单位。解锁双条件：玩家等级 ≥ unlock_level 且开服天数 ≥ unlock_open_day。
 * 等级线对齐 pacing 章节节奏（CHAPTER_PACE）：第二章约 8 级、第三章约 18 级、第四章约 30 级、
 * 终章 60 级、无尽回廊 80 级；unlock_level 略低于节奏线，保证玩家推进到该章节时可立即进入。
 */
const DUNGEON_DEFS = [
  { id: 'dungeon-ch1', name: '月城食缘', english: 'CHAPTER I', description: '春山初醒，与食灵一同完成月桥下的第一次试炼。', order: 1, unlockLevel: 1, unlockOpenDay: 1 },
  { id: 'dungeon-ch2', name: '桂香茶语', english: 'CHAPTER II', description: '飘散茶香的小径深处，巡夜灯灵在浓雾中等待点亮。', order: 2, unlockLevel: 5, unlockOpenDay: 1 },
  { id: 'dungeon-ch3', name: '醉月星辰', english: 'CHAPTER III', description: '月下酒窖酝酿已久，钟塔回廊的守卫正等待挑战。', order: 3, unlockLevel: 15, unlockOpenDay: 2 },
  { id: 'dungeon-ch4', name: '雾隐后厨', english: 'CHAPTER IV', description: '经年不化的冷房、燃烧的灶山——无面厨师还在试最后一道菜。', order: 4, unlockLevel: 31, unlockOpenDay: 3 },
  { id: 'dungeon-final', name: '忘川之宴', english: 'FINALE', description: '忘川雾上的残宴将散未散。这一次，坐下来把饭吃完。', order: 5, unlockLevel: 60, unlockOpenDay: 5 },
  { id: 'dungeon-endless', name: '无尽回廊', english: 'ENDLESS CORRIDOR', description: '没有尽头的巡礼，每一巡都比上一巡更接近月城的秘密。', order: 6, unlockLevel: 80, unlockOpenDay: 7 },
] as const;

/** 章节 → 副本映射（种子写入 stage_defs.dungeon_id 用；STAGES 常量本身保持不动） */
const DUNGEON_BY_CHAPTER: Record<string, string> = {
  '第一章': 'dungeon-ch1',
  '第二章': 'dungeon-ch2',
  '第三章': 'dungeon-ch3',
  '第四章': 'dungeon-ch4',
  '终章': 'dungeon-final',
  '无尽回廊': 'dungeon-endless',
};

/* ------------------------------ 功能与活动开关（v21） ------------------------------ */
/**
 * 运营开关的种子基线。category：feature=常驻功能入口 / activity=限时活动 / system=系统级。
 * enabled=1 全开；限时活动给 open_day/close_day 窗口（开服第 N 天），NULL = 无界。
 * 前端主界面入口按此过滤显隐；GM 可通过配置接口修改并 bump 版本动态生效。
 */
const FEATURE_TOGGLES = [
  // —— 常驻功能入口（feature）——
  { key: 'trade', name: '交易坊', category: 'feature', enabled: 1, openDay: null, closeDay: null, detail: '闲置资源每日兑换' },
  { key: 'shop', name: '灵晶商城', category: 'feature', enabled: 1, openDay: null, closeDay: null, detail: '灵晶直购礼包' },
  { key: 'chronicle', name: '街巷食神记', category: 'feature', enabled: 1, openDay: null, closeDay: null, detail: '每日限时玩法' },
  { key: 'market', name: '集市', category: 'feature', enabled: 1, openDay: null, closeDay: null, detail: '每日轮换货架' },
  { key: 'workshop', name: '研制坊', category: 'feature', enabled: 1, openDay: null, closeDay: null, detail: '灵味原浆炼制' },
  { key: 'timehouse', name: '时光屋', category: 'feature', enabled: 1, openDay: null, closeDay: null, detail: '挂机收益领取' },
  { key: 'astrology', name: '占星', category: 'feature', enabled: 1, openDay: null, closeDay: null, detail: '星图节点解锁' },
  { key: 'worldtree', name: '世界树', category: 'feature', enabled: 1, openDay: null, closeDay: null, detail: '掌灶人等级成长' },
  { key: 'quest', name: '旅途委托', category: 'feature', enabled: 1, openDay: null, closeDay: null, detail: '每日与成长任务' },
  { key: 'mail', name: '旅者信箱', category: 'feature', enabled: 1, openDay: null, closeDay: null, detail: '系统邮件与附件' },
  { key: 'friend', name: '同行伙伴', category: 'feature', enabled: 1, openDay: null, closeDay: null, detail: '好友与在线状态' },
  { key: 'guild', name: '食灵协会', category: 'feature', enabled: 1, openDay: 3, closeDay: null, detail: '协会玩法（开服第 3 天开放）' },
  { key: 'chat', name: '灵界信使', category: 'feature', enabled: 1, openDay: null, closeDay: null, detail: '世界与协会频道' },
  { key: 'ranking', name: '灵界排行榜', category: 'feature', enabled: 1, openDay: null, closeDay: null, detail: '全服榜单' },
  // —— 限时活动（activity，开服天窗口）——
  { key: 'seven', name: '七日之约', category: 'activity', enabled: 1, openDay: 1, closeDay: 7, detail: '开服前 7 天每日签到豪礼' },
  { key: 'events', name: '开服活动', category: 'activity', enabled: 1, openDay: 1, closeDay: 14, detail: '开服庆典活动总览' },
  { key: 'first', name: '首充赠礼', category: 'activity', enabled: 1, openDay: 1, closeDay: 30, detail: '首次充值邂逅五星食灵' },
  { key: 'contract', name: '契约特惠', category: 'activity', enabled: 1, openDay: 1, closeDay: 30, detail: '金色契约限时特惠' },
  { key: 'level', name: '等级礼包', category: 'activity', enabled: 1, openDay: 1, closeDay: null, detail: '珍藏每一步成长' },
  { key: 'daily', name: '每日充值', category: 'activity', enabled: 1, openDay: 1, closeDay: null, detail: '每日一份小确幸' },
  { key: 'activity', name: '活动中心', category: 'activity', enabled: 1, openDay: 1, closeDay: null, detail: '战令 / 基金 / 卡包总览' },
] as const;

/* ------------------------------ 任务 ------------------------------ */
type SeedQuest = {
  id: string;
  group: '日常' | '成长' | '主线';
  name: string;
  detail: string;
  target: number;
  metric: string;
  /** v14：stage_clear 的关卡引用；其余 metric 不传 */
  ref?: string;
  rewards: ReadonlyArray<{ kind: string; amount: number; label: string }>;
};
const QUESTS: readonly SeedQuest[] = [
  { id: 'summon', group: '日常', name: '食灵召唤', detail: '今日召唤 1 次食灵', target: 1, metric: 'daily_summons', rewards: [{ kind: 'coin', amount: 50000, label: '金币' }] },
  { id: 'daily-gift', group: '日常', name: '领取每日礼遇', detail: '在每日充值中领取任意档位奖励', target: 1, metric: 'daily_claimed_tiers', rewards: [{ kind: 'gem', amount: 20, label: '灵晶' }] },
  { id: 'seven-day', group: '日常', name: '七日之约', detail: '今日领取 1 次登录赠礼', target: 1, metric: 'daily_login_rewards', rewards: [{ kind: 'leaf', amount: 50, label: '食灵精华' }] },
  /* v18 §3.3②：每日任务 leaf 档 ×2（补食灵精华收支缺口） */
  { id: 'daily-battle', group: '日常', name: '灶火不熄', detail: '今日取得 2 场战斗胜利', target: 2, metric: 'daily_battle_wins', rewards: [{ kind: 'leaf', amount: 60, label: '食灵精华' }] },
  { id: 'daily-market', group: '日常', name: '赶集的清晨', detail: '今日在集市兑换 1 次', target: 1, metric: 'market_today', rewards: [{ kind: 'leaf', amount: 80, label: '食灵精华' }] },
  { id: 'first-charge', group: '成长', name: '首充赠礼', detail: '解锁首充值礼遇，结识蓝纹奶酪', target: 1, metric: 'first_purchase', rewards: [{ kind: 'book', amount: 2, label: '食灵契约' }] },
  { id: 'collection', group: '成长', name: '结识 3 位食灵', detail: '通过召唤或活动收集食灵', target: 3, metric: 'character_count', rewards: [{ kind: 'exp', amount: 400, label: '掌灶人经验' }] },
  { id: 'manor', group: '成长', name: '滋养世界树', detail: '将世界树升至 2 级', target: 2, metric: 'worldtree_level', rewards: [{ kind: 'coin', amount: 80000, label: '金币' }] },
  { id: 'battle', group: '主线', name: '挑战主线 2-4', detail: '在灵界远征中取得 1 场胜利', target: 1, metric: 'battle_wins', rewards: [{ kind: 'chest', amount: 1, label: '冒险宝箱' }] },
  { id: 'covenant', group: '主线', name: '缔结金色契约', detail: '查看并领取契约特惠', target: 1, metric: 'contract_purchase', rewards: [{ kind: 'gem', amount: 60, label: '灵晶' }] },

  /* ------- v14 主线任务链 P0（1–30 级，26 个，设计文档 docs/main-quest-design.md §3.0–3.2） ------- */
  { id: 'MQ-1-01', group: '主线', name: '点火的人', detail: '完成角色创建，在味契上按下指印', target: 1, metric: 'none', rewards: [{ kind: 'coin', amount: 5000, label: '金币' }] },
  { id: 'MQ-1-02', group: '主线', name: '夜市初行', detail: '初访千灯夜市（登录游戏）', target: 1, metric: 'login_days', rewards: [{ kind: 'coin', amount: 5000, label: '金币' }] },
  { id: 'MQ-1-03', group: '主线', name: '听见声音', detail: '拥有 1 位食灵伙伴（青团已与你同行）', target: 1, metric: 'character_count', rewards: [{ kind: 'leaf', amount: 20, label: '食灵精华' }] },
  { id: 'MQ-1-04', group: '主线', name: '初春试炼', detail: '通关 1-1 初春试炼', target: 1, metric: 'stage_clear', ref: '1-1', rewards: [{ kind: 'coin', amount: 10000, label: '金币' }, { kind: 'leaf', amount: 30, label: '食灵精华' }] },
  { id: 'MQ-1-05', group: '主线', name: '味契缔约', detail: '完成首次食灵召唤', target: 1, metric: 'summons_total', rewards: [{ kind: 'leaf', amount: 30, label: '食灵精华' }] },
  { id: 'MQ-1-06', group: '主线', name: '三足鼎立', detail: '编排 3 人出战阵容', target: 3, metric: 'formation_slots', rewards: [{ kind: 'coin', amount: 8000, label: '金币' }] },
  { id: 'MQ-1-07', group: '主线', name: '开刃', detail: '获得 1 件装备并穿戴', target: 1, metric: 'equipment_worn', rewards: [{ kind: 'coin', amount: 8000, label: '金币' }] },
  { id: 'MQ-1-08', group: '主线', name: '灶婆婆的灶', detail: '在研制坊炼制 1 次灵味原浆', target: 1, metric: 'crafted_total', rewards: [{ kind: 'exp', amount: 600, label: '掌灶人经验' }] },
  { id: 'MQ-1-09', group: '主线', name: '第一封信', detail: '在邮件系统领取 1 封邮件附件', target: 1, metric: 'mail_claimed', rewards: [{ kind: 'gem', amount: 10, label: '灵晶' }] },
  { id: 'MQ-1-10', group: '主线', name: '树初长成', detail: '将世界树升至 2 级', target: 2, metric: 'worldtree_level', rewards: [{ kind: 'coin', amount: 8000, label: '金币' }] },
  { id: 'MQ-1-11', group: '主线', name: '茶田疑云', detail: '通关 2-3 茶庭小径', target: 1, metric: 'stage_clear', ref: '2-3', rewards: [{ kind: 'coin', amount: 60000, label: '金币' }, { kind: 'leaf', amount: 60, label: '食灵精华' }] },
  { id: 'MQ-1-12', group: '主线', name: '说书人的价码', detail: '结识 1 位好友（好友系统）', target: 1, metric: 'friend_count', rewards: [{ kind: 'leaf', amount: 50, label: '食灵精华' }] },
  { id: 'MQ-1-13', group: '主线', name: '集市的秤', detail: '在集市完成 1 次兑换（今日）', target: 1, metric: 'market_today', rewards: [{ kind: 'coin', amount: 20000, label: '金币' }] },
  { id: 'MQ-1-14', group: '主线', name: '占星的灯', detail: '在占星台解锁 1 个星位', target: 1, metric: 'astrology_nodes', rewards: [{ kind: 'gem', amount: 15, label: '灵晶' }] },
  { id: 'MQ-1-15', group: '主线', name: '递出去的伞', detail: '累计取得 5 场战斗胜利', target: 5, metric: 'battle_wins', rewards: [{ kind: 'coin', amount: 50000, label: '金币' }] },
  { id: 'MQ-1-16', group: '主线', name: '灶婆婆的储备', detail: '开启 1 次装备宝箱', target: 1, metric: 'equipment_chests', rewards: [{ kind: 'exp', amount: 1300, label: '掌灶人经验' }] },
  { id: 'MQ-1-17', group: '主线', name: '贪味饕童', detail: '通关茶庭小径 3 次，逼出抱食盒的身影', target: 3, metric: 'stage_clear', ref: '2-3', rewards: [{ kind: 'gem', amount: 30, label: '灵晶' }, { kind: 'chest', amount: 1, label: '冒险宝箱' }] },
  { id: 'MQ-1-18', group: '主线', name: '茶寮小帮工', detail: '净化囡囡后回访茶庭：通关茶庭小径 5 次', target: 5, metric: 'stage_clear', ref: '2-3', rewards: [{ kind: 'leaf', amount: 80, label: '食灵精华' }] },
  { id: 'MQ-2-01', group: '主线', name: '九桥夜雨', detail: '通关 2-4 石桥夜雨', target: 1, metric: 'stage_clear', ref: '2-4', rewards: [{ kind: 'coin', amount: 80000, label: '金币' }, { kind: 'gem', amount: 15, label: '灵晶' }] },
  { id: 'MQ-2-02', group: '主线', name: '咸境·淡境', detail: '累计取得 8 场战斗胜利，练习看环境配队', target: 8, metric: 'battle_wins', rewards: [{ kind: 'leaf', amount: 80, label: '食灵精华' }] },
  { id: 'MQ-2-03', group: '主线', name: '时光的褶皱', detail: '在时光屋领取 1 次挂机收益', target: 1, metric: 'idle_claimed', rewards: [{ kind: 'coin', amount: 30000, label: '金币' }] },
  { id: 'MQ-2-04', group: '主线', name: '交易坊的规矩', detail: '在交易坊完成 1 次资源兑换（今日）', target: 1, metric: 'trade_used', rewards: [{ kind: 'coin', amount: 30000, label: '金币' }] },
  { id: 'MQ-2-05', group: '主线', name: '世界树的年轮', detail: '将世界树升至 5 级', target: 5, metric: 'worldtree_level', rewards: [{ kind: 'gem', amount: 20, label: '灵晶' }] },
  { id: 'MQ-2-06', group: '主线', name: '一碗端', detail: '将 3 名食灵升至 3 星', target: 3, metric: 'stars_reached', rewards: [{ kind: 'leaf', amount: 120, label: '食灵精华' }] },
  { id: 'MQ-2-07', group: '主线', name: '双勺判官', detail: '通关石桥夜雨 3 次，让判官尝出对方的甜', target: 3, metric: 'stage_clear', ref: '2-4', rewards: [{ kind: 'gem', amount: 40, label: '灵晶' }, { kind: 'chest', amount: 2, label: '冒险宝箱' }] },
  { id: 'MQ-2-08', group: '主线', name: '忘技之人', detail: '累计取得 20 场战斗胜利', target: 20, metric: 'battle_wins', rewards: [{ kind: 'exp', amount: 2500, label: '掌灶人经验' }] },
];

/* ------------------------------ 邮件 ------------------------------ */
const MAILS = [
  { id: 'open', sender: '灵界事务所', title: '开服贺礼', excerpt: '感谢你来到灵界大陆，这份贺礼请收下。', time: '今日', rewards: [{ kind: 'book', amount: 2, label: '食灵契约' }, { kind: 'coin', amount: 100000, label: '金币' }] },
  { id: 'guide', sender: '青团', title: '引路人的叮嘱', excerpt: '记得每天来看看七日之约，成长资源不会缺席。', time: '今日', rewards: [{ kind: 'leaf', amount: 100, label: '食灵精华' }] },
  { id: 'maintain', sender: '运营团队', title: '维护补偿说明', excerpt: '本次维护补偿将随邮件发放，请在有效期内领取。', time: '昨日', rewards: [{ kind: 'gem', amount: 50, label: '灵晶' }] },
  { id: 'ranking', sender: '灵界竞技场', title: '排行结算奖励', excerpt: '上赛季结算已完成，奖励以邮件形式补发。', time: '3 天前', rewards: [{ kind: 'medal', amount: 1, label: '稀有徽章' }] },
] as const;

/* ------------------------------ 商店与交易 ------------------------------ */
const SHOP_PACKS = [
  { id: 'gem-6', name: '一小袋灵晶', price: 6, gems: 60, books: 0, label: '新手补给', note: '新手补给', limit: 0, order: 1 },
  { id: 'gem-30', name: '灵晶礼匣', price: 30, gems: 330, books: 1, label: '灵晶礼匣', note: '附赠 1 份契约', limit: 0, order: 2 },
  { id: 'gem-68', name: '星辉宝匣', price: 68, gems: 780, books: 3, label: '星辉宝匣', note: '附赠 3 份契约', limit: 0, order: 3 },
] as const;

const TRADE_RATES = [
  { id: 't1', giveCurrency: 'coin', giveAmount: 150000, getCurrency: 'book', getAmount: 1, limit: 3, order: 1 },
  { id: 't2', giveCurrency: 'leaf', giveAmount: 200, getCurrency: 'gem', getAmount: 30, limit: 2, order: 2 },
  { id: 't3', giveCurrency: 'gem', giveAmount: 100, getCurrency: 'potion', getAmount: 300000, limit: 5, order: 3 },
  { id: 't4', giveCurrency: 'coin', giveAmount: 90000, getCurrency: 'leaf', getAmount: 120, limit: 4, order: 4 },
] as const;

const MARKET_OFFERS = [
  { id: 'm1', currency: 'book', amount: 2, price: 120000, label: '食灵契约', order: 1 },
  { id: 'm2', currency: 'gem', amount: 30, price: 90000, label: '灵晶', order: 2 },
  { id: 'm3', currency: 'potion', amount: 80000, price: 60000, label: '灵味原浆', order: 3 },
  { id: 'm4', currency: 'leaf', amount: 150, price: 75000, label: '食灵精华', order: 4 },
  { id: 'm5', currency: 'chest', amount: 1, price: 150000, label: '冒险宝箱', order: 5 },
  { id: 'm6', currency: 'medal', amount: 1, price: 260000, label: '稀有徽章', order: 6 },
] as const;

const ASTROLOGY_NODES = [
  { id: 'star-1', name: '天枢', cost: 60 },
  { id: 'star-2', name: '天璇', cost: 80 },
  { id: 'star-3', name: '天玑', cost: 100 },
  { id: 'star-4', name: '天权', cost: 140 },
  { id: 'star-5', name: '玉衡', cost: 180 },
  { id: 'star-6', name: '开阳', cost: 240 },
] as const;

/* ------------------------------ 装备 ------------------------------ */
/**
 * v17 装备 6 阶（设计 §4.1）：每阶系数 ×1.85 递进，穿戴等级 1/10/25/40/60/80，覆盖 1–100 级。
 * 阶内仍有 3 档稀有度（乘数 [1, 1.7, 2.6]），同名同阶不同稀有度只差属性倍率。
 * id 规则（存量兼容）：1–3 阶沿用 `${slot}-${rarity}`（存量 player_equipment 引用不断）；
 * 4–6 阶用 `${slot}-t${tier}-${rarity}`。总计 6 槽 × 6 阶 × 3 稀有度 = 108 件。
 */
const EQUIPMENT_COLLECTIONS = {
  weapon: { names: ['青芽短刃', '月华长刃', '星辉誓剑', '鼎辉战刃', '忘川霜刃', '天鼎圣剑'], story: '刀锋不只切开迷雾，也为同行者开辟归途。', stats: { attack: 65, critical: 1 } },
  crown: { names: ['茶庭发冠', '月桂之冠', '晨星王冠', '鼎辉冕冠', '忘川星冠', '天鼎神冠'], story: '把晨露与一缕月光，编入旅者的发间。', stats: { health: 130, defense: 22 } },
  armor: { names: ['青叶轻甲', '银月礼衣', '星织守护', '鼎辉重铠', '忘川月衣', '天鼎圣铠'], story: '细密的纹路之间，藏着一份不曾言说的守护。', stats: { health: 300, defense: 30 } },
  charm: { names: ['玉露吊坠', '月影指环', '永昼之约', '鼎辉坠饰', '忘川泪珠', '天鼎符印'], story: '愿远方的灯火，永远为你留一盏。', stats: { speed: 3, critical: 1 } },
  relic: { names: ['清泉茶盏', '浮月灵灯', '流光星仪', '鼎辉香炉', '忘川魂灯', '天鼎宝鼎'], story: '一件古老的灵器，记得每一次相遇的温度。', stats: { attack: 32, health: 120 } },
  crest: { names: ['新叶徽记', '银月勋章', '星穹纹章', '鼎辉战徽', '忘川纹章', '天鼎龙章'], story: '将并肩走过的旅程，刻成胸前不灭的微光。', stats: { defense: 25, resistance: 1 } },
} as const;

const RARITIES = ['rare', 'epic', 'legendary'] as const;
const RARITY_MULTIPLIER = [1, 1.7, 2.6];

/** v17：阶位表——穿戴等级与属性系数（×1.85^(tier-1)），装备数值扩容的唯一数据源。 */
const EQUIPMENT_TIERS = [
  { tier: 1, requiredLevel: 1 },
  { tier: 2, requiredLevel: 10 },
  { tier: 3, requiredLevel: 25 },
  { tier: 4, requiredLevel: 40 },
  { tier: 5, requiredLevel: 60 },
  { tier: 6, requiredLevel: 80 },
] as const;

/* ------------------------------ 职业与成长（v15） ------------------------------ */

/** 五大职业。id 沿用既有 role 文案（治疗/法术/输出/辅助/防御），存量角色数据零迁移即可挂靠外键。 */
const CLASSES = [
  { id: '治疗', name: '治疗', detail: '以自然与烟火之气治愈同伴的守护职业。', trait: '治疗效果提升 15%；队友生命低于 50% 时，治疗量额外提升 20%。', health: 950, attack: 85, defense: 42, speed: 96, critical: 3, resistance: 12 },
  { id: '法术', name: '法术', detail: '掌控星辉与元素之力的远程输出职业。', trait: '技能系数提升 10%；对防御型敌人造成伤害提升 10%。', health: 880, attack: 120, defense: 35, speed: 100, critical: 8, resistance: 18 },
  { id: '输出', name: '输出', detail: '冲锋在前、以刀锋终结战斗的近战职业。', trait: '暴击伤害提升 20%；攻击有 5% 概率追加一次普攻。', health: 920, attack: 128, defense: 38, speed: 104, critical: 12, resistance: 8 },
  { id: '辅助', name: '辅助', detail: '以增益与控场支援全队的敏捷职业。', trait: '己方增益效果持续 +1 回合；全队速度提升 5%。', health: 900, attack: 90, defense: 40, speed: 108, critical: 5, resistance: 15 },
  { id: '防御', name: '防御', detail: '以厚重护甲与不屈意志守护队伍的坚壁职业。', trait: '受到伤害降低 8%；为相邻队友分摊 10% 的伤害。', health: 1150, attack: 82, defense: 58, speed: 88, critical: 3, resistance: 20 },
] as const;

/** 等级上限：经验表与等级表共同的主键域（1..150，v19 §2.5 无墙延伸）。 */
const MAX_LEVEL = 150;

/**
 * 经验曲线分段倍率（v17 数值核心 v2，设计 §2.1/§2.5）：
 * 1–30 新手期 1.05（任务链驱动，曲线让位于节奏）→ 31–60 中期 1.06 → 61–150 后期 1.07。
 * 三段倍率差 ≤0.02，无断崖感；100 级后以 L99 需求（约 60,630）为基数按 1.07 续接，
 * 单级需求 < 500 万（150 级约 179 万），数字规模受控（§2.5）。
 */
function expRateAt(level: number): number {
  if (level < 31) return 1.05;
  if (level < 61) return 1.06;
  return 1.07;
}

/** 升到下一级所需经验：分段几何 80 × r^(L-1)（r=expRateAt），就近取整到 10；满级返回 0（封顶标记）。 */
function expRequiredAt(level: number): number {
  if (level >= MAX_LEVEL) return 0;
  return Math.max(10, Math.round((80 * expRateAt(level) ** (level - 1)) / 10) * 10);
}

/** 整体成长系数（万分比，1 级 = 10000 基线）：线性铺满 1 级 1.0x → 100 级 2.6x，100+ 封顶续用（v19 §2.5）。公式权威在 domain/power.ts，此处仅复用。 */
const growthBpAt = growthBp;

/** 暴击 / 抗性随等级的线性增量（绝对值）：1 级 0 → 100 级 +30 / +25，100+ 封顶（分母钉死 99，随 MAX_LEVEL 放开不漂移）。 */
const critAddAt = (level: number): number => Math.round(30 * Math.min(level - 1, 99) / 99);
const resAddAt = (level: number): number => Math.round(25 * Math.min(level - 1, 99) / 99);

/**
 * v15 种子自检：经验表 / 等级表 / 职业表 / 装备等级需求四者的跨表逻辑一致性。
 * 外键只保证「引用存在」，这里进一步校验曲线本身的数学性质（连续、单调、公式一致）。
 * 导出供测试直接调用（seedCatalog 会先重灌数据再自检，篡改值会被自愈，无法从外部触发）。
 */
export function assertGrowthConsistency(): void {
  const expRows = queryAll<{ level: number; exp_required: number; exp_total: number }>(
    'SELECT level, exp_required, exp_total FROM level_exp_defs ORDER BY level',
  );
  if (expRows.length !== MAX_LEVEL) {
    throw unprocessable(`level_exp_defs 应覆盖 1..${MAX_LEVEL} 级，实际 ${expRows.length} 行`);
  }
  let running = 0;
  for (const [index, row] of expRows.entries()) {
    if (row.level !== index + 1) {
      throw unprocessable(`level_exp_defs 等级不连续：第 ${index + 1} 行 level=${row.level}`);
    }
    if (row.exp_total !== running) {
      throw unprocessable(`level_exp_defs 第 ${row.level} 级累计经验不一致：期望 ${running}，实际 ${row.exp_total}`);
    }
    if (row.level < MAX_LEVEL && row.exp_required <= 0) {
      throw unprocessable(`level_exp_defs 第 ${row.level} 级升级经验必须为正`);
    }
    running += row.exp_required;
  }
  if (expRows[expRows.length - 1].exp_required !== 0) {
    throw unprocessable('level_exp_defs 满级升级经验必须为 0（封顶标记）');
  }

  const statsRows = queryAll<{ level: number; growth_bp: number }>(
    'SELECT level, growth_bp FROM level_stats_defs ORDER BY level',
  );
  if (statsRows.length !== MAX_LEVEL) {
    throw unprocessable(`level_stats_defs 应覆盖 1..${MAX_LEVEL} 级，实际 ${statsRows.length} 行`);
  }
  for (const [index, row] of statsRows.entries()) {
    if (row.level !== index + 1) {
      throw unprocessable(`level_stats_defs 等级不连续：第 ${index + 1} 行 level=${row.level}`);
    }
    if (row.growth_bp !== growthBpAt(row.level)) {
      throw unprocessable(`level_stats_defs 第 ${row.level} 级成长系数 ${row.growth_bp} 与曲线公式不一致`);
    }
    if (index > 0 && row.growth_bp < statsRows[index - 1].growth_bp) {
      throw unprocessable(`level_stats_defs 成长系数必须单调不减：第 ${row.level} 级出现回落`);
    }
  }
  if (statsRows[0].growth_bp !== 10000) {
    throw unprocessable('level_stats_defs 1 级成长系数必须为 10000（基线）');
  }

  // 与等级表共享主键域：两表等级集合必须完全一致（FK 保证存在性，此处保证无缺行）
  const missing = queryOne<{ total: number }>(
    'SELECT COUNT(*) AS total FROM level_exp_defs WHERE level NOT IN (SELECT level FROM level_stats_defs)',
  );
  if (missing && Number(missing.total) > 0) {
    throw unprocessable(`level_exp_defs 中有 ${missing.total} 个等级缺少等级表成长数据`);
  }

  const orphanRoles = queryOne<{ total: number }>(
    'SELECT COUNT(*) AS total FROM character_defs WHERE role NOT IN (SELECT id FROM class_defs)',
  );
  if (orphanRoles && Number(orphanRoles.total) > 0) {
    throw unprocessable(`character_defs 存在未挂靠职业的角色 ${orphanRoles.total} 条`);
  }

  const orphanLevels = queryOne<{ total: number }>(
    'SELECT COUNT(*) AS total FROM equipment_defs WHERE required_level NOT IN (SELECT level FROM level_exp_defs)',
  );
  if (orphanLevels && Number(orphanLevels.total) > 0) {
    throw unprocessable(`equipment_defs 存在等级域之外的穿戴需求 ${orphanLevels.total} 条`);
  }
}

/* ------------------------------ 协会 ------------------------------ */
const GUILDS = [
  { id: 'osmanthus', name: '桂花小筑', english: 'THE OSMANTHUS COVENANT', level: 6, capacity: 50, motto: '让每一位归来的旅者，都有一盏温热的茶。', notice: '欢迎在此停留。签到与会话仅用于体验协会流程。' },
  { id: 'starlight', name: '星河食盟', english: 'A FEAST AMONG THE STARS', level: 5, capacity: 50, motto: '在星光下相聚，把冒险写成共同的故事。', notice: '愿每场相遇，都成为值得回味的篇章。' },
  { id: 'moonlit', name: '月下茶会', english: 'THE MOONLIT TEA SOCIETY', level: 4, capacity: 50, motto: '以一杯月色，敬与你同行的时光。', notice: '不必匆忙，旅途也值得慢慢品味。' },
] as const;

/* ------------------------------ 特效（v7；v17 新增终极特效 2 个） ------------------------------ */
const VFX_DEFS = [
  { id: 'vfx-hit-basic', name: '基础打击', type: 'hit', path: 'assets/vfx/hit-basic', duration: 200, order: 1 },
  { id: 'vfx-skill-frost', name: '霜冻新星', type: 'skill', path: 'assets/vfx/skill-frost', duration: 600, order: 2 },
  { id: 'vfx-skill-flame', name: '火焰爆裂', type: 'skill', path: 'assets/vfx/skill-flame', duration: 500, order: 3 },
  { id: 'vfx-skill-mend', name: '治愈之光', type: 'skill', path: 'assets/vfx/skill-mend', duration: 500, order: 4 },
  { id: 'vfx-skill-mist', name: '酸雾蚀甲', type: 'skill', path: 'assets/vfx/skill-mist', duration: 450, order: 5 },
  { id: 'vfx-buff-guard', name: '坚壁护盾', type: 'buff', path: 'assets/vfx/buff-guard', duration: 400, order: 6 },
  { id: 'vfx-ui-levelup', name: '升级演出', type: 'ui', path: 'assets/vfx/ui-levelup', duration: 800, order: 7 },
  { id: 'vfx-ult-banquet', name: '月宴回春', type: 'skill', path: 'assets/vfx/skill-mend', duration: 700, order: 8 },
  { id: 'vfx-ult-meteor', name: '星陨盛筵', type: 'skill', path: 'assets/vfx/skill-frost', duration: 750, order: 9 },
] as const;

/* ------------------------------ 技能（v7；v17 扩容 6 → 18，系数为万分比） ------------------------------ */
/**
 * v17 技能纵深（设计 §5）：每职业 普攻（1 级）→ 主动（13 级解锁）→ 终极（31 级解锁），
 * 解锁等级即「等级墙 → 解锁点」转换（13/31 级各给一次战力台阶）。
 * 18 = 普攻 1 + 主动 5 + 终极 5 + 引擎效果技登记 4（灼烧/汲取/月影冲击/春风化雨）+ Boss 专属 3。
 * 解锁等级写进 detail 文案（战斗引擎按掌灶人等级选技，见 battle.service / battle-engine parity 表）。
 */
const SKILL_DEFS = [
  { id: 'sk-slap', name: '灯火拍击', kind: 'attack', target: 'enemy', bp: 10500, cd: 0, vfx: 'vfx-hit-basic', detail: '挥出灯火的基础打击。全员 1 级起共享的普攻。' },
  { id: 'sk-frost-nova', name: '霜冻新星', kind: 'attack', target: 'enemy_all', bp: 9000, cd: 2, vfx: 'vfx-skill-frost', detail: '冰蓝星辉对全体敌人造成范围伤害。法术职业 13 级解锁。' },
  { id: 'sk-spice-burn', name: '香料灼烧', kind: 'attack', target: 'enemy', bp: 12500, cd: 2, vfx: 'vfx-skill-flame', detail: '炽热香料灼烧单一目标。输出职业 13 级解锁。' },
  { id: 'sk-spring-mend', name: '春风回元', kind: 'heal', target: 'ally', bp: 12000, cd: 2, vfx: 'vfx-skill-mend', detail: '以自然之力治疗一名同伴。治疗职业 13 级解锁。' },
  { id: 'sk-guard-up', name: '坚壁固守', kind: 'buff', target: 'self', bp: 8000, cd: 3, vfx: 'vfx-buff-guard', detail: '升起护盾强化自身防御。辅助职业 13 级解锁。' },
  { id: 'sk-sour-mist', name: '酸雾蚀甲', kind: 'debuff', target: 'enemy', bp: 10000, cd: 3, vfx: 'vfx-skill-mist', detail: '酸雾侵蚀敌人防御。防御职业 13 级解锁。' },
  /* ------- v17 终极技（31 级解锁） ------- */
  { id: 'sk-ult-banquet', name: '月宴回春', kind: 'heal', target: 'ally_all', bp: 13000, cd: 4, vfx: 'vfx-ult-banquet', detail: '以月宴之名治疗全体同伴。治疗职业 31 级解锁。' },
  { id: 'sk-ult-meteor', name: '星陨盛筵', kind: 'attack', target: 'enemy_all', bp: 16000, cd: 4, vfx: 'vfx-ult-meteor', detail: '召唤星陨对全体敌人造成毁灭性伤害。法术职业 31 级解锁。' },
  { id: 'sk-ult-finale', name: '灶火终章', kind: 'attack', target: 'enemy', bp: 17500, cd: 3, vfx: 'vfx-skill-flame', detail: '灶火燃至终章，无视目标 20% 防御。输出职业 31 级解锁。' },
  { id: 'sk-ult-opening', name: '全席开火', kind: 'buff', target: 'ally_all', bp: 12500, cd: 4, vfx: 'vfx-buff-guard', detail: '全队攻击提升 25%，持续 3 回合。辅助职业 31 级解锁。' },
  { id: 'sk-ult-bulwark', name: '铜墙鼎壁', kind: 'buff', target: 'ally_all', bp: 10000, cd: 4, vfx: 'vfx-buff-guard', detail: '全队受到伤害降低 30%，持续 2 回合。防御职业 31 级解锁。' },
  /* ------- v17 引擎效果技登记（战斗时间线中出现，白名单校验需要 defs 存在） ------- */
  { id: 'sk-burn-tick', name: '灼烧', kind: 'debuff', target: 'enemy', bp: 3500, cd: 0, vfx: 'vfx-skill-flame', detail: '灼烧跳伤（施加者攻击 ×35%，共 2 跳）。引擎效果技。' },
  { id: 'sk-drain-mark', name: '雾里汲取', kind: 'debuff', target: 'enemy', bp: 4000, cd: 0, vfx: 'vfx-skill-mist', detail: '汲取：按实际伤害 40% 回复自身。引擎效果技。' },
  { id: 'sk-fallback', name: '月影冲击', kind: 'attack', target: 'enemy', bp: 10000, cd: 0, vfx: 'vfx-hit-basic', detail: '无名单位的技能回退名。引擎效果技。' },
  { id: 'sk-heal-rain', name: '春风化雨', kind: 'heal', target: 'ally', bp: 11000, cd: 0, vfx: 'vfx-skill-mend', detail: '青团每 3 轮治疗血比例最低队友。引擎效果技。' },
  /* ------- v17 Boss 专属技（Boss 战时间线展示名） ------- */
  { id: 'sk-boss-devour', name: '囫囵吞珠', kind: 'debuff', target: 'enemy', bp: 12000, cd: 2, vfx: 'vfx-buff-guard', detail: '囡囡吞噬我方增益转化为己身护盾。Boss 专属。' },
  { id: 'sk-boss-taste', name: '五味失调', kind: 'debuff', target: 'enemy_all', bp: 9000, cd: 2, vfx: 'vfx-skill-mist', detail: '咸与淡切换味性，淡境减伤咸境掉血。Boss 专属。' },
  { id: 'sk-boss-feast', name: '忘川终宴', kind: 'attack', target: 'enemy_all', bp: 14000, cd: 3, vfx: 'vfx-skill-flame', detail: '忘川馔三阶段终宴，团圆纹达成则我方伤害 ×1.25。Boss 专属。' },
] as const;

/* ------------------------------ 怪物 / Boss（v7；v17 扩容 8 → 30，Boss 不单独建表，kind 判别） ------------------------------ */
/**
 * v17 敌人池按章组织（设计 §8）：普通怪 power = 主力出没关锚 × 0.10~0.16，Boss = 关锚 × 0.55。
 * 21 关 = 22 普通/精英（章内复用）+ 8 Boss；Boss 机制复用既有 5 种（devour/taste/drunk/mirror/feast），
 * 战斗引擎零改动。id 沿用语义化命名；kind/数值为 catalog 展示与校验数据（战斗快照由 buildEnemies 程序化生成）。
 */
const ENEMY_DEFS = [
  /* 第一章（1-1 锚 7000 / 1-2 锚 16000） */
  { id: 'enemy-lantern', name: '巡夜灯灵', kind: 'normal', element: '光', power: 700, health: 900, attack: 220, defense: 8, speed: 100, skills: ['sk-slap'], vfx: 'vfx-hit-basic' },
  { id: 'enemy-lamp-moth', name: '灯芯蛾', kind: 'normal', element: '自然', power: 1700, health: 2000, attack: 460, defense: 10, speed: 106, skills: ['sk-slap', 'sk-frost-nova'], vfx: 'vfx-skill-frost' },
  { id: 'enemy-lamp-boy', name: '提灯小童', kind: 'normal', element: '光', power: 2200, health: 2400, attack: 560, defense: 10, speed: 108, skills: ['sk-slap', 'sk-spice-burn'], vfx: 'vfx-skill-flame' },
  {
    id: 'enemy-nannan', name: '囡囡', kind: 'boss', element: '暗', power: 3850, health: 8000, attack: 480, defense: 12, speed: 100,
    skills: ['sk-slap', 'sk-boss-devour'], vfx: 'vfx-buff-guard',
    phases: [
      { threshold_bp: 10000, skill: 'sk-boss-devour', detail: '吞噬机制由引擎按轮首接管（有增益可吞则吞噬转化护盾，否则饥饿受伤 ×2）' },
    ],
  },
  /* 第二章（2-1 锚 28000 / 2-2 锚 34000 / 2-3 锚 40000 / 2-4 Boss 锚 55000） */
  { id: 'enemy-diner', name: '雾隐食客', kind: 'normal', element: '水', power: 3300, health: 3600, attack: 820, defense: 14, speed: 104, skills: ['sk-slap', 'sk-sour-mist'], vfx: 'vfx-skill-mist' },
  { id: 'enemy-bridge-guard', name: '月桥守卫', kind: 'normal', element: '土', power: 4200, health: 4800, attack: 1000, defense: 30, speed: 96, skills: ['sk-guard-up', 'sk-slap'], vfx: 'vfx-buff-guard' },
  { id: 'enemy-frost-slime', name: '糖霜史莱姆', kind: 'normal', element: '冰', power: 3700, health: 4200, attack: 880, defense: 16, speed: 98, skills: ['sk-slap', 'sk-frost-nova'], vfx: 'vfx-skill-frost' },
  { id: 'enemy-tea-pet', name: '茶宠泥偶', kind: 'normal', element: '土', power: 5100, health: 5600, attack: 1150, defense: 26, speed: 102, skills: ['sk-guard-up', 'sk-slap'], vfx: 'vfx-buff-guard' },
  {
    id: 'enemy-twin-taste', name: '咸与淡', kind: 'boss', element: '水', power: 30250, health: 28000, attack: 4200, defense: 24, speed: 104,
    skills: ['sk-slap', 'sk-sour-mist', 'sk-boss-taste'], vfx: 'vfx-skill-mist',
    phases: [
      { threshold_bp: 5000, skill: 'sk-boss-taste', detail: '味性按回合奇偶自动切换（引擎接管），血量过半后切换频率不变' },
    ],
  },
  /* 第三章（3-1 Boss 锚 68000 / 3-2 锚 95000 / 3-3 锚 108000 / 3-4 Boss 锚 120000） */
  { id: 'enemy-drunk-jar', name: '醉酒坛灵', kind: 'normal', element: '火', power: 8100, health: 8800, attack: 1900, defense: 20, speed: 108, skills: ['sk-spice-burn', 'sk-slap'], vfx: 'vfx-skill-flame' },
  { id: 'enemy-crust-beetle', name: '酥皮甲虫', kind: 'normal', element: '土', power: 11800, health: 12600, attack: 2700, defense: 40, speed: 104, skills: ['sk-slap', 'sk-sour-mist'], vfx: 'vfx-skill-mist' },
  { id: 'enemy-moon-waiter', name: '醉月侍者', kind: 'elite', element: '光', power: 17200, health: 15000, attack: 3900, defense: 30, speed: 116, skills: ['sk-slap', 'sk-frost-nova'], vfx: 'vfx-skill-frost' },
  { id: 'enemy-cellar-bat', name: '酒窖蝠', kind: 'normal', element: '暗', power: 12000, health: 13000, attack: 2800, defense: 18, speed: 114, skills: ['sk-spice-burn', 'sk-slap'], vfx: 'vfx-skill-flame' },
  {
    id: 'enemy-jug-sage', name: '壶中翁', kind: 'boss', element: '水', power: 37400, health: 34000, attack: 5600, defense: 30, speed: 106,
    skills: ['sk-slap', 'sk-spice-burn', 'sk-boss-devour'], vfx: 'vfx-skill-flame',
    phases: [
      { threshold_bp: 6000, skill: 'sk-spice-burn', detail: '醉步速度波动由引擎按回合奇偶接管；血量跌破 60% 后追加香料灼烧' },
    ],
  },
  {
    id: 'enemy-drunk-fairy', name: '醉月仙', kind: 'boss', element: '光', power: 66000, health: 58000, attack: 9500, defense: 36, speed: 112,
    skills: ['sk-slap', 'sk-frost-nova', 'sk-ult-banquet'], vfx: 'vfx-ult-banquet',
    phases: [
      { threshold_bp: 6000, skill: 'sk-frost-nova', detail: '醉步机制与壶中翁同源（引擎按回合奇偶接管）；血量跌破 60% 后释放霜冻新星' },
      { threshold_bp: 3000, skill: 'sk-ult-banquet', detail: '血量跌破 30% 后进入酣醉终局，转用月宴回春自我回复' },
    ],
  },
  /* 第四章（4-1 锚 130000 / 4-2 锚 145000 / 4-3 Boss 锚 160000 / 4-4 锚 175000 / 4-5 锚 190000） */
  { id: 'enemy-moth', name: '馔尘蛾', kind: 'normal', element: '自然', power: 15600, health: 17000, attack: 3600, defense: 26, speed: 110, skills: ['sk-slap', 'sk-frost-nova'], vfx: 'vfx-skill-frost' },
  { id: 'enemy-ash-imp', name: '灶灰小鬼', kind: 'normal', element: '火', power: 14300, health: 15400, attack: 3300, defense: 24, speed: 112, skills: ['sk-spice-burn', 'sk-slap'], vfx: 'vfx-skill-flame' },
  { id: 'enemy-ladle-golem', name: '汤勺泥偶', kind: 'normal', element: '土', power: 18800, health: 20000, attack: 4200, defense: 55, speed: 96, skills: ['sk-guard-up', 'sk-slap'], vfx: 'vfx-buff-guard' },
  { id: 'enemy-frost-sweet', name: '冰髓甜魄', kind: 'elite', element: '冰', power: 20800, health: 18000, attack: 4700, defense: 32, speed: 122, skills: ['sk-frost-nova', 'sk-slap'], vfx: 'vfx-skill-frost' },
  { id: 'enemy-steam-valve', name: '蒸汽阀妖', kind: 'elite', element: '水', power: 26200, health: 23000, attack: 5900, defense: 48, speed: 118, skills: ['sk-slap', 'sk-guard-up'], vfx: 'vfx-buff-guard' },
  { id: 'enemy-stove-lord', name: '灶王爷像', kind: 'elite', element: '土', power: 28500, health: 26000, attack: 6100, defense: 60, speed: 98, skills: ['sk-guard-up', 'sk-slap'], vfx: 'vfx-buff-guard' },
  {
    id: 'enemy-nameless-chef', name: '雾厨无名氏', kind: 'boss', element: '水', power: 88000, health: 76000, attack: 12000, defense: 42, speed: 122,
    skills: ['sk-sour-mist', 'sk-frost-nova', 'sk-ult-finale'], vfx: 'vfx-skill-frost',
    phases: [
      { threshold_bp: 6000, skill: 'sk-frost-nova', detail: '镜像影厨机制由引擎接管（影厨存活时本体受伤 ×0.3）；血量跌破 60% 后释放霜冻新星' },
      { threshold_bp: 3000, skill: 'sk-ult-finale', detail: '血量跌破 30% 后揭开真容，转用灶火终章' },
    ],
  },
  /* 第五章（5-1 Boss 锚 205000 / 5-2 锚 235000 / 5-3 Boss 锚 265000） */
  { id: 'enemy-wangchuan-steward', name: '忘川馔侍', kind: 'elite', element: '暗', power: 28700, health: 25000, attack: 6400, defense: 38, speed: 124, skills: ['sk-sour-mist', 'sk-frost-nova'], vfx: 'vfx-skill-frost' },
  { id: 'enemy-ferry-lantern', name: '渡魂灯官', kind: 'normal', element: '光', power: 28200, health: 30000, attack: 6300, defense: 30, speed: 112, skills: ['sk-slap', 'sk-frost-nova'], vfx: 'vfx-skill-frost' },
  { id: 'enemy-mist-gourmet', name: '雾中饕客', kind: 'elite', element: '暗', power: 37600, health: 32000, attack: 8300, defense: 36, speed: 120, skills: ['sk-sour-mist', 'sk-slap'], vfx: 'vfx-skill-mist' },
  {
    id: 'enemy-wangchuan-feast', name: '忘川馔', kind: 'boss', element: '暗', power: 112750, health: 96000, attack: 15000, defense: 44, speed: 126,
    skills: ['sk-slap', 'sk-spice-burn', 'sk-boss-feast'], vfx: 'vfx-skill-flame',
    phases: [
      { threshold_bp: 6600, skill: 'sk-boss-feast', detail: '三阶段（餐前/上菜/散席）与团圆纹由引擎按血量接管' },
    ],
  },
  {
    id: 'enemy-eclipse-witch', name: '月蚀魔女', kind: 'boss', element: '暗', power: 145750, health: 120000, attack: 19000, defense: 48, speed: 124,
    skills: ['sk-slap', 'sk-frost-nova', 'sk-ult-meteor'], vfx: 'vfx-ult-meteor',
    phases: [
      { threshold_bp: 5000, skill: 'sk-frost-nova', detail: '味性切换机制与咸与淡同源（引擎按回合奇偶接管）；血量跌破 50% 后释放霜冻新星' },
      { threshold_bp: 2500, skill: 'sk-ult-meteor', detail: '血量跌破 25% 后召唤月蚀，转用星陨盛筵' },
    ],
  },
  /* 第六章 · 无尽回廊（6-1 锚 350000 / 6-2 锚 371000 / 6-3 Boss 锚 393000） */
  { id: 'enemy-cycle-shadow', name: '轮回食影', kind: 'elite', element: '暗', power: 49000, health: 42000, attack: 10800, defense: 44, speed: 122, skills: ['sk-sour-mist', 'sk-spice-burn'], vfx: 'vfx-skill-flame' },
  { id: 'enemy-eclipse-glutton', name: '月蚀饕餮', kind: 'elite', element: '暗', power: 55600, health: 47000, attack: 12200, defense: 46, speed: 124, skills: ['sk-spice-burn', 'sk-slap'], vfx: 'vfx-skill-flame' },
  {
    id: 'enemy-cycle-lord', name: '轮回之主', kind: 'boss', element: '暗', power: 216150, health: 180000, attack: 26000, defense: 52, speed: 128,
    skills: ['sk-slap', 'sk-frost-nova', 'sk-boss-feast'], vfx: 'vfx-ult-meteor',
    phases: [
      { threshold_bp: 6600, skill: 'sk-boss-feast', detail: '三阶段终宴与团圆纹机制由引擎接管；无尽回廊的最终试炼' },
      { threshold_bp: 3300, skill: 'sk-ult-meteor', detail: '血量跌破 33% 后叠加星陨盛筵，全屏轰炸' },
    ],
  },
] as const;

/* ------------------------------ 场景（v8；背景图必须指向 public/images 下真实存在的资源，无音频资源置空） ------------------------------ */
const SCENE_DEFS = [
  { id: 'scene-battle-main', name: '灵界远征', type: 'battle', background: 'images/moonbridge-battle.jpg', music: '', unlock: 1, order: 1 },
  { id: 'scene-home', name: '灵界主城', type: 'idle', background: 'images/moonlit-sanctuary.jpg', music: '', unlock: 1, order: 0 },
  { id: 'scene-guild', name: '协会驻地', type: 'guild', background: 'images/verdant-realm.jpg', music: '', unlock: 1, order: 2 },
  { id: 'scene-manor', name: '家园经营', type: 'manor', background: 'images/star-ascension.jpg', music: '', unlock: 2, order: 3 },
  { id: 'scene-activity', name: '活动广场', type: 'activity', background: 'images/night-market.jpg', music: '', unlock: 1, order: 4 },
] as const;

/** 战斗关卡的默认场景 id（存量关卡的 scene_id 由这里回填） */
const DEFAULT_BATTLE_SCENE = 'scene-battle-main';

/* ------------------------------ 物品（v9；v17 扩容 6 → 14，设计 §7；icon 置空 = 客户端按 type/kind 渲染默认图标，不得写死不存在的资源路径） ------------------------------ */
const ITEM_DEFS = [
  { id: 'item-spice-bundle', name: '香料包', type: 'material', rarity: 'common', stackable: 1, maxStack: 9999, value: 50, icon: '', detail: '烹饪的基底材料，四处收集吧。' },
  { id: 'item-stew-small', name: '暖胃炖汤', type: 'consumable', rarity: 'rare', stackable: 1, maxStack: 999, effect: { kind: 'resource', currency: 'potion', amount: 50000 }, value: 100, icon: '', detail: '使用后获得 50000 灵味原浆（升星材料）。' },
  { id: 'item-energy-brew', name: '活力特调', type: 'consumable', rarity: 'epic', stackable: 1, maxStack: 999, effect: { kind: 'resource', currency: 'coin', amount: 80000 }, value: 200, icon: '', detail: '使用后获得 80000 金币。' },
  { id: 'item-ingredient-chest', name: '食材宝箱', type: 'chest', rarity: 'rare', stackable: 1, maxStack: 999, value: 0, icon: '', detail: '开启后随机获得食材类物品。' },
  { id: 'item-qingtuan-fragment', name: '青团碎片', type: 'fragment', rarity: 'epic', stackable: 1, maxStack: 999, value: 200, icon: '', detail: '集齐可合成指定食灵的碎片。' },
  { id: 'item-newbie-gift', name: '新手礼盒', type: 'gift', rarity: 'rare', stackable: 1, maxStack: 99, value: 0, icon: '', detail: '给新旅者的见面礼。' },
  /* ------- v17 新增（设计 §7） ------- */
  { id: 'item-stove-ash', name: '灶心灰', type: 'material', rarity: 'epic', stackable: 1, maxStack: 999, value: 400, icon: '', detail: '灶膛深处淬炼出的灰烬，锻造 4/5 阶装备的核心材料（×3/件）。来源：4-1 以上关卡。' },
  { id: 'item-stardust-sugar', name: '星尘糖', type: 'material', rarity: 'legendary', stackable: 1, maxStack: 999, value: 900, icon: '', detail: '撒着星光的糖晶，锻造 5/6 阶装备的核心材料（×2/件）。来源：5-1 与无尽回廊。' },
  { id: 'item-moon-dew', name: '月露', type: 'material', rarity: 'epic', stackable: 1, maxStack: 999, value: 600, icon: '', detail: '月夜凝结的露水，技能 6–10 级升级材料（×1/级）。来源：占星与活动。' },
  { id: 'item-recipe-page', name: '失传菜谱残页', type: 'fragment', rarity: 'legendary', stackable: 1, maxStack: 8, value: 500, icon: '', detail: '佛跳墙的失传菜谱之一，集齐 8 页可触发藏品类任务 MQ-X-02。来源：Boss 战与探索。' },
  { id: 'item-taste-rubbing', name: '味契拓片', type: 'fragment', rarity: 'legendary', stackable: 1, maxStack: 99, value: 1200, icon: '', detail: '拓下味契真纹的石片，可在无尽回廊重打 Boss 真身全记忆。来源：无尽回廊。' },
  { id: 'item-reunion-rice', name: '团圆饭团', type: 'consumable', rarity: 'legendary', stackable: 1, maxStack: 99, effect: { kind: 'revive', ratio_bp: 3000 }, value: 2000, icon: '', detail: '全队以 30% 血量复活，终章与无尽回廊可用。来源：故事商店。' },
  { id: 'item-secret-recipe', name: '秘传配方', type: 'material', rarity: 'epic', stackable: 1, maxStack: 999, value: 300, icon: '', detail: '街巷食神记的兑换凭证，可在活动商店换取稀有物资。' },
  { id: 'item-star-sugar', name: '星辉砂糖', type: 'consumable', rarity: 'rare', stackable: 1, maxStack: 999, effect: { kind: 'buff', stat: 'attack', ratio_bp: 1000, battles: 1 }, value: 150, icon: '', detail: '撒了星辉的砂糖，下一场战斗全队攻击 +10%。' },
] as const;

/* ------------------------------ 活动（v10） ------------------------------ */
const ACTIVITY_WINDOW = { start: '2025-01-01T00:00:00.000Z', end: '2099-12-31T23:59:59.999Z' } as const;

const ACTIVITY_DEFS = [
  {
    id: 'act-login-7', name: '七日签到', type: 'login', sort: 1,
    config: { tiers: [
      { key: 'day-1', need: 1, rewards: [{ kind: 'coin', amount: 20000, label: '金币' }] },
      { key: 'day-2', need: 2, rewards: [{ kind: 'leaf', amount: 50, label: '食灵精华' }] },
      { key: 'day-3', need: 3, rewards: [{ kind: 'gem', amount: 30, label: '灵晶' }] },
      { key: 'day-5', need: 5, rewards: [{ kind: 'item', amount: 2, itemId: 'item-stew-small', label: '暖胃炖汤' }] },
      { key: 'day-7', need: 7, rewards: [{ kind: 'book', amount: 1, label: '食灵契约' }] },
    ] },
  },
  {
    id: 'act-charge-rush', name: '充能狂欢', type: 'charge', sort: 2,
    config: { tiers: [
      { key: 'charge-1', need: 1, rewards: [{ kind: 'gem', amount: 20, label: '灵晶' }] },
      { key: 'charge-3', need: 3, rewards: [{ kind: 'item', amount: 1, itemId: 'item-newbie-gift', label: '新手礼盒' }] },
    ] },
  },
  {
    id: 'act-collect-spice', name: '香料收集', type: 'collect', sort: 3,
    config: { tiers: [
      { key: 'spice-30', need: 30, rewards: [{ kind: 'item', amount: 5, itemId: 'item-stew-small', label: '暖胃炖汤' }] },
      { key: 'spice-80', need: 80, rewards: [{ kind: 'gem', amount: 60, label: '灵晶' }] },
    ] },
  },
] as const;

/* ------------------------------ 排行榜（v12） ------------------------------ */
const LEADERBOARD_DEFS = [
  { id: 'lb-battle-wins', name: '灵界胜场榜', metric: 'battle_wins', period: 'all', season: null, capacity: 100 },
  { id: 'lb-power', name: '战力巅峰榜', metric: 'power', period: 'all', season: null, capacity: 100 },
  { id: 'lb-worldtree', name: '世界树等级榜', metric: 'worldtree_level', period: 'all', season: null, capacity: 50 },
  { id: 'lb-chronicle', name: '食谱编年榜', metric: 'chronicle_points', period: 'season', season: 'S1', capacity: 100 },
] as const;

/** 写入全部静态配置数据，可重复执行。 */
export function seedCatalog(): { characters: number; stages: number; equipment: number; quests: number; mails: number; guilds: number; levels: number; classes: number } {
  const stamp = nowIso();

  /* ---------------- v15：成长维度（必须最先写入：character_defs.role 与 equipment_defs.required_level 外键引用） ---------------- */
  let runningExp = 0;
  for (let level = 1; level <= MAX_LEVEL; level += 1) {
    const expRequired = expRequiredAt(level);
    upsert('level_exp_defs', { level, exp_required: expRequired, exp_total: runningExp }, 'level');
    upsert('level_stats_defs', {
      level,
      growth_bp: growthBpAt(level),
      crit_add: critAddAt(level),
      res_add: resAddAt(level),
    }, 'level');
    runningExp += expRequired;
  }
  for (const cls of CLASSES) {
    upsert('class_defs', {
      id: cls.id, name: cls.name, detail: cls.detail, trait: cls.trait,
      health: cls.health, attack: cls.attack, defense: cls.defense,
      speed: cls.speed, critical: cls.critical, resistance: cls.resistance,
    });
  }

  for (const character of CHARACTERS) {
    upsert('character_defs', {
      id: character.id, name: character.name, title: character.title, element: character.element,
      rarity: character.rarity, role: character.role, detail: character.detail,
      portrait: `images/${character.id}.jpg`, base_power: character.power,
    });
  }

  /* ---------------- v8：场景（必须先于关卡：stage_defs.scene_id 外键引用） ---------------- */
  for (const scene of SCENE_DEFS) {
    insertSceneDef({
      id: scene.id, name: scene.name, type: scene.type,
      background: scene.background, music: scene.music,
      unlockWorldtreeLevel: scene.unlock, orderIndex: scene.order,
    });
  }
  bumpCatalogVersion('scene');

  /* ---------------- v21：副本（必须先于关卡：stage_defs.dungeon_id 外键引用） ---------------- */
  for (const dungeon of DUNGEON_DEFS) {
    upsert('dungeon_defs', {
      id: dungeon.id, name: dungeon.name, english: dungeon.english,
      description: dungeon.description, order_index: dungeon.order,
      unlock_level: dungeon.unlockLevel, unlock_open_day: dungeon.unlockOpenDay,
    });
  }
  bumpCatalogVersion('dungeon');

  for (const stage of STAGES) {
    upsert('stage_defs', {
      id: stage.id, chapter: stage.chapter, name: stage.name, order_index: stage.order,
      suggested_power: stage.power, scene_id: DEFAULT_BATTLE_SCENE,
      dungeon_id: DUNGEON_BY_CHAPTER[stage.chapter] ?? null, reward_json: json(stage.rewards),
    });
  }

  /* ---------------- v21：功能与活动开关 ---------------- */
  for (const [index, toggle] of FEATURE_TOGGLES.entries()) {
    upsert('feature_toggles', {
      key: toggle.key, name: toggle.name, category: toggle.category, enabled: toggle.enabled,
      open_day: toggle.openDay, close_day: toggle.closeDay, sort_index: index, detail: toggle.detail,
    }, 'key');
  }
  bumpCatalogVersion('feature');

  for (const [index, quest] of QUESTS.entries()) {
    upsert('quest_defs', {
      id: quest.id, group_name: quest.group, name: quest.name, detail: quest.detail,
      target: quest.target, metric: quest.metric, ref_id: quest.ref ?? null,
      reward_json: json(quest.rewards), sort_index: index,
    });
  }

  for (const [index, mail] of MAILS.entries()) {
    upsert('mail_defs', {
      id: mail.id, sender: mail.sender, title: mail.title, excerpt: mail.excerpt,
      time_label: mail.time, reward_json: json(mail.rewards), sort_index: index,
    });
  }

  for (const pack of SHOP_PACKS) {
    upsert('shop_pack_defs', {
      id: pack.id, name: pack.name, price: pack.price, gems: pack.gems, books: pack.books,
      label: pack.label, note: pack.note, daily_limit: pack.limit, sort_index: pack.order,
    });
  }

  for (const rate of TRADE_RATES) {
    upsert('trade_rate_defs', {
      id: rate.id, give_currency: rate.giveCurrency, give_amount: rate.giveAmount,
      get_currency: rate.getCurrency, get_amount: rate.getAmount,
      daily_limit: rate.limit, sort_index: rate.order,
    });
  }

  for (const offer of MARKET_OFFERS) {
    upsert('market_offer_defs', {
      id: offer.id, currency: offer.currency, amount: offer.amount,
      price: offer.price, label: offer.label, sort_index: offer.order,
    });
  }

  for (const [index, node] of ASTROLOGY_NODES.entries()) {
    upsert('astrology_node_defs', { id: node.id, name: node.name, gem_cost: node.cost, order_index: index });
  }

  let equipmentCount = 0;
  const equipmentTemplateId = (slot: string, rarity: string, tier: number): string => {
    // 存量兼容桥接：旧 18 件 id（${slot}-${rarity}）精确对应 rare@t1 / epic@t2 / legendary@t3，
    // 名称与穿戴需求语义连续（青芽短刃=1/月华长刃=10/星辉誓剑=25）；其余组合用带阶位段的新 id。
    const bridged = (rarity === 'rare' && tier === 1) || (rarity === 'epic' && tier === 2) || (rarity === 'legendary' && tier === 3);
    return bridged ? `${slot}-${rarity}` : `${slot}-t${tier}-${rarity}`;
  };
  for (const [slot, collection] of Object.entries(EQUIPMENT_COLLECTIONS)) {
    for (const tierDef of EQUIPMENT_TIERS) {
      RARITIES.forEach(rarity => {
        // 属性 = 基础面板 × 阶位系数（1.85^(tier-1)）× 稀有度乘数
        const multiplier = Math.pow(1.85, tierDef.tier - 1) * RARITY_MULTIPLIER[RARITIES.indexOf(rarity)];
        const stats = collection.stats as Record<string, number>;
        const scaled = (key: string) => Math.round((stats[key] ?? 0) * multiplier);
        upsert('equipment_defs', {
          id: equipmentTemplateId(slot, rarity, tierDef.tier),
          name: collection.names[tierDef.tier - 1], slot, rarity,
          story: collection.story, health: scaled('health'), attack: scaled('attack'),
          defense: scaled('defense'), speed: scaled('speed'),
          critical: scaled('critical'), resistance: scaled('resistance'),
          required_level: tierDef.requiredLevel,
        });
        equipmentCount += 1;
      });
    }
  }

  for (const guild of GUILDS) {
    upsert('guilds', {
      id: guild.id, name: guild.name, english: guild.english, level: guild.level,
      capacity: guild.capacity, motto: guild.motto, notice: guild.notice, created_at: stamp,
    });
  }

  /* ---------------- v7：特效 → 技能 → 怪物（外键引用顺序，不可调换） ---------------- */
  for (const vfx of VFX_DEFS) {
    insertVfxDef({ id: vfx.id, name: vfx.name, type: vfx.type, assetPath: `${vfx.path}.json`, durationMs: vfx.duration, sortIndex: vfx.order });
  }
  for (const skill of SKILL_DEFS) {
    insertSkillDef({
      id: skill.id, name: skill.name, kind: skill.kind, targetType: skill.target,
      coefficientBp: skill.bp, cooldown: skill.cd, vfxId: skill.vfx, detail: skill.detail,
    });
  }
  for (const enemy of ENEMY_DEFS) {
    // 万分比自检（设计附录 B 风险 #5）：Boss 阶段阈值必须落在 (0, 10000]
    if ('phases' in enemy) {
      for (const phase of enemy.phases) {
        if (phase.threshold_bp <= 0 || phase.threshold_bp > 10000) {
          throw unprocessable(`enemy_defs 种子数据非法：${enemy.id} 阶段阈值 ${phase.threshold_bp} 超出万分比范围`);
        }
      }
    }
    insertEnemyDef({
      id: enemy.id, name: enemy.name, kind: enemy.kind, element: enemy.element,
      power: enemy.power, health: enemy.health, attack: enemy.attack,
      defense: enemy.defense, speed: enemy.speed,
      skillIds: [...enemy.skills], vfxId: enemy.vfx,
      dropJson: '[]',
      phaseJson: 'phases' in enemy ? json(enemy.phases) : null,
    });
  }
  // 逻辑外键自检：怪物引用的技能必须全部存在（D-2 白名单校验的 seed 侧应用）
  for (const enemy of ENEMY_DEFS) {
    validateSkillIds([...enemy.skills]);
  }
  bumpCatalogVersion('vfx');
  bumpCatalogVersion('skill');
  bumpCatalogVersion('enemy');

  /* ---------------- v9：物品 ---------------- */
  for (const item of ITEM_DEFS) {
    insertItemDef({
      id: item.id, name: item.name, type: item.type, rarity: item.rarity,
      stackable: item.stackable, maxStack: item.maxStack,
      effectJson: 'effect' in item ? json(item.effect) : '{}',
      value: item.value, icon: item.icon, detail: item.detail,
    });
  }
  bumpCatalogVersion('item');

  /* ---------------- v10：活动 ---------------- */
  for (const activity of ACTIVITY_DEFS) {
    insertActivityDef({
      id: activity.id, name: activity.name, type: activity.type,
      startAt: ACTIVITY_WINDOW.start, endAt: ACTIVITY_WINDOW.end,
      configJson: json(activity.config), sortIndex: activity.sort,
    });
  }
  bumpCatalogVersion('activity');

  /* ---------------- v12：排行榜 ---------------- */
  for (const leaderboard of LEADERBOARD_DEFS) {
    insertLeaderboardDef({
      id: leaderboard.id, name: leaderboard.name, metric: leaderboard.metric,
      period: leaderboard.period, seasonKey: leaderboard.season, capacity: leaderboard.capacity,
    });
  }
  bumpCatalogVersion('leaderboard');

  /* ---------------- v15 自检：经验/等级/职业/装备需求跨表一致（全部种子落库后统一校验） ---------------- */
  assertGrowthConsistency();

  /* ---------------- v11：默认 GM 账号（口令只从环境变量读取，绝不硬编码） ---------------- */
  if (env.gmSeedPassword) {
    // INSERT ON CONFLICT DO NOTHING：不覆盖已存在账号（运维改过口令后重跑 seed 不得重置）
    const existing = findGmByUsername(env.gmSeedUsername);
    if (!existing) {
      insertGmAccount({ username: env.gmSeedUsername, passwordHash: hashPassword(env.gmSeedPassword), role: 'super' });
      console.log(`[seed] 默认 GM 账号已创建：${env.gmSeedUsername}（super）`);
    }
  } else {
    console.log('[seed] 未配置 GM_SEED_PASSWORD，跳过默认 GM 账号创建');
  }

  return {
    characters: CHARACTERS.length,
    stages: STAGES.length,
    equipment: equipmentCount,
    quests: QUESTS.length,
    mails: MAILS.length,
    guilds: GUILDS.length,
    levels: MAX_LEVEL,
    classes: CLASSES.length,
  };
}

if (isMain(import.meta.url)) {
  connectDatabase();
  runMigrations();
  const summary = seedCatalog();
  console.log('[seed] 种子数据写入完成：', summary);
  closeDatabase();
}
