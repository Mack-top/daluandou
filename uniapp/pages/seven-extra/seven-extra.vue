<!-- componentized -->
<template>
  <view class="page">
    <!-- 自定义导航栏 -->
        <custom-navbar title="七日之约-限时追加" :show-back="true" @back="onBack" />


    <scroll-view class="scroll" scroll-y="true" show-scrollbar="false">
      <view class="content">

        <!-- 追加说明 -->
        <view class="hint-card">
          <text class="hint-title">七日之约-限时追加</text>
          <text class="hint-desc">在七日之约期间，额外获得限时追加奖励</text>
        </view>

        <!-- 追加奖励卡片 -->
        <view class="extra-card">
          <text class="extra-name">七日之约-限时追加</text>
          <view class="extra-rewards">
            <text class="reward-chip">吃货卡包</text>
            <text class="reward-chip">超值基金</text>
          </view>
          <base-button class="btn-view" @tap="onViewDetail">查看详情</base-button>
        </view>

        <!-- 累计登录奖励 -->
        <view class="section-title">累计登录奖励</text>
        <view class="cum-card" v-for="(c, i) in cumulative" :key="i" @tap="onClaimCumulative(c)">
          <text class="cum-label">累计登录 {{ c.day }} 天</text>
          <view class="cum-rewards">
            <text v-for="(r, j) in c.rewards" :key="j" class="reward-chip">{{ r }}</text>
          </view>
          <text class="cum-status" :class="{claimed: c.claimed}">{{ c.claimed ? '已领取' : '领取' }}</text>
        </view>

      </view>
    </scroll-view>
  </view>
</template>

<script setup>
import CustomNavbar from '@/pages/components/CustomNavbar.vue';
import BaseButton from '@/pages/components/BaseButton.vue';
import { ref } from 'vue';

const cumulative = ref([
  { day: 1, rewards: ['食灵契约 × 5', '金币 × 100000'], claimed: true },
  { day: 3, rewards: ['食灵契约 × 10', '食灵精华 × 200'], claimed: true },
  { day: 7, rewards: ['拉菲', '食灵契约 × 5'], claimed: false }
]);

const onBack = () => { uni.navigateBack(); };
const onViewDetail = () => { uni.showToast({ title: '查看七日之约详情', icon: 'none' }); };
const onClaimCumulative = (c) => {
  if (c.claimed) {
    uni.showToast({ title: '已领取', icon: 'none' });
    return;
  }
  c.claimed = true;
  uni.showToast({ title: '累计奖励已发放', icon: 'success' });
};
</script>

<style scoped>
.page { width: 100vw; min-height: 100vh; background-color: #0F0E1D; position: relative; }
.scroll { height: 100vh; padding-top: 88rpx; padding-bottom: 100rpx; box-sizing: border-box; }
.content { padding: 0 48rpx; box-sizing: border-box; }
.hint-card {
  background: rgba(224,211,161,0.1); border: 1rpx solid rgba(224,211,161,0.3);
  border-radius: 24rpx; padding: 32rpx; margin-bottom: 30rpx; text-align: center;
}
.hint-title { font-size: 30rpx; color: #E0D3A1; font-weight: 700; margin-bottom: 12rpx; }
.hint-desc { font-size: 26rpx; color: #B8B8C8; }
.extra-card {
  background: rgba(255,255,255,0.04); border: 1rpx solid #2A293E;
  border-radius: 24rpx; padding: 32rpx; margin-bottom: 30rpx; text-align: center;
}
.extra-name { font-size: 32rpx; color: #FFFFFF; font-weight: 700; margin-bottom: 16rpx; }
.extra-rewards { display: flex; justify-content: center; gap: 16rpx; margin-bottom: 24rpx; }
.reward-chip {
  font-size: 22rpx; color: #B8B8C8; background: rgba(255,255,255,0.06);
  padding: 6rpx 16rpx; border-radius: 12rpx; border: 1rpx solid #2A293E;
}
.btn-view {
  width: 300rpx; height: 80rpx; line-height: 80rpx;
  background: linear-gradient(135deg, #E0D3A1 0%, #C9B87E 100%);
  color: #0F0E1D; font-size: 30rpx; font-weight: 700; border-radius: 40rpx;
}
.section-title {
  font-size: 30rpx; color: #FFFFFF; font-weight: 600; margin: 30rpx 0 20rpx 0;
}
.cum-card {
  display: flex; justify-content: space-between; align-items: center;
  background: rgba(255,255,255,0.04); border: 1rpx solid #2A293E;
  border-radius: 20rpx; padding: 20rpx 32rpx; margin-bottom: 16rpx;
}
.cum-label { font-size: 28rpx; color: #FFFFFF; }
.cum-rewards { display: flex; gap: 14rpx; flex: 1; margin: 0 30rpx; }
.cum-status { font-size: 26rpx; color: #4CAF50; font-weight: 600; }
.cum-status.claimed { color: #8A8A9E; }
</style>