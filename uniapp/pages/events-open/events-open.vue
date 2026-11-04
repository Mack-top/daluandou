<!-- componentized -->
<template>
  <view class="page">
        <custom-navbar title="开服活动" :show-back="true" @back="onBack" />

    <scroll-view class="scroll" scroll-y="true" show-scrollbar="false">
      <view class="content">
        <view class="section-title">开服限时活动</view>
        <view class="activity-list">
          <view v-for="(a, i) in activities" :key="i" class="activity-card" :class="{ended: a.ended}" @tap="onEnter(a)">
            <view class="activity-icon-wrapper">
              <avatar-icon :placeholder-char="a.icon" :size="'md'" :shape="'circle'" />
            </view>
            <view class="activity-info">
              <text class="activity-name">{{ a.name }}</text>
              <text class="activity-desc">{{ a.desc }}</text>
              <text class="activity-time">{{ a.ended ? '已结束' : a.time }}</text>
            </view>
            <view class="activity-status">
              <text v-if="a.ended" class="status-ended">已结束</text>
              <base-button v-else class="btn-go">前往</base-button>
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
const activities = [
  { name: '百抽献礼', desc: '累计召唤100抽，获5星SSR食灵', icon: '🎁', time: '剩余 6天 12小时', ended: false },
  { name: '主线通关奖励', desc: '通关主线2-4，获蓝色夏威夷·艾薇儿', icon: '🗺️', time: '剩余 6天 12小时', ended: false },
  { name: '累计充值', desc: '累计充值达标，获丰厚返利', icon: '💰', time: '剩余 6天 12小时', ended: false },
  { name: '新手七日登录', desc: '连续登录7日，获拉菲食灵', icon: '📅', time: '剩余 4天 8小时', ended: false },
  { name: '首充双倍', desc: '首次充值获得双倍灵晶', icon: '💎', time: '已结束', ended: true }
];
const onBack = () => uni.navigateBack();
const onEnter = (a) => {
  if (a.ended) { uni.showToast({ title: '活动已结束', icon: 'none' }); return; }
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
.activity-card.ended { opacity: 0.6; border-color: #2A293E; }
.activity-card:active { background: rgba(255,255,255,0.08); }
.activity-icon-wrapper { width: 48rpx; height: 48rpx; flex-shrink: 0; }
.activity-info { flex: 1; margin: 0 24rpx; }
.activity-name { font-size: 28rpx; color: #FFFFFF; font-weight: 600; margin-bottom: 6rpx; }
.activity-desc { font-size: 22rpx; color: #8A8A9E; margin-bottom: 6rpx; }
.activity-time { font-size: 22rpx; color: #E0D3A1; font-weight: 600; }
.activity-card.ended .activity-time { color: #8A8A9E; }
.activity-status { flex-shrink: 0; }
.status-ended { font-size: 22rpx; color: #8A8A9E; font-weight: 600; }
.btn-go { width: 120rpx; height: 56rpx; line-height: 56rpx; background: linear-gradient(135deg, #E0D3A1 0%, #C9B87E 100%); color: #0F0E1D; font-size: 22rpx; font-weight: 700; border-radius: 28rpx; flex-shrink: 0; }
.btn-go:active { transform: scale(0.96); opacity: 0.85; }
</style>