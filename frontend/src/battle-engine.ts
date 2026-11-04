import type { BattleRecord, BattleTurn, Combatant } from './battle-types';
import { battleChargesOf, battleExpGain, battleStages, characterBattleStats, characters, grantRewards, localDateKey, starLevel, squadPower, validFormation, type BattleStage, type GameSave, type Reward } from './game-data';
import { localDate, rolloverDaily } from './game-clock';

export const MAX_BATTLE_HISTORY = 20;
export const MAX_BATTLE_ROUNDS = 12;

const skills: Record<string, string> = {
  '青团': '春山回响', '蓝纹奶酪': '星霜之咏', '冬阴功': '绯焰盛宴', '拉菲': '流金誓约', '咖喱': '金鳞守护',
  '馔尘蛾': '霜粉迷障', '冰髓甜魄': '寒髓糖刺', '灶灰小鬼': '撒灰扑火', '汤勺泥偶': '一勺舀月',
  '雾厨无名氏': '无味之刃', '忘川馔侍': '残宴如梦', '醉酒坛灵': '陈酿爆裂',
  // v17 新增章节敌人技能名（时间线展示用）
  '灯芯蛾': '灯粉迷眼', '提灯小童': '灯火燎原', '糖霜史莱姆': '糖衣裹身', '茶宠泥偶': '陶土结界',
  '灶王爷像': '灶王庇佑', '酥皮甲虫': '酥壳裂甲', '醉月侍者': '月下独酌', '酒窖蝠': '酵酸扑咬',
  '蒸汽阀妖': '高压汽爆', '渡魂灯官': '引渡灯河', '雾中饕客': '雾里偷香', '轮回食影': '回环割裂',
  '月蚀饕餮': '蚀月之吻',
  // Boss 主体技能名（时间线展示用；影厨不在此表，按被复制食灵名解析）
  '囡囡': '囫囵吞珠', '咸与淡': '五味失调', '壶中翁': '一壶乾坤', '忘川馔': '忘川终宴',
  '醉月仙': '醉月轮回', '月蚀魔女': '月蚀领域', '轮回之主': '万味归墟',
};

export type SkillEffect = 'heal' | 'burn' | 'chill' | 'shield' | 'shred' | 'guard' | 'drain' | 'pierce' | 'stun' | 'none';

/**
 * 技能效果表：技能第 3 轮一次的「技能回合」命中时生效。与后端 battle.service.ts 逐字一致（parity 锁定）。
 * 所有效果均不消耗 RNG——RNG 消耗序保持：治疗分支 1 次、普通分支 3 次。
 */
export const skillEffects: Record<string, SkillEffect> = {
  // 食灵
  '青团': 'heal',         // 春风化雨：每 3 轮治疗血比例最低的队友（原有机制）
  '蓝纹奶酪': 'chill',    // 星霜之咏：霜寒迟滞——目标速度 ×0.75 持续 2 轮
  '冬阴功': 'burn',       // 绯焰盛宴：灼烧——目标每轮跳伤（= 施加者攻击 ×0.35）共 2 跳
  '拉菲': 'shield',       // 流金誓约：全队护盾（= 施加者攻击 ×0.9，存续 2 轮）
  '咖喱': 'guard',        // 金鳞守护：全队受伤 ×0.75（本轮剩余 + 下一轮）
  // 馔妖
  '巡夜灯灵': 'none',
  '雾隐食客': 'drain',    // 汲取：按实际伤害的 40% 回复自身
  '月桥守卫': 'shred',    // 破甲：目标防御清零 2 轮
  '馔尘蛾': 'chill',
  '冰髓甜魄': 'chill',
  '灶灰小鬼': 'burn',
  '汤勺泥偶': 'stun',     // 一勺舀月：技能暴击时目标跳过下一轮
  '雾厨无名氏': 'pierce', // 无味之刃：技能伤害无视防御
  '忘川馔侍': 'drain',
  '醉酒坛灵': 'burn',
  // v17 新增章节敌人
  '灯芯蛾': 'chill',
  '提灯小童': 'burn',
  '糖霜史莱姆': 'guard',
  '茶宠泥偶': 'shield',
  '灶王爷像': 'guard',
  '酥皮甲虫': 'shred',
  '醉月侍者': 'drain',
  '酒窖蝠': 'burn',
  '蒸汽阀妖': 'stun',
  '渡魂灯官': 'chill',
  '雾中饕客': 'drain',
  '轮回食影': 'pierce',
  '月蚀饕餮': 'burn',
  // Boss 主体
  '囡囡': 'none',         // 囫囵吞珠：吞噬机制走轮首专用分支，不走技能效果表
  '咸与淡': 'none',       // 五味失调：味性切换走轮首/轮末专用分支
  '壶中翁': 'stun',       // 一壶乾坤：复用眩晕——技能暴击时目标跳过下一轮（与汤勺泥偶同机制）
  '忘川馔': 'drain',      // 忘川终宴：汲取，与忘川馔侍同机制
  '醉月仙': 'stun',       // 醉月轮回：复用眩晕（drunk 关主体，与壶中翁同机制）
  '月蚀魔女': 'none',     // 月蚀领域：味性切换走轮首/轮末专用分支（与咸与淡同机制）
  '轮回之主': 'drain',    // 万味归墟：汲取，与忘川馔同机制
};

