import { execute, queryOne } from '../db/index.js';
import { nowIso } from '../lib/clock.js';

export type CredentialRow = { player_id: string; password_hash: string; created_at: string; updated_at: string };

export function insertCredential(playerId: string, passwordHash: string): void {
  const at = nowIso();
  execute(
    `INSERT INTO account_credentials (player_id, password_hash, created_at, updated_at) VALUES (?, ?, ?, ?)
     ON CONFLICT (player_id) DO UPDATE SET password_hash = excluded.password_hash, updated_at = excluded.updated_at`,
    playerId,
    passwordHash,
    at,
    at,
  );
}

export function findCredential(playerId: string): CredentialRow | undefined {
  return queryOne<CredentialRow>('SELECT player_id, password_hash, created_at, updated_at FROM account_credentials WHERE player_id = ?', playerId);
}
