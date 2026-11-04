<!-- componentized -->
<template>
  <view class="page">
        <custom-navbar title="补给加速" :show-back="true" @back="onBack" />

    <scroll-view class="scroll" scroll-y="true" show-scrollbar="false">
      <view class="content">
        <view class="section-title">补给加速</view>
        <text class="section-sub">消耗碎钻立即完成补给，获取收益</text>
        <view class="speed-card">
          <text class="speed-time">{{ remaining }}</text>
          <text class="speed-label">剩余补给时间</text>
        </view>
        <view class="action-section">
          <base-button class="btn-speed" @tap="onSpeedUp">碎钻加速</base-button>
        </view>
      </view>
    </scroll-view>
  </view>
</template>

<script setup>
import CustomNavbar from '@/pages/components/CustomNavbar.vue';
import BaseButton from '@/pages/components/BaseButton.vue';
const remaining = ref('00:15:30');
const onBack = () => uni.navigateBack();
const onSpeedUp = () => {
  uni.showModal({ title: '提示', content: '确定消耗碎钻加速补给吗？', success: (res) => { if (res.confirm) uni.showToast({ title: '加速完成', icon: 'success' }); } });
};
</script>

<style scoped>
.page { width: 100vw; min-height: 100vh; background: #0F0E1D; }
.scroll { height: 100vh; padding-top: 88rpx; padding-bottom: 100rpx; box-sizing: border-box; }
.content { padding: 0 48rpx; box-sizing: border-box; display: flex; flex-direction: column; align-items: center; justify-content: center; min-height: 100%; }
.section-title { font-size: 32rpx; color: #FFFFFF; font-weight: 700; margin-bottom: 8rpx; }
.section-sub { font-size: 24rpx; color: #8A8A9E; margin-bottom: 50rpx; }
.speed-card { background: rgba(255,255,255,0.04); border: 1rpx solid #2A293E; border-radius: 24rpx; padding: 40rpx 32rpx; text-align: center; margin-bottom: 50rpx; width: 640rpx; }
.speed-time { font-size: 44rpx; color: #E0D3A1; font-weight: 700; font-family: monospace; margin-bottom: 12rpx; }
.speed-label { font-size: 26rpx; color: #B8B8C8; }
.action-section { width: 100%; }
.btn-speed { width: 600rpx; height: 96rpx; line-height: 96rpx; background: linear-gradient(135deg, #E0D3A1 0%, #C9B87E 100%); color: #0F0E1D; font-size: 34rpx; font-weight: 700; border-radius: 48rpx; box-shadow: 0 8rpx 24rpx rgba(224,211,161,0.3); }
.btn-speed:active { transform: scale(0.96); opacity: 0.85; }
</style>