/** 效果数值：与后端 battle.service.ts 逐字一致。 */
export const SKILL_PARAMS = {
  BURN_RATIO: 0.35, BURN_TURNS: 2, BURN_SKILL: '灼烧',
  CHILL_FACTOR: 0.75, CHILL_TURNS: 2,
  SHIELD_RATIO: 0.9, SHIELD_TURNS: 2,
  SHRED_TURNS: 2,
  GUARD_FACTOR: 0.75, GUARD_TURNS: 1,
  DRAIN_RATIO: 0.4,
} as const;

/** 默认馔妖三件套；新章节关卡按 stageEnemies 覆盖。与后端 battle.service.ts 逐字一致（parity 锁定）。 */
export const defaultEnemyNames = ['巡夜灯灵', '雾隐食客', '月桥守卫'];
export const stageEnemies: Record<string, string[]> = {
  '1-2': ['灯芯蛾', '提灯小童', '巡夜灯灵'],
  '2-1': ['糖霜史莱姆', '雾隐食客', '茶宠泥偶'],
  '2-2': ['茶宠泥偶', '月桥守卫', '糖霜史莱姆'],
  '4-1': ['馔尘蛾', '雾隐食客', '冰髓甜魄'],
  '4-2': ['灶灰小鬼', '馔尘蛾', '汤勺泥偶'],
  '4-3': ['冰髓甜魄', '馔尘蛾', '雾厨无名氏'],
  '4-4': ['蒸汽阀妖', '馔尘蛾', '冰髓甜魄'],
  '4-5': ['汤勺泥偶', '蒸汽阀妖', '灶王爷像'],
  '5-1': ['巡夜灯灵', '月桥守卫', '忘川馔侍'],
  '5-2': ['渡魂灯官', '雾中饕客', '忘川馔侍'],
  '6-1': ['轮回食影', '月蚀饕餮', '渡魂灯官'],
  '6-2': ['月蚀饕餮', '轮回食影', '雾中饕客'],
};

/**
 * Boss 机制数值口径：与后端 battle.service.ts 逐字一致（parity 锁定）。
 * 所有系数作用于确定性结算，零 RNG。
 */
export const BOSS_PARAMS = {
  BOSS_HP_FACTOR: 2,        // Boss 主体血量倍率（在 index 2 公式 1.2 系数之上再乘）
  BOSS_ATTACK_FACTOR: 1.3,  // Boss 主体攻击倍率（在 index 2 公式 1.15 系数之上再乘）
  // 囡囡 · 吞噬增益
  DEVOUR_GUARD_SHIELD: 300, // 守护无「量」，吞噬守护转化为固定护盾值
  // 咸与淡 · 味性切换
  TASTE_SALT_RATIO: 0.03,   // 咸境（偶数轮）：轮末我方全体按最大生命 3% 掉血（保底 1，可致死）
  TASTE_MILD_FACTOR: 0.75,  // 淡境（奇数轮）：敌方全体直接输出 ×0.75（灼烧跳伤按施加时固定值，不二次折减）
  // 壶中翁 · 醉步
  DRUNK_SPEED_UP: 1.3,      // 偶数轮速度 ×1.3
  DRUNK_SPEED_DOWN: 0.7,    // 奇数轮速度 ×0.7
  // 雾厨无名氏 · 镜像影厨
  MIRROR_STATS_FACTOR: 1.2, // 影厨三维（血/攻/速/防）= 被复制食灵 ×1.2；暴击/抗性按百分比照抄
  MIRROR_BOSS_REDUCE: 0.3,  // 影厨存活时无名氏本体受伤 ×0.3（被消灭后受全伤）
  // 忘川馔 · 三阶段 + 团圆纹
  FEAST_PHASE_HIGH: 0.66,   // 血量 >66%：餐前
  FEAST_PHASE_LOW: 0.33,    // 血量 33%-66%：上菜；<33%：散席
  FEAST_PRE_MEAL_DRAIN: 0.02,       // 餐前：轮末我方全体掉 2% 最大生命（保底 1）
  FEAST_SERVE_ATTACK: 1.2,          // 上菜：Boss 攻击 ×1.2
  FEAST_FAREWELL_ATTACK: 1.4,       // 散席：Boss 攻击 ×1.4
  FEAST_REUNION_HP: 0.3,            // 团圆纹判定线：我方全员存活且血量均 >30%
  FEAST_REUNION_BONUS: 1.25,        // 团圆达成：我方对 Boss 伤害 ×1.25
  FEAST_REUNION_PENALTY: 0.5,       // 未达成：Boss 额外受伤 ×0.5（与其它系数叠乘）
} as const;

