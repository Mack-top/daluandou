import { execute, queryAll, queryOne } from '../db/index.js';
import { nowIso } from '../lib/clock.js';
import type { SceneDefRow } from '../domain/types.js';

/* ------------------------------ 场景定义（v8） ------------------------------ */

export function listSceneDefs(type?: SceneDefRow['type']): SceneDefRow[] {
  if (type) {
    return queryAll<SceneDefRow>('SELECT * FROM scene_defs WHERE type = ? ORDER BY order_index', type);
  }
  return queryAll<SceneDefRow>('SELECT * FROM scene_defs ORDER BY order_index');
}

export function findSceneDef(id: string): SceneDefRow | undefined {
  return queryOne<SceneDefRow>('SELECT * FROM scene_defs WHERE id = ?', id);
}

/** 关卡 → 场景：未配置或场景缺失时回退到默认战斗场景（约定 id：scene-battle-main）。 */
export function resolveStageScene(sceneId: string | null): SceneDefRow | undefined {
  return (sceneId ? findSceneDef(sceneId) : undefined) ?? findSceneDef('scene-battle-main');
}

/** 幂等 upsert（seed 可重复执行）。 */
export function insertSceneDef(input: {
  id: string;
  name: string;
  type: SceneDefRow['type'];
  background?: string;
  music?: string;
  unlockWorldtreeLevel?: number;
  orderIndex?: number;
}): void {
  execute(
    `INSERT INTO scene_defs (id, name, type, background, music, unlock_worldtree_level, order_index, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(id) DO UPDATE SET
       name = excluded.name, type = excluded.type, background = excluded.background,
       music = excluded.music, unlock_worldtree_level = excluded.unlock_worldtree_level,
       order_index = excluded.order_index, updated_at = excluded.updated_at`,
    input.id,
    input.name,
    input.type,
    input.background ?? '',
    input.music ?? '',
    input.unlockWorldtreeLevel ?? 1,
    input.orderIndex ?? 0,
    nowIso(),
  );
}
