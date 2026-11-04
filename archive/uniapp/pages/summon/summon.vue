<template>
  <view class="page">
    <view class="navbar">
      <text class="navbar-back" @tap="onBack">◀</text>
      <text class="navbar-title">食灵召唤</text>
      <view class="navbar-spacer"></view>
    </view>
    <scroll-view class="scroll" scroll-y="true" show-scrollbar="false">
      <view class="content">
        <view class="section-title">召唤卡池</text>
        <view class="pool-list">
          <view v-for="(p, i) in pools" :key="i" class="pool-card" :class="{active: activePool === i}" @tap="activePool = i">
            <text class="pool-name">{{ p.name }}</text>
            <text class="pool-desc">{{ p.desc }}</text>
            <text class="pool-cost">{{ p.cost }}</text>
          </view>
        </view>
        <view class="rate-info">
          <text class="rate-label">召唤概率：</text>
          <text class="rate-value">SSR 2% | SR 18% | R 80%</text>
        </view>
        <view class="action-section">
          <button class="btn-single" @tap="onSummon(1)">单次召唤</button>
          <button class="btn-ten" @tap="onSummon(10)">十连召唤</button>
        </view>
        <view class="guarantee">
          <text class="guarantee-text">未保底机制，每次召唤概率独立</text>
        </view>
      </view>
    </scroll-view>
  </view>
</template>

<script setup>
import { ref } from 'vue';
const activePool = ref(0);
const pools = [
  { name: '普通召唤', desc: '消耗食灵契约召唤', cost: '食灵契约 × 1' },
  { name: '高级召唤', desc: '消耗灵晶召唤，保底 SR', cost: '灵晶 × 50' },
  { name: '限时召唤', desc: 'UP 食灵出率提升', cost: '灵晶 × 100' }
];
const onBack = () => uni.navigateBack();
const onSummon = (count) => {
  uni.showToast({ title: `${count}次召唤开发中`, icon: 'none' });
};
</script>

<style scoped>
.page { width: 100vw; min-height: 100vh; background: #0F0E1D; }
.navbar { position: fixed; top: 0; left: 0; right: 0; height: 88rpx; display: flex; align-items: center; padding: 0 32rpx; background: #16152A; border-bottom: 1rpx solid #2A293E; z-index: 100; box-sizing: border-box; }
.navbar-back { font-size: 36rpx; color: #FFFFFF; }
.navbar-title { font-size: 34rpx; font-weight: 600; color: #FFFFFF; margin-left: 40rpx; }
.navbar-spacer { flex: 1; }
.scroll { height: 100vh; padding-top: 88rpx; padding-bottom: 100rpx; box-sizing: border-box; }
.content { padding: 0 48rpx; box-sizing: border-box; }
.section-title { font-size: 32rpx; color: #FFFFFF; font-weight: 700; margin: 40rpx 0 24rpx 0; }
.pool-list { display: flex; flex-direction: column; gap: 16rpx; margin-bottom: 40rpx; }
.pool-card { display: flex; justify-content: space-between; align-items: center; background: rgba(255,255,255,0.04); border: 1rpx solid #2A293E; border-radius: 20rpx; padding: 24rpx 32rpx; }
.pool-card.active { border-color: #E0D3A1; background: rgba(224,211,161,0.1); }
.pool-card:active { background: rgba(255,255,255,0.08); }
.pool-info { flex: 1; }
.pool-name { font-size: 28rpx; color: #FFFFFF; font-weight: 600; margin-bottom: 6rpx; }
.pool-desc { font-size: 22rpx; color: #8A8A9E; }
.pool-cost { font-size: 24rpx; color: #E0D3A1; font-weight: 600; }
.rate-info { background: rgba(255,255,255,0.04); border: 1rpx solid #2A293E; border-radius: 20rpx; padding: 24rpx 32rpx; margin-bottom: 30rpx; text-align: center; }
.rate-label { font-size: 24rpx; color: #8A8A9E; margin-right: 10rpx; }
.rate-value { font-size: 24rpx; color: #E0D3A1; font-weight: 600; }
.action-section { display: flex; gap: 20rpx; margin-bottom: 30rpx; }
.btn-single, .btn-ten {
  flex: 1; height: 88rpx; line-height: 88rpx;
  background: rgba(255,255,255,0.06); border: 1rpx solid #2A293E;
  color: #FFFFFF; font-size: 28rpx; border-radius: 44rpx;
}
.btn-ten { background: linear-gradient(135deg, #E0D3A1 0%, #C9B87E 100%); color: #0F0E1D; font-weight: 700; }
.btn-single:active, .btn-ten:active { background: rgba(255,255,255,0.12); }
.guarantee { text-align: center; font-size: 22rpx; color: #8A8A9E; }
</style>