export type BossMechanic = 'devour' | 'taste' | 'drunk' | 'mirror' | 'feast';

/** Boss 关配置：stageId → Boss 名称、机制与敌人编成（index 2 恒为 Boss 主体）。与后端 battle.service.ts 逐字一致。 */
export type BossStage = { name: string; mechanic: BossMechanic; enemies: string[] };

export const bossStages: Record<string, BossStage> = {
  '1-1': { name: '囡囡', mechanic: 'devour', enemies: ['巡夜灯灵', '雾隐食客', '囡囡'] },
  '2-4': { name: '咸与淡', mechanic: 'taste', enemies: ['雾隐食客', '月桥守卫', '咸与淡'] },
  '3-1': { name: '壶中翁', mechanic: 'drunk', enemies: ['雾隐食客', '醉酒坛灵', '壶中翁'] },
  // v17 新增 Boss 关：复用既有机制（引擎零改动），drunk/taste/feast 各再上一次场
  '3-4': { name: '醉月仙', mechanic: 'drunk', enemies: ['酥皮甲虫', '酒窖蝠', '醉月仙'] },
  '4-3': { name: '雾厨无名氏', mechanic: 'mirror', enemies: ['冰髓甜魄', '馔尘蛾', '雾厨无名氏'] },
  '5-1': { name: '忘川馔', mechanic: 'feast', enemies: ['月桥守卫', '忘川馔侍', '忘川馔'] },
  '5-3': { name: '月蚀魔女', mechanic: 'taste', enemies: ['雾中饕客', '渡魂灯官', '月蚀魔女'] },
  '6-3': { name: '轮回之主', mechanic: 'feast', enemies: ['轮回食影', '月蚀饕餮', '轮回之主'] },
};

/**
 * Boss 上下文：simulateTimeline 的可选第三参。缺省（undefined）= 非 Boss 关，行为与旧版完全一致。
 * 与后端 battle.service.ts 逐字一致（parity 锁定）。
 */
export type BossContext = {
  stageId: string;
  bossId: string; // Boss 主体单位 id（编成 index 2 → 'enemy-2'）
  mechanic: BossMechanic;
  mirrorId?: string;      // mirror 专用：影厨单位 id（'enemy-mirror'）
  mirrorSource?: string;  // mirror 专用：被复制食灵名（用于解析影厨技能效果）
};

/**
 * Boss 关敌人编成：在标准公式上强化 Boss 主体（index 2 ×HP2/×攻1.3）；
 * mirror 机制额外在我方攻击最高者（平攻取插入序最先）的对位生成影厨（enemy-mirror，追加在编成末尾）。
 * 与后端 battle.service.ts 的 buildEnemies Boss 分支逐字段一致（parity 锁定）。
 */
export function buildBossEnemies(stage: BattleStage, allies: Combatant[]): { enemies: Combatant[]; boss: BossContext } {
  const config = bossStages[stage.id];
  const enemies: Combatant[] = config.enemies.map((name, index) => ({
    id: `enemy-${index}`, name, character: null, side: 'enemy', star: stage.id === '1-1' ? 1 : 3,
    maxHp: Math.round(stage.suggest / 12 * (index === 2 ? 1.2 : 0.9) * (index === 2 ? BOSS_PARAMS.BOSS_HP_FACTOR : 1)),
    attack: Math.round(stage.suggest / 72 * (index === 2 ? 1.15 : 0.9) * (index === 2 ? BOSS_PARAMS.BOSS_ATTACK_FACTOR : 1)),
    speed: 100 + index * 4,
  }));
  const boss: BossContext = { stageId: stage.id, bossId: 'enemy-2', mechanic: config.mechanic };
  if (config.mechanic === 'mirror') {
    const source = allies.reduce<Combatant | null>((best, unit) => (!best || unit.attack > best.attack) ? unit : best, null);
    if (source) {
      enemies.push({
        id: 'enemy-mirror', name: `影厨·${source.name}`, character: null, side: 'enemy', star: 3,
        maxHp: Math.round(source.maxHp * BOSS_PARAMS.MIRROR_STATS_FACTOR),
        attack: Math.round(source.attack * BOSS_PARAMS.MIRROR_STATS_FACTOR),
        speed: Math.round(source.speed * BOSS_PARAMS.MIRROR_STATS_FACTOR),
        defense: Math.round((source.defense ?? 0) * BOSS_PARAMS.MIRROR_STATS_FACTOR),
        critical: source.critical ?? 18,
        resistance: source.resistance ?? 0,
      });
      boss.mirrorId = 'enemy-mirror';
      boss.mirrorSource = source.name;
    }
  }
  return { enemies, boss };
}

