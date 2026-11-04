import { ascendCost, astrologyNodes, craftCost, expRequiredAt, grantRewards, idleAccrual, marketStockFor, starLevel, tradeRates, worldtreeCost, WORLD_TREE_MAX, type GameSave } from './game-data';
import { rolloverDaily } from './game-clock';

export function exchangeResources(save: GameSave, id: string): GameSave {
  const current = rolloverDaily(save);
  const rate = tradeRates.find(item => item.id === id);
  if (!rate) return current;
  const used = current.tradeCounts[id] || 0;
  const key = rate.give.kind === 'coin' ? 'coins' : rate.give.kind === 'leaf' ? 'leaves' : 'gems';
  if (used >= rate.dailyLimit || current[key] < rate.give.amount) return current;
  const next = grantRewards(current, [rate.get]);
  return { ...next, [key]: next[key] - rate.give.amount, tradeCounts: { ...next.tradeCounts, [id]: used + 1 } };
}

export function ascendCharacter(save: GameSave, name: string): GameSave {
  if (!save.characters.includes(name)) return save;
  const star = starLevel(save, name);
  const cost = ascendCost(star);
  if (star >= 5 || save.potions < cost.potions || save.leaves < cost.leaves) return save;
  const next = star + 1 === 5 ? grantRewards(save, [{ kind: 'book', amount: 1, label: '食灵契约' }]) : star + 1 === 3 ? grantRewards(save, [{ kind: 'medal', amount: 1, label: '稀有徽章' }]) : save;
  return { ...next, potions: next.potions - cost.potions, leaves: next.leaves - cost.leaves, stars: { ...next.stars, [name]: star + 1 } };
}

export function claimIdleRewards(save: GameSave, now = new Date()): GameSave {
  if (!save.profile) return save;
  const accrual = idleAccrual(save, now.getTime());
  if (accrual.coins < 1 && accrual.exp < 1) return save;
  return { ...save, coins: save.coins + accrual.coins, potions: save.potions + accrual.potions, expEarned: save.expEarned + accrual.exp, idleClaimAt: now.toISOString() };
}

export function craftPotionsTransaction(save: GameSave, times: number): GameSave {
  if (times !== 1 && times !== 5) return save;
  const cost = craftCost(times);
  if (save.coins < cost.coins || save.leaves < cost.leaves) return save;
  const produced = Math.round(90000 * times * (save.crafted >= 5 ? 1.1 : 1));
  return { ...save, coins: save.coins - cost.coins, leaves: save.leaves - cost.leaves, potions: save.potions + produced, crafted: save.crafted + times };
}

export function buyMarketTransaction(save: GameSave, id: string): GameSave {
  const current = rolloverDaily(save);
  const item = marketStockFor(current.marketDate).find(entry => entry.id === id);
  if (!item || current.marketBought.includes(id)) return current;
  const price = Math.round(item.price * (current.worldtree >= 3 ? 0.9 : 1));
  if (current.coins < price) return current;
  return { ...grantRewards(current, [{ kind: item.kind, amount: item.amount, label: item.label }]), coins: current.coins - price, marketBought: [...current.marketBought, id] };
}

export function unlockStarNode(save: GameSave, id: string): GameSave {
  const index = astrologyNodes.findIndex(item => item.id === id);
  if (index < 0 || save.astrology.includes(id)) return save;
  if (index > 0 && !save.astrology.includes(astrologyNodes[index - 1].id)) return save;
  const cost = astrologyNodes[index].cost;
  return save.gems < cost ? save : { ...save, gems: save.gems - cost, astrology: [...save.astrology, id] };
}

export function upgradeTree(save: GameSave): GameSave {
  // v17 §2.3 升级接线：exp_required(L) + coins×0.2 + leaves 全额（与后端 upgradeWorldtree 同口径）
  const cost = worldtreeCost(save.worldtree);
  const coinCost = Math.round(cost.coins * 0.2);
  const expCost = expRequiredAt(save.worldtree);
  if (save.worldtree >= WORLD_TREE_MAX || expCost <= 0) return save;
  if (save.coins < coinCost || save.leaves < cost.leaves || save.expEarned < expCost) return save;
  return { ...save, coins: save.coins - coinCost, leaves: save.leaves - cost.leaves, expEarned: save.expEarned - expCost, worldtree: save.worldtree + 1 };
}