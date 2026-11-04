<template>
  <view class="page">
    <!-- 自定义顶部栏：玩家信息 -->
    <view class="top-bar">
      <view class="player-info">
        <text class="player-name">{{ playerName }}</text>
        <text class="player-power">战力 {{ power }}</text>
      </view>
      <view class="res-bar">
        <view class="res-item"><avatar-icon placeholder-char="💎" :size="'sm'" :shape="'circle'" /><text class="res-num">{{ gems }}</text></view>
        <view class="res-item"><avatar-icon placeholder-char="📖" :size="'sm'" :shape="'circle'" /><text class="res-num">{{ books }}</text></view>
        <view class="res-item"><avatar-icon placeholder-char="🍂" :size="'sm'" :shape="'circle'" /><text class="res-num">{{ leaves }}</text></view>
      </view>
    </view>

    <!-- 主城中间场景 -->
    <scroll-view class="main-scroll" scroll-y="true" show-scrollbar="false">
      <view class="main-content">

        <!-- 小助手引导对话 -->
        <view v-if="showGuide" class="guide-bubble">
          <view class="guide-avatar">👼</view>
          <view class="guide-text">
            <text class="guide-name">小助手</text>
            <text class="guide-content">{{ guideText }}</text>
          </view>
          <view class="guide-next" @tap="nextGuide">点击继续 ▸</view>
        </view>

        <!-- 左侧功能栏 -->
        <view class="rail left-rail">
          <view class="rail-item" v-for="item in leftItems" :key="item.id" @tap="onLeftTap(item)">
            <avatar-icon :placeholder-char="item.icon" :size="'md'" :shape="'circle'" />
            <text class="rail-label">{{ item.label }}</text>
          </view>
        </view>

        <!-- 右侧功能栏 -->
        <view class="rail right-rail">
          <view class="rail-item" v-for="item in rightItems" :key="item.id" @tap="onRightTap(item)">
            <avatar-icon :placeholder-char="item.icon" :size="'md'" :shape="'circle'" />
            <text class="rail-label">{{ item.label }}</text>
          </view>
        </view>

        <!-- 底部导航 -->
        <view class="bottom-nav">
          <view
            v-for="tab in bottomTabs"
            :key="tab.id"
            class="nav-tab"
            :class="{active: activeTab === tab.id}"
            @tap="activeTab = tab.id"
          >
            <avatar-icon :placeholder-char="tab.icon" :size="'md'" :shape="'circle'" />
            <text class="nav-label">{{ tab.label }}</text>
          </view>
        </view>

      </view>
    </scroll-view>
  </view>
</template>

<script setup>
import { ref } from 'vue';
import AvatarIcon from '@/pages/components/AvatarIcon.vue';

const playerName = ref('命运之子');
const power = ref(0);
const gems = ref(50000);
const books = ref(100);
const leaves = ref(300);
const showGuide = ref(true);
const guideIndex = ref(0);
const activeTab = ref('lobby');

const guideTexts = [
  '现在的灵界大陆充满危机，拯救世界也将困难重重。',
  '我们需要更多食灵的帮助，现在就去召唤他们吧！',
  '点击底部“食灵”按钮，开始你的第一次召唤。'
];

const guideText = ref(guideTexts[0]);

const leftItems = [
  { id: 'chat', label: '聊天', icon: '💬' },
  { id: 'mail', label: '邮件', icon: '📬' },
  { id: 'quest', label: '任务', icon: '📋' },
  { id: 'record', label: '录像', icon: '🎬' },
  { id: 'ranking', label: '排行', icon: '🏆' },
  { id: 'friend', label: '好友', icon: '👥' }
];

const rightItems = [
  { id: 'bag', label: '背包', icon: '🎒' },
  { id: 'workshop', label: '研制坊', icon: '🔧' },
  { id: 'timehouse', label: '时光屋', icon: '⏳' },
  { id: 'market', label: '集市', icon: '🏪' },
  { id: 'astrology', label: '占星', icon: '🔮' },
  { id: 'worldtree', label: '世界树', icon: '🌳' }
];

