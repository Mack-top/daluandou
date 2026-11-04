import { transaction } from '../db/index.js';
import { dayKey, nowIso } from '../lib/clock.js';
import { conflict, forbidden, notFound } from '../lib/errors.js';
import { newId, newSeed } from '../lib/ids.js';
import { createRng } from '../lib/rng.js';
import { battleExpGain, characterPower, equipmentPower, growthMultiplier, growthScaled, growthWeightsOf, sumEquipmentStats, type EquipmentStats } from '../domain/power.js';
import { parseJsonArray, type BattleDto, type BattleTurnDto, type BattleUnitDto, type Reward } from '../domain/types.js';
import { applyResourceDelta, getProgress, grantRewards, requirePlayer, updateProgress } from '../repositories/player.repository.js';
import { findEquipmentDefById, findStageById } from '../repositories/catalog.repository.js';
import { listAstrology, listFormation, listOwnedCharacters, listPlayerEquipment } from '../repositories/roster.repository.js';
import {
  ensureBattleCharge,
  findBattle,
  findPendingBattle,
  hasFirstClear,
  incrementBattleCharge,
  insertBattle,
  insertBattleTurns,
  listBattles,
  settleBattleRow,
} from '../repositories/battle.repository.js';
import { toBattleDto } from './state.service.js';
import { updateLeaderboardScore } from './leaderboard.service.js';

const LEADERBOARD_BATTLE_WINS = 'lb-battle-wins';

const MAX_ROUNDS = 12;

/* ------------------------------ 每日挑战次数 ------------------------------ */

import {
  BATTLE_PASS_COST_GEMS,
  FREE_BATTLES_PER_DAY,
  MAX_BATTLES_PER_DAY,
  MAX_PASSES_PER_DAY,
  computeBattleCharges,
  type BattleCharges,
} from '../domain/battle-charges.js';
export { BATTLE_PASS_COST_GEMS, FREE_BATTLES_PER_DAY, MAX_BATTLES_PER_DAY, MAX_PASSES_PER_DAY };
export type { BattleCharges };

/** 当日挑战次数视图（跨日首次调用自动建行——重置即「零操作」）。 */
export function getBattleCharges(playerId: string): BattleCharges {
  return computeBattleCharges(ensureBattleCharge(playerId, dayKey()));
}

/**
 * 购买挑战卡：免费次数用尽后才能购买；达每日总上限或当日已购满后拒绝。
 * 扣费走 applyResourceDelta（余额不足时内部抛错，事务回滚）。
 */
export function purchaseBattlePass(playerId: string): { charges: BattleCharges } {
  return transaction(() => {
    const charges = getBattleCharges(playerId);
    if (charges.used < FREE_BATTLES_PER_DAY) {
      throw conflict(`今日免费挑战次数还剩 ${FREE_BATTLES_PER_DAY - charges.used} 次，用尽后再购买`);
    }
    if (charges.purchased >= MAX_PASSES_PER_DAY) {
      throw conflict(`今日挑战卡已购满（${MAX_PASSES_PER_DAY} 张）`);
    }
    if (charges.used >= MAX_BATTLES_PER_DAY) {
      throw conflict(`已达每日挑战上限（${MAX_BATTLES_PER_DAY} 次）`);
    }
    applyResourceDelta(playerId, { gem: -BATTLE_PASS_COST_GEMS }, 'battle-pass.purchase');
    incrementBattleCharge(playerId, charges.dayKey, 'purchased');
    return { charges: getBattleCharges(playerId) };
  });
}

/* ------------------------------ 确定性随机 ------------------------------ */