function seededRandom(seed: number) {
  let state = seed >>> 0;
  return () => {
    state += 0x6d2b79f5;
    let value = Math.imul(state ^ state >>> 15, 1 | state);
    value ^= value + Math.imul(value ^ value >>> 7, 61 | value);
    return ((value ^ value >>> 14) >>> 0) / 4294967296;
  };
}

export function battleRewards(save: GameSave, stageId: string): Reward[] {
  const stage = battleStages.find(item => item.id === stageId);
  if (!stage) return [];
  const firstClear = !save.firstClears.includes(stageId);
  // v17 §2.2：战斗胜利发掌灶人经验（round(锚/90)，首通 ×3，碾压减半），与后端 settleBattle 同口径
  const expGain = battleExpGain(stage.suggest, firstClear, squadPower(save));
  const rewards = firstClear
    ? stage.rewards.map(reward => ({ ...reward }))
    : stage.rewards.filter(reward => reward.kind !== 'character').map(reward => ({ ...reward, amount: Math.max(1, Math.floor(reward.amount * 0.2)) }));
  // v17 §3.3③：复刷追加食灵精华掉落 = floor(锚/2000)（下限 1）；首通走关卡自带奖励不重复发
  if (!firstClear) {
    rewards.push({ kind: 'leaf', amount: Math.max(1, Math.floor(stage.suggest / 2000)), label: '食灵精华' });
  }
  rewards.push({ kind: 'exp', amount: expGain, label: '掌灶人经验' });
  return rewards;
}

export type TimelineResult = { win: boolean; rounds: number; turns: BattleTurn[] };

/**
 * 纯时间线推演：给定双方单位快照与种子，产出与回放完全一致的对局时间线。
 * 后端引擎（backend simulateBattle）逐帧复刻本函数——RNG 消耗顺序不可改动：
 * 治疗分支 1 次（仅伤害浮动，选目标与暴击均不消耗），普通分支 3 次（目标、暴击、浮动）。
 * 技能效果（灼烧/迟滞/护盾/破甲/守护/汲取/无视防御/眩晕）全部零 RNG，按轮次确定性结算。
 * Boss 机制（boss 参数，缺省 undefined = 非 Boss 关，行为与旧版完全一致）同样零 RNG：
 * 吞噬/味性切换/醉步/镜像影厨/三阶段+团圆纹，全部按轮次确定性触发并写入时间线（kind 'skill'、amount 0 的事件轮）。
 */
