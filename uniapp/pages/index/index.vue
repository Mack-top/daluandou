<template>
  <view class="page">
    <!-- 背景装饰 -->
    <view class="bg-decor"></view>

    <!-- 顶部：适龄提示 + 切换账号 -->
    <view class="top-bar">
      <view class="age-tip">16+</view>
      <text class="switch-account" @tap="onSwitchAccount">切换账号</text>
    </view>

    <!-- 公告按钮（右上角） -->
    <view class="notice-btn" @tap="onNotice">
      <text>公告</text>
    </view>

    <!-- 中间主内容 -->
    <view class="main-content">
      <!-- 推荐标签 -->
      <view class="recommend-tag">推荐</view>

      <!-- 服务器选择区域 -->
      <view class="server-select" @tap="onSelectServer">
        <text class="server-label">美食17服</text>
        <text class="server-arrow">▾</text>
      </view>
      <text class="change-server" @tap="onChangeServer">点击换服</text>

      <!-- 开始游戏按钮 -->
      <base-button btn-type="primary" :disabled="!agreed" @tap="onStartGame">开始游戏</base-button>
    </view>

    <!-- 底部：协议勾选 -->
    <view class="bottom-area">
      <view class="agreement-row">
        <view class="checkbox" :class="{checked: isAgreed}" @tap="toggleAgree">
          <view class="check-icon-wrapper" v-if="isAgreed">
            <avatar-icon placeholder-char="✓" :size="'sm'" :shape="'circle'" />
          </view>
        </view>
        <text class="agreement-text">
          我已经详细阅读并同意
          <text class="agreement-link" @tap="onUserProtocol">游戏用户协议</text>
          和
          <text class="agreement-link" @tap="onPrivacyPolicy">隐私保护指引</text>
        </text>
      </view>
    </view>

    <!-- 底部法律文本 -->
    <view class="footer-texts">
      <text class="footer-line">抵制不良游戏，拒绝盗版游戏。注意自我保护，谨防受骗上当。</text>
      <text class="footer-line">适度游戏益脑，沉迷游戏伤身。合理安排时间，享受健康生活。</text>
      <text class="footer-line">本公司积极履行《网络游戏行业防沉迷自律公约》</text>
      <text class="footer-line">无锡长永网络科技有限公司　2019SR0911059</text>
      <text class="footer-line">杭州群游科技有限公司　北京运旺时盛科技有限公司</text>
      <text class="footer-line">国新出审[2021]418号　ISBN978-7-498-08884-0</text>
    </view>
  </view>
</template>

<script setup>
import { ref, onMounted } from 'vue';
import { useStore } from 'vuex';
import { guestLogin, fetchServerList } from '../../utils/api.js';
import BaseButton from '@/pages/components/BaseButton.vue';
import AvatarIcon from '@/pages/components/AvatarIcon.vue';

const store = useStore();

// 响应式协议勾选状态
const isAgreed = ref(false);

// 切换账号
const onSwitchAccount = () => {
  uni.showModal({
    title: '提示',
    content: '确定要切换账号吗？',
    success: (res) => {
      if (res.confirm) {
        store.commit('CLEAR_USER');
        uni.reLaunch({ url: '/pages/index/index' });
      }
    }
  });
};

// 公告
const onNotice = () => {
  uni.navigateTo({ url: '/pages/notice/notice' });
};

// 选择服务器（从后端获取列表）
const onSelectServer = async () => {
  try {
    uni.showLoading({ title: '加载中...' });
    const list = await store.dispatch('fetchServerList');
    uni.hideLoading();

    const itemList = list.map((s, i) => {
      const statusTag = s.maintenance ? '（维护）' : s.status === '爆满' ? '（爆满）' : s.status === '推荐' ? '（推荐）' : '';
      return `美食${s.id}服${statusTag}`;
    });

    uni.showActionSheet({
      itemList,
      success: (res) => {
        const selected = list[res.tapIndex];
        if (selected.maintenance) {
          uni.showToast({ title: '该服务器维护中，请选择其他服务器', icon: 'none' });
          return;
        }
        uni.setStorageSync('selected_server', `美食${selected.id}服`);
        store.commit('SET_SELECTED_SERVER', selected);
        uni.showToast({ title: `已选择：美食${selected.id}服`, icon: 'none' });
      }
    });
  } catch (e) {
    uni.hideLoading();
    uni.showToast({ title: '获取服务器列表失败', icon: 'none' });
  }
};

// 点击换服
const onChangeServer = () => {
  uni.navigateTo({ url: '/pages/server-list/server-list' });
};

// 开始游戏（调用后端游客登录 API）
const onStartGame = async () => {
  if (!isAgreed.value) {
    uni.showToast({ title: '请先勾选同意用户协议和隐私保护指引', icon: 'none' });
    return;
  }

  uni.showLoading({ title: '登录中...' });
  try {
    const savedServer = uni.getStorageSync('selected_server');
    const serverNum = savedServer ? Number(savedServer.replace('美食', '').replace('服', '')) : 17;

    const result = await guestLogin({
      nickname: '旅人',
      gender: 'male',
      server: serverNum,
    });

    uni.hideLoading();

    store.commit('SET_USER', {
      token: result.token,
      player: result.player,
    });
    store.commit('SET_SAVE', result.save);

    uni.redirectTo({ url: '/pages/lobby/lobby' });
  } catch (e) {
    uni.hideLoading();
    uni.showToast({ title: e.message || '登录失败', icon: 'none' });
  }
};

