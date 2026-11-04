<template>
  <view class="page">
    <!-- 自定义导航栏 -->
    <view class="navbar">
      <text class="navbar-back" @tap="onBack">◀</text>
      <text class="navbar-title">选择服务器</text>
      <view class="navbar-spacer"></view>
    </view>

    <!-- 页面主体 -->
    <scroll-view class="scroll-content" scroll-y="true" show-scrollbar="false">
      <view class="content-wrapper">

        <!-- 服务器列表标题 -->
        <view class="section-title">请选择游戏服务器</view>

        <!-- 服务器卡片列表 -->
        <view class="server-list">
          <view
            v-for="server in serverList"
            :key="server.id"
            class="server-card"
            :class="{selected: selectedServerId === server.id, full: server.status === '爆满', maintenance: server.status === '维护'}"
            @tap="() => onSelectServer(server)"
          >
            <!-- 服务器名称 -->
            <view class="server-info">
              <text class="server-name">{{ server.name }}</text>
              <text class="server-status" :class="`status-${server.status}`">{{ server.status }}</text>
            </view>

            <!-- 右侧：在线人数 + 已有角色标记 -->
            <view class="server-right">
              <text class="online-count">{{ server.online }}人在线</text>
              <view v-if="server.hasRole" class="role-tag">已有角色</view>
            </view>
          </view>
        </view>

        <!-- 提示文本 -->
        <view class="hint-text">
          选择后将进入该服务器的游戏主城，不同服务器数据不互通。
        </view>

      </view>
    </scroll-view>
  </view>
</template>

<script setup>
import { ref, onLoad } from 'vue';
import { useStore } from 'vuex';

const store = useStore();

// 服务器列表数据（与启动页 OCR 识别内容一致）
const serverList = ref([
  { id: '1', name: '美食1服', status: '推荐', online: 1250, hasRole: false },
  { id: '2', name: '美食2服', status: '顺畅', online: 980, hasRole: false },
  { id: '3', name: '美食3服', status: '顺畅', online: 870, hasRole: false },
  { id: '4', name: '美食4服', status: '顺畅', online: 760, hasRole: false },
  { id: '5', name: '美食5服', status: '爆满', online: 2000, hasRole: false },
  { id: '17', name: '美食17服', status: '推荐', online: 1560, hasRole: true }
]);

const selectedServerId = ref(null);

// 当前选中的服务器（供提交用）
const selectedServer = ref(null);

onLoad(() => {
  // 恢复之前选择的服务器
  const saved = uni.getStorageSync('selected_server');
  if (saved) {
    const found = serverList.value.find(s => s.name === saved);
    if (found) {
      selectedServerId.value = found.id;
      selectedServer.value = found;
    }
  }

  // 同步到 store
  store.dispatch('fetchServerList').then(list => {
    // 后端数据可在此合并覆盖
  });
});

// 选择服务器
const onSelectServer = (server) => {
  if (server.status === '维护') {
    uni.showToast({ title: '该服务器维护中，请选择其他服务器', icon: 'none' });
    return;
  }
  selectedServerId.value = server.id;
  selectedServer.value = server;

  // 持久化选择
  uni.setStorageSync('selected_server', server.name);
  store.commit('SET_SELECTED_SERVER', server);

  uni.showToast({ title: `已选择 ${server.name}`, icon: 'none' });
};

// 返回上一页
const onBack = () => {
  uni.navigateBack();
};
</script>

<style scoped>
.page {
  width: 100vw;
  min-height: 100vh;
  background-color: #0F0E1D;
  position: relative;
}

.navbar {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  height: 88rpx;
  display: flex;
  align-items: center;
  padding: 0 32rpx;
  background-color: #16152A;
  border-bottom: 1rpx solid #2A293E;
  z-index: 100;
  box-sizing: border-box;
}

.navbar-back {
  font-size: 36rpx;
  color: #FFFFFF;
}

.navbar-title {
  font-size: 34rpx;
  font-weight: 600;
  color: #FFFFFF;
  margin-left: 40rpx;
}

.navbar-spacer {
  flex: 1;
}

.scroll-content {
  height: 100vh;
  padding-top: 88rpx;
  padding-bottom: 100rpx;
  box-sizing: border-box;
}

.content-wrapper {
  padding: 0 48rpx;
  box-sizing: border-box;
}

.section-title {
  font-size: 32rpx;
  font-weight: 600;
  color: #FFFFFF;
  margin-top: 40rpx;
  margin-bottom: 32rpx;
}

.server-list {
  display: flex;
  flex-direction: column;
  gap: 20rpx;
}

.server-card {
  display: flex;
  align-items: center;
  justify-content: space-between;
  background-color: rgba(255, 255, 255, 0.04);
  border: 1rpx solid #2A293E;
  border-radius: 20rpx;
  padding: 24rpx 32rpx;
  height: 110rpx;
  box-sizing: border-box;
  transition: all 0.2s;
}

.server-card:active {
  background-color: rgba(255, 255, 255, 0.08);
}

.server-card.selected {
  border-color: #E0D3A1;
  background-color: rgba(224, 211, 161, 0.1);
}

.server-card.full {
  opacity: 0.6;
}

.server-card.maintenance {
  opacity: 0.5;
}

.server-info {
  display: flex;
  align-items: center;
  gap: 16rpx;
}

.server-name {
  font-size: 32rpx;
  color: #FFFFFF;
  font-weight: 600;
}

.server-status {
  font-size: 26rpx;
  padding: 2rpx 16rpx;
  border-radius: 12rpx;
  font-weight: 600;
}

.status-推荐 {
  color: #E0D3A1;
  border: 1rpx solid rgba(224, 211, 161, 0.3);
  background: rgba(224, 211, 161, 0.1);
}

.status-顺畅 {
  color: #4CAF50;
  border: 1rpx solid rgba(76, 175, 80, 0.3);
  background: rgba(76, 175, 80, 0.1);
}

.status-爆满 {
  color: #E5484D;
  border: 1rpx solid rgba(229, 72, 77, 0.3);
  background: rgba(229, 72, 77, 0.1);
}

.status-维护 {
  color: #B8B8C8;
  border: 1rpx solid rgba(184, 184, 200, 0.3);
  background: rgba(184, 184, 200, 0.1);
}

.server-right {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 8rpx;
}

.online-count {
  font-size: 26rpx;
  color: #B8B8C8;
}

.role-tag {
  font-size: 22rpx;
  color: #E0D3A1;
  background: rgba(224, 211, 161, 0.15);
  border: 1rpx solid rgba(224, 211, 161, 0.3);
  border-radius: 10rpx;
  padding: 2rpx 12rpx;
}

.hint-text {
  font-size: 26rpx;
  color: #8A8A9E;
  text-align: center;
  margin-top: 60rpx;
  line-height: 1.5;
}
</style>
