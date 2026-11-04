import { transaction } from '../db/index.js';
import { conflict, notFound, unprocessable } from '../lib/errors.js';
import { CURRENCIES, parseJsonObject, type Currency, type ItemDefRow, type Reward } from '../domain/types.js';
import { grantRewards } from '../repositories/player.repository.js';
import { consumeItem, findItemDef, grantItem, listItemDefs, listPlayerItems } from '../repositories/item.repository.js';
import { insertOpLog } from '../repositories/log.repository.js';

/* ------------------------------ 统一发放入口（货币 + 物品） ------------------------------ */

/**
 * 奖励清单统一入账：货币走 grantRewards → applyResourceDelta（强约束：不得绕开），
 * 物品走 grantItem（堆叠合并/独立实例）。新系统（活动、系统邮件、结算奖励）必须经此入口。
 * 调用方负责事务包裹；reason/refId 直通流水，保证可对账。
 */
export function applyRewards(
  playerId: string,
  rewards: Array<Pick<Reward, 'kind' | 'amount' | 'itemId'> & { label?: string }>,
  reason: string,
  refId: string | null = null,
): { itemsGranted: string[] } {
  const currencyRewards = rewards
    .filter(reward => CURRENCIES.includes(reward.kind as Currency))
    .map(reward => ({ kind: reward.kind, amount: reward.amount, label: reward.label ?? reward.kind }));
  if (currencyRewards.length) {
    grantRewards(playerId, currencyRewards, reason, refId);
  }
  const itemsGranted: string[] = [];
  for (const reward of rewards) {
    if (reward.kind === 'item') {
      if (!reward.itemId) throw conflict('物品奖励缺少 itemId');
      grantItem(playerId, reward.itemId, reward.amount);
      itemsGranted.push(reward.itemId);
    }
  }
  return { itemsGranted };
}

/* ------------------------------ 背包查询 ------------------------------ */

export type PlayerItemView = {
  itemId: string;
  name: string;
  type: ItemDefRow['type'];
  rarity: ItemDefRow['rarity'];
  quantity: number;
  icon: string;
  detail: string;
};

export function listBackpack(playerId: string): PlayerItemView[] {
  const defs = new Map(listItemDefs().map(def => [def.id, def]));
  return listPlayerItems(playerId).flatMap(row => {
    const def = defs.get(row.item_id);
    if (!def) return [];
    return [{
      itemId: def.id,
      name: def.name,
      type: def.type,
      rarity: def.rarity,
      quantity: Number(row.quantity),
      icon: def.icon,
      detail: def.detail,
    }];
  });
}

/* ------------------------------ 使用消耗品 ------------------------------ */

type ResourceEffect = { kind: 'resource'; currency: Currency; amount: number };

/**
 * 使用消耗品：效果白名单校验（只支持 resource 投放），消耗与入账同事务。
 * 非消耗品（material/chest/fragment/gift）不可直接「使用」。
 */
export function useItem(playerId: string, itemId: string, ip = ''): { granted: Reward[] } {
  return transaction(() => {
    const def = findItemDef(itemId);
    if (!def) throw notFound('物品不存在');
    if (def.type !== 'consumable') throw unprocessable('该物品不可直接使用');

    const effect = parseJsonObject<ResourceEffect>(def.effect_json);
    if (!effect || effect.kind !== 'resource') {
      throw unprocessable('该物品没有可执行的使用效果');
    }
    if (!CURRENCIES.includes(effect.currency)) {
      throw unprocessable(`未知货币类型：${effect.currency}`);
    }
    if (!Number.isInteger(effect.amount) || effect.amount <= 0) {
      throw unprocessable('使用效果数值非法');
    }

    consumeItem(playerId, itemId, 1);
    grantRewards(playerId, [{ kind: effect.currency, amount: effect.amount, label: def.name }], 'item.use', itemId);
    insertOpLog({ playerId, action: 'item_use', detail: { itemId, effect }, ip });

    return {
      granted: [{ kind: effect.currency, amount: effect.amount, label: def.name }],
    };
  });
}