/** 技能名表：与前端 battle-engine.ts 逐字一致。 */
const SKILL_NAMES: Record<string, string> = {
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
const HEAL_SKILL = '春风化雨';
const FALLBACK_SKILL = '月影冲击';
const NORMAL_SKILL = '灵力一击';

export type SkillEffect = 'heal' | 'burn' | 'chill' | 'shield' | 'shred' | 'guard' | 'drain' | 'pierce' | 'stun' | 'none';

/**
 * 技能效果表：技能回合（每 3 轮一次）命中时生效。与前端 battle-engine.ts 逐字一致（parity 锁定）。
 * 所有效果均不消耗 RNG——RNG 消耗序保持：治疗分支 1 次、普通分支 3 次。
 */
const SKILL_EFFECTS: Record<string, SkillEffect> = {
  // 食灵
  '青团': 'heal',
  '蓝纹奶酪': 'chill',
  '冬阴功': 'burn',
  '拉菲': 'shield',
  '咖喱': 'guard',
  // 馔妖
  '巡夜灯灵': 'none',
  '雾隐食客': 'drain',
  '月桥守卫': 'shred',
  '馔尘蛾': 'chill',
  '冰髓甜魄': 'chill',
  '灶灰小鬼': 'burn',
  '汤勺泥偶': 'stun',
  '雾厨无名氏': 'pierce',
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

/** 效果数值：与前端 battle-engine.ts 逐字一致。 */
export const SKILL_PARAMS = {
  BURN_RATIO: 0.35, BURN_TURNS: 2, BURN_SKILL: '灼烧',
  CHILL_FACTOR: 0.75, CHILL_TURNS: 2,
  SHIELD_RATIO: 0.9, SHIELD_TURNS: 2,
  SHRED_TURNS: 2,
  GUARD_FACTOR: 0.75, GUARD_TURNS: 1,
  DRAIN_RATIO: 0.4,
} as const;

export type SimulatedBattle = { win: boolean; rounds: number; turns: BattleTurnDto[] };

/**
 * 纯时间线推演：不读数据库、不产生副作用，便于单元测试与回放校验。
 * 与前端 battle-engine.ts 的 simulateTimeline 逐帧一致（battle-parity 测试锁定）：
 * - 出手顺序按速度降序【稳定】排序，平速按插入序，禁止 id 决胜；
 * - 青团每 3 轮且最低血比例队友 < 80% maxHp 时治疗；
 * - RNG 消耗顺序是命门：治疗分支 1 次（选目标 0 次 + 暴击因 `!healing &&` 短路 0 次 + 浮动 1 次），
 *   普通分支 3 次（目标、暴击、浮动）。任何顺序偏差都会导致同种子时间线分叉。
 * Boss 机制（boss 参数，缺省 undefined = 非 Boss 关，行为与旧版完全一致）同样零 RNG，
 * 逻辑与前端 battle-engine.ts 逐字镜像。
 */
export function simulateTimeline(units: BattleUnitDto[], seed: number, boss?: BossContext): SimulatedBattle {
  const rng = createRng(seed);
  const health: Record<string, number> = Object.fromEntries(units.map(unit => [unit.id, unit.maxHp]));
  const turns: BattleTurnDto[] = [];
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
  const effectOf = (unit: BattleUnitDto) =>
    boss && boss.mechanic === 'mirror' && boss.mirrorId === unit.id && boss.mirrorSource
      ? SKILL_EFFECTS[boss.mirrorSource] ?? 'none'
      : SKILL_EFFECTS[unit.name] ?? 'none';
  const skillNameOf = (unit: BattleUnitDto) =>
    boss && boss.mechanic === 'mirror' && boss.mirrorId === unit.id && boss.mirrorSource
      ? SKILL_NAMES[boss.mirrorSource] || FALLBACK_SKILL
      : SKILL_NAMES[unit.name] || FALLBACK_SKILL;
  // Boss 语境攻击力口径：忘川馔按阶段放大（餐前 ×1 / 上菜 ×1.2 / 散席 ×1.4），影响直击与灼烧施加值
  const attackOf = (unit: BattleUnitDto) =>
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

  for (; round <= MAX_ROUNDS; round += 1) {
    const speedOf = (unit: BattleUnitDto) => {
      const base = (chilled[unit.id] ?? -Infinity) >= round ? unit.speed * SKILL_PARAMS.CHILL_FACTOR : unit.speed;
      // 壶中翁醉步：偶数轮 ×1.3、奇数轮 ×0.7（确定性速度波动，影响出手序）
      return boss && boss.mechanic === 'drunk' && unit.id === boss.bossId ? base * (round % 2 === 0 ? BOSS_PARAMS.DRUNK_SPEED_UP : BOSS_PARAMS.DRUNK_SPEED_DOWN) : base;
    };
    const defenseOf = (unit: BattleUnitDto) => ((shredded[unit.id] ?? -Infinity) >= round ? 0 : (unit.defense ?? 0));
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
      const target = healing ? teammates[0] : targets[Math.floor(rng() * targets.length)];
      const special = round % 3 === 0;
      const effect = effectOf(actor);
      const criticalChance = Math.max(0, (actor.critical ?? 18) - (target.resistance ?? 0)) / 100;
      const critical = !healing && rng() < criticalChance;
      const pierce = special && !healing && effect === 'pierce';
      const raw = Math.max(1, Math.round(attackOf(actor) * (0.9 + rng() * 0.2) * (special ? 1.55 : 1) * (critical ? 1.5 : 1) - (healing || pierce ? 0 : defenseOf(target) * 0.35)));
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
      turns.push({
        round,
        actor: actor.id,
        target: target.id,
        kind: healing ? 'heal' : special ? 'skill' : 'attack',
        skill: healing ? HEAL_SKILL : special ? skillNameOf(actor) : NORMAL_SKILL,
        amount,
        critical,
        health: { ...health },
      });
    }
    // 灼烧跳伤：按单位插入序逐个结算（确定性，无 RNG）；跳伤可致死并写入时间线
    for (const unit of units) {
      const burn = burns[unit.id];
      if (!burn || burn.until < round || health[unit.id] <= 0) continue;
      const loss = Math.min(health[unit.id], burn.amount);
      health[unit.id] -= loss;
      turns.push({
        round,
        actor: burn.source,
        target: unit.id,
        kind: 'skill',
        skill: SKILL_PARAMS.BURN_SKILL,
        amount: loss,
        critical: false,
        health: { ...health },
      });
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
            turns.push({
              round,
              actor: boss.bossId,
              target: unit.id,
              kind: 'skill',
              skill: '咸境',
              amount: loss,
              critical: false,
              health: { ...health },
            });
          }
        }
      }
      if (boss.mechanic === 'feast' && feastPhase === '餐前') {
        // 餐前：轮末我方全体按最大生命 2% 掉血（保底 1，可致死，逐人写入时间线）
        for (const unit of units) {
          if (unit.side !== 'ally' || health[unit.id] <= 0) continue;
          const loss = Math.min(health[unit.id], Math.max(1, Math.round(unit.maxHp * BOSS_PARAMS.FEAST_PRE_MEAL_DRAIN)));
          health[unit.id] -= loss;
          turns.push({
            round,
            actor: boss.bossId,
            target: unit.id,
            kind: 'skill',
            skill: '餐前',
            amount: loss,
            critical: false,
            health: { ...health },
          });
        }
      }
    }
    if (!alive('ally').length || !alive('enemy').length) break;
  }

  // 胜负判定与前端一致：分母为【全部单位】（非仅存活），严格大于（相等判负）
  const hpRatio = (side: 'ally' | 'enemy') =>
    units.filter(unit => unit.side === side).reduce((sum, unit) => sum + health[unit.id], 0)
    / units.filter(unit => unit.side === side).reduce((sum, unit) => sum + unit.maxHp, 0);
  const win = alive('ally').length > 0 && (alive('enemy').length === 0 || hpRatio('ally') > hpRatio('enemy'));
  return { win, rounds: Math.min(round, MAX_ROUNDS), turns };
}

