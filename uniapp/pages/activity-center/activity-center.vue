<!-- componentized -->
<template>
  <view class="page">
        <custom-navbar title="活动中心" :show-back="true" @back="onBack" />

    <scroll-view class="scroll" scroll-y="true" show-scrollbar="false">
      <view class="content">
        <view class="section-title">限时活动</view>
        <view class="activity-list">
          <view v-for="(a, i) in activities" :key="i" class="activity-card" @tap="onEnter(a)">
            <view class="activity-icon-wrapper">
              <avatar-icon :placeholder-char="a.icon" :size="'md'" :shape="'circle'" />
            </view>
            <view class="activity-info">
              <text class="activity-name">{{ a.name }}</text>
              <text class="activity-desc">{{ a.desc }}</text>
              <text class="activity-time">{{ a.time }}</text>
            </view>
            <view class="activity-tag">{{ a.tag }}</view>
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
const activities = [
  { name: '开服庆典', desc: '百抽献礼与主线通关奖励', icon: '🎉', time: '剩余 3天 12小时', tag: '火热进行中' },
  { name: '七日之约', desc: '连续登录获取丰厚奖励', icon: '📅', time: '剩余 5天 4小时', tag: '火热进行中' },
  { name: '食神记', desc: '街巷美食探索活动', icon: '🍜', time: '即将开启', tag: '敬请期待' },
  { name: '世界BOSS', desc: '全服挑战强大世界BOSS', icon: '🐉', time: '即将开启', tag: '敬请期待' },
  { name: '跨服竞技场', desc: '与全服玩家一较高下', icon: '⚔️', time: '即将开启', tag: '敬请期待' }
];
const onBack = () => uni.navigateBack();
const onEnter = (a) => {
  if (a.tag === '敬请期待') {
    uni.showToast({ title: '活动即将开启，敬请期待', icon: 'none' });
    return;
  }
  uni.showToast({ title: `进入${a.name}`, icon: 'none' });
};
</script>

<style scoped>
.page { width: 100vw; min-height: 100vh; background: #0F0E1D; }
.scroll { height: 100vh; padding-top: 88rpx; padding-bottom: 100rpx; box-sizing: border-box; }
.content { padding: 0 48rpx; box-sizing: border-box; }
.section-title { font-size: 32rpx; color: #FFFFFF; font-weight: 700; margin: 40rpx 0 24rpx 0; }
.activity-list { display: flex; flex-direction: column; gap: 16rpx; }
.activity-card { display: flex; justify-content: space-between; align-items: center; background: rgba(255,255,255,0.04); border: 1rpx solid #2A293E; border-radius: 20rpx; padding: 24rpx 32rpx; }
.activity-card:active { background: rgba(255,255,255,0.08); }
.activity-icon-wrapper { width: 64rpx; height: 64rpx; flex-shrink: 0; }
.activity-info { flex: 1; margin: 0 24rpx; }
.activity-name { font-size: 28rpx; color: #FFFFFF; font-weight: 600; margin-bottom: 6rpx; }
.activity-desc { font-size: 22rpx; color: #8A8A9E; margin-bottom: 6rpx; }
.activity-time { font-size: 22rpx; color: #E0D3A1; font-weight: 600; }
.activity-tag { font-size: 20rpx; padding: 4rpx 16rpx; border-radius: 12rpx; flex-shrink: 0; }
.activity-card:nth-child(1) .activity-tag { color: #4CAF50; border: 1rpx solid rgba(76,175,80,0.3); background: rgba(76,175,80,0.1); }
.activity-card:nth-child(2) .activity-tag { color: #4CAF50; border: 1rpx solid rgba(76,175,80,0.3); background: rgba(76,175,80,0.1); }
.activity-card:nth-child(n+3) .activity-tag { color: #8A8A9E; border: 1rpx solid rgba(138,138,158,0.3); background: rgba(138,138,158,0.1); }
</style>