export function simulateTimeline(units: Combatant[], seed: number, boss?: BossContext): TimelineResult {
  const random = seededRandom(seed);
  const health: Record<string, number> = Object.fromEntries(units.map(unit => [unit.id, unit.maxHp]));
  const turns: BattleTurn[] = [];
  const alive = (side: 'ally' | 'enemy') => units.filter(unit => unit.side === side && health[unit.id] > 0);
  // 技能效果状态（until = 失效轮次；施加于第 r 轮、until = r + N → 生效于 r+1 .. r+N 轮）
  const shields: Record<string, { amount: number; until: number }> = {};
  const burns: Record<string, { amount: number; until: number; source: string }> = {};
  const chilled: Record<string, number> = {};
  const shredded: Record<string, number> = {};
  const guarded: Record<string, number> = {};
  const stunned: Record<string, number> = {};
  let round = 1;
  // Boss 机制状态（零 RNG，全部确定性结算）
  const bossUnit = boss ? units.find(unit => unit.id === boss.bossId) : undefined;
  let hungryRound = -1;  // 囡囡：本轮无可吞增益 → 饥饿（本轮受伤 ×2）
  let feastPhase = '';   // 忘川馔：当前阶段（'' = 尚未宣告，首轮必写宣告事件）
  // Boss 语境效果/技能名解析：影厨复用被复制食灵的技能效果（按名字查表）；其余单位与旧版完全一致
  const effectOf = (unit: Combatant) =>
    boss && boss.mechanic === 'mirror' && boss.mirrorId === unit.id && boss.mirrorSource
      ? skillEffects[boss.mirrorSource] ?? 'none'
      : skillEffects[unit.name] ?? 'none';
  const skillNameOf = (unit: Combatant) =>
    boss && boss.mechanic === 'mirror' && boss.mirrorId === unit.id && boss.mirrorSource
      ? skills[boss.mirrorSource] || '月影冲击'
      : skills[unit.name] || '月影冲击';
  // Boss 语境攻击力口径：忘川馔按阶段放大（餐前 ×1 / 上菜 ×1.2 / 散席 ×1.4），影响直击与灼烧施加值
  const attackOf = (unit: Combatant) =>
    boss && boss.mechanic === 'feast' && unit.id === boss.bossId
      ? unit.attack * (feastPhase === '上菜' ? BOSS_PARAMS.FEAST_SERVE_ATTACK : feastPhase === '散席' ? BOSS_PARAMS.FEAST_FAREWELL_ATTACK : 1)
      : unit.attack;
  // 团圆纹：我方全员存活且血量均 >30% → 我方对 Boss 伤害 ×1.25；否则 Boss 额外受伤 ×0.5
  const reunionFactor = () => {
    const ok = units.filter(unit => unit.side === 'ally').every(unit => health[unit.id] > 0 && health[unit.id] > unit.maxHp * BOSS_PARAMS.FEAST_REUNION_HP);
    return ok ? BOSS_PARAMS.FEAST_REUNION_BONUS : BOSS_PARAMS.FEAST_REUNION_PENALTY;
  };
  // Boss 受伤修正（叠乘口径，零 RNG）：饥饿 ×2 / 影厨存活 ×0.3 / 团圆纹 ×1.25 或 ×0.5
  const incomingFactorOf = (targetId: string) => {
    let factor = 1;
    if (!boss || targetId !== boss.bossId) return factor;
    if (boss.mechanic === 'devour' && hungryRound === round) factor *= 2;
    if (boss.mechanic === 'mirror' && boss.mirrorId && health[boss.mirrorId] > 0) factor *= BOSS_PARAMS.MIRROR_BOSS_REDUCE;
    if (boss.mechanic === 'feast') factor *= reunionFactor();
    return factor;
  };
  // Boss 环境事件：kind 'skill'、amount 0，由回放 UI 按技能名自然展示
  const pushEvent = (skill: string, targetId: string) => turns.push({ round, actor: boss!.bossId, target: targetId, kind: 'skill', skill, amount: 0, critical: false, health: { ...health } });

  // The seeded timeline is stored once; playback never rolls new damage or awards resources.
  for (; round <= MAX_BATTLE_ROUNDS; round++) {
    const speedOf = (unit: Combatant) => {
      const base = (chilled[unit.id] ?? -Infinity) >= round ? unit.speed * SKILL_PARAMS.CHILL_FACTOR : unit.speed;
      // 壶中翁醉步：偶数轮 ×1.3、奇数轮 ×0.7（确定性速度波动，影响出手序）
      return boss && boss.mechanic === 'drunk' && unit.id === boss.bossId ? base * (round % 2 === 0 ? BOSS_PARAMS.DRUNK_SPEED_UP : BOSS_PARAMS.DRUNK_SPEED_DOWN) : base;
    };
    const defenseOf = (unit: Combatant) => ((shredded[unit.id] ?? -Infinity) >= round ? 0 : (unit.defense ?? 0));
    // ---- Boss 轮首阶段（零 RNG；Boss 存活且我方有人时才结算）----
    if (boss && bossUnit && health[boss.bossId] > 0 && alive('ally').length > 0) {
      if (boss.mechanic === 'devour') {
        // 吞噬增益：按「最先到期」确定性选取（同 until 时护盾优先，再按单位插入序）；
        // 护盾转移剩余量、守护转为固定护盾值；存续期继承原 until；已有护盾则覆盖
        let devoured: { targetId: string; kind: 'shield' | 'guard'; amount: number; until: number } | null = null;
        for (const unit of units) {
          if (unit.side !== 'ally' || health[unit.id] <= 0) continue;
          const shield = shields[unit.id];
          if (shield && shield.until >= round && shield.amount > 0 && (!devoured || shield.until < devoured.until || (shield.until === devoured.until && devoured.kind !== 'shield'))) {
            devoured = { targetId: unit.id, kind: 'shield', amount: shield.amount, until: shield.until };
          }
          const guardUntil = guarded[unit.id] ?? -Infinity;
          if (guardUntil >= round && (!devoured || guardUntil < devoured.until)) {
            devoured = { targetId: unit.id, kind: 'guard', amount: BOSS_PARAMS.DEVOUR_GUARD_SHIELD, until: guardUntil };
          }
        }
        if (devoured) {
          if (devoured.kind === 'shield') delete shields[devoured.targetId]; else delete guarded[devoured.targetId];
          shields[boss.bossId] = { amount: devoured.amount, until: devoured.until };
          pushEvent('吞噬', devoured.targetId);
        } else {
          hungryRound = round; // 饥饿：本轮囡囡受伤 ×2
          pushEvent('饥饿', boss.bossId);
        }
      }
      if (boss.mechanic === 'taste' && round === 1) pushEvent('淡境', boss.bossId);
      if (boss.mechanic === 'feast') {
        // 三阶段按 Boss 当前血量比例切换（轮首评估，阶段切换写入时间线事件）
        const ratio = health[boss.bossId] / bossUnit.maxHp;
        const nextPhase = ratio > BOSS_PARAMS.FEAST_PHASE_HIGH ? '餐前' : ratio >= BOSS_PARAMS.FEAST_PHASE_LOW ? '上菜' : '散席';
        if (nextPhase !== feastPhase) {
          feastPhase = nextPhase;
          pushEvent(feastPhase, boss.bossId);
        }
      }
    }
    for (const actor of [...units].sort((a, b) => speedOf(b) - speedOf(a))) {
      if (!alive('ally').length || !alive('enemy').length) break;
      if (health[actor.id] <= 0) continue;
      if (stunned[actor.id] === round) continue; // 眩晕：跳过本次行动，不消耗 RNG
      const targets = alive(actor.side === 'ally' ? 'enemy' : 'ally');
      const teammates = alive(actor.side).sort((a, b) => health[a.id] / a.maxHp - health[b.id] / b.maxHp);
      const healing = actor.character === '青团' && round % 3 === 0 && health[teammates[0].id] < teammates[0].maxHp * 0.8;
      const target = healing ? teammates[0] : targets[Math.floor(random() * targets.length)];
      const special = round % 3 === 0;
      const effect = effectOf(actor);
      const criticalChance = Math.max(0, (actor.critical ?? 18) - (target.resistance ?? 0)) / 100;
      const critical = !healing && random() < criticalChance;
      const pierce = special && !healing && effect === 'pierce';
      const raw = Math.max(1, Math.round(attackOf(actor) * (0.9 + random() * 0.2) * (special ? 1.55 : 1) * (critical ? 1.5 : 1) - (healing || pierce ? 0 : defenseOf(target) * 0.35)));
      const guardHit = !healing && (guarded[target.id] ?? -Infinity) >= round;
      let dealt = guardHit ? Math.max(1, Math.round(raw * SKILL_PARAMS.GUARD_FACTOR)) : raw;
      // Boss 受伤修正（影厨减伤 / 饥饿 / 团圆纹；叠乘、四舍五入、保底 1，零 RNG）
      const incomingFactor = incomingFactorOf(target.id);
      if (incomingFactor !== 1) dealt = Math.max(1, Math.round(dealt * incomingFactor));
      // 咸与淡淡境：奇数轮敌方全体直接输出 ×0.75（保底 1）
      if (!healing && boss?.mechanic === 'taste' && round % 2 === 1 && actor.side === 'enemy') {
        dealt = Math.max(1, Math.round(dealt * BOSS_PARAMS.TASTE_MILD_FACTOR));
      }
      if (!healing) {
        const shield = shields[target.id];
        if (shield && shield.until >= round && shield.amount > 0) {
          const absorbed = Math.min(shield.amount, dealt);
          shield.amount -= absorbed;
          dealt -= absorbed;
        }
      }
      const amount = healing ? Math.min(target.maxHp - health[target.id], raw) : Math.min(health[target.id], dealt);
      health[target.id] += healing ? amount : -amount;
      // 汲取：按实际伤害的 40% 回复自身（折入同一快照，不产生额外回合）
      if (special && !healing && effect === 'drain' && amount > 0) {
        health[actor.id] += Math.min(actor.maxHp - health[actor.id], Math.floor(amount * SKILL_PARAMS.DRAIN_RATIO));
      }
      // 技能效果施加（均不消耗 RNG；灼烧施加值走 attackOf 口径）
      if (special && !healing) {
        if (effect === 'burn') burns[target.id] = { amount: Math.max(1, Math.round(attackOf(actor) * SKILL_PARAMS.BURN_RATIO)), until: round + SKILL_PARAMS.BURN_TURNS, source: actor.id };
        if (effect === 'chill') chilled[target.id] = round + SKILL_PARAMS.CHILL_TURNS;
        if (effect === 'shred') shredded[target.id] = round + SKILL_PARAMS.SHRED_TURNS;
        if (effect === 'guard') for (const mate of alive(actor.side)) guarded[mate.id] = round + SKILL_PARAMS.GUARD_TURNS;
        if (effect === 'shield') for (const mate of alive(actor.side)) shields[mate.id] = { amount: Math.max(1, Math.round(attackOf(actor) * SKILL_PARAMS.SHIELD_RATIO)), until: round + SKILL_PARAMS.SHIELD_TURNS };
        if (effect === 'stun' && critical) stunned[target.id] = round + 1;
      }
      turns.push({ round, actor: actor.id, target: target.id, kind: healing ? 'heal' : special ? 'skill' : 'attack', skill: healing ? '春风化雨' : special ? skillNameOf(actor) : '灵力一击', amount, critical, health: { ...health } });
    }
    // 灼烧跳伤：按单位插入序逐个结算（确定性，无 RNG）；跳伤可致死并写入时间线
    for (const unit of units) {
      const burn = burns[unit.id];
      if (!burn || burn.until < round || health[unit.id] <= 0) continue;
      const loss = Math.min(health[unit.id], burn.amount);
      health[unit.id] -= loss;
      turns.push({ round, actor: burn.source, target: unit.id, kind: 'skill', skill: SKILL_PARAMS.BURN_SKILL, amount: loss, critical: false, health: { ...health } });
    }
    // ---- Boss 轮末阶段（零 RNG；Boss 存活且我方有人时才结算）----
    if (boss && bossUnit && health[boss.bossId] > 0 && alive('ally').length > 0) {
      if (boss.mechanic === 'taste') {
        if (round % 2 === 1) {
          pushEvent('味性前摇', boss.bossId); // 淡境 → 咸境切换的前摇
        } else {
          pushEvent('咸境', boss.bossId);
          // 咸境：轮末我方全体按最大生命 3% 掉血（保底 1，可致死，逐人写入时间线）
          for (const unit of units) {
            if (unit.side !== 'ally' || health[unit.id] <= 0) continue;
            const loss = Math.min(health[unit.id], Math.max(1, Math.round(unit.maxHp * BOSS_PARAMS.TASTE_SALT_RATIO)));
            health[unit.id] -= loss;
            turns.push({ round, actor: boss.bossId, target: unit.id, kind: 'skill', skill: '咸境', amount: loss, critical: false, health: { ...health } });
          }
        }
      }
      if (boss.mechanic === 'feast' && feastPhase === '餐前') {
        // 餐前：轮末我方全体按最大生命 2% 掉血（保底 1，可致死，逐人写入时间线）
        for (const unit of units) {
          if (unit.side !== 'ally' || health[unit.id] <= 0) continue;
          const loss = Math.min(health[unit.id], Math.max(1, Math.round(unit.maxHp * BOSS_PARAMS.FEAST_PRE_MEAL_DRAIN)));
          health[unit.id] -= loss;
          turns.push({ round, actor: boss.bossId, target: unit.id, kind: 'skill', skill: '餐前', amount: loss, critical: false, health: { ...health } });
        }
      }
    }
    if (!alive('ally').length || !alive('enemy').length) break;
  }
  const hpRatio = (side: 'ally' | 'enemy') => units.filter(unit => unit.side === side).reduce((sum, unit) => sum + health[unit.id], 0) / units.filter(unit => unit.side === side).reduce((sum, unit) => sum + unit.maxHp, 0);
  const win = alive('ally').length > 0 && (alive('enemy').length === 0 || hpRatio('ally') > hpRatio('enemy'));
  return { win, rounds: Math.min(round, MAX_BATTLE_ROUNDS), turns };
}

