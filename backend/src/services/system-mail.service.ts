import { transaction } from '../db/index.js';
import { isExpired, nowIso } from '../lib/clock.js';
import { conflict, forbidden, notFound } from '../lib/errors.js';
import { parseJsonArray, type PlayerSystemMailRow, type Reward } from '../domain/types.js';
import { findSystemMail, listSystemMails, markSystemMailClaimed, markSystemMailRead } from '../repositories/system-mail.repository.js';
import { insertOpLog } from '../repositories/log.repository.js';
import { applyRewards } from './item.service.js';

/* ------------------------------ 玩家系统邮件（v11） ------------------------------ */

export type SystemMailView = {
  id: string;
  title: string;
  body: string;
  attachments: Reward[];
  source: PlayerSystemMailRow['source'];
  expireAt: string | null;
  read: boolean;
  claimed: boolean;
  createdAt: string;
};

function toView(row: PlayerSystemMailRow): SystemMailView {
  return {
    id: row.id,
    title: row.title,
    body: row.body,
    attachments: parseJsonArray<Reward>(row.attachments_json),
    source: row.source,
    expireAt: row.expire_at,
    read: Boolean(row.read_at),
    claimed: Boolean(row.claimed_at),
    createdAt: row.created_at,
  };
}

/** 邮箱视图：过滤已过期未领取的邮件（过期视为不可见，与主流邮箱口径一致）。 */
export function listSystemMailbox(playerId: string): SystemMailView[] {
  const now = nowIso();
  return listSystemMails(playerId)
    .filter(row => !row.expire_at || row.claimed_at || row.expire_at > now)
    .map(toView);
}

export function readSystemMail(playerId: string, mailId: string): SystemMailView {
  const row = findSystemMail(playerId, mailId);
  if (!row) throw notFound('邮件不存在');
  if (row.expire_at && isExpired(row.expire_at) && !row.claimed_at) throw notFound('邮件已过期');
  if (!row.read_at) markSystemMailRead(mailId);
  return toView(row);
}

/** 领取系统邮件附件：过期/重复领取服务端拒绝；发放入账走 applyRewards 统一入口。 */
export function claimSystemMail(playerId: string, mailId: string, ip = ''): { rewards: Reward[] } {
  return transaction(() => {
    const row = findSystemMail(playerId, mailId);
    if (!row) throw notFound('邮件不存在');
    if (row.claimed_at) throw conflict('该邮件奖励已领取');
    if (row.expire_at && isExpired(row.expire_at)) {
      throw forbidden('邮件已过期，附件无法领取');
    }

    const rewards = parseJsonArray<Reward>(row.attachments_json);
    applyRewards(playerId, rewards, 'mail.system.claim', row.id);
    markSystemMailClaimed(row.id);
    insertOpLog({ playerId, action: 'system_mail_claim', detail: { mailId: row.id, source: row.source }, ip });

    return { rewards };
  });
}
