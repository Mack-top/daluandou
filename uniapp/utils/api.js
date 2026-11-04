/**
 * uni-app 前端 API 请求封装
 * 对接后端 Express + SQLite 服务（http://127.0.0.1:8787/api）
 *
 * 特性：
 * 1. 自动拼接基础 URL（支持跨环境切换）
 * 2. 自动携带登录 Token（从 uni.getStorageSync 读取）
 * 3. 统一错误处理（toast 提示）
 * 4. 支持 Promise 风格调用
 */

const API_BASE = 'http://127.0.0.1:8787/api';

const TOKEN_KEY = 'food_fantasy_token';

function getToken() {
  try {
    return uni.getStorageSync(TOKEN_KEY);
  } catch (e) {
    return '';
  }
}

function setToken(token) {
  try {
    uni.setStorageSync(TOKEN_KEY, token);
  } catch (e) {
    console.warn('save token failed', e);
  }
}

function clearToken() {
  try {
    uni.removeStorageSync(TOKEN_KEY);
  } catch (e) {
    console.warn('clear token failed', e);
  }
}

/**
 * 发起请求
 * @param {string} url - 接口路径（如 /auth/guest）
 * @param {Object} options - uni.request 选项
 * @returns {Promise} - 响应数据
 */
function request(url, options = {}) {
  const fullUrl = url.startsWith('http') ? url : `${API_BASE}${url}`;
  const token = getToken();

  const headers = {
    ...options.headers,
    'Content-Type': options.contentType || 'application/json',
  };

  // 双轨鉴权：优先 Authorization: Bearer；若无则不设置（后端支持 Cookie 轨道，uni-app H5 同源自动携带 Cookie）
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  return new Promise((resolve, reject) => {
    uni.request({
      url: fullUrl,
      method: options.method || 'GET',
      header: headers,
      data: options.data,
      dataType: 'json',
      timeout: 10000,
      success: (res) => {
        const { statusCode, data } = res;

        // 未授权拦截：401 清除本地 token 并跳转登录/选服页
        if (statusCode === 401) {
          clearToken();
          uni.showToast({ title: '登录已过期，请重新登录', icon: 'none', duration: 2500 });
          setTimeout(() => {
            uni.redirectTo({ url: '/pages/index/index' });
          }, 1500);
          reject(new Error('未授权：token 已过期'));
          return;
        }

        // 网络层异常
        if (statusCode < 200 || statusCode >= 300) {
          const msg = (data && data.error && data.error.message) || `请求失败 (${statusCode})`;
          uni.showToast({ title: msg, icon: 'none', duration: 3000 });
          reject(new Error(msg));
          return;
        }

        // 业务层异常（后端统一返回 { ok: false, error: {...} }）
        if (data && data.ok === false) {
          const msg = (data.error && data.error.message) || '业务请求失败';
          uni.showToast({ title: msg, icon: 'none', duration: 3000 });
          reject(new Error(msg));
          return;
        }

        resolve(data && data.ok !== undefined ? data.data : data);
      },
      fail: (err) => {
        uni.showToast({ title: '网络请求失败，请检查后端服务', icon: 'none', duration: 3000 });
        reject(err);
      },
      complete: options.complete,
    });
  });
}

/* ==================== 认证模块 ==================== */

/** 游客登录（无需账号，返回 token + player + save） */
export function guestLogin({ nickname, gender, server } = {}) {
  return request('/auth/guest', {
    method: 'POST',
    data: {
      ...(nickname ? { nickname } : {}),
      ...(gender ? { gender } : {}),
      ...(server ? { server } : {}),
    },
  }).then((result) => {
    if (result.token) {
      setToken(result.token);
    }
    return result;
  });
}

/** 获取当前玩家信息与存档（需登录） */
export function getMe() {
  return request('/auth/me', { method: 'GET' });
}

/** 密码登录（账号 ID + 密码） */
export function loginWithPassword({ accountId, password }) {
  return request('/auth/login', {
    method: 'POST',
    data: { accountId, password },
  }).then((result) => {
    if (result.token) {
      setToken(result.token);
    }
    return result;
  });
}

/** 设置密码（游客升级为正式账号） */
export function registerPassword({ password }) {
  return request('/auth/register', {
    method: 'POST',
    data: { password },
  });
}

/** 登出 */
export function logout() {
  clearToken();
  return request('/auth/logout', { method: 'POST' });
}

/* ==================== 服务器模块 ==================== */

/** 获取服务器列表 */
export function fetchServerList() {
  return request('/servers', { method: 'GET' });
}

/* ==================== 公告模块 ==================== */

