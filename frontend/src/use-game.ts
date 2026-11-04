import { useCallback, useEffect, useState, type Dispatch, type SetStateAction } from 'react';
import { defaultPreferences, type GameSave, type Preferences } from './game-data';
import { createFreshSave, rolloverDaily } from './game-clock';
import { parseSave } from './save-store';
import { onIdentityResolved, readIdentitySnapshot, type AccountIdentity } from './api/identity';
import { isCloudSyncActive, schedulePush, syncOnce } from './api/save-sync';
import { fetchCatalog } from './api/catalog';

const SAVE_KEY = 'food-fantasy.save.v1';
const PREF_KEY = 'food-fantasy.preferences.v1';
const SCREEN_KEY = 'food-fantasy.session.v1';

function readSave(): GameSave {
  try {
    const stored = JSON.parse(localStorage.getItem(SAVE_KEY) || 'null');
    return parseSave(stored);
  } catch { return createFreshSave(); }
}

function readPreferences(): Preferences {
  try {
    const stored = JSON.parse(localStorage.getItem(PREF_KEY) || 'null');
    if (!stored) return { ...defaultPreferences };
    return {
      theme: ['moon', 'jade', 'amber'].includes(stored.theme) ? stored.theme : 'moon',
      particles: stored.particles !== false,
      music: false,
      volume: typeof stored.volume === 'number' ? Math.min(100, Math.max(0, stored.volume)) : 35,
    };
  } catch { return { ...defaultPreferences }; }
}

/** 刷新后回到上一次所在的界面；仅在有角色时才恢复主城。 */
export function readStoredScreen(fallback: 'login' | 'lobby'): 'login' | 'lobby' {
  try {
    const session = JSON.parse(localStorage.getItem(SCREEN_KEY) || 'null');
    if (session?.screen === 'lobby' && readSave().profile) return 'lobby';
  } catch { /* ignore malformed session data */ }
  return fallback;
}

export function writeStoredScreen(screen: 'login' | 'lobby'): void {
  try { localStorage.setItem(SCREEN_KEY, JSON.stringify({ screen })); } catch { /* storage unavailable */ }
}

/**
 * v16 按服隔离：建号时携带上一次选择的服务器（账号属于某个服，建号后不可改）。
 * 供 main.tsx 在静默建号前同步读取；无存档/非法值返回 undefined（后端按默认服处理）。
 */
export function readStoredServer(): number | undefined {
  try {
    const stored = JSON.parse(localStorage.getItem(SAVE_KEY) || 'null');
    const server = Number(stored?.server);
    return Number.isInteger(server) && server >= 1 && server <= 99 ? server : undefined;
  } catch { return undefined; }
}

export function useGame() {
  const [save, updateSave] = useState<GameSave>(readSave);
  const [preferences, setPreferences] = useState<Preferences>(readPreferences);
  const [storageError, setStorageError] = useState(false);
  const setSave: Dispatch<SetStateAction<GameSave>> = useCallback(action => {
    updateSave(current => {
      const normalized = rolloverDaily(current);
      return typeof action === 'function' ? action(normalized) : rolloverDaily(action);
    });
  }, []);

  useEffect(() => {
    try { localStorage.setItem(SAVE_KEY, JSON.stringify(save)); }
    catch { setStorageError(true); }
    // 云端回写（防抖）。无身份/未激活时内部直接跳过，保持纯本地行为。
    schedulePush(save, document => updateSave(document));
  }, [save]);

  // 身份就绪后做首轮云同步：云端有档 → 拉回替换本地；云端无档 → 上传本地完成迁移。
  // 自动化环境（webdriver 无 ?identity=1）不会建立身份，此 effect 不会触发任何网络请求。
  useEffect(() => {
    const start = (identity: AccountIdentity | null) => {
      if (!identity) return;
      void syncOnce(identity, readSave()).then(remote => {
        if (remote) updateSave(remote.document);
      });
    };
    const unsubscribe = onIdentityResolved(start);
    // 竞态防护：ensureIdentity 可能在本组件挂载前完成，主动检查一次已有身份
    const existing = readIdentitySnapshot();
    if (existing && !isCloudSyncActive()) start(existing);
    return unsubscribe;
  }, []);

  // v21 数据持久化：启动时拉取服务端 catalog（公开端点，无需身份），
  // 关卡表/副本/功能开关以服务端为权威；离线失败保持本地兜底，不影响游戏。
  useEffect(() => {
    void fetchCatalog();
  }, []);

  useEffect(() => {
    try { localStorage.setItem(PREF_KEY, JSON.stringify(preferences)); }
    catch { setStorageError(true); }
  }, [preferences]);

  useEffect(() => {
    const sync = () => updateSave(current => rolloverDaily(current));
    const timer = window.setInterval(sync, 1000);
    window.addEventListener('focus', sync);
    document.addEventListener('visibilitychange', sync);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener('focus', sync);
      document.removeEventListener('visibilitychange', sync);
    };
  }, []);

  // Ambient tones are synthesized locally and only enabled by a user action.
  useEffect(() => {
    if (!preferences.music) return;
    if (!window.AudioContext) { setPreferences(current => ({ ...current, music: false })); return; }
    let context: AudioContext | null = null;
    try {
      context = new AudioContext();
      const gain = context.createGain();
      gain.gain.setValueAtTime(0, context.currentTime);
      gain.gain.linearRampToValueAtTime(preferences.volume / 100 * 0.035, context.currentTime + 1.5);
      gain.connect(context.destination);
      [130.81, 196, 261.63, 329.63].forEach((frequency, index) => {
        const oscillator = context!.createOscillator();
        oscillator.type = 'sine';
        oscillator.frequency.value = frequency;
        oscillator.detune.value = index % 2 ? 2 : -2;
        oscillator.connect(gain);
        oscillator.start();
      });
      void context.resume().catch(() => setPreferences(current => ({ ...current, music: false })));
    } catch { setPreferences(current => ({ ...current, music: false })); }
    return () => { if (context && context.state !== 'closed') void context.close().catch(() => undefined); };
  }, [preferences.music, preferences.volume]);

  return { save, setSave, preferences, setPreferences, storageError };
}