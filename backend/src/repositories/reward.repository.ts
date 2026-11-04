import { execute, queryAll, queryOne } from '../db/index.js';
import { nowIso } from '../lib/clock.js';

/* ------------------------------ 任务领取 ------------------------------ */

export function listQuestClaims(playerId: string): Array<{ quest_id: string; day_key: string | null; claimed_at: string }> {
  return queryAll<{ quest_id: string; day_key: string | null; claimed_at: string }>(
    'SELECT quest_id, day_key, claimed_at FROM player_quest_claims WHERE player_id = ? ORDER BY claimed_at DESC',
    playerId,
  );
}

export function findQuestClaim(playerId: string, questId: string): { day_key: string | null; claimed_at: string } | undefined {
  return queryOne<{ day_key: string | null; claimed_at: string }>(
    'SELECT day_key, claimed_at FROM player_quest_claims WHERE player_id = ? AND quest_id = ?',
    playerId,
    questId,
  );
}

export function insertQuestClaim(playerId: string, questId: string, dayKey: string | null): void {
  execute(
    `INSERT INTO player_quest_claims (player_id, quest_id, day_key, claimed_at) VALUES (?, ?, ?, ?)
     ON CONFLICT(player_id, quest_id) DO UPDATE SET claimed_at = excluded.claimed_at, day_key = excluded.day_key`,
    playerId,
    questId,
    dayKey,
    nowIso(),
  );
}

/* ------------------------------ 邮件状态 ------------------------------ */

export type MailStateRow = { mail_id: string; read_at: string | null; claimed_at: string | null };

export function listMailStates(playerId: string): MailStateRow[] {
  return queryAll<MailStateRow>(
    'SELECT mail_id, read_at, claimed_at FROM player_mail WHERE player_id = ?',
    playerId,
  );
}

export function markMailRead(playerId: string, mailId: string): void {
  execute(
    `INSERT INTO player_mail (player_id, mail_id, read_at) VALUES (?, ?, ?)
     ON CONFLICT(player_id, mail_id) DO UPDATE SET read_at = COALESCE(player_mail.read_at, excluded.read_at)`,
    playerId,
    mailId,
    nowIso(),
  );
}

export function markMailClaimed(playerId: string, mailId: string): void {
  const stamp = nowIso();
  execute(
    `INSERT INTO player_mail (player_id, mail_id, read_at, claimed_at) VALUES (?, ?, ?, ?)
     ON CONFLICT(player_id, mail_id) DO UPDATE SET claimed_at = excluded.claimed_at, read_at = COALESCE(player_mail.read_at, excluded.read_at)`,
    playerId,
    mailId,
    stamp,
    stamp,
  );
}
