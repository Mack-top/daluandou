import { execute, queryAll, queryOne } from '../db/index.js';
import { nowIso } from '../lib/clock.js';
import type { SkillDefRow } from '../domain/types.js';

/* ------------------------------ 技能定义（v7） ------------------------------ */

export function listSkillDefs(): SkillDefRow[] {
  return queryAll<SkillDefRow>('SELECT * FROM skill_defs ORDER BY name');
}

export function findSkillDef(id: string): SkillDefRow | undefined {
  return queryOne<SkillDefRow>('SELECT * FROM skill_defs WHERE id = ?', id);
}

/** 幂等 upsert（seed 可重复执行）。 */
export function insertSkillDef(input: {
  id: string;
  name: string;
  kind: SkillDefRow['kind'];
  targetType: SkillDefRow['target_type'];
  coefficientBp: number;
  cooldown?: number;
  vfxId?: string | null;
  detail?: string;
}): void {
  execute(
    `INSERT INTO skill_defs (id, name, kind, target_type, coefficient_bp, cooldown, vfx_id, detail, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(id) DO UPDATE SET
       name = excluded.name, kind = excluded.kind, target_type = excluded.target_type,
       coefficient_bp = excluded.coefficient_bp, cooldown = excluded.cooldown,
       vfx_id = excluded.vfx_id, detail = excluded.detail, updated_at = excluded.updated_at`,
    input.id,
    input.name,
    input.kind,
    input.targetType,
    input.coefficientBp,
    input.cooldown ?? 0,
    input.vfxId ?? null,
    input.detail ?? '',
    nowIso(),
  );
}
