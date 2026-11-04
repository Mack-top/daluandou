import { execute, queryAll, queryOne } from '../db/index.js';
import type { BattleRow, BattleTurnRow } from '../domain/types.js';

export function insertBattle(row: {
  id: string;
  playerId: string;
  stageId: string;
  seed: number;
  power: number;
  enemyPower: number;
  unitsJson: string;
  startedAt: string;
}): void {
  execute(
    `INSERT INTO battles (id, player_id, stage_id, seed, status, rounds, power, enemy_power, first_clear, units_json, started_at)
     VALUES (?, ?, ?, ?, 'pending', 0, ?, ?, 0, ?, ?)`,
    row.id,
    row.playerId,
    row.stageId,
    row.seed,
    row.power,
    row.enemyPower,
    row.unitsJson,
    row.startedAt,
  );
}

export function findBattle(battleId: string): BattleRow | undefined {
  return queryOne<BattleRow>('SELECT * FROM battles WHERE id = ?', battleId);
}

export function findPendingBattle(playerId: string): BattleRow | undefined {
  return queryOne<BattleRow>(
    "SELECT * FROM battles WHERE player_id = ? AND status = 'pending' ORDER BY started_at DESC LIMIT 1",
    playerId,
  );
}

export function settleBattleRow(input: {
  battleId: string;
  status: 'claimed' | 'lost';
  win: boolean;
  rounds: number;
  firstClear: boolean;
  unitsJson: string;
  settledAt: string;
}): void {
  execute(
    `UPDATE battles
        SET status = ?, win = ?, rounds = ?, first_clear = ?, units_json = ?, settled_at = ?
      WHERE id = ? AND status = 'pending'`,
    input.status,
    input.win ? 1 : 0,
    input.rounds,
    input.firstClear ? 1 : 0,
    input.unitsJson,
    input.settledAt,
    input.battleId,
  );
}

export function insertBattleTurns(battleId: string, turns: BattleTurnRow[]): void {
  for (const turn of turns) {
    execute(
      `INSERT INTO battle_turns (battle_id, round, seq, actor_id, target_id, kind, skill, amount, critical, health_json)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      battleId,
      turn.round,
      turn.seq,
      turn.actor_id,
      turn.target_id,
      turn.kind,
      turn.skill,
      turn.amount,
      turn.critical,
      turn.health_json,
    );
  }
}

export function listBattleTurns(battleId: string): BattleTurnRow[] {
  return queryAll<BattleTurnRow>(
    'SELECT * FROM battle_turns WHERE battle_id = ? ORDER BY round, seq',
    battleId,
  );
}

export function listBattles(playerId: string, limit = 20): BattleRow[] {
  return queryAll<BattleRow>(
    'SELECT * FROM battles WHERE player_id = ? ORDER BY started_at DESC LIMIT ?',
    playerId,
    limit,
  );
}

export function listFirstClears(playerId: string): string[] {
  return queryAll<{ stage_id: string }>(
    'SELECT DISTINCT stage_id FROM battles WHERE player_id = ? AND first_clear = 1',
    playerId,
  ).map(row => row.stage_id);
}

export function hasFirstClear(playerId: string, stageId: string): boolean {
  const row = queryOne<{ id: string }>(
    'SELECT id FROM battles WHERE player_id = ? AND stage_id = ? AND first_clear = 1 LIMIT 1',
    playerId,
    stageId,
  );
  return Boolean(row);
}

/* ------------------------------ 每日挑战次数（v5） ------------------------------ */

export type BattleChargeRow = { player_id: string; day_key: string; used: number; purchased: number };

/** 幂等取当日计数行（跨日首次开战时自动建行——重置即「零操作」）。 */
export function ensureBattleCharge(playerId: string, dayKey: string): BattleChargeRow {
  queryOne(
    `INSERT INTO battle_passes (player_id, day_key, used, purchased) VALUES (?, ?, 0, 0)
     ON CONFLICT (player_id, day_key) DO NOTHING`,
    playerId,
    dayKey,
  );
  return queryOne<BattleChargeRow>(
    'SELECT player_id, day_key, used, purchased FROM battle_passes WHERE player_id = ? AND day_key = ?',
    playerId,
    dayKey,
  )!;
}

export function incrementBattleCharge(playerId: string, dayKey: string, field: 'used' | 'purchased'): BattleChargeRow {
  const column = field === 'used' ? 'used' : 'purchased';
  execute(
    `UPDATE battle_passes SET ${column} = ${column} + 1 WHERE player_id = ? AND day_key = ?`,
    playerId,
    dayKey,
  );
  return ensureBattleCharge(playerId, dayKey);
}
