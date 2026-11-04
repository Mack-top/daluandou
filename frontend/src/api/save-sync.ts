/**
 * 存档云同步
 * -----------------------------------------------------------------------------
 * 职责：把 use-game 的本地存档与服务端 player_save_documents 对齐。
 *
 * 工作方式：
 *   1. 身份就绪后 syncOnce()：云端有文档 → 拉回并替换本地；没有 → 上传本地存档完成迁移；
 *   2. 之后本地每次变更经 schedulePush() 防抖 1.5s 回写云端（带乐观锁版本号）；
 *   3. 版本冲突（409，说明另一台设备先写入）→ 放弃本地推送，采用云端文档；
 *   4. 无身份（自动化环境/离线）→ 完全不启动，保持纯 localStorage 行为。
 *
 * 防回环：applyRemote 应用云端文档时不触发回写（lastSyncedJson 先行记录）。
 */

import type { GameSave } from '../game-data';
import { parseSave } from '../save-store';
import type { AccountIdentity } from './identity';
import { readCsrfCookie } from './identity';

export type RemoteDocument = {
  document: GameSave;
  version: number;
};

type CloudState = {
  identity: AccountIdentity;
  version: number;
  lastSyncedJson: string;
  timer: number | null;
  pushing: boolean;
};

let cloud: CloudState | null = null;
let syncInFlight: Promise<RemoteDocument | null> | null = null;
const DEBOUNCE_MS = 1500;

/** 云同步是否已激活（有有效身份且首轮同步完成）。 */
export function isCloudSyncActive(): boolean {
  return cloud !== null;
}

import { apiUrl } from './base';

async function request(path: string, init: RequestInit = {}): Promise<Response> {
  const headers: Record<string, string> = {
    ...((init.headers as Record<string, string>) ?? {}),
    ...(init.body !== undefined ? { 'content-type': 'application/json' } : {}),
  };
  // 会话走 HttpOnly Cookie（同源自动携带）；写请求另附 CSRF 双提交头
  if (init.method !== undefined && init.method !== 'GET') {
    const csrf = readCsrfCookie();
    if (csrf) headers['x-csrf-token'] = csrf;
  }
  return fetch(apiUrl(path), { ...init, headers });
}

/** 拉取云端文档；version 0 表示云端还没有该账号的存档。 */
async function fetchRemote(): Promise<{ document: unknown; version: number } | null> {
  const response = await request('/api/game/state/document');
  if (!response.ok) return null;
  const payload = await response.json().catch(() => null);
  const data = payload?.data;
  if (!data || typeof data.version !== 'number') return null;
  return { document: data.document ?? null, version: data.version };
}

type PushResult =
  | { kind: 'ok'; document: GameSave; version: number }
  | { kind: 'conflict'; document: GameSave; version: number }
  | { kind: 'failed' };

async function pushRemote(document: unknown, version?: number): Promise<PushResult> {
  let response: Response;
  try {
    response = await request('/api/game/state/document', {
      method: 'PUT',
      body: JSON.stringify(version === undefined ? { document } : { document, version }),
    });
  } catch {
    return { kind: 'failed' };
  }
  const payload = await response.json().catch(() => null);
  if (response.ok) {
    const data = payload?.data;
    if (!data || typeof data.version !== 'number') return { kind: 'failed' };
    return { kind: 'ok', document: parseSave(data.document), version: data.version };
  }
  if (response.status === 409) {
    const details = payload?.error?.details;
    if (details && typeof details.version === 'number' && details.document) {
      return { kind: 'conflict', document: parseSave(details.document), version: details.version };
    }
  }
  return { kind: 'failed' };
}

/**
 * 首轮同步：身份就绪后调用一次。
 * 云端已有文档 → 返回云端文档（调用方替换本地存档）；
 * 云端为空 → 上传本地存档完成迁移，返回 null（本地保持不变）。
 * 失败（离线/接口异常）→ 返回 null，本地模式继续。
 */
export async function syncOnce(identity: AccountIdentity, localSave: GameSave): Promise<RemoteDocument | null> {
  if (cloud) return null; // 已完成首轮同步
  if (syncInFlight) return syncInFlight; // 并发调用共享同一次同步
  syncInFlight = doSyncOnce(identity, localSave);
  try {
    return await syncInFlight;
  } finally {
    // 失败（返回 null）时允许下次重试；成功时 cloud 已建立，天然幂等
    syncInFlight = null;
  }
}

async function doSyncOnce(identity: AccountIdentity, localSave: GameSave): Promise<RemoteDocument | null> {
  let remote: Awaited<ReturnType<typeof fetchRemote>>;
  try {
    remote = await fetchRemote();
  } catch {
    return null;
  }
  if (!remote) return null;

  if (remote.version > 0 && remote.document) {
    const document = parseSave(remote.document);
    cloud = {
      identity,
      version: remote.version,
      lastSyncedJson: JSON.stringify(document),
      timer: null,
      pushing: false,
    };
    return { document, version: remote.version };
  }

  // 迁移：云端还没有存档，把本地存档推上去
  const result = await pushRemote(localSave);
  if (result.kind === 'ok') {
    cloud = {
      identity,
      version: result.version,
      lastSyncedJson: JSON.stringify(result.document),
      timer: null,
      pushing: false,
    };
    if (JSON.stringify(localSave) !== JSON.stringify(result.document)) {
      // 服务端清洗改变了内容（例如剔除了非法字段）：以服务端为准
      return { document: result.document, version: result.version };
    }
  } else if (result.kind === 'conflict') {
    // 并发场景：别的端抢先迁移，直接采用云端版本
    cloud = {
      identity,
      version: result.version,
      lastSyncedJson: JSON.stringify(result.document),
      timer: null,
      pushing: false,
    };
    return { document: result.document, version: result.version };
  }
  return null;
}

/**
 * 本地变更后调度回写（防抖）。save 与上次同步内容相同则跳过。
 * applyRemote：冲突/漂移时把云端文档应用回本地状态（不会再次触发回写）。
 */
export function schedulePush(save: GameSave, applyRemote: (document: GameSave) => void): void {
  if (!cloud) return;
  // 无论本次是否回写，都先取消上一轮定时器：永远以最新状态为准，
  // 避免「云端文档刚拉回，上一拍排的本地旧快照又把云端覆盖回去」。
  if (cloud.timer !== null) {
    window.clearTimeout(cloud.timer);
    cloud.timer = null;
  }
  const json = JSON.stringify(save);
  if (json === cloud.lastSyncedJson) return;
  cloud.timer = window.setTimeout(() => {
    void flushPush(save, applyRemote);
  }, DEBOUNCE_MS);
}

async function flushPush(save: GameSave, applyRemote: (document: GameSave) => void): Promise<void> {
  if (!cloud || cloud.pushing) return;
  const current = cloud;
  current.pushing = true;
  try {
    const result = await pushRemote(save, current.version);
    if (!cloud || cloud !== current) return; // 同步期间被重置
    if (result.kind === 'ok') {
      current.version = result.version;
      current.lastSyncedJson = JSON.stringify(result.document);
    } else if (result.kind === 'conflict') {
      current.version = result.version;
      current.lastSyncedJson = JSON.stringify(result.document);
      applyRemote(result.document);
    }
    // failed：保持 lastSyncedJson 不变，下次变更会重试
  } finally {
    if (cloud === current) current.pushing = false;
  }
}

/** 身份注销/更换时停止云同步。 */
export function stopCloudSync(): void {
  if (cloud?.timer !== null && cloud?.timer !== undefined) window.clearTimeout(cloud.timer);
  cloud = null;
}
