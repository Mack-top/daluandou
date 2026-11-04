import { execute, queryAll, queryOne } from '../db/index.js';
import type {
  AstrologyNodeRow,
  CharacterDefRow,
  PlayerCharacterRow,
  PlayerEquipmentRow,
} from '../domain/types.js';

/* ------------------------------ 食灵持有 ------------------------------ */

export type OwnedCharacter = PlayerCharacterRow & Pick<CharacterDefRow, 'name' | 'rarity' | 'base_power' | 'element' | 'role'>;

export function listOwnedCharacters(playerId: string): OwnedCharacter[] {
  return queryAll<OwnedCharacter>(
    `SELECT pc.*, cd.name, cd.rarity, cd.base_power, cd.element, cd.role
       FROM player_characters pc
       JOIN character_defs cd ON cd.id = pc.character_id
      WHERE pc.player_id = ?
      ORDER BY cd.base_power DESC, cd.name`,
    playerId,
  );
}

export function findOwnedCharacter(playerId: string, characterId: string): PlayerCharacterRow | undefined {
  return queryOne<PlayerCharacterRow>(
    'SELECT * FROM player_characters WHERE player_id = ? AND character_id = ?',
    playerId,
    characterId,
  );
}

export function addOwnedCharacter(playerId: string, characterId: string, unlockedAt: string): void {
  execute(
    `INSERT INTO player_characters (player_id, character_id, star, level, unlocked_at)
     VALUES (?, ?, 1, 1, ?)
     ON CONFLICT(player_id, character_id) DO NOTHING`,
    playerId,
    characterId,
    unlockedAt,
  );
}

export function setCharacterStar(playerId: string, characterId: string, star: number): void {
  execute(
    'UPDATE player_characters SET star = ? WHERE player_id = ? AND character_id = ?',
    star,
    playerId,
    characterId,
  );
}

/* ------------------------------ 阵容 ------------------------------ */

export type FormationSlot = { slot: number; character_id: string; name: string };

export function listFormation(playerId: string): FormationSlot[] {
  return queryAll<FormationSlot>(
    `SELECT pf.slot, pf.character_id, cd.name
       FROM player_formation pf
       JOIN character_defs cd ON cd.id = pf.character_id
      WHERE pf.player_id = ?
      ORDER BY pf.slot`,
    playerId,
  );
}

/** 覆盖式写入阵容：先清空再按顺序写入，保证槽位唯一。 */
export function replaceFormation(playerId: string, characterIds: string[]): void {
  execute('DELETE FROM player_formation WHERE player_id = ?', playerId);
  characterIds.slice(0, 3).forEach((characterId, index) => {
    execute(
      'INSERT INTO player_formation (player_id, slot, character_id) VALUES (?, ?, ?)',
      playerId,
      index + 1,
      characterId,
    );
  });
}

/* ------------------------------ 装备 ------------------------------ */

export function listPlayerEquipment(playerId: string): PlayerEquipmentRow[] {
  return queryAll<PlayerEquipmentRow>(
    'SELECT * FROM player_equipment WHERE player_id = ? ORDER BY obtained_at DESC',
    playerId,
  );
}

export function countPlayerEquipment(playerId: string): number {
  const row = queryOne<{ total: number }>(
    'SELECT COUNT(*) AS total FROM player_equipment WHERE player_id = ?',
    playerId,
  );
  return row ? Number(row.total) : 0;
}

export function insertPlayerEquipment(row: {
  id: string;
  playerId: string;
  templateId: string;
  obtainedAt: string;
  level?: number;
}): void {
  execute(
    `INSERT INTO player_equipment (id, player_id, template_id, level, obtained_at)
     VALUES (?, ?, ?, ?, ?)`,
    row.id,
    row.playerId,
    row.templateId,
    row.level ?? 0,
    row.obtainedAt,
  );
}

/** 装备/卸下：先卸下该槽位旧装备，再装备新件。 */
export function equipItem(playerId: string, equipmentId: string, slot: string): void {
  execute('UPDATE player_equipment SET equipped_slot = NULL WHERE player_id = ? AND equipped_slot = ?', playerId, slot);
  execute(
    'UPDATE player_equipment SET equipped_slot = ? WHERE id = ? AND player_id = ?',
    slot,
    equipmentId,
    playerId,
  );
}

/** 卸下某槽位装备：返回受影响行数，0 表示该槽位本来就是空的。 */
export function unequipSlot(playerId: string, slot: string): number {
  const result = execute(
    'UPDATE player_equipment SET equipped_slot = NULL WHERE player_id = ? AND equipped_slot = ?',
    playerId,
    slot,
  );
  return result.changes;
}

/** 查询单件装备（含穿戴状态）。 */
export function findPlayerEquipment(playerId: string, equipmentId: string): PlayerEquipmentRow | undefined {
  return queryOne<PlayerEquipmentRow>(
    'SELECT * FROM player_equipment WHERE id = ? AND player_id = ?',
    equipmentId,
    playerId,
  );
}

/** 强化升级装备等级（上限校验在服务层）。 */
export function updatePlayerEquipmentLevel(playerId: string, equipmentId: string, level: number): void {
  execute('UPDATE player_equipment SET level = ? WHERE id = ? AND player_id = ?', level, equipmentId, playerId);
}

/** v20 §4.3：写入洗练结果（key/value 校验在服务层；wash_count 由服务层传入新值）。 */
export function updatePlayerEquipmentSubstat(
  playerId: string,
  equipmentId: string,
  substatKey: string,
  substatValue: number,
  washCount: number,
): void {
  execute(
    'UPDATE player_equipment SET substat_key = ?, substat_value = ?, wash_count = ? WHERE id = ? AND player_id = ?',
    substatKey,
    substatValue,
    washCount,
    equipmentId,
    playerId,
  );
}

/** 删除玩家拥有的装备（用于背包整理/销毁）。 */
export function deletePlayerEquipment(playerId: string, equipmentId: string): number {
  const result = execute('DELETE FROM player_equipment WHERE id = ? AND player_id = ?', equipmentId, playerId);
  return result.changes;
}

/* ------------------------------ 星象 ------------------------------ */

export function listAstrology(playerId: string): Array<{ node_id: string; unlocked_at: string }> {
  return queryAll<{ node_id: string; unlocked_at: string }>(
    'SELECT node_id, unlocked_at FROM player_astrology WHERE player_id = ? ORDER BY unlocked_at',
    playerId,
  );
}

export function addAstrologyNode(playerId: string, nodeId: string, unlockedAt: string): void {
  execute(
    `INSERT INTO player_astrology (player_id, node_id, unlocked_at) VALUES (?, ?, ?)
     ON CONFLICT(player_id, node_id) DO NOTHING`,
    playerId,
    nodeId,
    unlockedAt,
  );
}

export type AstrologyProgress = { unlocked: string[]; nodes: AstrologyNodeRow[] };
