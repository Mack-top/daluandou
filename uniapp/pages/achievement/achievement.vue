<template>
  <view class="page">
    <!-- 自定义导航栏（组件化） -->
    <custom-navbar
      title="成就系统"
      :show-back="true"
      @back="onBack"
    />
    <scroll-view class="scroll" scroll-y="true" show-scrollbar="false">
      <view class="content">
        <view class="section-title">成就列表</view>
        <text class="section-sub">完成成就获取成就点数与奖励</text>
        <view class="achievement-list">
          <view v-for="(a, i) in achievements" :key="i" class="ach-card" :class="{unlocked: a.unlocked, claimed: a.claimed}" @tap="onClaim(a)">
            <!-- 美术资源接入：AvatarIcon 组件，资源到位后自动加载真实图片 -->
            <view class="ach-icon-wrapper">
              <avatar-icon
                :placeholder-char="a.icon"
                :size="'lg'"
                :shape="'circle'"
                :locked="!a.unlocked"
                rarity="SSR"
              />
            </view>
            <view class="ach-info">
              <text class="ach-name">{{ a.name }}</text>
              <text class="ach-desc">{{ a.desc }}</text>
              <text class="ach-points">{{ a.points }} 成就点</text>
            </view>
            <view class="ach-action">
              <text v-if="a.claimed" class="status-done">已领取</text>
              <text v-else-if="!a.unlocked" class="status-lock">未达成</text>
              <base-button v-else btn-type="primary" @tap="() => onClaim(a)">领取</base-button>
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
import AvatarIcon from '@/pages/components/AvatarIcon.vue';

const achievements = [
  { name: '初出茅庐', desc: '通关主线第1章', icon: '🌱', points: 10, unlocked: true, claimed: false },
  { name: '崭露头角', desc: '通关主线第3章', icon: '⭐', points: 20, unlocked: true, claimed: false },
  { name: '召唤师', desc: '进行10次召唤', icon: '📜', points: 15, unlocked: true, claimed: true },
  { name: '收藏家', desc: '收集5位食灵', icon: '📖', points: 25, unlocked: false, claimed: false },
  { name: '主宰者', desc: '通关主线第10章', icon: '👑', points: 50, unlocked: false, claimed: false }
];
const onBack = () => uni.navigateBack();
const onClaim = (a) => {
  if (a.claimed) { uni.showToast({ title: '已领取', icon: 'none' }); return; }
  if (!a.unlocked) { uni.showToast({ title: '成就未达成', icon: 'none' }); return; }
  a.claimed = true;
  uni.showToast({ title: `获得${a.points}成就点`, icon: 'success' });
};
</script>

<style scoped>
.page { width: 100vw; min-height: 100vh; background: #0F0E1D; }
.scroll { height: 100vh; padding-top: 88rpx; padding-bottom: 100rpx; box-sizing: border-box; }
.content { padding: 0 48rpx; box-sizing: border-box; }
.section-title { font-size: 32rpx; color: #FFFFFF; font-weight: 700; margin: 40rpx 0 12rpx 0; }
.section-sub { font-size: 24rpx; color: #8A8A9E; margin-bottom: 30rpx; }
.achievement-list { display: flex; flex-direction: column; gap: 16rpx; }
.ach-card {
  display: flex;
  justify-content: space-between;
  align-items: center;
  background: rgba(255,255,255,0.04);
  border: 1rpx solid #2A293E;
  border-radius: 20rpx;
  padding: 24rpx 32rpx;
}
.ach-card.unlocked { border-color: #E0D3A1; background: rgba(224,211,161,0.1); }
.ach-card.claimed { border-color: #4CAF50; background: rgba(76,175,80,0.08); opacity: 0.85; }
.ach-card:not(.unlocked) { opacity: 0.6; }
.ach-card:active { background: rgba(255,255,255,0.08); }
.ach-icon-wrapper {
  width: 96rpx;
  height: 96rpx;
  flex-shrink: 0;
}
.ach-info { flex: 1; margin: 0 24rpx; }
.ach-name { font-size: 26rpx; color: #FFFFFF; font-weight: 600; margin-bottom: 6rpx; }
.ach-desc { font-size: 22rpx; color: #8A8A9E; margin-bottom: 6rpx; }
.ach-points { font-size: 20rpx; color: #E0D3A1; font-weight: 600; }
.ach-action { display: flex; align-items: center; gap: 12rpx; flex-shrink: 0; }
.status-done { font-size: 22rpx; color: #4CAF50; font-weight: 600; }
.status-lock { font-size: 22rpx; color: #8A8A9E; font-weight: 600; }
</style>