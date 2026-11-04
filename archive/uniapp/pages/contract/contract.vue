<template>
  <view class="page">
    <!-- 自定义导航栏 -->
    <view class="navbar">
      <text class="navbar-back" @tap="onBack">◀</text>
      <text class="navbar-title">契约特惠</text>
      <view class="navbar-spacer"></view>
    </view>

    <scroll-view class="scroll" scroll-y="true" show-scrollbar="false">
      <view class="content">

        <!-- 限时特惠倒计时 -->
        <view class="countdown">
          <text class="countdown-label">限时特惠剩余：</text>
          <text class="countdown-time">{{ countdown }}</text>
        </view>

        <!-- 契约特惠卡片 -->
        <view class="deal-card">
          <text class="deal-tag">超值必买</text>
          <text class="deal-title">契约特惠</text>
          <text class="deal-desc">旧之约 吃货卡包 · 超值基金</text>
          <view class="deal-price">灵晶 × 360</view>
          <button class="deal-btn" @tap="onBuyContract">购买</button>
        </view>

        <!-- 首充礼包 -->
        <view class="section-title">首充赠礼</text>
        <view class="gift-card">
          <text class="gift-name">蓝纹奶酪</text>
          <text class="gift-rarity">5星SSR</text>
          <view class="gift-avatar">🧀</view>
          <text class="gift-desc">群攻爆发·官方力荐</text>
          <button class="gift-btn" @tap="onBuyFirstCharge">首充</button>
        </view>

        <!-- 三日礼遇 -->
        <view class="section-title">三日礼遇</text>
        <view class="daily-card" v-for="(d, i) in dayGifts" :key="i" @tap="onClaimDay(d)">
          <text class="day-label">第{{ d.day }}天</text>
          <view class="day-rewards">
            <text v-for="(r, j) in d.rewards" :key="j" class="reward-chip">{{ r }}</text>
          </view>
          <text class="day-status" :class="{claimed: d.claimed}">{{ d.claimed ? '已领取' : '领取' }}</text>
        </view>

        <!-- 超值基金 -->
        <view class="fund-card">
          <text class="fund-title">超值基金</text>
          <text class="fund-desc">投资灵晶，每日领取丰厚回报</text>
          <button class="fund-btn" @tap="onBuyFund">立即购买</button>
        </view>

      </view>
    </scroll-view>
  </view>
</template>

<script setup>
import { ref, computed } from 'vue';

const countdown = ref('3天 12:04:20');

const dayGifts = ref([
  { day: 1, rewards: ['食灵契约 × 2', '金币 × 200000', '每日宝箱 × 1'], claimed: false },
  { day: 2, rewards: ['食灵契约 × 4', '金币 × 500000', '每日宝箱 × 2'], claimed: false },
  { day: 3, rewards: ['食灵契约 × 10', '金币 × 1200000', '每日宝箱 × 5'], claimed: false }
]);

