<template>
  <view class="page">
    <!-- 自定义导航栏 -->
    <view class="navbar">
      <text class="navbar-back" @tap="onBack">◀</text>
      <text class="navbar-title">七日之约</text>
      <view class="navbar-spacer"></view>
    </view>

    <scroll-view class="scroll" scroll-y="true" show-scrollbar="false">
      <view class="content">

        <!-- 进度条 -->
        <view class="progress-section">
          <text class="progress-title">已连续登录 {{ loginDays }} 天</text>
          <view class="progress-bar-container">
            <view class="progress-bar" :style="{ width: progressPercent + '%' }"></view>
          </view>
          <text class="progress-text">{{ progressCurrent }} / {{ progressTotal }}</text>
        </view>

        <!-- 七日奖励列表 -->
        <view class="day-list">
          <view
            v-for="(d, i) in days"
            :key="d.day"
            class="day-card"
            :class="{claimed: d.claimed, locked: d.locked, today: d.today}"
            @tap="() => onClaim(d)"
          >
            <view class="day-number">{{ d.day }}</view>
            <view class="day-content">
              <text class="day-title">第{{ d.day }}天奖励</text>
              <view class="day-rewards">
                <text v-for="(r, j) in d.rewards" :key="j" class="reward-chip">{{ r }}</text>
              </view>
            </view>
            <view class="day-action">
              <text v-if="d.claimed" class="status-claimed">已领取</text>
              <text v-else-if="d.locked" class="status-locked">未达成</text>
              <button v-else class="btn-claim">领取</button>
            </view>
          </view>
        </view>

        <!-- 追加奖励入口 -->
        <view class="extra-entry" @tap="onExtra">
          <text class="extra-text">查看七日之约-限时追加奖励 ▸</text>
        </view>

      </view>
    </scroll-view>
  </view>
</template>

<script setup>
import { ref } from 'vue';

const loginDays = ref(7);
const progressCurrent = ref(7);
const progressTotal = ref(7);
const progressPercent = ref(100);

const days = ref([
  { day: 1, rewards: ['食灵契约 × 10', '金币 × 50000'], claimed: true, locked: false, today: false },
  { day: 2, rewards: ['食灵契约 × 10', '食灵精华 × 100'], claimed: true, locked: false, today: false },
  { day: 3, rewards: ['冬阴功', '食灵契约 × 50', '食灵精华 × 100', '灵味原浆 × 30000'], claimed: true, locked: false, today: false },
  { day: 4, rewards: ['史诗装备 × 1', '金币 × 100000'], claimed: true, locked: false, today: false },
  { day: 5, rewards: ['食灵契约 × 2', '食灵精华 × 150000'], claimed: true, locked: false, today: false },
  { day: 6, rewards: ['食灵契约 × 2', '食灵精华 × 500'], claimed: true, locked: false, today: false },
  { day: 7, rewards: ['拉菲', '食灵契约 × 5'], claimed: false, locked: false, today: true }
]);

const onBack = () => { uni.navigateBack(); };

const onClaim = (d) => {
  if (d.claimed) {
    uni.showToast({ title: '已领取', icon: 'none' });
    return;
  }
  if (d.locked) {
    uni.showToast({ title: '未达成领取条件', icon: 'none' });
    return;
  }
  d.claimed = true;
  uni.showToast({ title: '奖励已发放', icon: 'success' });
};

const onExtra = () => {
  uni.navigateTo({ url: '/pages/seven-extra/seven-extra' });
};
</script>

<style scoped>
.page { width: 100vw; min-height: 100vh; background-color: #0F0E1D; position: relative; }
.navbar {
  position: fixed; top: 0; left: 0; right: 0; height: 88rpx;
  display: flex; align-items: center; padding: 0 32rpx;
  background-color: #16152A; border-bottom: 1rpx solid #2A293E; z-index: 100; box-sizing: border-box;
}
.navbar-back { font-size: 36rpx; color: #FFFFFF; }
.navbar-title { font-size: 34rpx; font-weight: 600; color: #FFFFFF; margin-left: 40rpx; }
.navbar-spacer { flex: 1; }
.scroll { height: 100vh; padding-top: 88rpx; padding-bottom: 100rpx; box-sizing: border-box; }
.content { padding: 0 48rpx; box-sizing: border-box; }
.progress-section {
  background: rgba(255,255,255,0.04); border: 1rpx solid #2A293E;
  border-radius: 24rpx; padding: 32rpx; margin-bottom: 30rpx; text-align: center;
}
.progress-title { font-size: 30rpx; color: #FFFFFF; font-weight: 700; margin-bottom: 16rpx; }
.progress-bar-container {
  width: 100%; max-width: 500rpx; margin: 0 auto 12rpx auto;
  height: 16rpx; background: #2A293E; border-radius: 8rpx; overflow: hidden;
}
.progress-bar { height: 100%; background: linear-gradient(90deg, #E0D3A1, #C9B87E); border-radius: 8rpx; }
.progress-text { font-size: 24rpx; color: #B8B8C8; }
.day-list { display: flex; flex-direction: column; gap: 16rpx; }
.day-card {
  display: flex; justify-content: space-between; align-items: center;
  background: rgba(255,255,255,0.04); border: 1rpx solid #2A293E;
  border-radius: 20rpx; padding: 20rpx 32rpx;
}
.day-card.today { border-color: #E0D3A1; background: rgba(224,211,161,0.1); }
.day-card.claimed { border-color: #4CAF50; background: rgba(76,175,80,0.08); opacity: 0.85; }
.day-card.locked { opacity: 0.6; }
.day-number {
  width: 60rpx; height: 60rpx; line-height: 60rpx; text-align: center;
  background: #1A192E; border-radius: 30rpx; font-size: 28rpx; color: #E0D3A1;
  font-weight: 700; flex-shrink: 0;
}
.day-card.today .day-number { background: #E0D3A1; color: #0F0E1D; }
.day-content { flex: 1; margin: 0 24rpx; }
.day-title { font-size: 28rpx; color: #FFFFFF; font-weight: 600; margin-bottom: 8rpx; }
.day-rewards { display: flex; gap: 12rpx; flex-wrap: wrap; }
.reward-chip {
  font-size: 20rpx; color: #B8B8C8; background: rgba(255,255,255,0.06);
  padding: 4rpx 10rpx; border-radius: 10rpx; border: 1rpx solid #2A293E;
}
.day-action { display: flex; align-items: center; gap: 12rpx; }
.status-claimed { font-size: 26rpx; color: #4CAF50; font-weight: 600; }
.status-locked { font-size: 26rpx; color: #8A8A9E; font-weight: 600; }
.btn-claim {
  width: 120rpx; height: 56rpx; line-height: 56rpx;
  background: linear-gradient(135deg, #E0D3A1 0%, #C9B87E 100%);
  color: #0F0E1D; font-size: 24rpx; font-weight: 700; border-radius: 28rpx;
  flex-shrink: 0;
}
.extra-entry {
  margin-top: 30rpx; text-align: center;
}
.extra-text { font-size: 26rpx; color: #E0D3A1; }
</style>