<!-- componentized -->
<template>
  <view class="page">
        <custom-navbar title="恭喜升级" :show-back="true" @back="onBack" />

    <scroll-view class="scroll" scroll-y="true" show-scrollbar="false">
      <view class="content">
        <view class="level-card">
          <text class="level-title">主角升级啦！</text>
          <view class="level-change">
            <text class="old-level">Lv.{{ oldLevel }}</text>
            <text class="arrow">→</text>
            <text class="new-level">Lv.{{ newLevel }}</text>
          </view>
          <text class="level-desc">功能解锁预告：{{ unlockFunc }}</text>
        </view>
        <view class="reward-list">
          <view v-for="(r, i) in levelRewards" :key="i" class="reward-item">
            <text class="reward-icon">{{ r.icon }}</text>
            <text class="reward-name">{{ r.name }} × {{ r.amount }}</text>
          </view>
        </view>
        <view class="action-section">
          <base-button class="btn-continue" @tap="onContinue">继续冒险</base-button>
        </view>
      </view>
    </scroll-view>
  </view>
</template>

<script setup>
import CustomNavbar from '@/pages/components/CustomNavbar.vue';
import BaseButton from '@/pages/components/BaseButton.vue';
import { ref } from 'vue';
const oldLevel = ref(9);
const newLevel = ref(10);
const unlockFunc = ref('世界树功能已解锁');
const levelRewards = [
  { icon: '📖', name: '食灵契约', amount: 10 },
  { icon: '💰', name: '金币', amount: 200000 },
  { icon: '⚡', name: '食灵精华', amount: 500 }
];
const onBack = () => uni.navigateBack();
const onContinue = () => {
  uni.showToast({ title: '返回主城', icon: 'none' });
  uni.navigateBack();
};
</script>

<style scoped>
.page { width: 100vw; min-height: 100vh; background: #0F0E1D; }
.scroll { height: 100vh; padding-top: 88rpx; padding-bottom: 100rpx; box-sizing: border-box; }
.content { padding: 0 48rpx; box-sizing: border-box; display: flex; flex-direction: column; align-items: center; justify-content: center; min-height: 100%; }
.level-card { background: linear-gradient(135deg, rgba(224,211,161,0.15) 0%, rgba(201,184,126,0.08) 100%); border: 1rpx solid rgba(224,211,161,0.3); border-radius: 24rpx; padding: 48rpx 32rpx; text-align: center; margin-bottom: 40rpx; width: 640rpx; }
.level-title { font-size: 40rpx; color: #E0D3A1; font-weight: 800; margin-bottom: 24rpx; }
.level-change { display: flex; align-items: center; justify-content: center; gap: 16rpx; margin-bottom: 20rpx; }
.old-level { font-size: 32rpx; color: #8A8A9E; }
.arrow { font-size: 32rpx; color: #E0D3A1; font-weight: 700; }
.new-level { font-size: 48rpx; color: #FFFFFF; font-weight: 800; }
.level-desc { font-size: 26rpx; color: #B8B8C8; margin-top: 16rpx; }
.reward-list { display: flex; flex-direction: column; gap: 14rpx; width: 100%; max-width: 640rpx; margin-bottom: 40rpx; }
.reward-item { display: flex; align-items: center; gap: 16rpx; font-size: 26rpx; color: #FFFFFF; }
.reward-icon { font-size: 32rpx; flex-shrink: 0; }
.reward-name { color: #E0D3A1; font-weight: 600; }
.action-section { width: 100%; }
.btn-continue { width: 600rpx; height: 96rpx; line-height: 96rpx; background: linear-gradient(135deg, #E0D3A1 0%, #C9B87E 100%); color: #0F0E1D; font-size: 34rpx; font-weight: 700; border-radius: 48rpx; box-shadow: 0 8rpx 24rpx rgba(224,211,161,0.3); }
.btn-continue:active { transform: scale(0.96); opacity: 0.85; }
</style>