/** 获取最新公告 */
export function fetchAnnounce() {
  return request('/catalog', { method: 'GET' }).then((data) => {
    // 目录接口返回完整配置，公告信息可从中提取或单独扩展
    return data.announcements || [];
  });
}

/* ==================== 存档模块 ==================== */

/** 获取玩家存档 */
export function getSave() {
  return request('/game/state', { method: 'GET' });
}

/** 云端存档文档（读） */
export function getSaveDocument() {
  return request('/game/state/document', { method: 'GET' });
}

/** 云端存档文档（写） */
export function putSaveDocument(document, version) {
  return request('/game/state/document', {
    method: 'PUT',
    data: { document, version },
  });
}

/* ==================== 商店/物品模块 ==================== */

/** 获取商店目录 */
export function getCatalog() {
  return request('/catalog', { method: 'GET' });
}

/** 获取今日集市 */
export function getMarket() {
  return request('/catalog/market', { method: 'GET' });
}

/** 购买商城礼包 */
export function purchasePack({ packId }) {
  return request('/game/shop/purchase', {
    method: 'POST',
    data: { packId },
  });
}

/* ==================== 背包模块 ==================== */

/** 获取背包物品 */
export function listItems() {
  return request('/game/items', { method: 'GET' });
}

/** 使用物品 */
export function useItem(itemId) {
  return request(`/game/items/${itemId}/use`, { method: 'POST' });
}

/* ==================== 任务模块 ==================== */

/** 获取任务列表 */
export function listQuests() {
  return request('/game/quests', { method: 'GET' });
}

/** 领取任务奖励 */
export function claimQuest(questId) {
  return request(`/game/quests/${questId}/claim`, { method: 'POST' });
}

/* ==================== 邮件模块 ==================== */

/** 获取邮件列表 */
export function listMail() {
  return request('/game/mail', { method: 'GET' });
}

/** 领取邮件奖励 */
export function claimMail(mailId) {
  return request(`/game/mail/${mailId}/claim`, { method: 'POST' });
}

/** 获取系统邮件 */
export function listSystemMail() {
  return request('/game/mail/system', { method: 'GET' });
}

/** 读取系统邮件 */
export function readSystemMail(mailId) {
  return request(`/game/mail/system/${mailId}/read`, { method: 'POST' });
}

/** 领取系统邮件奖励 */
export function claimSystemMail(mailId) {
  return request(`/game/mail/system/${mailId}/claim`, { method: 'POST' });
}

/* ==================== 活动模块 ==================== */

/** 获取活动列表 */
export function listActivities() {
  return request('/game/activities', { method: 'GET' });
}

/** 领取活动奖励 */
export function claimActivityTier(activityId, tier) {
  return request(`/game/activities/${activityId}/claim`, {
    method: 'POST',
    data: { tier },
  });
}

/* ==================== 战斗模块 ==================== */

/** 战斗准备 */
export function battlePrep() {
  return request('/battles/prep', { method: 'GET' });
}

/** 战斗进行 */
export function battlePlay(data) {
  return request('/battles/play', { method: 'POST', data });
}

/** 战斗结果 */
export function battleResult(data) {
  return request('/battles/result', { method: 'POST', data });
}

/* ==================== 排行榜模块 ==================== */

/** 获取排行榜 */
export function getLeaderboards() {
  return request('/leaderboards', { method: 'GET' });
}

/* ==================== 社交模块 ==================== */

/** 获取好友列表 */
export function listFriends() {
  return request('/social/friends', { method: 'GET' });
}

/** 协会签到 */
export function guildCheckin() {
  return request('/social/guilds/checkin', { method: 'POST' });
}

/** 获取聊天消息 */
export function listChat() {
  return request('/social/chat', { method: 'GET' });
}

/** 发送聊天消息 */
export function sendChat(data) {
  return request('/social/chat', { method: 'POST', data });
}

/* ==================== 支付模块 ==================== */

/** 创建支付订单 */
export function createPayment(data) {
  return request('/payments/create', { method: 'POST', data });
}

export default {
  guestLogin,
  getMe,
  loginWithPassword,
  registerPassword,
  logout,
  fetchServerList,
  fetchAnnounce,
  getSave,
  getSaveDocument,
  putSaveDocument,
  getCatalog,
  getMarket,
  purchasePack,
  listItems,
  useItem,
  listQuests,
  claimQuest,
  listMail,
  claimMail,
  listSystemMail,
  readSystemMail,
  claimSystemMail,
  listActivities,
  claimActivityTier,
  battlePrep,
  battlePlay,
  battleResult,
  getLeaderboards,
  listFriends,
  guildCheckin,
  listChat,
  sendChat,
  createPayment,
  clearToken,
  getToken,
};
