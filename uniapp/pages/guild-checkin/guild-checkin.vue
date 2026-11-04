<!-- emoji-replaced -->
<!-- componentized -->
<template>
  <view class="page">
        <custom-navbar title="协会签到" :show-back="true" @back="onBack" />

    <scroll-view class="scroll" scroll-y="true" show-scrollbar="false">
      <view class="content">
        <!-- 连续签到 -->
        <view class="streak-card">
          <text class="streak-title">连续签到</text>
          <text class="streak-days">{{ streakDays }} 天</text>
        </view>
        <!-- 签到按钮 -->
        <view class="action-section">
          <base-button :class="{claimed: isClaimed}" class="btn-checkin" @tap="onCheckin">{{ isClaimed ? '已签到' : '立即签到' }}</base-button>
        </view>
        <!-- 签到奖励 -->
        <view class="section-title">签到奖励预览</text>
        <view class="reward-list">
          <view v-for="(r, i) in rewards" :key="i" class="reward-card" :class="{claimed: i < claimedCount, today: i === streakDays}">
            <text class="reward-day">第{{ i + 1 }}天</text>
            <view class="reward-item">
              <view class="reward-icon-wrapper">
  <avatar-icon :placeholder-char="r.icon" :size="'md'" :shape="'circle'" />
</view>
              <text class="reward-name">{{ r.name }}</text>
            </view>
            <view v-if="i < claimedCount" class="reward-done">已领取</view>
          </view>
        </view>
      </view>
    </scroll-view>
  </view>
</template>

<script setup>
import AvatarIcon from '@/pages/components/AvatarIcon.vue';
import CustomNavbar from '@/pages/components/CustomNavbar.vue';
import BaseButton from '@/pages/components/BaseButton.vue';
import { ref } from 'vue';
const streakDays = ref(3);
const isClaimed = ref(false);
const claimedCount = ref(3);
const rewards = [
  { icon: '📖', name: '协会币 × 50' },
  { icon: '💰', name: '金币 × 100000' },
  { icon: '⚡', name: '食灵精华 × 300' },
  { icon: '📦', name: '协会宝箱 × 1' },
  { icon: '💎', name: '协会币 × 200' }
];
const onBack = () => uni.navigateBack();
const onCheckin = () => {
  if (isClaimed.value) {
    uni.showToast({ title: '今日已签到', icon: 'none' });
    return;
  }
  isClaimed.value = true;
  claimedCount.value++;
  uni.showToast({ title: '签到成功，获得协会币 × 50', icon: 'success' });
};
</script>

<style scoped>
.page { width: 100vw; min-height: 100vh; background: #0F0E1D; }
.scroll { height: 100vh; padding-top: 88rpx; padding-bottom: 100rpx; box-sizing: border-box; }
.content { padding: 0 48rpx; box-sizing: border-box; }
.streak-card { background: linear-gradient(135deg, rgba(224,211,161,0.15) 0%, rgba(201,184,126,0.08) 100%); border: 1rpx solid rgba(224,211,161,0.3); border-radius: 24rpx; padding: 40rpx 32rpx; text-align: center; margin-bottom: 30rpx; }
.streak-title { font-size: 28rpx; color: #B8B8C8; margin-bottom: 8rpx; }
.streak-days { font-size: 56rpx; color: #E0D3A1; font-weight: 800; }
.action-section { text-align: center; margin-bottom: 40rpx; }
.btn-checkin { width: 600rpx; height: 96rpx; line-height: 96rpx; background: linear-gradient(135deg, #E0D3A1 0%, #C9B87E 100%); color: #0F0E1D; font-size: 34rpx; font-weight: 700; border-radius: 48rpx; box-shadow: 0 8rpx 24rpx rgba(224,211,161,0.3); }
.btn-checkin:not(.claimed):active { transform: scale(0.96); opacity: 0.85; }
.btn-checkin.claimed { background: #2A293E; color: #666; box-shadow: none; }
.section-title { font-size: 32rpx; color: #FFFFFF; font-weight: 700; margin: 30rpx 0 24rpx 0; }
.reward-list { display: flex; flex-direction: column; gap: 16rpx; }
.reward-card { display: flex; justify-content: space-between; align-items: center; background: rgba(255,255,255,0.04); border: 1rpx solid #2A293E; border-radius: 20rpx; padding: 20rpx 32rpx; }
.reward-card.today { border-color: #E0D3A1; background: rgba(224,211,161,0.1); }
.reward-card.claimed { opacity: 0.6; }
.reward-day { font-size: 22rpx; color: #8A8A9E; flex-shrink: 0; }
.reward-item { flex: 1; margin: 0 24rpx; display: flex; align-items: center; gap: 12rpx; }
.reward-icon { font-size: 32rpx; flex-shrink: 0; }
.reward-name { font-size: 26rpx; color: #FFFFFF; }
.reward-done { font-size: 22rpx; color: #4CAF50; font-weight: 600; flex-shrink: 0; }
</style>