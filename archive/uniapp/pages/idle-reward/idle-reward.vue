<template>
  <view class="page">
    <view class="navbar">
      <text class="navbar-back" @tap="onBack">◀</text>
      <text class="navbar-title">补给收益</text>
      <view class="navbar-spacer"></view>
    </view>
    <scroll-view class="scroll" scroll-y="true" show-scrollbar="false">
      <view class="content">
        <view class="section-title">挂机收益结算</text>
        <view class="idle-card">
          <text class="idle-time">{{ offlineTime }}</text>
          <text class="idle-label">离线挂机时长</text>
        </view>
        <view class="reward-list">
          <view v-for="(r, i) in rewards" :key="i" class="reward-item">
            <text class="reward-icon">{{ r.icon }}</text>
            <text class="reward-name">{{ r.name }} × {{ r.amount }}</text>
          </view>
        </view>
        <view class="action-section">
          <button class="btn-claim" @tap="onClaim">全部领取</button>
        </view>
      </view>
    </scroll-view>
  </view>
</template>

<script setup>
import { ref } from 'vue';
const offlineTime = ref('4小时 23分钟');
const rewards = [
  { icon: '💰', name: '金币', amount: 1200000 },
  { icon: '📖', name: '食灵契约', amount: 5 },
  { icon: '⚡', name: '食灵精华', amount: 800 }
];
const onBack = () => uni.navigateBack();
const onClaim = () => {
  uni.showToast({ title: '收益已发放到邮箱', icon: 'success' });
  uni.navigateBack();
};
</script>

<style scoped>
.page { width: 100vw; min-height: 100vh; background: #0F0E1D; }
.navbar { position: fixed; top: 0; left: 0; right: 0; height: 88rpx; display: flex; align-items: center; padding: 0 32rpx; background: #16152A; border-bottom: 1rpx solid #2A293E; z-index: 100; box-sizing: border-box; }
.navbar-back { font-size: 36rpx; color: #FFFFFF; }
.navbar-title { font-size: 34rpx; font-weight: 600; color: #FFFFFF; margin-left: 40rpx; }
.navbar-spacer { flex: 1; }
.scroll { height: 100vh; padding-top: 88rpx; padding-bottom: 100rpx; box-sizing: border-box; }
.content { padding: 0 48rpx; box-sizing: border-box; display: flex; flex-direction: column; align-items: center; justify-content: center; min-height: 100%; }
.section-title { font-size: 32rpx; color: #FFFFFF; font-weight: 700; margin-bottom: 8rpx; }
.idle-card { background: rgba(255,255,255,0.04); border: 1rpx solid #2A293E; border-radius: 24rpx; padding: 40rpx 32rpx; text-align: center; margin: 30rpx 0 40rpx 0; width: 640rpx; }
.idle-time { font-size: 44rpx; color: #E0D3A1; font-weight: 700; margin-bottom: 12rpx; }
.idle-label { font-size: 26rpx; color: #B8B8C8; }
.reward-list { display: flex; flex-direction: column; gap: 16rpx; width: 100%; max-width: 640rpx; margin-bottom: 40rpx; }
.reward-item { display: flex; align-items: center; gap: 16rpx; font-size: 26rpx; color: #FFFFFF; }
.reward-icon { font-size: 32rpx; flex-shrink: 0; }
.reward-name { color: #E0D3A1; font-weight: 600; }
.action-section { width: 100%; }
.btn-claim { width: 600rpx; height: 96rpx; line-height: 96rpx; background: linear-gradient(135deg, #E0D3A1 0%, #C9B87E 100%); color: #0F0E1D; font-size: 34rpx; font-weight: 700; border-radius: 48rpx; box-shadow: 0 8rpx 24rpx rgba(224,211,161,0.3); }
.btn-claim:active { transform: scale(0.96); opacity: 0.85; }
</style>