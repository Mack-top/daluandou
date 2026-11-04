import { execute, queryAll, queryOne } from '../db/index.js';
import { nowIso } from '../lib/clock.js';
import { newId } from '../lib/ids.js';
import type { PlayerSystemMailRow } from '../domain/types.js';

/* ------------------------------ 个性化系统邮件（v11） ------------------------------ */

export function insertSystemMail(input: {
  playerId: string;
  templateId?: string | null;
  title: string;
  body?: string;
  attachments?: Array<{ kind: string; amount: number; itemId?: string; label?: string }>;
  source?: PlayerSystemMailRow['source'];
  createdBy?: string | null;
  expireAt?: string | null;
}): string {
  const id = newId();
  execute(
    `INSERT INTO player_system_mails (id, player_id, template_id, title, body, attachments_json,
                                      source, created_by, expire_at, read_at, claimed_at, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, NULL, NULL, ?)`,
    id,
    input.playerId,
    input.templateId ?? null,
    input.title,
    input.body ?? '',
    JSON.stringify(input.attachments ?? []),
    input.source ?? 'system',
    input.createdBy ?? null,
    input.expireAt ?? null,
    nowIso(),
  );
  return id;
}

export function findSystemMail(playerId: string, mailId: string): PlayerSystemMailRow | undefined {
  return queryOne<PlayerSystemMailRow>(
    'SELECT * FROM player_system_mails WHERE id = ? AND player_id = ?',
    mailId,
    playerId,
  );
}

export function listSystemMails(playerId: string, limit = 50): PlayerSystemMailRow[] {
  return queryAll<PlayerSystemMailRow>(
    'SELECT * FROM player_system_mails WHERE player_id = ? ORDER BY created_at DESC LIMIT ?',
    playerId,
    limit,
  );
}

export function markSystemMailRead(mailId: string): void {
  execute(
    'UPDATE player_system_mails SET read_at = COALESCE(read_at, ?) WHERE id = ?',
    nowIso(),
    mailId,
  );
}

export function markSystemMailClaimed(mailId: string): void {
  execute(
    'UPDATE player_system_mails SET claimed_at = ?, read_at = COALESCE(read_at, ?) WHERE id = ?',
    nowIso(),
    nowIso(),
    mailId,
  );
}
