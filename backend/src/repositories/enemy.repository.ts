import { execute, queryAll, queryOne } from '../db/index.js';
import { nowIso } from '../lib/clock.js';
import { unprocessable } from '../lib/errors.js';
import type { EnemyDefRow } from '../domain/types.js';

/* ------------------------------ 怪物 / Boss 定义（v7） ------------------------------ */

export function listEnemyDefs(kind?: EnemyDefRow['kind']): EnemyDefRow[] {
  if (kind) {
    return queryAll<EnemyDefRow>('SELECT * FROM enemy_defs WHERE kind = ? ORDER BY power', kind);
  }
  return queryAll<EnemyDefRow>('SELECT * FROM enemy_defs ORDER BY kind, power');
}

export function findEnemyDef(id: string): EnemyDefRow | undefined {
  return queryOne<EnemyDefRow>('SELECT * FROM enemy_defs WHERE id = ?', id);
}

/**
 * 校验怪物引用的技能清单：逻辑外键（设计决策 D-2 同一原则）。
 * 任一技能 id 不存在即抛 422，供 seed 自检与战斗组装前拦截。
 */
export function validateSkillIds(skillIds: string[]): void {
  for (const skillId of new Set(skillIds)) {
    if (!queryOne<{ id: string }>('SELECT id FROM skill_defs WHERE id = ?', skillId)) {
      throw unprocessable(`技能定义不存在：${skillId}`);
    }
  }
}

/** 幂等 upsert（seed 可重复执行）。 */
export function insertEnemyDef(input: {
  id: string;
  name: string;
  kind: EnemyDefRow['kind'];
  element: string;
  power: number;
  health: number;
  attack: number;
  defense?: number;
  speed?: number;
  skillIds?: string[];
  vfxId?: string | null;
  dropJson?: string;
  phaseJson?: string | null;
  portrait?: string;
}): void {
  execute(
    `INSERT INTO enemy_defs (id, name, kind, element, power, health, attack, defense, speed,
                             skill_ids, vfx_id, drop_json, phase_json, portrait, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(id) DO UPDATE SET
       name = excluded.name, kind = excluded.kind, element = excluded.element,
       power = excluded.power, health = excluded.health, attack = excluded.attack,
       defense = excluded.defense, speed = excluded.speed, skill_ids = excluded.skill_ids,
       vfx_id = excluded.vfx_id, drop_json = excluded.drop_json, phase_json = excluded.phase_json,
       portrait = excluded.portrait, updated_at = excluded.updated_at`,
    input.id,
    input.name,
    input.kind,
    input.element,
    input.power,
    input.health,
    input.attack,
    input.defense ?? 0,
    input.speed ?? 0,
    JSON.stringify(input.skillIds ?? []),
    input.vfxId ?? null,
    input.dropJson ?? '[]',
    input.phaseJson ?? null,
    input.portrait ?? '',
    nowIso(),
  );
}