// 切换勾选状态
const toggleAgree = () => {
  isAgreed.value = !isAgreed.value;
};

// 查看用户协议
const onUserProtocol = () => {
  uni.navigateTo({ url: '/pages/protocol/protocol?type=user&fromIndex=true' });
};

// 查看隐私保护指引
const onPrivacyPolicy = () => {
  uni.navigateTo({ url: '/pages/protocol/protocol?type=privacy&fromIndex=true' });
};

onMounted(() => {
  // 恢复之前选择的服务器显示
  const saved = uni.getStorageSync('selected_server');
  if (saved) {
    const serverSelect = document.querySelector('.server-label');
    if (serverSelect) serverSelect.textContent = saved;
  }
});
</script>

<style scoped>
.page {
  width: 100vw;
  height: 100vh;
  min-height: 100vh;
  background-color: #0F0E1D;
  position: relative;
  overflow: hidden;
}

.bg-decor {
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background:
    radial-gradient(circle at 50% 40%, rgba(224, 211, 161, 0.08) 0%, transparent 40%),
    linear-gradient(180deg, #0F0E1D 0%, #16152A 100%);
  z-index: 0;
}

.top-bar {
  position: fixed;
  top: 20rpx;
  left: 0;
  right: 0;
  padding: 0 32rpx;
  display: flex;
  justify-content: space-between;
  align-items: center;
  z-index: 50;
}

.age-tip {
  font-size: 28rpx;
  color: #E0D3A1;
  font-weight: 700;
  padding: 4rpx 16rpx;
  background: rgba(224, 211, 161, 0.15);
  border-radius: 20rpx;
  border: 1rpx solid rgba(224, 211, 161, 0.3);
}

.switch-account {
  font-size: 28rpx;
  color: #FFFFFF;
}

.notice-btn {
  position: fixed;
  top: 20rpx;
  right: 32rpx;
  font-size: 28rpx;
  color: #B8B8C8;
  z-index: 50;
}

.main-content {
  position: relative;
  z-index: 10;
  padding: 0 48rpx;
  height: 100%;
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
}

.recommend-tag {
  font-size: 24rpx;
  color: #E0D3A1;
  margin-bottom: 24rpx;
}

.server-select {
  display: flex;
  align-items: center;
  gap: 12rpx;
  background: rgba(255, 255, 255, 0.06);
  border: 1rpx solid #2A293E;
  border-radius: 44rpx;
  padding: 0 32rpx;
  height: 88rpx;
  margin-bottom: 16rpx;
  width: 600rpx;
}

.server-label {
  font-size: 36rpx;
  color: #FFFFFF;
  font-weight: 600;
}

.server-arrow {
  font-size: 28rpx;
  color: #B8B8C8;
  margin-left: auto;
}

.change-server {
  font-size: 28rpx;
  color: #E0D3A1;
  margin-bottom: 48rpx;
}

.btn-start {
  width: 600rpx;
  height: 96rpx;
  line-height: 96rpx;
  background: linear-gradient(135deg, #E0D3A1 0%, #C9B87E 100%);
  color: #0F0E1D;
  font-size: 36rpx;
  font-weight: 700;
  border-radius: 48rpx;
  box-shadow: 0 8rpx 24rpx rgba(224, 211, 161, 0.3);
}

.btn-start:disabled {
  background: #2A293E;
  color: #666666;
  box-shadow: none;
}

.bottom-area {
  position: absolute;
  bottom: 200rpx;
  left: 0;
  right: 0;
  padding: 0 48rpx;
  z-index: 10;
}

.agreement-row {
  display: flex;
  align-items: center;
  gap: 16rpx;
  font-size: 26rpx;
  color: #B8B8C8;
}

.checkbox {
  width: 40rpx;
  height: 40rpx;
  border: 2rpx solid #2A293E;
  border-radius: 8rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.checkbox.checked {
  border-color: #E0D3A1;
  background-color: #E0D3A1;
}

.check-icon-wrapper {
  width: 28rpx; height: 28rpx; flex-shrink: 0;
}

.check-icon {
  color: #0F0E1D;
  font-weight: 700;
  font-size: 24rpx;
}

.agreement-link {
  color: #E0D3A1;
  text-decoration: underline;
}

.footer-texts {
  position: absolute;
  bottom: 40rpx;
  left: 0;
  right: 0;
  padding: 0 32rpx;
  display: flex;
  flex-direction: column;
  gap: 10rpx;
  align-items: center;
  z-index: 10;
}

.footer-line {
  font-size: 20rpx;
  color: #6A6A7A;
  line-height: 1.4;
  text-align: center;
  white-space: pre-line;
}
</style>
