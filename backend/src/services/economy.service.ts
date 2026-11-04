import { transaction } from '../db/index.js';
import { dayKey, nowIso } from '../lib/clock.js';
import { conflict, notFound } from '../lib/errors.js';
import { CURRENCY_LABEL, type Currency } from '../domain/types.js';
import { WORLD_TREE_MAX, craftCost, craftYield, idleAccrual, worldtreeCost } from '../domain/power.js';
import {
  applyResourceDelta,
  getBalances,
  getProgress,
  requirePlayer,
  setWorldtreeLevel,
  updateProgress,
} from '../repositories/player.repository.js';
import { findLevelExpByLevel, findMarketOfferById, findShopPackById, findTradeRateById, marketStockFor } from '../repositories/catalog.repository.js';
import {
  countPackPurchasesOn,
  getTradeUsed,
  incrementTradeUsage,
  insertMarketPurchase,
  insertShopPurchase,
  listMarketPurchases,
} from '../repositories/economy.repository.js';
import { listAstrology } from '../repositories/roster.repository.js';

const MARKET_DISCOUNT_LEVEL = 3;

/* ------------------------------ 交易坊 ------------------------------ */

/** 资源兑换：校验日限次与余额，扣减与补入在同一事务内完成。 */
export function exchange(playerId: string, rateId: string): void {
  transaction(() => {
    const rate = findTradeRateById(rateId);
    if (!rate) throw notFound('兑换档位不存在');

    const today = dayKey();
    const used = getTradeUsed(playerId, today, rateId);
    if (used >= rate.daily_limit) {
      throw conflict(`今日兑换次数已达上限（${rate.daily_limit} 次）`);
    }

    applyResourceDelta(
      playerId,
      { [rate.give_currency]: -rate.give_amount } as Partial<Record<Currency, number>>,
      'trade.exchange',
      rate.id,
    );
    applyResourceDelta(
      playerId,
      { [rate.get_currency]: rate.get_amount } as Partial<Record<Currency, number>>,
      'trade.exchange',
      rate.id,
    );
    incrementTradeUsage(playerId, today, rateId);
  });
}

/* ------------------------------ 研制坊 ------------------------------ */

/** 炼制灵味原浆：累计炼制次数影响产出效率。 */
export function craft(playerId: string, times: number): void {
  if (times !== 1 && times !== 5) throw conflict('炼制次数只能是 1 或 5');

  transaction(() => {
    const progress = getProgress(playerId);
    const cost = craftCost(times);
    const produced = craftYield(times, progress.crafted);

    applyResourceDelta(
      playerId,
      { coin: -cost.coins, leaf: -cost.leaves, potion: produced },
      'workshop.craft',
      null,
    );
    updateProgress(playerId, { crafted: progress.crafted + times });
  });
}

/* ------------------------------ 集市 ------------------------------ */

/** 购买每日轮换货架上的商品；同一自然日同一商品限购一次。 */
export function buyMarketOffer(playerId: string, offerId: string): void {
  transaction(() => {
    const today = dayKey();
    const stock = marketStockFor(today);
    if (!stock.some(offer => offer.id === offerId)) {
      throw notFound('该商品今日未上架');
    }
    const offer = findMarketOfferById(offerId);
    if (!offer) throw notFound('商品不存在');

    if (listMarketPurchases(playerId, today).includes(offerId)) {
      throw conflict('今日已购买过该商品');
    }

    const player = requirePlayer(playerId);
    const price = Math.round(offer.price * (player.worldtree_level >= MARKET_DISCOUNT_LEVEL ? 0.9 : 1));

    applyResourceDelta(playerId, { coin: -price }, 'market.buy', offer.id);
    applyResourceDelta(
      playerId,
      { [offer.currency]: offer.amount } as Partial<Record<Currency, number>>,
      'market.buy',
      offer.id,
    );
    insertMarketPurchase({ playerId, dayKey: today, offerId, price });
  });
}

/* ------------------------------ 世界树 ------------------------------ */

