import { execute, queryAll, queryOne } from '../db/index.js';
import { nowIso } from '../lib/clock.js';
import { newId } from '../lib/ids.js';

/* ------------------------------ 交易坊每日次数 ------------------------------ */

export function listTradeUsage(playerId: string, dayKey: string): Record<string, number> {
  const rows = queryAll<{ rate_id: string; used: number }>(
    'SELECT rate_id, used FROM player_trade_usage WHERE player_id = ? AND day_key = ?',
    playerId,
    dayKey,
  );
  return Object.fromEntries(rows.map(row => [row.rate_id, Number(row.used)]));
}

export function getTradeUsed(playerId: string, dayKey: string, rateId: string): number {
  const row = queryOne<{ used: number }>(
    'SELECT used FROM player_trade_usage WHERE player_id = ? AND day_key = ? AND rate_id = ?',
    playerId,
    dayKey,
    rateId,
  );
  return row ? Number(row.used) : 0;
}

export function incrementTradeUsage(playerId: string, dayKey: string, rateId: string): number {
  execute(
    `INSERT INTO player_trade_usage (player_id, day_key, rate_id, used) VALUES (?, ?, ?, 1)
     ON CONFLICT(player_id, day_key, rate_id) DO UPDATE SET used = used + 1`,
    playerId,
    dayKey,
    rateId,
  );
  return getTradeUsed(playerId, dayKey, rateId);
}

/* ------------------------------ 集市购买 ------------------------------ */

export function listMarketPurchases(playerId: string, dayKey: string): string[] {
  return queryAll<{ offer_id: string }>(
    'SELECT offer_id FROM player_market_purchases WHERE player_id = ? AND day_key = ?',
    playerId,
    dayKey,
  ).map(row => row.offer_id);
}

export function insertMarketPurchase(input: {
  playerId: string;
  dayKey: string;
  offerId: string;
  price: number;
}): void {
  execute(
    `INSERT INTO player_market_purchases (player_id, day_key, offer_id, price, purchased_at)
     VALUES (?, ?, ?, ?, ?)`,
    input.playerId,
    input.dayKey,
    input.offerId,
    input.price,
    nowIso(),
  );
}

/* ------------------------------ 商店购买 ------------------------------ */

export function listShopPurchases(playerId: string): string[] {
  return queryAll<{ pack_id: string }>(
    'SELECT pack_id FROM player_purchases WHERE player_id = ? ORDER BY purchased_at DESC',
    playerId,
  ).map(row => row.pack_id);
}

export function countPackPurchasesOn(playerId: string, packId: string, dayKey: string): number {
  const row = queryOne<{ total: number }>(
    'SELECT COUNT(*) AS total FROM player_purchases WHERE player_id = ? AND pack_id = ? AND substr(purchased_at, 1, 10) = ?',
    playerId,
    packId,
    dayKey,
  );
  return row ? Number(row.total) : 0;
}

export function insertShopPurchase(input: {
  playerId: string;
  packId: string;
  price: number;
}): string {
  const id = newId();
  execute(
    `INSERT INTO player_purchases (id, player_id, pack_id, price, purchased_at) VALUES (?, ?, ?, ?, ?)`,
    id,
    input.playerId,
    input.packId,
    input.price,
    nowIso(),
  );
  return id;
}
