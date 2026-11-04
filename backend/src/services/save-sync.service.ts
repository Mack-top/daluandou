import { transaction } from '../db/index.js';
import { nowIso } from '../lib/clock.js';
import { badRequest, conflict, unprocessable } from '../lib/errors.js';
import {
  MAX_SAVE_DOCUMENT_BYTES,
  sanitizeSaveDocument,
  type SaveDocumentCatalog,
} from '../domain/save-document.js';
import {
  listAstrologyNodes,
  listCharacterDefs,
  listEquipmentDefs,
  listMails,
  listMarketOffers,
  listQuests,
  listShopPacks,
  listStages,
  listTradeRates,
} from '../repositories/catalog.repository.js';
import { queryAll } from '../db/index.js';
import {
  findSaveDocument,
  insertSaveDocument,
  updateSaveDocument,
} from '../repositories/save-document.repository.js';
import { requirePlayer, getBalances, getProgress } from '../repositories/player.repository.js';
import { ensureBattleCharge, listFirstClears } from '../repositories/battle.repository.js';
import { computeBattleCharges } from '../domain/battle-charges.js';
import { dayKey } from '../lib/clock.js';

/**
 * 服务端权威重算（防作弊）：客户端上报的存档只保留「展示/进度」语义，
 * 服务端可推导的字段一律以业务表为准覆盖——
 *  1. 货币：player_resources 余额（一切增减必须走 applyResourceDelta 留流水）；
 *  2. battleWins：battles 表真实胜场统计；
 *  3. firstClears：battles 表真实首通记录；
 *  4. 每日挑战次数：battle_passes 表当日计数（含挑战卡）。
 * 战斗回放/历史仅在展示层有意义，保留客户端清洗版本。
 */
function applyAuthoritativeFields(document: Record<string, unknown>, playerId: string): void {
  const balances = getBalances(playerId);
  document.coins = balances.coin;
  document.gems = balances.gem;
  document.books = balances.book;
  document.leaves = balances.leaf;
  document.potions = balances.potion;
  document.chests = balances.chest;
  document.medals = balances.medal;
  // v17 数值核心：掌灶人经验余额为服务端权威字段（战斗/任务/挂机入账，世界树升级消费）
  document.expEarned = getProgress(playerId).exp;
  document.battleWins = queryAll<{ total: number }>(
    'SELECT COUNT(*) AS total FROM battles WHERE player_id = ? AND win = 1',
    playerId,
  )[0]?.total ?? 0;
  document.firstClears = listFirstClears(playerId);
  const charges = computeBattleCharges(ensureBattleCharge(playerId, dayKey()));
  document.battleChargeDate = charges.dayKey;
  document.dailyBattlesUsed = charges.used;
  document.battlePassesPurchased = charges.purchased;
  // v14 主线任务链：关卡胜场分布与累计登录天数为服务端可推导字段，权威覆盖
  const stageWins = queryAll<{ stage_id: string; total: number }>(
    'SELECT stage_id, COUNT(*) AS total FROM battles WHERE player_id = ? AND win = 1 GROUP BY stage_id',
    playerId,
  );
  document.stageClears = Object.fromEntries(stageWins.map(row => [row.stage_id, Number(row.total)]));
  document.loginDays = queryAll<{ total: number }>(
    'SELECT COUNT(*) AS total FROM player_daily_state WHERE player_id = ?',
    playerId,
  )[0]?.total ?? 1;
}

export type SaveDocumentPayload = { document: Record<string, unknown>; version: number; updatedAt: string };

/** 从配置表加载校验白名单；表数据静态，逐请求读取成本低且永不过期。 */
function loadCatalog(): SaveDocumentCatalog {
  return {
    characters: listCharacterDefs().map(row => row.name),
    equipmentTemplates: listEquipmentDefs().map(row => ({ id: row.id, slot: row.slot })),
    stages: listStages().map(row => row.id),
    quests: listQuests().map(row => row.id),
    mails: listMails().map(row => row.id),
    shopPacks: listShopPacks().map(row => row.id),
    tradeRates: listTradeRates().map(row => ({ id: row.id, dailyLimit: row.daily_limit })),
    marketOffers: listMarketOffers().map(row => row.id),
    astrologyNodes: listAstrologyNodes().map(row => row.id),
    guilds: queryAll<{ id: string }>('SELECT id FROM guilds').map(row => row.id),
  };
}

/** 读取云端存档；尚未同步过返回 null（客户端据此上传本地存档完成迁移）。 */
export function getSaveDocument(playerId: string): SaveDocumentPayload | null {
  requirePlayer(playerId);
  const row = findSaveDocument(playerId);
  if (!row) return null;
  let document: unknown;
  try {
    document = JSON.parse(row.document);
  } catch {
    document = null;
  }
  if (!document || typeof document !== 'object' || Array.isArray(document)) return null;
  // v17：读取路径同样应用权威覆盖（只读、不落库）——快照落库后服务端状态可能已推进
  // （战斗/任务/挂机入账、世界树升级扣减），另一台设备拉取时必须拿到新鲜权威值而非陈旧快照
  const record = document as Record<string, unknown>;
  applyAuthoritativeFields(record, playerId);
  return { document: record, version: Number(row.version), updatedAt: row.updated_at };
}

/**
 * 上传存档文档：
 * 1. 服务端白名单校验清洗（非法字段丢弃，不整体拒绝）；
 * 2. 乐观锁：expectedVersion 与库内版本不一致时抛 409，并携带服务端当前文档，
 *    客户端据此放弃本地改动、采用服务端版本（多端冲突以先写入者为准）；
 * 3. 首次上传无需版本号，版本从 1 开始。
 */
export function putSaveDocument(
  playerId: string,
  rawDocument: unknown,
  expectedVersion?: number,
): SaveDocumentPayload {
  requirePlayer(playerId);
  const catalog = loadCatalog();
  const document = sanitizeSaveDocument(rawDocument, catalog);
  if (!document) throw badRequest('存档文档必须是对象');
  applyAuthoritativeFields(document, playerId);

  const serialized = JSON.stringify(document);
  if (Buffer.byteLength(serialized, 'utf8') > MAX_SAVE_DOCUMENT_BYTES) {
    throw unprocessable('存档文档过大，已超出云端存储上限');
  }

  return transaction(() => {
    const existing = findSaveDocument(playerId);
    const stamp = nowIso();
    if (!existing) {
      insertSaveDocument(playerId, serialized, stamp);
      return { document, version: 1, updatedAt: stamp };
    }
    const currentVersion = Number(existing.version);
    if (expectedVersion !== undefined && expectedVersion !== currentVersion) {
      let serverDocument: unknown = null;
      try {
        serverDocument = JSON.parse(existing.document);
      } catch {
        serverDocument = null;
      }
      throw conflict('存档已被其他设备更新，请采用云端版本', {
        document: serverDocument,
        version: currentVersion,
        updatedAt: existing.updated_at,
      });
    }
    updateSaveDocument(playerId, serialized, currentVersion, stamp);
    return { document, version: currentVersion + 1, updatedAt: stamp };
  });
}
