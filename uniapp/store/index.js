import { createStore } from 'vuex';

const STORAGE_KEY = 'food_fantasy_user';

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
    token: loadAuth()?.token || null,
    serverList: [],
    selectedServer: null,
    isLoggedIn: !!loadAuth()?.token
  },
  mutations: {
    SET_USER(state, user) {
      state.user = user;
      state.token = user?.token || null;
      state.isLoggedIn = !!user?.token;
      if (user) saveAuth(user);
    },
    CLEAR_USER(state) {
      state.user = null;
      state.token = null;
      state.isLoggedIn = false;
      clearAuth();
    },
    SET_SERVER_LIST(state, list) {
      state.serverList = list;
    },
    SET_SELECTED_SERVER(state, server) {
      state.selectedServer = server;
    },
    SET_LOGGED_IN(state, flag) {
      state.isLoggedIn = flag;
    }
  },
  actions: {
    login({ commit }, user) {
      commit('SET_USER', user);
    },
    logout({ commit }) {
      commit('CLEAR_USER');
      uni.redirectTo({ url: '/pages/index/index' });
    },
    async fetchServerList({ commit }) {
      const list = [
        { id: '1', name: '美食1服', status: '推荐', online: 1250 },
        { id: '2', name: '美食2服', status: '顺畅', online: 980 },
        { id: '3', name: '美食3服', status: '顺畅', online: 870 },
        { id: '4', name: '美食4服', status: '顺畅', online: 760 },
        { id: '5', name: '美食5服', status: '爆满', online: 2000 },
        { id: '17', name: '美食17服', status: '推荐', online: 1560 }
      ];
      commit('SET_SERVER_LIST', list);
      return list;
    }
  },
  getters: {
    isAuthenticated: (state) => !!state.token,
    currentUser: (state) => state.user
  }
});