export function simulateBattle(input: {
  seed: number;
  allies: BattleUnitDto[];
  enemies: BattleUnitDto[];
  boss?: BossContext;
}): SimulatedBattle {
  return simulateTimeline([...input.allies, ...input.enemies], input.seed, input.boss);
}

/* ------------------------------ 队伍构建 ------------------------------ */

function equippedStats(playerId: string): EquipmentStats {
  const equipped = listPlayerEquipment(playerId).filter(item => item.equipped_slot);
  const stats = equipped.flatMap(item => {
    const definition = findEquipmentDefById(item.template_id);
    if (!definition) return [];
    // v20 §4.3：副属性随穿戴件计入面板（substat 折算在 sumEquipmentStats 内，生命 ×100）
    const substat = item.substat_key && item.substat_value
      ? { key: item.substat_key, value: Number(item.substat_value) }
      : null;
    return [{ ...definition, level: item.level, substat }];
  });
  return sumEquipmentStats(stats);
}

export function buildSquad(playerId: string): { allies: BattleUnitDto[]; power: number } {
  const astrologyCount = listAstrology(playerId).length;
  const owned = new Map(listOwnedCharacters(playerId).map(character => [character.character_id, character]));
  const gear = equippedStats(playerId);
  const gearPower = equipmentPower(gear);
  // v17 §2.3：掌灶人等级（世界树）成长系数 1.0→2.6，与前端 baseCharacterPower 同式
  const growth = growthMultiplier(requirePlayer(playerId).worldtree_level);

  const allies: BattleUnitDto[] = [];
  let power = 0;
  let index = 0;
  for (const slot of listFormation(playerId)) {
    const character = owned.get(slot.character_id);
    if (!character) continue;
    // 面板口径与前端 characterBattleStats 一致：装备面板全额摊入，defense/resistance 无基础值
    // baseFactor = 未乘 growth 的基础战力（星级×星象）；power 口径含 growth，属性派生单独吃权重
    const baseFactor = Math.round(
      character.base_power * (1 + (character.star - 1) * 0.28) * (1 + astrologyCount * 0.02),
    );
    const base = characterPower(character.base_power, character.star, astrologyCount, growth);
    // v17 §6 职业成长权重：成长增量（growth-1）按职业分化，战力口径不变（锚点零漂移）
    const weights = growthWeightsOf(character.role);
    power += base + gearPower;
    allies.push({
      id: `ally-${index}`,
      name: character.name,
      side: 'ally',
      character: character.name,
      star: character.star,
      maxHp: Math.round(growthScaled(baseFactor / 4, growth, weights.health)) + gear.health,
      attack: Math.round(growthScaled(baseFactor / 24, growth, weights.attack)) + gear.attack,
      speed: Math.round(growthScaled(116 - index * 3, growth, weights.speed)) + gear.speed,
      defense: gear.defense,
      critical: Math.min(60, 18 + gear.critical),
      resistance: Math.min(50, gear.resistance),
    });
    index += 1;
  }

  return { allies, power };
}

