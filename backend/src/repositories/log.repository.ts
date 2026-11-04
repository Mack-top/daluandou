import { execute } from '../db/index.js';
import { nowIso } from '../lib/clock.js';
import { newId } from '../lib/ids.js';
import type { SecurityEvent } from '../domain/types.js';

/* ------------------------------ 运营与安全日志（v13，append-only） ------------------------------ */

/** 玩家关键操作留痕：物品使用、活动领取、系统邮件领取等。 */
export function insertOpLog(input: {
  playerId: string | null;
  action: string;
  detail?: unknown;
  ip?: string;
}): void {
  execute(
    `INSERT INTO op_logs (id, player_id, action, detail_json, ip, created_at)
     VALUES (?, ?, ?, ?, ?, ?)`,
    newId(),
    input.playerId,
    input.action,
    JSON.stringify(input.detail ?? {}),
    input.ip ?? '',
    nowIso(),
  );
}

/**
 * 安全事件留痕：登录失败、CSRF 校验失败、封禁命中等。
 * player_id 允许 NULL（请求可能来自未认证身份），因此无外键。
 * 写日志自身绝不抛业务异常：审计失败不应拖垮主流程，仅打印告警。
 */
export function insertSecurityLog(input: {
  playerId?: string | null;
  event: SecurityEvent;
  detail?: unknown;
  ip?: string;
}): void {
  try {
    execute(
      `INSERT INTO security_logs (id, player_id, event, detail_json, ip, created_at)
       VALUES (?, ?, ?, ?, ?, ?)`,
      newId(),
      input.playerId ?? null,
      input.event,
      JSON.stringify(input.detail ?? {}),
      input.ip ?? '',
      nowIso(),
    );
  } catch (error) {
    console.warn('[security-log] 写入安全日志失败：', error);
  }
}
