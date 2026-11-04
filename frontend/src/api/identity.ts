/**
 * 账号身份（静默建立，无注册/登录界面）
 * -----------------------------------------------------------------------------
 * 身份如何获得：
 *   1. 首次访问时调用 POST /api/auth/guest，服务端创建游客账号，
 *      并通过 Set-Cookie 下发一对 Cookie：
 *        - sid（HttpOnly）：会话令牌本体，JS 不可读，数据库只存其 SHA-256 摘要；
 *        - csrf（可读）：CSRF 双提交令牌，写请求时放进 x-csrf-token 头；
 *   2. {accountId, nickname} 持久化在 localStorage（food-fantasy.identity.v1），
 *      之后每次访问自动复用同一账号，无需任何用户操作；
 *   3. 会话失效（过期/吊销）时自动重新建号；网络不可用时保持旧身份，游戏继续本地运行。
 *
 * 身份如何使用：
 *   - accountId 是服务端一切数据的归属键（players.id）；
 *   - 会话令牌存于 HttpOnly Cookie（SameSite=Lax），浏览器同源请求自动携带，
 *     XSS 无法读取令牌；写请求另需 x-csrf-token 头与 csrf cookie 双提交校验；
 *   - 服务端所有业务接口都从 Cookie/Bearer 解析出操作者，
 *     请求参数无法指定"以谁的身份"操作，因此数据天然按账号隔离。
 */

// save-sync 对这里只有类型依赖，运行时无循环引用
import { stopCloudSync } from './save-sync';
import { apiUrl } from './base';

const IDENTITY_KEY = 'food-fantasy.identity.v1';
const CSRF_COOKIE = 'csrf';

export type AccountIdentity = {
  accountId: string;
  nickname: string;
  createdAt: string;
};

/** 从 document.cookie 读取 CSRF 双提交令牌（sid 为 HttpOnly，读不到属预期）。 */
export function readCsrfCookie(): string | null {
  if (typeof document === 'undefined') return null;
  for (const part of document.cookie.split(';')) {
    const eq = part.indexOf('=');
    if (eq > -1 && part.slice(0, eq).trim() === CSRF_COOKIE) {
      try {
        return decodeURIComponent(part.slice(eq + 1).trim());
      } catch {
        return part.slice(eq + 1).trim();
      }
    }
  }
  return null;
}

function readIdentity(): AccountIdentity | null {
  try {
    const raw = localStorage.getItem(IDENTITY_KEY);
    if (!raw) return null;
    const value: unknown = JSON.parse(raw);
    if (!value || typeof value !== 'object') return null;
    const candidate = value as Partial<AccountIdentity>;
    if (typeof candidate.accountId !== 'string') return null;
    return {
      accountId: candidate.accountId,
      nickname: typeof candidate.nickname === 'string' ? candidate.nickname : '灵界旅人',
      createdAt: typeof candidate.createdAt === 'string' ? candidate.createdAt : new Date().toISOString(),
    };
  } catch {
    return null;
  }
}

function writeIdentity(identity: AccountIdentity): void {
  try {
    localStorage.setItem(IDENTITY_KEY, JSON.stringify(identity));
  } catch {
    // 存储不可用时身份仅保留在内存中，本次会话仍然有效
  }
}

function clearIdentity(): void {
  try {
    localStorage.removeItem(IDENTITY_KEY);
  } catch {
    // 忽略存储异常
  }
}

/** 仅读取已建立的账号标识（同步，不发请求）；尚未建立时返回 null。 */
export function readAccountId(): string | null {
  return readIdentity()?.accountId ?? null;
}

/** 同步读取身份快照；供云同步等模块在身份就绪后取用（令牌在 Cookie 中，不经此传递）。 */
export function readIdentitySnapshot(): AccountIdentity | null {
  return readIdentity();
}

/** 身份就绪事件：ensureIdentity 完成（无论成败）后通知订阅者，供存档云同步启动。 */
type IdentityListener = (identity: AccountIdentity | null) => void;
const identityListeners = new Set<IdentityListener>();

export function onIdentityResolved(listener: IdentityListener): () => void {
  identityListeners.add(listener);
  return () => identityListeners.delete(listener);
}

function notifyIdentityResolved(identity: AccountIdentity | null): void {
  for (const listener of identityListeners) {
    try {
      listener(identity);
    } catch {
      // 订阅者异常不影响其他订阅者
    }
  }
}

async function createGuestIdentity(server?: number): Promise<AccountIdentity | null> {
  try {
    const response = await fetch(apiUrl('/api/auth/guest'), {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      // v16 按服隔离：建号时携带上次选择的服务器；账号属于该服，之后不可改
      body: JSON.stringify(Number.isInteger(server) ? { server } : {}),
    });
    if (!response.ok) return null;
    const payload = await response.json();
    const player = payload?.data?.player;
    if (typeof player?.id !== 'string') return null;
    // 会话令牌由服务端经 Set-Cookie 下发（HttpOnly），前端不落 localStorage
    const identity: AccountIdentity = {
      accountId: player.id,
      nickname: typeof player.nickname === 'string' ? player.nickname : '灵界旅人',
      createdAt: new Date().toISOString(),
    };
    writeIdentity(identity);
    return identity;
  } catch {
    // 后端不可用：静默降级，游戏仍以本地模式运行
    return null;
  }
}