export function simulateBattle(save: GameSave, stageId: string, formation: string[], seed: number, id: string, now = new Date()): BattleRecord | null {
  const stage = battleStages.find(item => item.id === stageId);
  const team = validFormation(save, formation);
  if (!stage || !save.profile || team.length === 0) return null;
  const allies: Combatant[] = team.map((name, index) => {
    const stats = characterBattleStats(save, name, index);
    return { id: `ally-${index}`, name, character: name, side: 'ally', star: starLevel(save, name), maxHp: stats.health, attack: stats.attack, speed: stats.speed, defense: stats.defense, critical: stats.critical, resistance: stats.resistance };
  });
  // Boss 关：编成由 bossStages 覆盖（Boss 主体强化 + mirror 影厨），并向时间线注入 Boss 上下文
  const bossBuild = bossStages[stageId] ? buildBossEnemies(stage, allies) : null;
  const enemies: Combatant[] = bossBuild
    ? bossBuild.enemies
    : (stageEnemies[stageId] ?? defaultEnemyNames).map((name, index) => ({
      id: `enemy-${index}`, name, character: null, side: 'enemy', star: stage.id === '1-1' ? 1 : 3,
      maxHp: Math.round(stage.suggest / 12 * (index === 2 ? 1.2 : 0.9)),
      attack: Math.round(stage.suggest / 72 * (index === 2 ? 1.15 : 0.9)), speed: 100 + index * 4,
    }));
  const units = [...allies, ...enemies];
  const timeline = simulateTimeline(units, seed, bossBuild?.boss);
  return {
    version: 1, id, seed, stageId, stageName: stage.name, chapter: stage.chapter, startedAt: now.toISOString(), settledAt: null,
    power: squadPower(save, team), enemyPower: stage.suggest, units, turns: timeline.turns, win: timeline.win, rounds: timeline.rounds,
    firstClear: !save.firstClears.includes(stageId), rewards: timeline.win ? battleRewards(save, stageId) : [], status: 'pending',
  };
}

