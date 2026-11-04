import { execute, queryOne } from '../db/index.js';

export type SaveDocumentRow = {
  player_id: string;
  document: string;
  version: number;
  updated_at: string;
};

export function findSaveDocument(playerId: string): SaveDocumentRow | undefined {
  return queryOne<SaveDocumentRow>(
    'SELECT * FROM player_save_documents WHERE player_id = ?',
    playerId,
  );
}

/** 首次上传：版本从 1 开始。 */
export function insertSaveDocument(playerId: string, document: string, updatedAt: string): void {
  execute(
    'INSERT INTO player_save_documents (player_id, document, version, updated_at) VALUES (?, ?, 1, ?)',
    playerId,
    document,
    updatedAt,
  );
}

/**
 * 乐观锁更新：只有 version 匹配才生效。
 * 返回受影响行数，0 表示版本已被其他端推进（冲突）。
 */
export function updateSaveDocument(
  playerId: string,
  document: string,
  expectedVersion: number,
  updatedAt: string,
): number {
  const result = execute(
    `UPDATE player_save_documents
        SET document = ?, version = version + 1, updated_at = ?
      WHERE player_id = ? AND version = ?`,
    document,
    updatedAt,
    playerId,
    expectedVersion,
  );
  return result.changes;
}