/** 默认馔妖三件套；新章节关卡按 STAGE_ENEMIES 覆盖。与前端 battle-engine.ts 逐字一致（parity 锁定）。 */
export const ENEMY_NAMES = ['巡夜灯灵', '雾隐食客', '月桥守卫'];
export const STAGE_ENEMIES: Record<string, string[]> = {
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
 * Boss 机制数值口径：与前端 battle-engine.ts 逐字一致（parity 锁定）。
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

/** Boss 关配置：stageId → Boss 名称、机制与敌人编成（index 2 恒为 Boss 主体）。与前端 battle-engine.ts 逐字一致。 */
export type BossStage = { name: string; mechanic: BossMechanic; enemies: string[] };

export const BOSS_STAGES: Record<string, BossStage> = {
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
 * 与前端 battle-engine.ts 逐字一致（parity 锁定）。
 */
export type BossContext = {
  stageId: string;
  bossId: string; // Boss 主体单位 id（编成 index 2 → 'enemy-2'）
  mechanic: BossMechanic;
  mirrorId?: string;      // mirror 专用：影厨单位 id（'enemy-mirror'）
  mirrorSource?: string;  // mirror 专用：被复制食灵名（用于解析影厨技能效果）
};

/**
 * 从 stageId + 我方阵容推导 Boss 上下文（确定性：mirror 源 = 我方攻击最高者，平攻取插入序最先）。
 * 开战与结算共用同一推导，保证存储的 unitsJson 重新推演时上下文一致。
 */
export function buildBossContext(stageId: string, allies: BattleUnitDto[]): BossContext | null {
  const config = BOSS_STAGES[stageId];
  if (!config) return null;
  const boss: BossContext = { stageId, bossId: 'enemy-2', mechanic: config.mechanic };
  if (config.mechanic === 'mirror') {
    const source = allies.reduce<BattleUnitDto | null>((best, unit) => (!best || unit.attack > best.attack) ? unit : best, null);
    if (source) {
      boss.mirrorId = 'enemy-mirror';
      boss.mirrorSource = source.name;
    }
  }
  return boss;
}

/** 导出供 parity 测试与前端构建公式逐字段比对；Boss 关编成由 BOSS_STAGES 覆盖（与前端 buildBossEnemies Boss 分支逐字段一致）。 */
export function buildEnemies(stageId: string, enemyPower: number, allies: BattleUnitDto[] = []): BattleUnitDto[] {
  const config = BOSS_STAGES[stageId];
  if (config) {
    const enemies: BattleUnitDto[] = config.enemies.map((name, index) => ({
      id: `enemy-${index}`,
      name,
      side: 'enemy' as const,
      character: null,
      star: stageId === '1-1' ? 1 : 3,
      maxHp: Math.round(enemyPower / 12 * (index === 2 ? 1.2 : 0.9) * (index === 2 ? BOSS_PARAMS.BOSS_HP_FACTOR : 1)),
      attack: Math.round(enemyPower / 72 * (index === 2 ? 1.15 : 0.9) * (index === 2 ? BOSS_PARAMS.BOSS_ATTACK_FACTOR : 1)),
      speed: 100 + index * 4,
      defense: 0,
      critical: 18,
      resistance: 0,
    }));
    if (config.mechanic === 'mirror') {
      const source = allies.reduce<BattleUnitDto | null>((best, unit) => (!best || unit.attack > best.attack) ? unit : best, null);
      if (source) {
        enemies.push({
          id: 'enemy-mirror',
          name: `影厨·${source.name}`,
          side: 'enemy',
          character: null,
          star: 3,
          maxHp: Math.round(source.maxHp * BOSS_PARAMS.MIRROR_STATS_FACTOR),
          attack: Math.round(source.attack * BOSS_PARAMS.MIRROR_STATS_FACTOR),
          speed: Math.round(source.speed * BOSS_PARAMS.MIRROR_STATS_FACTOR),
          defense: Math.round(source.defense * BOSS_PARAMS.MIRROR_STATS_FACTOR),
          critical: source.critical,
          resistance: source.resistance,
        });
      }
    }
    return enemies;
  }
  // 与前端 battle-engine.ts 敌人构建逐字段一致；DTO 必填字段以显式 0/18 复刻前端 `?? 0 / ?? 18` 兜底语义
  return (STAGE_ENEMIES[stageId] ?? ENEMY_NAMES).map((name, index) => ({
    id: `enemy-${index}`,
    name,
    side: 'enemy' as const,
    character: null,
    star: stageId === '1-1' ? 1 : 3,
    maxHp: Math.round(enemyPower / 12 * (index === 2 ? 1.2 : 0.9)),
    attack: Math.round(enemyPower / 72 * (index === 2 ? 1.15 : 0.9)),
    speed: 100 + index * 4,
    defense: 0,
    critical: 18,
    resistance: 0,
  }));
}

/* ------------------------------ 开战与结算 ------------------------------ */

export function startBattle(playerId: string, stageId: string): BattleDto {
  return transaction(() => {
    const stage = findStageById(stageId);
    if (!stage) throw notFound('关卡不存在');

    if (findPendingBattle(playerId)) {
      throw conflict('存在未结算的战斗，请先完成结算');
    }

    // 每日挑战次数硬校验：免费 4 次 + 已购挑战卡；达每日总上限后当天不能再挑战
    const day = dayKey();
    const charge = ensureBattleCharge(playerId, day);
    const allowed = FREE_BATTLES_PER_DAY + charge.purchased;
    if (charge.used >= allowed) {
      throw conflict(
        allowed >= MAX_BATTLES_PER_DAY
          ? `已达每日挑战上限（${MAX_BATTLES_PER_DAY} 次），明日重置`
          : '今日免费挑战次数已用尽，可购买挑战卡继续挑战',
      );
    }
    incrementBattleCharge(playerId, day, 'used');

    const { allies, power } = buildSquad(playerId);
    if (!allies.length) throw conflict('请先设置出战阵容');

    const enemies = buildEnemies(stageId, stage.suggested_power, allies);
    const battleId = newId();
    insertBattle({
      id: battleId,
      playerId,
      stageId,
      seed: newSeed(),
      power,
      enemyPower: stage.suggested_power,
      unitsJson: JSON.stringify([...allies, ...enemies]),
      startedAt: nowIso(),
    });

    const row = findBattle(battleId);
    if (!row) throw conflict('战斗创建失败');
    return toBattleDto(row, stage);
  });
}

export function settleBattle(playerId: string, battleId: string): { battle: BattleDto; rewards: Reward[]; win: boolean } {
  return transaction(() => {
    const row = findBattle(battleId);
    if (!row) throw notFound('战斗不存在');
    if (row.player_id !== playerId) throw forbidden('无权结算该战斗');
    if (row.status !== 'pending') throw conflict('该战斗已结算');

    const stage = findStageById(row.stage_id);
    if (!stage) throw notFound('关卡不存在');

    const units = parseJsonArray<BattleUnitDto>(row.units_json);
    const allies = units.filter(unit => unit.side === 'ally');
    // Boss 关从 stageId + 存储的我方阵容重新推导上下文（与开战时同一确定性规则）
    const outcome = simulateBattle({
      seed: row.seed,
      allies,
      enemies: units.filter(unit => unit.side === 'enemy'),
      boss: buildBossContext(row.stage_id, allies) ?? undefined,
    });

    const firstClear = outcome.win && !hasFirstClear(playerId, row.stage_id);

    settleBattleRow({
      battleId,
      status: outcome.win ? 'claimed' : 'lost',
      win: outcome.win,
      rounds: outcome.rounds,
      firstClear,
      unitsJson: row.units_json,
      settledAt: nowIso(),
    });

    insertBattleTurns(
      battleId,
      outcome.turns.map((turn, index) => ({
        battle_id: battleId,
        round: turn.round,
        seq: index + 1,
        actor_id: turn.actor,
        target_id: turn.target,
        kind: turn.kind,
        skill: turn.skill,
        amount: turn.amount,
        critical: turn.critical ? 1 : 0,
        health_json: JSON.stringify(turn.health),
      })),
    );

    // 奖励口径与前端 battleRewards 一致：首通全奖，复刷非 character 奖励按 20%（下限 1）折算
    let rewards: Reward[] = [];
    if (outcome.win) {
      const full = parseJsonArray<Reward>(stage.reward_json);
      rewards = firstClear
        ? full
        : full
          .filter(reward => reward.kind !== 'character')
          .map(reward => ({ ...reward, amount: Math.max(1, Math.floor(reward.amount * 0.2)) }));
      // v17 §3.3③：复刷追加食灵精华掉落 = floor(锚/2000)（下限 1）；首通走关卡自带奖励不重复发
      if (!firstClear) {
        rewards.push({ kind: 'leaf', amount: Math.max(1, Math.floor(stage.suggested_power / 2000)), label: '食灵精华' });
      }
      grantRewards(playerId, rewards, 'battle.win', battleId);

      // v17 数值核心：战斗胜利发放掌灶人经验（服务端权威，设计 §2.2）
      // exp = round(关卡锚/90)，首通 ×3；碾压刷取（队伍战力 ≥ 锚×1.5）减半（§3.4 等级差保护）
      const progress = getProgress(playerId);
      const expGain = battleExpGain(stage.suggested_power, firstClear, row.power);
      updateProgress(playerId, { battle_wins: progress.battle_wins + 1, exp: progress.exp + expGain });
      // 经验入结算返回值供客户端弹奖励提示（grantRewards 已发放，此处仅追加展示）
      if (expGain > 0) rewards.push({ kind: 'exp', amount: expGain, label: '掌灶人经验' });

      // battle_wins 榜：结算事务内 upsert（设计 §3.6，score 只能服务端写）
      updateLeaderboardScore(LEADERBOARD_BATTLE_WINS, playerId, progress.battle_wins + 1);
    }

    const updated = findBattle(battleId);
    if (!updated) throw conflict('战斗结算失败');
    return { battle: toBattleDto(updated, stage), rewards, win: outcome.win };
  });
}

/** 战斗详情：含逐回合回放数据。 */
export function getBattle(playerId: string, battleId: string): BattleDto {
  const row = findBattle(battleId);
  if (!row) throw notFound('战斗不存在');
  if (row.player_id !== playerId) throw forbidden('无权查看该战斗');
  return toBattleDto(row, findStageById(row.stage_id));
}

export function listBattleHistory(playerId: string, limit = 20): BattleDto[] {
  return listBattles(playerId, limit)
    .filter(row => row.status !== 'pending')
    .map(row => toBattleDto(row, findStageById(row.stage_id)));
}
