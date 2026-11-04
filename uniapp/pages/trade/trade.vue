<!-- componentized -->
<template>
  <view class="page">
        <custom-navbar title="交易坊" :show-back="true" @back="onBack" />

    <scroll-view class="scroll" scroll-y="true" show-scrollbar="false">
      <view class="content">
        <view class="section-title">资源兑换</view>
        <text class="section-sub">每日兑换次数有限，次日重置</text>
        <view class="trade-list">
          <view v-for="(t, i) in trades" :key="i" class="trade-card" @tap="onTrade(t)">
            <view class="trade-give">
              <view class="trade-icon-wrapper">
                <avatar-icon :placeholder-char="t.giveIcon" :size="'md'" :shape="'circle'" />
              </view>
              <text class="trade-value">{{ t.giveValue }}</text>
            </view>
            <view class="trade-arrow-wrapper">
              <avatar-icon placeholder-char="→" :size="'sm'" :shape="'circle'" />
            </view>
            <view class="trade-get">
              <view class="trade-icon-wrapper">
                <avatar-icon :placeholder-char="t.getIcon" :size="'md'" :shape="'circle'" />
              </view>
              <text class="trade-value">{{ t.getValue }}</text>
            </view>
            <view class="trade-limit">
              <text class="limit-text">今日：{{ t.bought }}/{{ t.limit }}</text>
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
const trades = [
  { giveIcon: '💰', giveValue: '金币 × 100000', getIcon: '📖', getValue: '食灵契约 × 2', limit: 5, bought: 2 },
  { giveIcon: '⚡', giveValue: '食灵精华 × 5000', getIcon: '📖', getValue: '食灵契约 × 1', limit: 10, bought: 5 },
  { giveIcon: '💎', giveValue: '灵晶 × 100', getIcon: '📦', getValue: '每日宝箱 × 1', limit: 3, bought: 1 },
  { giveIcon: '🍵', giveValue: '灵味原浆 × 100000', getIcon: '📖', getValue: '食灵契约 × 5', limit: 2, bought: 0 }
];
const onBack = () => uni.navigateBack();
const onTrade = (t) => {
  if (t.bought >= t.limit) {
    uni.showToast({ title: '今日兑换次数已用完', icon: 'none' });
    return;
  }
  uni.showToast({ title: '兑换成功', icon: 'success' });
};
</script>

<style scoped>
.page { width: 100vw; min-height: 100vh; background: #0F0E1D; }
.scroll { height: 100vh; padding-top: 88rpx; padding-bottom: 100rpx; box-sizing: border-box; }
.content { padding: 0 48rpx; box-sizing: border-box; }
.section-title { font-size: 32rpx; color: #FFFFFF; font-weight: 700; margin: 40rpx 0 12rpx 0; }
.section-sub { font-size: 24rpx; color: #8A8A9E; margin-bottom: 30rpx; }
.trade-list { display: flex; flex-direction: column; gap: 16rpx; }
.trade-card { display: flex; justify-content: space-between; align-items: center; background: rgba(255,255,255,0.04); border: 1rpx solid #2A293E; border-radius: 20rpx; padding: 24rpx 32rpx; }
.trade-card:active { background: rgba(255,255,255,0.08); }
.trade-give, .trade-get { display: flex; align-items: center; gap: 8rpx; flex-shrink: 0; }
.trade-icon-wrapper { width: 32rpx; height: 32rpx; flex-shrink: 0; }
.trade-value { font-size: 24rpx; color: #FFFFFF; font-weight: 600; }
.trade-arrow-wrapper { width: 24rpx; height: 24rpx; flex-shrink: 0; margin: 0 16rpx; }
.trade-limit { flex-shrink: 0; }
.limit-text { font-size: 22rpx; color: #E0D3A1; font-weight: 600; }
</style>