export function beginBattle(save: GameSave, stageId: string, formation: string[], seed: number, id: string, now = new Date()): GameSave {
  if (save.pendingBattle) return save;
  const next = rolloverDaily(save, now);
  const record = simulateBattle(next, stageId, formation, seed, id, now);
  if (!record) return next;
  // 本地演示口径：与服务端一致的开战计数；次数用尽则不开战
  const charges = battleChargesOf(next);
  if (charges.remaining <= 0) return next;
  const today = localDateKey(now);
  return {
    ...next,
    dailyBattleDate: today,
    dailyBattlesUsed: (next.dailyBattlesUsed ?? 0) + 1,
    formation: validFormation(next, formation),
    pendingBattle: record,
  };
}

export function settleBattle(save: GameSave, id: string, now = new Date()): GameSave {
  const current = rolloverDaily(save, now);
  const record = current.pendingBattle;
  if (!record || record.id !== id || current.battleHistory.some(item => item.id === id) || !current.profile) return current;
  const settled: BattleRecord = { ...record, status: record.win ? 'claimed' : 'lost', settledAt: now.toISOString() };
  const next = record.win ? grantRewards(current, record.rewards) : current;
  const sameEventDay = localDate(new Date(record.startedAt)) === localDate(now);
  return {
    ...next, pendingBattle: null, battleHistory: [settled, ...next.battleHistory].slice(0, MAX_BATTLE_HISTORY),
    battleWins: next.battleWins + Number(record.win),
    firstClears: record.win ? Array.from(new Set([...next.firstClears, record.stageId])) : next.firstClears,
    chroniclePoints: next.chroniclePoints + Number(record.win && sameEventDay),
  };
}