/**
 * 自动化环境（Playwright/无头浏览器）不自动建号：
 * 1. 防刷号：机器人无法通过反复加载页面批量注册游客账号（IP 限流仍然生效）；
 * 2. 测试卫生：端到端回归每次用例都是全新上下文，自动建号会在一次回归里
 *    产生两三百个无主账号并撞上限流。
 * URL 带 ?identity=1 可强制走完整建号流程（供身份用例验证真实行为）。
 */
function shouldSkipGuestCreation(): boolean {
  const automated = typeof navigator !== 'undefined' && navigator.webdriver === true;
  if (!automated) return false;
  return !new URLSearchParams(window.location.search).has('identity');
}

/**
 * 确保当前浏览器拥有一个可用账号：
 * 已有身份 → 携带会话 Cookie 请求 /api/auth/me 服务端确权；
 * 会话失效 → 丢弃旧身份并自动重建（可携带上次选择的服）；
 * 自动化环境 → 只恢复、不新建；
 * 网络异常 → 返回 null，调用方无需阻塞游戏流程。
 */
export async function ensureIdentity(server?: number): Promise<AccountIdentity | null> {
  const existing = readIdentity();
  if (existing) {
    try {
      // 同源 fetch 自动携带 sid Cookie，无需 Authorization 头
      const response = await fetch(apiUrl('/api/auth/me'));
      if (response.ok) {
        notifyIdentityResolved(existing);
        return existing;
      }
      if (response.status === 401) clearIdentity();
    } catch {
      return null; // 离线：沿用旧身份，不重建
    }
  }
  if (shouldSkipGuestCreation()) return null;
  stopCloudSync(); // 旧身份作废，避免用过期会话继续回写
  const created = await createGuestIdentity(server);
  notifyIdentityResolved(created);
  return created;
}

/** 退出当前账号并清除本地身份（下一次访问会自动建立新账号）。 */
export async function signOutIdentity(): Promise<void> {
  const existing = readIdentity();
  if (existing) {
    try {
      const headers: Record<string, string> = { 'content-type': 'application/json' };
      const csrf = readCsrfCookie();
      if (csrf) headers['x-csrf-token'] = csrf;
      await fetch(apiUrl('/api/auth/logout'), { method: 'POST', headers, body: '{}' });
    } catch {
      // 即使服务端登出失败也要清掉本地身份
    }
  }
  stopCloudSync();
  clearIdentity();
}

/* ------------------------------ 账号密码注册 / 登录 ------------------------------ */

export type AuthError = { status: number; message: string };

function authErrorMessage(payload: unknown, fallback: string): string {
  const message = (payload as { error?: { message?: string } })?.error?.message;
  return typeof message === 'string' && message ? message : fallback;
}

/**
 * 正式注册：为当前会话身份设置密码。返回 accountId（即 players.id，找回凭证）。
 * 409 = 该身份已设置过密码；400 = 密码强度不足。
 */
export async function registerPassword(password: string): Promise<{ accountId: string }> {
  const headers: Record<string, string> = { 'content-type': 'application/json' };
  const csrf = readCsrfCookie();
  if (csrf) headers['x-csrf-token'] = csrf;
  const response = await fetch(apiUrl('/api/auth/register'), { method: 'POST', headers, body: JSON.stringify({ password }) });
  const payload = await response.json().catch(() => null);
  if (!response.ok) {
    throw { status: response.status, message: authErrorMessage(payload, response.status === 409 ? '该账号已设置过密码' : '密码设置失败，请检查密码格式') } satisfies AuthError;
  }
  const accountId = (payload as { data?: { accountId?: string } })?.data?.accountId;
  if (typeof accountId !== 'string') throw { status: response.status, message: '注册响应异常' } satisfies AuthError;
  return { accountId };
}

/**
 * 密码登录：账号 ID + 密码找回身份。服务端经 Set-Cookie 签发新会话，
 * 返回清洗后的远端存档（parseSave 口径）供调用方替换本地状态。
 */
export async function loginWithPassword(accountId: string, password: string): Promise<{ save: import('../game-data').GameSave | null }> {
  const response = await fetch(apiUrl('/api/auth/login'), {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ accountId: accountId.trim(), password }),
  });
  const payload = await response.json().catch(() => null);
  if (!response.ok) {
    throw { status: response.status, message: authErrorMessage(payload, '账号 ID 或密码不正确') } satisfies AuthError;
  }
  const data = (payload as { data?: { player?: { id?: unknown; nickname?: unknown }; save?: unknown } })?.data;
  const playerId = data?.player?.id;
  const nickname = data?.player?.nickname;
  if (typeof playerId === 'string' && typeof nickname === 'string') {
    // 登录成功后本机身份切换为该账号（跨设备找回）
    writeIdentity({ accountId: playerId, nickname, createdAt: new Date().toISOString() });
  }
  const { parseSave } = await import('../save-store');
  return { save: parseSave(data?.save) };
}
