<!-- componentized -->
<template>
  <view class="page">
        <custom-navbar title="通关奖励" :show-back="true" @back="onBack" />

    <scroll-view class="scroll" scroll-y="true" show-scrollbar="false">
      <view class="content">
        <view class="result-card">
          <text class="result-title">通关赠礼</text>
          <text class="result-desc">恭喜通关主线关卡，获得以下奖励</text>
          <view class="reward-list">
            <view v-for="(r, i) in rewards" :key="i" class="reward-item">
              <text class="reward-icon">{{ r.icon }}</text>
              <text class="reward-name">{{ r.name }} × {{ r.amount }}</text>
            </view>
          </view>
        </view>
        <view class="action-section">
          <base-button class="btn-claim" @tap="onClaim">领取奖励</base-button>
        </view>
      </view>
    </scroll-view>
  </view>
</template>

<script setup>
import CustomNavbar from '@/pages/components/CustomNavbar.vue';
import BaseButton from '@/pages/components/BaseButton.vue';
const rewards = [
  { icon: '📖', name: '食灵契约', amount: 10 },
  { icon: '💰', name: '金币', amount: 500000 },
  { icon: '⚡', name: '食灵精华', amount: 2000 }
];
const onBack = () => uni.navigateBack();
const onClaim = () => {
  uni.showToast({ title: '奖励已发放到邮箱', icon: 'success' });
  uni.navigateBack();
};
</script>

<style scoped>
.page { width: 100vw; min-height: 100vh; background: #0F0E1D; }
.scroll { height: 100vh; padding-top: 88rpx; padding-bottom: 100rpx; box-sizing: border-box; }
.content { padding: 0 48rpx; box-sizing: border-box; display: flex; flex-direction: column; align-items: center; justify-content: center; min-height: 100%; }
.result-card { background: rgba(255,255,255,0.04); border: 1rpx solid #2A293E; border-radius: 24rpx; padding: 40rpx 32rpx; text-align: center; margin-bottom: 40rpx; width: 640rpx; }
.result-title { font-size: 36rpx; color: #E0D3A1; font-weight: 700; margin-bottom: 16rpx; }
.result-desc { font-size: 26rpx; color: #B8B8C8; margin-bottom: 30rpx; }
.reward-list { display: flex; flex-direction: column; gap: 16rpx; margin-bottom: 30rpx; }
.reward-item { display: flex; align-items: center; gap: 16rpx; font-size: 26rpx; color: #FFFFFF; }
.reward-icon { font-size: 32rpx; flex-shrink: 0; }
.reward-name { color: #E0D3A1; font-weight: 600; }
.action-section { width: 100%; }
.btn-claim { width: 600rpx; height: 96rpx; line-height: 96rpx; background: linear-gradient(135deg, #E0D3A1 0%, #C9B87E 100%); color: #0F0E1D; font-size: 34rpx; font-weight: 700; border-radius: 48rpx; box-shadow: 0 8rpx 24rpx rgba(224,211,161,0.3); }
.btn-claim:active { transform: scale(0.96); opacity: 0.85; }
</style>