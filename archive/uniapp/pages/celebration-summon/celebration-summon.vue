<template>
  <view class="page">
    <!-- 自定义导航栏 -->
    <view class="navbar">
      <text class="navbar-back" @tap="onBack">◀</text>
      <text class="navbar-title">开服庆典-百抽献礼</text>
      <view class="navbar-spacer"></view>
    </view>

    <scroll-view class="scroll" scroll-y="true" show-scrollbar="false">
      <view class="content">

        <!-- 活动标题 -->
        <view class="activity-header">
          <text class="activity-title">百抽献礼</text>
          <text class="activity-desc">开服庆典限时活动，完成百抽即可获得丰厚奖励</text>
        </view>

        <!-- 进度 -->
        <view class="progress-card">
          <text class="progress-label">召唤进度：{{ summonCount }} / 100</text>
          <view class="progress-bar">
            <view class="progress-fill" :style="{ width: progressPercent + '%' }"></view>
          </view>
        </view>

        <!-- 阶段奖励 -->
        <view class="section-title">阶段奖励</text>
        <view class="stage-list">
          <view
            v-for="(s, i) in stages"
            :key="s.threshold"
            class="stage-card"
            :class="{claimed: s.claimed, locked: s.locked, active: summonCount >= s.threshold && !s.claimed}"
            @tap="() => onClaimStage(s)"
          >
            <text class="stage-threshold">累计召唤 {{ s.threshold }} 抽</text>
            <view class="stage-rewards">
              <text v-for="(r, j) in s.rewards" :key="j" class="reward-chip">{{ r }}</text>
            </view>
            <view class="stage-action">
              <text v-if="s.claimed" class="status-claimed">已领取</text>
              <text v-else-if="s.locked" class="status-locked">未达成</text>
              <button v-else class="btn-claim">领取</button>
            </view>
          </view>
        </view>

      </view>
    </scroll-view>
  </view>
</template>

<script setup>
import { ref } from 'vue';

const summonCount = ref(78);
const progressPercent = ref(78);

const stages = ref([
  { threshold: 10, rewards: ['食灵契约 × 10', '金币 × 50000'], claimed: true, locked: false },
  { threshold: 30, rewards: ['食灵契约 × 30', '食灵精华 × 300'], claimed: true, locked: false },
  { threshold: 50, rewards: ['食灵契约 × 50', '食灵精华 × 1000'], claimed: true, locked: false },
  { threshold: 70, rewards: ['食灵契约 × 80', '食灵精华 × 3000'], claimed: false, locked: false },
  { threshold: 100, rewards: ['5星SSR食灵 × 1', '食灵契约 × 100'], claimed: false, locked: false }
]);

const onBack = () => { uni.navigateBack(); };

const onClaimStage = (s) => {
  if (s.claimed) {
    uni.showToast({ title: '已领取', icon: 'none' });
    return;
  }
  if (s.locked) {
    uni.showToast({ title: '召唤次数未达成', icon: 'none' });
    return;
  }
  s.claimed = true;
  uni.showToast({ title: '阶段奖励已发放', icon: 'success' });
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
.navbar-title { font-size: 30rpx; font-weight: 600; color: #FFFFFF; margin-left: 40rpx; }
.navbar-spacer { flex: 1; }
.scroll { height: 100vh; padding-top: 88rpx; padding-bottom: 100rpx; box-sizing: border-box; }
.content { padding: 0 48rpx; box-sizing: border-box; }
.activity-header {
  text-align: center; margin-top: 40rpx; margin-bottom: 30rpx;
}
.activity-title { font-size: 36rpx; color: #FFFFFF; font-weight: 700; margin-bottom: 12rpx; }
.activity-desc { font-size: 26rpx; color: #B8B8C8; }
.progress-card {
  background: rgba(255,255,255,0.04); border: 1rpx solid #2A293E;
  border-radius: 24rpx; padding: 32rpx; margin-bottom: 30rpx;
}
.progress-label { font-size: 28rpx; color: #FFFFFF; margin-bottom: 16rpx; }
.progress-bar { width: 100%; height: 20rpx; background: #2A293E; border-radius: 10rpx; overflow: hidden; }
.progress-fill { height: 100%; background: linear-gradient(90deg, #E0D3A1, #C9B87E); border-radius: 10rpx; }
.section-title {
  font-size: 30rpx; color: #FFFFFF; font-weight: 600; margin: 30rpx 0 20rpx 0;
}
.stage-list { display: flex; flex-direction: column; gap: 16rpx; }
.stage-card {
  display: flex; justify-content: space-between; align-items: center;
  background: rgba(255,255,255,0.04); border: 1rpx solid #2A293E;
  border-radius: 20rpx; padding: 20rpx 32rpx;
}
.stage-card.active { border-color: #E0D3A1; background: rgba(224,211,161,0.1); }
.stage-card.claimed { border-color: #4CAF50; background: rgba(76,175,80,0.08); opacity: 0.85; }
.stage-card.locked { opacity: 0.6; }
.stage-threshold { font-size: 26rpx; color: #E0D3A1; font-weight: 600; }
.stage-rewards { display: flex; gap: 12rpx; flex: 1; margin: 0 30rpx; }
.reward-chip {
  font-size: 20rpx; color: #B8B8C8; background: rgba(255,255,255,0.06);
  padding: 4rpx 10rpx; border-radius: 10rpx; border: 1rpx solid #2A293E;
}
.stage-action { display: flex; align-items: center; gap: 12rpx; }
.status-claimed { font-size: 24rpx; color: #4CAF50; font-weight: 600; }
.status-locked { font-size: 24rpx; color: #8A8A9E; font-weight: 600; }
.btn-claim {
  width: 120rpx; height: 56rpx; line-height: 56rpx;
  background: linear-gradient(135deg, #E0D3A1 0%, #C9B87E 100%);
  color: #0F0E1D; font-size: 24rpx; font-weight: 700; border-radius: 28rpx;
  flex-shrink: 0;
}
</style>