/**
 * 世界树升级（v17 数值核心 v2，设计 §2.3 升级接线）：
 * 消耗 = exp_required(当前等级)（经验表权威数据）+ 金币小额（worldtreeCost × 0.2）+ 食灵精华。
 * 经验余额记 player_progress.exp（服务端权威），金币/精华走资源流水。
 * 经验表驱动等级成长，level_exp_defs 孤儿表断点自此修复。
 */
export function upgradeWorldtree(playerId: string): void {
  transaction(() => {
    const player = requirePlayer(playerId);
    if (player.worldtree_level >= WORLD_TREE_MAX) throw conflict('世界树已达最高等级');

    const levelExp = findLevelExpByLevel(player.worldtree_level);
    if (!levelExp) throw notFound('经验表缺少该等级数据');
    if (levelExp.exp_required <= 0) throw conflict('世界树已达最高等级');

    const progress = getProgress(playerId);
    if (progress.exp < levelExp.exp_required) {
      throw conflict(
        `掌灶人经验不足：还需 ${levelExp.exp_required - progress.exp} 点经验（当前 ${progress.exp}/${levelExp.exp_required}）`,
      );
    }

    const cost = worldtreeCost(player.worldtree_level);
    applyResourceDelta(
      playerId,
      { coin: -Math.round(cost.coins * 0.2), leaf: -cost.leaves },
      'worldtree.upgrade',
      null,
    );
    updateProgress(playerId, { exp: progress.exp - levelExp.exp_required });
    setWorldtreeLevel(playerId, player.worldtree_level + 1);
  });
}

/* ------------------------------ 离线收益 ------------------------------ */

/** 领取离线收益（v17：经验与金币同源同闸门，设计 §2.2 挂机经验）。 */
export function claimIdleRewards(playerId: string): { coins: number; potions: number; exp: number; hours: number } {
  return transaction(() => {
    const player = requirePlayer(playerId);
    const progress = getProgress(playerId);
    const astrologyCount = listAstrology(playerId).length;

    const accrual = idleAccrual({
      worldtreeLevel: player.worldtree_level,
      astrologyCount,
      sinceIso: progress.idle_claim_at ?? player.created_at,
    });

    if (accrual.coins < 1 && accrual.exp < 1) throw conflict('暂无可领取的离线收益');

    applyResourceDelta(playerId, { coin: accrual.coins, potion: accrual.potions }, 'idle.claim', null);
    updateProgress(playerId, {
      idle_claim_at: nowIso(),
      exp: progress.exp + accrual.exp,
    });

    return {
      coins: accrual.coins,
      potions: accrual.potions,
      exp: accrual.exp,
      hours: Number(accrual.hours.toFixed(2)),
    };
  });
}

/* ------------------------------ 商店 ------------------------------ */

/**
 * 购买礼包（演示实现：不含真实支付渠道，仅完成发放与记账）。
 * 接入真实支付时，应改为「下单 → 支付回调 → 发放」并校验签名。
 */
export function purchasePack(playerId: string, packId: string): { purchaseId: string; firstPurchase: boolean } {
  return transaction(() => {
    const pack = findShopPackById(packId);
    if (!pack) throw notFound('礼包不存在');

    const today = dayKey();
    if (pack.daily_limit > 0 && countPackPurchasesOn(playerId, packId, today) >= pack.daily_limit) {
      throw conflict('该礼包今日购买次数已达上限');
    }

    const progress = getProgress(playerId);
    const firstPurchase = !progress.first_purchased_at;

    const deltas: Partial<Record<Currency, number>> = {};
    if (pack.gems) deltas.gem = pack.gems;
    if (pack.books) deltas.book = pack.books;
    applyResourceDelta(playerId, deltas, 'shop.purchase', pack.id);

    const purchaseId = insertShopPurchase({ playerId, packId, price: pack.price });
    updateProgress(playerId, {
      packs_opened: progress.packs_opened + 1,
      first_purchased_at: progress.first_purchased_at ?? nowIso(),
    });

    return { purchaseId, firstPurchase };
  });
}

/* ------------------------------ 汇总（供接口返回） ------------------------------ */

export function describePrices(playerId: string): { balances: ReturnType<typeof getBalances>; labels: typeof CURRENCY_LABEL } {
  return { balances: getBalances(playerId), labels: CURRENCY_LABEL };
}
