<template>
  <view class="page">
    <view class="navbar">
      <text class="navbar-back" @tap="onBack">◀</text>
      <text class="navbar-title">战斗结果</text>
      <view class="navbar-spacer"></view>
    </view>
    <scroll-view class="scroll" scroll-y="true" show-scrollbar="false">
      <view class="content">
        <view class="result-banner" :class="{victory: isVictory}">
          <text class="result-text">{{ isVictory ? '胜利' : '失败' }}</text>
        </view>
        <view class="section-title">战斗结算</text>
        <view class="mvp-card">
          <text class="mvp-label">MVP</text>
          <view class="mvp-avatar">{{ mvp.icon }}</text>
          <text class="mvp-name">{{ mvp.name }}</text>
          <text class="mvp-damage">伤害 {{ mvp.damage }} / 治疗 {{ mvp.heal }}</text>
        </view>
        <view class="reward-list">
          <view v-for="(r, i) in rewards" :key="i" class="reward-item">
            <text class="reward-icon">{{ r.icon }}</text>
            <text class="reward-name">{{ r.name }} × {{ r.amount }}</text>
          </view>
        </view>
        <view class="action-section">
          <button class="btn-again" @tap="onAgain">再次挑战</button>
          <button class="btn-back" @tap="onBack">返回</button>
        </view>
      </view>
    </scroll-view>
  </view>
</template>

<script setup>
import { ref } from 'vue';
const isVictory = ref(true);
const mvp = { name: '冬阴功', icon: '🍲', damage: 12500, heal: 0 };
const rewards = [
  { icon: '📖', name: '食灵契约', amount: 5 },
  { icon: '💰', name: '金币', amount: 300000 },
  { icon: '⚡', name: '食灵精华', amount: 800 }
];
const onBack = () => uni.navigateBack();
const onAgain = () => {
  uni.showToast({ title: '再次挑战开发中', icon: 'none' });
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
.result-banner { font-size: 56rpx; font-weight: 800; margin: 60rpx 0 30rpx 0; }
.result-banner.victory { color: #4CAF50; text-shadow: 0 0 30rpx rgba(76,175,80,0.4); }
.result-banner:not(.victory) { color: #E5484D; text-shadow: 0 0 30rpx rgba(229,72,77,0.4); }
.section-title { font-size: 32rpx; color: #FFFFFF; font-weight: 700; margin-bottom: 24rpx; }
.mvp-card { background: rgba(255,255,255,0.04); border: 1rpx solid #2A293E; border-radius: 24rpx; padding: 32rpx; text-align: center; margin-bottom: 30rpx; width: 640rpx; }
.mvp-label { font-size: 24rpx; color: #E0D3A1; margin-bottom: 12rpx; display: block; }
.mvp-avatar { font-size: 64rpx; margin-bottom: 10rpx; }
.mvp-name { font-size: 30rpx; color: #FFFFFF; font-weight: 700; margin-bottom: 8rpx; }
.mvp-damage { font-size: 24rpx; color: #B8B8C8; }
.reward-list { display: flex; flex-direction: column; gap: 14rpx; width: 100%; max-width: 640rpx; margin-bottom: 40rpx; }
.reward-item { display: flex; align-items: center; gap: 16rpx; font-size: 26rpx; color: #FFFFFF; }
.reward-icon { font-size: 32rpx; flex-shrink: 0; }
.reward-name { color: #E0D3A1; font-weight: 600; }
.action-section { width: 100%; display: flex; gap: 20rpx; }
.btn-again, .btn-back {
  flex: 1; height: 96rpx; line-height: 96rpx;
  font-size: 32rpx; font-weight: 700; border-radius: 48rpx;
}
.btn-again { background: linear-gradient(135deg, #E0D3A1 0%, #C9B87E 100%); color: #0F0E1D; box-shadow: 0 8rpx 24rpx rgba(224,211,161,0.3); }
.btn-back { background: rgba(255,255,255,0.06); border: 1rpx solid #2A293E; color: #FFFFFF; }
.btn-again:active { transform: scale(0.96); opacity: 0.85; }
.btn-back:active { background: rgba(255,255,255,0.12); }
</style>