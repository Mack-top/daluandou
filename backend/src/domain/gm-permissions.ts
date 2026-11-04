import type { GmAccountRow } from '../domain/types.js';

/**
 * GM 权限矩阵：角色即权限（设计 §2.4）。
 * super 持有全部操作；ops 负责运营投放与配置；support 仅邮件；readonly 只能看审计。
 */
export const GM_ACTIONS = [
  'login',
  'send_mail',
  'send_compensation',
  'grant_resource',
  'ban',
  'unban',
  'kick',
  'edit_config',
] as const;

export type GmAction = (typeof GM_ACTIONS)[number];

const GM_PERMISSIONS: Record<GmAccountRow['role'], readonly GmAction[]> = {
  super: GM_ACTIONS,
  ops: ['login', 'send_mail', 'send_compensation', 'grant_resource', 'edit_config', 'kick'],
  support: ['login', 'send_mail'],
  readonly: ['login'],
};

export function gmCan(gm: Pick<GmAccountRow, 'role'>, action: GmAction): boolean {
  return GM_PERMISSIONS[gm.role].includes(action);
}
