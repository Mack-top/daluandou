import { createStore } from 'vuex';
import {
  guestLogin,
  getMe,
  loginWithPassword,
  logout as apiLogout,
  fetchServerList as apiFetchServerList,
  getSave,
} from '../utils/api.js';

const STORAGE_KEY = 'food_fantasy_user';
const TOKEN_KEY = 'food_fantasy_token';

const loadAuth = () => {
  try {
    const raw = uni.getStorageSync(STORAGE_KEY);
    if (raw) return JSON.parse(raw);
  } catch (e) {
    console.warn('load auth storage failed', e);
  }
  return null;
};

const saveAuth = (user) => {
  try {
    uni.setStorageSync(STORAGE_KEY, JSON.stringify(user));
  } catch (e) {
    console.warn('save auth storage failed', e);
  }
};

const clearAuth = () => {
  try {
    uni.removeStorageSync(STORAGE_KEY);
  } catch (e) {
    console.warn('clear auth storage failed', e);
  }
};

export default createStore({
  state: {
    user: loadAuth(),
    token: uni.getStorageSync(TOKEN_KEY) || null,
    serverList: [],
    selectedServer: null,
    isLoggedIn: !!uni.getStorageSync(TOKEN_KEY),
    save: null,
  },
  mutations: {
    SET_USER(state, user) {
      state.user = user;
      state.token = user?.token || null;
      state.isLoggedIn = !!user?.token;
      if (user) saveAuth(user);
    },
    SET_TOKEN(state, token) {
      state.token = token;
      state.isLoggedIn = !!token;
      if (token) {
        uni.setStorageSync(TOKEN_KEY, token);
      } else {
        uni.removeStorageSync(TOKEN_KEY);
      }
    },
    CLEAR_USER(state) {
      state.user = null;
      state.token = null;
      state.isLoggedIn = false;
      state.save = null;
      clearAuth();
      uni.removeStorageSync(TOKEN_KEY);
    },
    SET_SERVER_LIST(state, list) {
      state.serverList = list;
    },
    SET_SELECTED_SERVER(state, server) {
      state.selectedServer = server;
      if (server) uni.setStorageSync('selected_server', server.name);
    },
    SET_LOGGED_IN(state, flag) {
      state.isLoggedIn = flag;
    },
    SET_SAVE(state, save) {
      state.save = save;
    },
  },
  actions: {
    // 游客登录（无需账号，后端自动建号）
    async guestLogin({ commit }, { nickname, gender, server } = {}) {
      const result = await guestLogin({ nickname, gender, server });
      commit('SET_USER', {
        token: result.token,
        player: result.player,
      });
      commit('SET_SAVE', result.save);
      return result;
    },

    // 密码登录（账号 ID + 密码）
    async login({ commit }, { accountId, password }) {
      const result = await loginWithPassword({ accountId, password });
      commit('SET_USER', {
        token: result.token,
        player: result.player,
      });
      commit('SET_SAVE', result.save);
      return result;
    },

    // 获取当前玩家信息（需登录）
    async fetchMe({ commit }) {
      const result = await getMe();
      commit('SET_USER', {
        token: state.token,
        player: result.player,
      });
      commit('SET_SAVE', result.save);
      return result;
    },

    // 设置密码（游客升级为正式账号）
    async registerPassword({ commit }, { password }) {
      const result = await registerPassword({ password });
      return result;
    },

    // 登出
    async logout({ commit }) {
      try {
        await apiLogout();
      } catch (e) {
        // 即使服务端登出失败也要清本地
        console.warn('server logout failed', e);
      }
      commit('CLEAR_USER');
      uni.redirectTo({ url: '/pages/index/index' });
    },

    // 从后端获取服务器列表（替换模拟数据）
    async fetchServerList({ commit }) {
      try {
        const result = await apiFetchServerList();
        // 后端返回 { servers: [...] }，转为前端期望的格式
        const list = (result.servers || []).map((s) => ({
          id: String(s.server),
          name: `美食${s.server}服`,
          status: s.maintenance ? '维护' : s.status === 'online' ? '顺畅' : '爆满',
          online: s.players,
          maintenance: s.maintenance,
        }));
        commit('SET_SERVER_LIST', list);
        return list;
      } catch (e) {
        console.warn('fetch server list from api failed, use fallback', e);
        // 降级到模拟数据
        const list = [
          { id: '1', name: '美食1服', status: '推荐', online: 1250 },
          { id: '2', name: '美食2服', status: '顺畅', online: 980 },
          { id: '3', name: '美食3服', status: '顺畅', online: 870 },
          { id: '4', name: '美食4服', status: '顺畅', online: 760 },
          { id: '5', name: '美食5服', status: '爆满', online: 2000 },
          { id: '17', name: '美食17服', status: '推荐', online: 1560 },
        ];
        commit('SET_SERVER_LIST', list);
        return list;
      }
    },

    // 获取存档
    async fetchSave({ commit }) {
      const result = await getSave();
      commit('SET_SAVE', result.save || result);
      return result;
    },
  },
  getters: {
    isAuthenticated: (state) => !!state.token,
    currentUser: (state) => state.user,
    currentSave: (state) => state.save,
  },
});
