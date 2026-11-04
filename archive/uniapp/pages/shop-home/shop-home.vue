<template>
  <view class="page">
    <view class="navbar">
      <text class="navbar-back" @tap="onBack">◀</text>
      <text class="navbar-title">商店</text>
      <view class="navbar-spacer"></view>
    </view>
    <scroll-view class="scroll" scroll-y="true" show-scrollbar="false">
      <view class="content">
        <view class="section-title">商店分类</text>
        <view class="shop-grid">
          <view class="shop-item" @tap="onEnter('spice')">
            <view class="shop-icon">🌶️</view>
            <text class="shop-name">香料商店</text>
            <text class="shop-desc">稀有/史诗/传说商品</text>
          </view>
          <view class="shop-item" @tap="onEnter('treasure')">
            <view class="shop-icon">🗺️</view>
            <text class="shop-name">藏宝阁</text>
            <text class="shop-desc">限时商品 / 每日刷新</text>
          </view>
          <view class="shop-item" @tap="onEnter('talent')">
            <view class="shop-icon">📜</view>
            <text class="shop-name">天赋商店</text>
            <text class="shop-desc">刻印与天赋道具</text>
          </view>
          <view class="shop-item" @tap="onEnter('gem')">
            <view class="shop-icon">💎</view>
            <text class="shop-name">灵晶商城</text>
            <text class="shop-desc">充值与灵晶礼包</text>
          </view>
        </view>
        <view class="shop-hint">
          <text class="hint-text">不同商店使用不同货币，请查看各商店说明</text>
        </view>
      </view>
    </scroll-view>
  </view>
</template>

<script setup>
const onBack = () => uni.navigateBack();
const onEnter = (type) => {
  const names = { spice: '香料商店', treasure: '藏宝阁', talent: '天赋商店', gem: '灵晶商城' };
  uni.showToast({ title: `进入${names[type]}`, icon: 'none' });
};
</script>

<style scoped>
.page { width: 100vw; min-height: 100vh; background: #0F0E1D; }
.navbar { position: fixed; top: 0; left: 0; right: 0; height: 88rpx; display: flex; align-items: center; padding: 0 32rpx; background: #16152A; border-bottom: 1rpx solid #2A293E; z-index: 100; box-sizing: border-box; }
.navbar-back { font-size: 36rpx; color: #FFFFFF; }
.navbar-title { font-size: 34rpx; font-weight: 600; color: #FFFFFF; margin-left: 40rpx; }
.navbar-spacer { flex: 1; }
.scroll { height: 100vh; padding-top: 88rpx; padding-bottom: 100rpx; box-sizing: border-box; }
.content { padding: 0 48rpx; box-sizing: border-box; }
.section-title { font-size: 32rpx; color: #FFFFFF; font-weight: 700; margin: 40rpx 0 24rpx 0; }
.shop-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 24rpx; margin-bottom: 40rpx; }
.shop-item { background: rgba(255,255,255,0.04); border: 1rpx solid #2A293E; border-radius: 24rpx; padding: 32rpx; text-align: center; display: flex; flex-direction: column; align-items: center; gap: 16rpx; }
.shop-item:active { background: rgba(255,255,255,0.08); }
.shop-icon { font-size: 64rpx; }
.shop-name { font-size: 28rpx; color: #FFFFFF; font-weight: 700; }
.shop-desc { font-size: 22rpx; color: #8A8A9E; }
.shop-hint { text-align: center; font-size: 22rpx; color: #8A8A9E; padding: 40rpx 0; }
</style>