export function healthAt(record: BattleRecord, step: number): Record<string, number> {
  return step > 0 ? record.turns[Math.min(step, record.turns.length) - 1].health : Object.fromEntries(record.units.map(unit => [unit.id, unit.maxHp]));
}

export function damageByUnit(record: BattleRecord) {
  return record.units.filter(unit => unit.side === 'ally').map(unit => ({
    ...unit,
    damage: record.turns.filter(turn => turn.actor === unit.id && turn.kind !== 'heal').reduce((sum, turn) => sum + turn.amount, 0),
    healing: record.turns.filter(turn => turn.actor === unit.id && turn.kind === 'heal').reduce((sum, turn) => sum + turn.amount, 0),
  })).sort((a, b) => b.damage - a.damage);
}

// Local storage is user-editable. Reject malformed timelines instead of crashing playback.
export function isBattleRecord(value: unknown): value is BattleRecord {
  if (!value || typeof value !== 'object') return false;
  const record = value as BattleRecord;
  const positive = (n: unknown): n is number => typeof n === 'number' && Number.isSafeInteger(n) && n > 0 && n < 1e9;
  if (record.version !== 1 || typeof record.id !== 'string' || !record.id || record.id.length > 100 || !Number.isFinite(record.seed)) return false;
  if (!battleStages.some(stage => stage.id === record.stageId) || typeof record.stageName !== 'string' || typeof record.chapter !== 'string') return false;
  if (Number.isNaN(Date.parse(record.startedAt)) || (record.settledAt !== null && Number.isNaN(Date.parse(record.settledAt)))) return false;
  if (!['pending', 'claimed', 'lost'].includes(record.status) || typeof record.win !== 'boolean' || typeof record.firstClear !== 'boolean') return false;
  if (!positive(record.power) || !positive(record.enemyPower) || !positive(record.rounds) || record.rounds > MAX_BATTLE_ROUNDS) return false;
  if (!Array.isArray(record.units) || record.units.length < 2 || record.units.length > 7) return false; // Boss 关最多 3 我方 + 3 敌人 + 1 影厨 = 7
  if (!record.units.every(unit => unit && typeof unit.id === 'string' && typeof unit.name === 'string' && ['ally', 'enemy'].includes(unit.side) && positive(unit.maxHp) && positive(unit.attack) && positive(unit.speed) && positive(unit.star) && unit.star <= 5 && (unit.character === null || characters.some(character => character.name === unit.character)))) return false;
  if (!record.units.every(unit => ['defense', 'critical', 'resistance'].every(key => {
    const value = unit[key as keyof Combatant];
    return value === undefined || (typeof value === 'number' && Number.isSafeInteger(value) && value >= 0 && value < 1e6);
  }))) return false;
  if (record.units.some(unit => unit.side === 'ally' && !characters.some(character => character.name === unit.character && character.name === unit.name))) return false;
  const ids = new Set(record.units.map(unit => unit.id));
  if (ids.size !== record.units.length || !record.units.some(unit => unit.side === 'ally') || !record.units.some(unit => unit.side === 'enemy')) return false;
  if (!Array.isArray(record.turns) || record.turns.length === 0 || record.turns.length > MAX_BATTLE_ROUNDS * 14) return false; // Boss 事件轮增量：7 单位 × 12 轮 + 灼烧 + Boss 事件上限
  if (!record.turns.every(turn => turn && ids.has(turn.actor) && ids.has(turn.target) && positive(turn.round) && turn.round <= MAX_BATTLE_ROUNDS && ['attack', 'skill', 'heal'].includes(turn.kind) && typeof turn.skill === 'string' && typeof turn.critical === 'boolean' && Number.isSafeInteger(turn.amount) && turn.amount >= 0 && turn.health && record.units.every(unit => Number.isFinite(turn.health[unit.id]) && turn.health[unit.id] >= 0 && turn.health[unit.id] <= unit.maxHp))) return false;
  return Array.isArray(record.rewards) && record.rewards.length <= 5 && record.rewards.every(reward => reward && ['coin', 'gem', 'book', 'leaf', 'potion', 'chest', 'medal', 'exp'].includes(reward.kind) && positive(reward.amount) && typeof reward.label === 'string');
}