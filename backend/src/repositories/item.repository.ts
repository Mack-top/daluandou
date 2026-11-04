import { execute, queryAll, queryOne } from '../db/index.js';
import { nowIso } from '../lib/clock.js';
import { newId } from '../lib/ids.js';
import { conflict, unprocessable } from '../lib/errors.js';
import type { ItemDefRow, PlayerItemRow } from '../domain/types.js';

/* ------------------------------ 物品定义（v9） ------------------------------ */

export function listItemDefs(type?: ItemDefRow['type']): ItemDefRow[] {
  if (type) {
    return queryAll<ItemDefRow>('SELECT * FROM item_defs WHERE type = ? ORDER BY rarity, name', type);
  }
  return queryAll<ItemDefRow>('SELECT * FROM item_defs ORDER BY rarity, name');
}

export function findItemDef(id: string): ItemDefRow | undefined {
  return queryOne<ItemDefRow>('SELECT * FROM item_defs WHERE id = ?', id);
}

/** 幂等 upsert（seed 可重复执行）。 */
export function insertItemDef(input: {
  id: string;
  name: string;
  type: ItemDefRow['type'];
  rarity: ItemDefRow['rarity'];
  stackable?: number;
  maxStack?: number;
  effectJson?: string;
  value?: number;
  icon?: string;
  detail?: string;
}): void {
  execute(
    `INSERT INTO item_defs (id, name, type, rarity, stackable, max_stack, effect_json, value, icon, detail, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(id) DO UPDATE SET
       name = excluded.name, type = excluded.type, rarity = excluded.rarity,
       stackable = excluded.stackable, max_stack = excluded.max_stack,
       effect_json = excluded.effect_json, value = excluded.value,
       icon = excluded.icon, detail = excluded.detail, updated_at = excluded.updated_at`,
    input.id,
    input.name,
    input.type,
    input.rarity,
    input.stackable ?? 1,
    input.maxStack ?? 9999,
    input.effectJson ?? '{}',
    input.value ?? 0,
    input.icon ?? '',
    input.detail ?? '',
    nowIso(),
  );
}

/* ------------------------------ 背包 ------------------------------ */

export function listPlayerItems(playerId: string): PlayerItemRow[] {
  return queryAll<PlayerItemRow>(
    'SELECT * FROM player_items WHERE player_id = ? ORDER BY updated_at DESC',
    playerId,
  );
}

/**
 * 发放物品：可堆叠物品走 ON CONFLICT 合并计数（依赖 uq_player_items_stack 部分唯一索引，
 * 设计决策 D-3），封顶 max_stack；不可堆叠物品一行一件。必须在 transaction() 内调用。
 */
export function grantItem(playerId: string, itemId: string, quantity: number): void {
  const def = findItemDef(itemId);
  if (!def) throw unprocessable(`未知物品：${itemId}`);
  if (!Number.isInteger(quantity) || quantity <= 0) {
    throw conflict('物品数量必须为正整数');
  }

  const stamp = nowIso();
  if (def.stackable === 1) {
    if (quantity > def.max_stack) {
      throw conflict(`单次发放超过堆叠上限（${def.max_stack}）`);
    }
    execute(
      `INSERT INTO player_items (id, player_id, item_id, quantity, stackable, obtained_at, updated_at)
       VALUES (?, ?, ?, ?, 1, ?, ?)
       ON CONFLICT(player_id, item_id) WHERE stackable = 1 DO UPDATE SET
         quantity = MIN(player_items.quantity + excluded.quantity, ?),
         updated_at = excluded.updated_at`,
      newId(),
      playerId,
      itemId,
      quantity,
      stamp,
      stamp,
      def.max_stack,
    );
    return;
  }

  for (let index = 0; index < quantity; index += 1) {
    execute(
      `INSERT INTO player_items (id, player_id, item_id, quantity, stackable, obtained_at, updated_at)
       VALUES (?, ?, ?, 1, 0, ?, ?)`,
      newId(),
      playerId,
      itemId,
      stamp,
      stamp,
    );
  }
}

/**
 * 消耗物品：可堆叠扣减计数（清零即删行，CHECK (quantity > 0) 不允许 0 存量）；
 * 不可堆叠按获得时间从旧到新删除实例。必须在 transaction() 内调用。
 */
export function consumeItem(playerId: string, itemId: string, quantity: number): void {
  const def = findItemDef(itemId);
  if (!def) throw unprocessable(`未知物品：${itemId}`);
  if (!Number.isInteger(quantity) || quantity <= 0) {
    throw conflict('物品数量必须为正整数');
  }

  if (def.stackable === 1) {
    const row = queryOne<{ id: string; quantity: number }>(
      'SELECT id, quantity FROM player_items WHERE player_id = ? AND item_id = ? AND stackable = 1',
      playerId,
      itemId,
    );
    if (!row || Number(row.quantity) < quantity) throw unprocessable('物品数量不足');
    if (Number(row.quantity) === quantity) {
      execute('DELETE FROM player_items WHERE id = ?', row.id);
    } else {
      execute('UPDATE player_items SET quantity = quantity - ?, updated_at = ? WHERE id = ?', quantity, nowIso(), row.id);
    }
    return;
  }

  const rows = queryAll<{ id: string }>(
    'SELECT id FROM player_items WHERE player_id = ? AND item_id = ? ORDER BY obtained_at LIMIT ?',
    playerId,
    itemId,
    quantity,
  );
  if (rows.length < quantity) throw unprocessable('物品数量不足');
  for (const row of rows) {
    execute('DELETE FROM player_items WHERE id = ?', row.id);
  }
}

export function countItemQuantity(playerId: string, itemId: string): number {
  const row = queryOne<{ total: number }>(
    'SELECT SUM(quantity) AS total FROM player_items WHERE player_id = ? AND item_id = ?',
    playerId,
    itemId,
  );
  return row ? Number(row.total) : 0;
}