const bottomTabs = [
  { id: 'lobby', label: '大厅', icon: '🏠' },
  { id: 'collection', label: '食灵', icon: '👥' },
  { id: 'hero', label: '主角', icon: '🧙‍♂️' },
  { id: 'manor', label: '庄园', icon: '🏰' },
  { id: 'guild', label: '协会', icon: '🏛️' },
  { id: 'battle', label: '副本', icon: '⚔️' }
];

const nextGuide = () => {
  guideIndex.value++;
  if (guideIndex.value >= guideTexts.length) {
    showGuide.value = false;
  } else {
    guideText.value = guideTexts[guideIndex.value];
  }
};

const onLeftTap = (item) => {
  uni.showToast({ title: `功能[${item.label}]开发中]`, icon: 'none' });
};

const onRightTap = (item) => {
  uni.showToast({ title: `功能[${item.label}]开发中]`, icon: 'none' });
};
</script>

<style scoped>
.page { width: 100vw; min-height: 100vh; background-color: #0F0E1D; position: relative; }
.top-bar {
  position: fixed; top: 0; left: 0; right: 0; height: 100rpx;
  display: flex; justify-content: space-between; align-items: center;
  padding: 0 32rpx; background: #16152A; border-bottom: 1rpx solid #2A293E; z-index: 100; box-sizing: border-box;
}
.player-info { display: flex; flex-direction: column; gap: 4rpx; }
.player-name { font-size: 30rpx; color: #FFFFFF; font-weight: 600; }
.player-power { font-size: 24rpx; color: #E0D3A1; }
.res-bar { display: flex; gap: 24rpx; }
.res-item { display: flex; align-items: center; gap: 8rpx; background: rgba(255,255,255,0.06); padding: 6rpx 16rpx; border-radius: 20rpx; border: 1rpx solid #2A293E; }
.res-num { font-size: 26rpx; color: #FFFFFF; }
.main-scroll { height: 100vh; padding-top: 100rpx; padding-bottom: 120rpx; box-sizing: border-box; }
.main-content { padding: 0 32rpx; box-sizing: border-box; min-height: 100%; display: flex; flex-direction: column; gap: 30rpx; }
.guide-bubble {
  display: flex; align-items: flex-start; gap: 16rpx;
  background: rgba(224,211,161,0.1); border: 1rpx solid rgba(224,211,161,0.3);
  border-radius: 24rpx; padding: 24rpx; margin-bottom: 20rpx;
}
.guide-avatar { font-size: 48rpx; flex-shrink: 0; }
.guide-text { flex: 1; display: flex; flex-direction: column; gap: 6rpx; }
.guide-name { font-size: 28rpx; color: #E0D3A1; font-weight: 600; }
.guide-content { font-size: 28rpx; color: #FFFFFF; line-height: 1.5; }
.guide-next { margin-top: 10rpx; align-self: flex-end; font-size: 26rpx; color: #E0D3A1; }
.rail {
  position: absolute; top: 140rpx; bottom: 140rpx; width: 90rpx;
  display: flex; flex-direction: column; gap: 18rpx; padding-top: 20rpx;
}
.left-rail { left: 20rpx; }
.right-rail { right: 20rpx; }
.rail-item {
  display: flex; flex-direction: column; align-items: center; gap: 6rpx;
  padding: 14rpx; border: 1rpx solid #2A293E; border-radius: 16rpx;
  background: rgba(255,255,255,0.04);
}
.rail-item:active { background: rgba(255,255,255,0.08); }
.rail-label { font-size: 20rpx; color: #B8B8C8; white-space: nowrap; }
.bottom-nav {
  position: fixed; bottom: 0; left: 0; right: 0; height: 100rpx;
  display: flex; justify-content: space-around; align-items: center;
  background: #1A192E; border-top: 1rpx solid #2A293E; z-index: 50;
}
.nav-tab { display: flex; flex-direction: column; align-items: center; gap: 4rpx; padding: 0 20rpx; }
.nav-tab.active .nav-icon { color: #E0D3A1; }
.nav-tab.active .nav-label { color: #E0D3A1; font-weight: 600; }
.nav-icon { font-size: 34rpx; color: #8A8A9E; }
.nav-label { font-size: 22rpx; color: #8A8A9E; }
</style>