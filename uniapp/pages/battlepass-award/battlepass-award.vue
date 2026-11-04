<!-- componentized -->
<template>
  <view class="page">
        <custom-navbar title="战令奖励" :show-back="true" @back="onBack" />

    <scroll-view class="scroll" scroll-y="true" show-scrollbar="false">
      <view class="content">
        <view class="section-title">战令奖励</view>
        <view class="card">
          <text class="card-desc">该界面对应参考图 086，视觉与交互逻辑将严格还原设计图。</text>
        </view>
        <view class="action-section">
          <base-button class="btn" @tap="onBack">返回</base-button>
        </view>
      </view>
    </scroll-view>
  </view>
</template>

<script setup>
import CustomNavbar from '@/pages/components/CustomNavbar.vue';
import BaseButton from '@/pages/components/BaseButton.vue';
const onBack = () => uni.navigateBack();
</script>

<style scoped>

.page { width: 100vw; min-height: 100vh; background: #0F0E1D; }
.scroll { height: 100vh; padding-top: 88rpx; padding-bottom: 100rpx; box-sizing: border-box; }
.content { padding: 0 48rpx; box-sizing: border-box; }
.section-title { font-size: 32rpx; color: #FFFFFF; font-weight: 700; margin: 40rpx 0 24rpx 0; }
.card { background: rgba(255,255,255,0.04); border: 1rpx solid #2A293E; border-radius: 24rpx; padding: 32rpx; margin-bottom: 30rpx; }
.btn { width: 600rpx; height: 96rpx; line-height: 96rpx; background: linear-gradient(135deg, #E0D3A1 0%, #C9B87E 100%); color: #0F0E1D; font-size: 34rpx; font-weight: 700; border-radius: 48rpx; box-shadow: 0 8rpx 24rpx rgba(224,211,161,0.3); text-align: center; margin: 0 auto; }
.btn:active { transform: scale(0.96); opacity: 0.85; }

.card-desc { font-size: 24rpx; color: #B8B8C8; line-height: 1.6; }
.action-section { text-align: center; }
</style>