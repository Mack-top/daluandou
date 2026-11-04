<!-- componentized -->
<template>
  <view class="page">
    <!-- 自定义导航栏 -->
        <custom-navbar title="等级礼包" :show-back="true" @back="onBack" />


    <scroll-view class="scroll" scroll-y="true" show-scrollbar="false">
      <view class="content">

        <!-- 当前等级 -->
        <view class="level-header">
          <text class="level-title">主角等级：{{ currentLevel }}</text>
          <view class="level-progress">
            <view class="progress-bar" :style="{ width: progressPercent + '%' }"></view>
          </view>
          <text class="progress-text">{{ progressCurrent }} / {{ progressTotal }}</text>
        </view>

        <!-- 等级礼包列表 -->
        <view class="gift-list">
          <view
            v-for="g in gifts"
            :key="g.level"
            class="gift-card"
            :class="{claimed: g.claimed, locked: g.locked}"
            @tap="() => onClaim(g)"
          >
            <view class="gift-info">
              <text class="gift-level">等级 {{ g.level }} 礼包</text>
              <text class="gift-condition">达成等级 {{ g.level }} 即可领取</text>
            </view>
            <view class="gift-rewards">
              <text v-for="(r, i) in g.rewards" :key="i" class="reward-chip">{{ r }}</text>
            </view>
            <view class="gift-action">
              <text v-if="g.claimed" class="status-claimed">已领取</text>
              <text v-else-if="g.locked" class="status-locked">锁定</text>
              <base-button v-else class="btn-claim">领取</base-button>
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

const currentLevel = ref(5);
const progressCurrent = ref(1200);
const progressTotal = ref(2000);
const progressPercent = ref(60);

const gifts = ref([
  { level: 1, rewards: ['食灵契约 × 5', '灵晶 × 50'], claimed: false, locked: false },
  { level: 3, rewards: ['食灵契约 × 10', '金币 × 100000'], claimed: false, locked: false },
  { level: 5, rewards: ['食灵契约 × 10', '食灵精华 × 500', '灵晶 × 60'], claimed: false, locked: false },
  { level: 10, rewards: ['史诗装备 × 1', '灵晶 × 100', '金币 × 1000000'], claimed: false, locked: true },
  { level: 15, rewards: ['专属徽章 × 1', '食灵契约 × 3', '金币 × 2000000'], claimed: false, locked: true },
  { level: 20, rewards: ['5星SSR食灵 × 1', '灵晶 × 500'], claimed: false, locked: true }
]);

const onBack = () => { uni.navigateBack(); };

const onClaim = (g) => {
  if (g.claimed) {
    uni.showToast({ title: '已领取', icon: 'none' });
    return;
  }
  if (g.locked) {
    uni.showToast({ title: '等级不足，继续努力', icon: 'none' });
    return;
  }
  g.claimed = true;
  uni.showToast({ title: '奖励已发放', icon: 'success' });
};
</script>

<style scoped>
.page { width: 100vw; min-height: 100vh; background-color: #0F0E1D; position: relative; }
.scroll { height: 100vh; padding-top: 88rpx; padding-bottom: 100rpx; box-sizing: border-box; }
.content { padding: 0 48rpx; box-sizing: border-box; }
.level-header {
  background: rgba(255,255,255,0.04); border: 1rpx solid #2A293E;
  border-radius: 24rpx; padding: 32rpx; margin-bottom: 30rpx; text-align: center;
}
.level-title { font-size: 34rpx; color: #FFFFFF; font-weight: 700; margin-bottom: 20rpx; }
.level-progress { width: 100%; max-width: 500rpx; margin: 0 auto; }
.progress-bar {
  height: 16rpx; background: #2A293E; border-radius: 8rpx; overflow: hidden;
  margin-bottom: 8rpx;
}
.progress-bar::after { /* 占位，实际通过inline style控制宽度 */ }
.progress-text { font-size: 24rpx; color: #B8B8C8; }
.gift-list { display: flex; flex-direction: column; gap: 16rpx; }
.gift-card {
  display: flex; justify-content: space-between; align-items: center;
  background: rgba(255,255,255,0.04); border: 1rpx solid #2A293E;
  border-radius: 20rpx; padding: 24rpx 32rpx;
}
.gift-card.locked { opacity: 0.6; }
.gift-card.claimed { border-color: #4CAF50; background: rgba(76,175,80,0.08); }
.gift-info { flex: 1; }
.gift-level { font-size: 30rpx; color: #E0D3A1; font-weight: 700; }
.gift-condition { font-size: 24rpx; color: #B8B8C8; margin-top: 6rpx; }
.gift-rewards { display: flex; gap: 12rpx; flex: 1; margin: 0 30rpx; }
.reward-chip {
  font-size: 22rpx; color: #B8B8C8; background: rgba(255,255,255,0.06);
  padding: 4rpx 12rpx; border-radius: 10rpx; border: 1rpx solid #2A293E;
}
.gift-action { display: flex; align-items: center; gap: 12rpx; }
.status-claimed { font-size: 26rpx; color: #4CAF50; font-weight: 600; }
.status-locked { font-size: 26rpx; color: #8A8A9E; font-weight: 600; }
.btn-claim {
  width: 140rpx; height: 64rpx; line-height: 64rpx;
  background: linear-gradient(135deg, #E0D3A1 0%, #C9B87E 100%);
  color: #0F0E1D; font-size: 26rpx; font-weight: 700; border-radius: 32rpx;
  flex-shrink: 0;
}
</style>