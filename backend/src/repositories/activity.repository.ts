import { execute, queryAll, queryOne } from '../db/index.js';
import { nowIso } from '../lib/clock.js';
import type { ActivityDefRow, PlayerActivityProgressRow } from '../domain/types.js';

/* ------------------------------ 活动定义与进度（v10） ------------------------------ */

/** 当前进行中的活动（含时间窗判断），按 sort_index 排序。 */
export function listActiveActivities(nowIsoValue: string): ActivityDefRow[] {
  return queryAll<ActivityDefRow>(
    'SELECT * FROM activity_defs WHERE start_at <= ? AND end_at > ? ORDER BY sort_index',
    nowIsoValue,
    nowIsoValue,
  );
}

export function listAllActivities(): ActivityDefRow[] {
  return queryAll<ActivityDefRow>('SELECT * FROM activity_defs ORDER BY sort_index');
}

export function findActivityDef(id: string): ActivityDefRow | undefined {
  return queryOne<ActivityDefRow>('SELECT * FROM activity_defs WHERE id = ?', id);
}

export function getActivityProgress(playerId: string, activityId: string): PlayerActivityProgressRow | undefined {
  return queryOne<PlayerActivityProgressRow>(
    'SELECT * FROM player_activity_progress WHERE player_id = ? AND activity_id = ?',
    playerId,
    activityId,
  );
}

export function listActivityProgress(playerId: string): PlayerActivityProgressRow[] {
  return queryAll<PlayerActivityProgressRow>(
    'SELECT * FROM player_activity_progress WHERE player_id = ?',
    playerId,
  );
}

/** 推进活动进度（事件来源调用，必须在 transaction() 内）。负增量钳制为 0。 */
export function advanceActivityProgress(playerId: string, activityId: string, delta: number): PlayerActivityProgressRow {
  const stamp = nowIso();
  execute(
    `INSERT INTO player_activity_progress (player_id, activity_id, progress, claimed_json, updated_at)
     VALUES (?, ?, MAX(0, ?), '[]', ?)
     ON CONFLICT(player_id, activity_id) DO UPDATE SET
       progress = MAX(0, player_activity_progress.progress + ?),
       updated_at = excluded.updated_at`,
    playerId,
    activityId,
    delta,
    stamp,
    delta,
  );
  const row = getActivityProgress(playerId, activityId);
  if (!row) throw new Error(`活动进度写入后读回失败：${activityId}`);
  return row;
}

/** 覆写活动进度（供修正/重置类运维操作）。 */
export function setActivityProgress(playerId: string, activityId: string, progress: number): void {
  execute(
    `INSERT INTO player_activity_progress (player_id, activity_id, progress, claimed_json, updated_at)
     VALUES (?, ?, ?, '[]', ?)
     ON CONFLICT(player_id, activity_id) DO UPDATE SET progress = excluded.progress, updated_at = excluded.updated_at`,
    playerId,
    activityId,
    progress,
    nowIso(),
  );
}

/** 记录已领取档位（覆盖式写入 claimed_json）。 */
export function saveClaimedTiers(playerId: string, activityId: string, claimedJson: string): void {
  execute(
    'UPDATE player_activity_progress SET claimed_json = ?, updated_at = ? WHERE player_id = ? AND activity_id = ?',
    claimedJson,
    nowIso(),
    playerId,
    activityId,
  );
}

/** 幂等 upsert（seed 可重复执行）。 */
export function insertActivityDef(input: {
  id: string;
  name: string;
  type: ActivityDefRow['type'];
  startAt: string;
  endAt: string;
  configJson?: string;
  rewardJson?: string;
  sortIndex?: number;
}): void {
  execute(
    `INSERT INTO activity_defs (id, name, type, start_at, end_at, config_json, reward_json, sort_index, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(id) DO UPDATE SET
       name = excluded.name, type = excluded.type, start_at = excluded.start_at, end_at = excluded.end_at,
       config_json = excluded.config_json, reward_json = excluded.reward_json,
       sort_index = excluded.sort_index, updated_at = excluded.updated_at`,
    input.id,
    input.name,
    input.type,
    input.startAt,
    input.endAt,
    input.configJson ?? '{}',
    input.rewardJson ?? '[]',
    input.sortIndex ?? 0,
    nowIso(),
  );
}
