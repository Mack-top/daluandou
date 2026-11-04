<!-- componentized -->
<template>
  <view class="page">
        <custom-navbar title="街巷食神记" :show-back="true" @back="onBack" />

    <scroll-view class="scroll" scroll-y="true" show-scrollbar="false">
      <view class="content">
        <!-- 活动进度 -->
        <view class="chronicle-header">
          <text class="chronicle-title">街巷食神记</text>
          <text class="chronicle-desc">探索街巷美食，收集食材，解锁里程碑奖励</text>
          <view class="progress-row">
            <text class="progress-label">活动进度：</text>
            <text class="progress-value">{{ collected }} / {{ total }}</text>
          </view>
          <view class="progress-bar">
            <view class="progress-fill" :style="{ width: progressPct + '%' }"></view>
          </view>
        </view>
        <!-- 里程碑奖励 -->
        <view class="section-title">里程碑奖励</text>
        <view class="milestone-list">
          <view v-for="(m, i) in milestones" :key="i" class="milestone-card" :class="{claimed: m.claimed, reached: collected >= m.threshold}">
            <text class="milestone-target">收集 {{ m.threshold }} 种食材</text>
            <view class="milestone-rewards">
              <text v-for="(r, j) in m.rewards" :key="j" class="reward-chip">{{ r }}</text>
            </view>
            <view class="milestone-action">
              <text v-if="m.claimed" class="status-claimed">已领取</text>
              <base-button v-else-if="collected >= m.threshold" class="btn-claim" @tap.stop="onClaim(m)">领取</base-button>
              <text v-else class="status-locked">未达成</text>
            </view>
          </view>
        </view>
      </view>
    </scroll-view>
  </view>
</template>

<script setup>
import CustomNavbar from '@/pages/components/CustomNavbar.vue';
import BaseButton from '@/pages/components/BaseButton.vue';
import { ref } from 'vue';
const collected = ref(12);
const total = ref(20);
const progressPct = ref(60);
const milestones = [
  { threshold: 5, rewards: ['食灵契约 × 5', '金币 × 100000'], claimed: true },
  { threshold: 10, rewards: ['食灵契约 × 10', '食灵精华 × 1000'], claimed: true },
  { threshold: 15, rewards: ['食灵契约 × 20', '史诗装备碎片 × 5'], claimed: false },
  { threshold: 20, rewards: ['5星SSR食灵 × 1', '灵晶 × 500'], claimed: false }
];
const onBack = () => uni.navigateBack();
const onClaim = (m) => {
  m.claimed = true;
  uni.showToast({ title: '里程碑奖励已发放', icon: 'success' });
};
</script>

<style scoped>
.page { width: 100vw; min-height: 100vh; background: #0F0E1D; }
.scroll { height: 100vh; padding-top: 88rpx; padding-bottom: 100rpx; box-sizing: border-box; }
.content { padding: 0 48rpx; box-sizing: border-box; }
.chronicle-header { background: linear-gradient(135deg, rgba(224,211,161,0.15) 0%, rgba(201,184,126,0.08) 100%); border: 1rpx solid rgba(224,211,161,0.3); border-radius: 24rpx; padding: 32rpx; margin-bottom: 30rpx; }
.chronicle-title { font-size: 36rpx; color: #E0D3A1; font-weight: 700; margin-bottom: 8rpx; }
.chronicle-desc { font-size: 24rpx; color: #B8B8C8; margin-bottom: 20rpx; }
.progress-row { display: flex; justify-content: space-between; margin-bottom: 12rpx; }
.progress-label { font-size: 24rpx; color: #FFFFFF; }
.progress-value { font-size: 24rpx; color: #E0D3A1; font-weight: 700; }
.progress-bar { width: 100%; height: 16rpx; background: #2A293E; border-radius: 8rpx; overflow: hidden; margin-bottom: 20rpx; }
.progress-fill { height: 100%; background: linear-gradient(90deg, #E0D3A1, #C9B87E); border-radius: 8rpx; }
.section-title { font-size: 32rpx; color: #FFFFFF; font-weight: 700; margin: 30rpx 0 24rpx 0; }
.milestone-list { display: flex; flex-direction: column; gap: 16rpx; }
.milestone-card { display: flex; justify-content: space-between; align-items: center; background: rgba(255,255,255,0.04); border: 1rpx solid #2A293E; border-radius: 20rpx; padding: 20rpx 32rpx; }
.milestone-card.reached { border-color: #E0D3A1; background: rgba(224,211,161,0.1); }
.milestone-card.claimed { border-color: #4CAF50; background: rgba(76,175,80,0.08); opacity: 0.85; }
.milestone-target { font-size: 24rpx; color: #FFFFFF; font-weight: 600; }
.milestone-rewards { display: flex; gap: 12rpx; flex: 1; margin: 0 30rpx; flex-wrap: wrap; }
.reward-chip { font-size: 20rpx; color: #B8B8C8; background: rgba(255,255,255,0.06); padding: 4rpx 10rpx; border-radius: 10rpx; border: 1rpx solid #2A293E; }
.milestone-action { display: flex; align-items: center; gap: 12rpx; flex-shrink: 0; }
.status-claimed { font-size: 24rpx; color: #4CAF50; font-weight: 600; }
.status-locked { font-size: 24rpx; color: #8A8A9E; font-weight: 600; }
.btn-claim { width: 120rpx; height: 56rpx; line-height: 56rpx; background: linear-gradient(135deg, #E0D3A1 0%, #C9B87E 100%); color: #0F0E1D; font-size: 24rpx; font-weight: 700; border-radius: 28rpx; flex-shrink: 0; }
.btn-claim:active { transform: scale(0.96); opacity: 0.85; }
</style>