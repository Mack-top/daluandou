import { execute, queryAll, queryOne } from '../db/index.js';
import { nowIso } from '../lib/clock.js';
import type { VfxDefRow } from '../domain/types.js';

/* ------------------------------ 特效定义（v7） ------------------------------ */

export function listVfxDefs(type?: VfxDefRow['type']): VfxDefRow[] {
  if (type) {
    return queryAll<VfxDefRow>('SELECT * FROM vfx_defs WHERE type = ? ORDER BY sort_index', type);
  }
  return queryAll<VfxDefRow>('SELECT * FROM vfx_defs ORDER BY sort_index');
}

export function findVfxDefById(id: string): VfxDefRow | undefined {
  return queryOne<VfxDefRow>('SELECT * FROM vfx_defs WHERE id = ?', id);
}

/** 幂等 upsert（seed 可重复执行）；同 seed.ts 通用 upsert 模式，禁止 INSERT OR REPLACE。 */
export function insertVfxDef(input: {
  id: string;
  name: string;
  type: VfxDefRow['type'];
  assetPath: string;
  durationMs?: number;
  sortIndex?: number;
}): void {
  execute(
    `INSERT INTO vfx_defs (id, name, type, asset_path, duration_ms, sort_index, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(id) DO UPDATE SET
       name = excluded.name, type = excluded.type, asset_path = excluded.asset_path,
       duration_ms = excluded.duration_ms, sort_index = excluded.sort_index, updated_at = excluded.updated_at`,
    input.id,
    input.name,
    input.type,
    input.assetPath,
    input.durationMs ?? 0,
    input.sortIndex ?? 0,
    nowIso(),
  );
}