const onBack = () => { uni.navigateBack(); };
const onBuyContract = () => { uni.showToast({ title: '购买契约特惠', icon: 'none' }); };
const onBuyFirstCharge = () => { uni.showToast({ title: '首充赠礼购买中', icon: 'none' }); };
const onBuyFund = () => { uni.showToast({ title: '超值基金购买中', icon: 'none' }); };
const onClaimDay = (d) => {
  if (d.claimed) return;
  d.claimed = true;
  uni.showToast({ title: '奖励已发放到邮箱', icon: 'none' });
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
.navbar-title { font-size: 34rpx; font-weight: 600; color: #FFFFFF; margin-left: 40rpx; }
.navbar-spacer { flex: 1; }
.scroll { height: 100vh; padding-top: 88rpx; padding-bottom: 100rpx; box-sizing: border-box; }
.content { padding: 0 48rpx; box-sizing: border-box; }
.countdown {
  margin-top: 40rpx; text-align: center; font-size: 28rpx; color: #E5484D;
}
.countdown-label { color: #B8B8C8; margin-right: 8rpx; }
.countdown-time { font-weight: 700; }
.deal-card {
  margin-top: 30rpx; background: rgba(255,255,255,0.04);
  border: 1rpx solid #2A293E; border-radius: 24rpx; padding: 32rpx;
  text-align: center; position: relative;
}
.deal-tag {
  position: absolute; top: -16rpx; left: 50%; transform: translateX(-50%);
  font-size: 24rpx; color: #E5484D; background: #1A192E;
  padding: 2rpx 16rpx; border-radius: 12rpx; border: 1rpx solid #E5484D;
}
.deal-title { font-size: 36rpx; color: #FFFFFF; font-weight: 700; margin-top: 10rpx; }
.deal-desc { font-size: 26rpx; color: #B8B8C8; margin-top: 12rpx; }
.deal-price { font-size: 32rpx; color: #E0D3A1; font-weight: 700; margin-top: 20rpx; }
.deal-btn {
  margin-top: 24rpx; width: 300rpx; height: 80rpx; line-height: 80rpx;
  background: linear-gradient(135deg, #E0D3A1 0%, #C9B87E 100%);
  color: #0F0E1D; font-size: 30rpx; font-weight: 700; border-radius: 40rpx;
}
.section-title {
  font-size: 30rpx; color: #FFFFFF; font-weight: 600; margin: 40rpx 0 20rpx 0;
}
.gift-card {
  display: flex; align-items: center; gap: 30rpx;
  background: rgba(255,255,255,0.04); border: 1rpx solid #2A293E;
  border-radius: 24rpx; padding: 32rpx; margin-bottom: 20rpx;
}
.gift-avatar { font-size: 64rpx; }
.gift-info { flex: 1; }
.gift-name { font-size: 32rpx; color: #FFFFFF; font-weight: 700; }
.gift-rarity { font-size: 26rpx; color: #E0D3A1; margin-top: 6rpx; }
.gift-desc { font-size: 24rpx; color: #B8B8C8; margin-top: 10rpx; }
.gift-btn {
  width: 160rpx; height: 80rpx; line-height: 80rpx;
  background: linear-gradient(135deg, #E0D3A1 0%, #C9B87E 100%);
  color: #0F0E1D; font-size: 28rpx; font-weight: 700; border-radius: 40rpx;
  flex-shrink: 0;
}
.daily-card {
  display: flex; justify-content: space-between; align-items: center;
  background: rgba(255,255,255,0.04); border: 1rpx solid #2A293E;
  border-radius: 20rpx; padding: 20rpx 32rpx; margin-bottom: 16rpx;
}
.day-label { font-size: 28rpx; color: #E0D3A1; font-weight: 600; }
.day-rewards { display: flex; gap: 12rpx; flex: 1; margin: 0 30rpx; }
.reward-chip {
  font-size: 22rpx; color: #B8B8C8; background: rgba(255,255,255,0.06);
  padding: 4rpx 12rpx; border-radius: 10rpx; border: 1rpx solid #2A293E;
}
.day-status { font-size: 26rpx; color: #4CAF50; font-weight: 600; }
.day-status.claimed { color: #8A8A9E; }
.fund-card {
  margin-top: 30rpx; background: linear-gradient(135deg, rgba(224,211,161,0.1) 0%, rgba(201,184,126,0.05) 100%);
  border: 1rpx solid rgba(224,211,161,0.3); border-radius: 24rpx; padding: 32rpx; text-align: center;
}
.fund-title { font-size: 32rpx; color: #E0D3A1; font-weight: 700; }
.fund-desc { font-size: 26rpx; color: #B8B8C8; margin-top: 12rpx; }
.fund-btn {
  margin-top: 24rpx; width: 300rpx; height: 80rpx; line-height: 80rpx;
  background: #1A192E; color: #FFFFFF; border: 1rpx solid #E0D3A1;
  font-size: 30rpx; font-weight: 700; border-radius: 40rpx;
}
</style>