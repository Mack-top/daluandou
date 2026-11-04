<!-- componentized -->
<template>
  <view class="page">
        <custom-navbar title="爬塔" :show-back="true" @back="onBack" />

    <scroll-view class="scroll" scroll-y="true" show-scrollbar="false">
      <view class="content">
        <!-- 进度 -->
        <view class="progress-card">
          <text class="progress-title">主塔进度</text>
          <text class="progress-value">{{ currentFloor }} / {{ totalFloors }} 层</text>
          <view class="progress-bar"><view class="progress-fill" :style="{ width: progressPct + '%' }"></view></view>
        </view>
        <!-- 塔层列表 -->
        <view class="section-title">塔层奖励</text>
        <view class="floor-list">
          <view v-for="(f, i) in floors" :key="i" class="floor-card" :class="{cleared: f.cleared, current: f.current, locked: f.locked}" @tap="onFloor(f)">
            <view class="floor-number">第{{ f.floor }}层</text>
            <view class="floor-info">
              <text class="floor-name">{{ f.name }}</text>
              <text class="floor-desc">{{ f.desc }}</text>
            </view>
            <view class="floor-rewards">
              <text v-for="(r, j) in f.rewards" :key="j" class="reward-chip">{{ r }}</text>
            </view>
            <view class="floor-action">
              <text v-if="f.cleared" class="status-done">已通关</text>
              <text v-else-if="f.locked" class="status-lock">锁定</text>
              <base-button v-else class="btn-floor">挑战</base-button>
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
const currentFloor = ref(12);
const totalFloors = ref(100);
const progressPct = ref(12);
const floors = [
  { floor: 1, name: '新手试炼', desc: '基础怪物，适合新手', rewards: ['食灵契约 × 5', '金币 × 10000'], cleared: true, locked: false, current: false },
  { floor: 5, name: '初级迷宫', desc: '少量精英怪物', rewards: ['食灵契约 × 10', '食灵精华 × 500'], cleared: true, locked: false, current: false },
  { floor: 10, name: '中级迷宫', desc: '精英怪物与首领', rewards: ['食灵契约 × 20', '升星石 × 3'], cleared: true, locked: false, current: false },
  { floor: 12, name: '高级迷宫', desc: '强力首领守卫', rewards: ['食灵契约 × 30', '史诗装备碎片 × 5'], cleared: false, locked: false, current: true },
  { floor: 15, name: '专家迷宫', desc: '顶级怪物，挑战极限', rewards: ['食灵契约 × 50', '5星食灵碎片 × 10'], cleared: false, locked: true, current: false }
];
const onBack = () => uni.navigateBack();
const onFloor = (f) => {
  if (f.locked) { uni.showToast({ title: '塔层未解锁', icon: 'none' }); return; }
  uni.showToast({ title = f.name, icon: 'none' });
};
</script>

<style scoped>
.page { width: 100vw; min-height: 100vh; background: #0F0E1D; }
.scroll { height: 100vh; padding-top: 88rpx; padding-bottom: 100rpx; box-sizing: border-box; }
.content { padding: 0 48rpx; box-sizing: border-box; }
.progress-card { background: rgba(255,255,255,0.04); border: 1rpx solid #2A293E; border-radius: 24rpx; padding: 32rpx; margin-bottom: 30rpx; }
.progress-title { font-size: 26rpx; color: #FFFFFF; font-weight: 600; margin-bottom: 12rpx; }
.progress-value { font-size: 34rpx; color: #E0D3A1; font-weight: 700; margin-bottom: 16rpx; }
.progress-bar { width: 100%; height: 16rpx; background: #2A293E; border-radius: 8rpx; overflow: hidden; }
.progress-fill { height: 100%; background: linear-gradient(90deg, #E0D3A1, #C9B87E); border-radius: 8rpx; }
.section-title { font-size: 32rpx; color: #FFFFFF; font-weight: 700; margin: 30rpx 0 24rpx 0; }
.floor-list { display: flex; flex-direction: column; gap: 16rpx; }
.floor-card { display: flex; justify-content: space-between; align-items: center; background: rgba(255,255,255,0.04); border: 1rpx solid #2A293E; border-radius: 20rpx; padding: 20rpx 32rpx; }
.floor-card.current { border-color: #E0D3A1; background: rgba(224,211,161,0.1); }
.floor-card.cleared { border-color: #4CAF50; background: rgba(76,175,80,0.08); opacity: 0.85; }
.floor-card.locked { opacity: 0.6; }
.floor-card:active { background: rgba(255,255,255,0.08); }
.floor-number { font-size: 26rpx; color: #E0D3A1; font-weight: 700; flex-shrink: 0; }
.floor-info { flex: 1; margin: 0 24rpx; }
.floor-name { font-size: 26rpx; color: #FFFFFF; font-weight: 600; margin-bottom: 4rpx; }
.floor-desc { font-size: 22rpx; color: #8A8A9E; }
.floor-rewards { display: flex; gap: 12rpx; flex: 1; margin: 0 30rpx; flex-wrap: wrap; }
.reward-chip { font-size: 18rpx; color: #B8B8C8; background: rgba(255,255,255,0.06); padding: 4rpx 10rpx; border-radius: 10rpx; border: 1rpx solid #2A293E; white-space: nowrap; }
.floor-action { display: flex; align-items: center; gap: 12rpx; flex-shrink: 0; }
.status-done { font-size: 22rpx; color: #4CAF50; font-weight: 600; }
.status-lock { font-size: 22rpx; color: #8A8A9E; font-weight: 600; }
.btn-floor { width: 100rpx; height: 48rpx; line-height: 48rpx; background: linear-gradient(135deg, #E0D3A1 0%, #C9B87E 100%); color: #0F0E1D; font-size: 20rpx; font-weight: 700; border-radius: 24rpx; flex-shrink: 0; }
.btn-floor:active { transform: scale(0.96); opacity: 0.85; }
</style>