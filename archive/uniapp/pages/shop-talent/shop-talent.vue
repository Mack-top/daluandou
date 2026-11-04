<template>
  <view class="page">
    <view class="navbar">
      <text class="navbar-back" @tap="onBack">◀</text>
      <text class="navbar-title">天赋商店</text>
      <view class="navbar-spacer"></view>
    </view>
    <scroll-view class="scroll" scroll-y="true" show-scrollbar="false">
      <view class="content">
        <view class="section-title">刻印道具</text>
        <text class="section-sub">购买天赋刻印相关道具，提升食灵潜能</text>
        <view class="product-list">
          <view v-for="(p, i) in products" :key="i" class="product-card" :class="{locked: p.locked}">
            <view class="product-icon">{{ p.icon }}</text>
            <view class="product-info">
              <text class="product-name">{{ p.name }}</text>
              <text class="product-desc">{{ p.desc }}</text>
              <text v-if="p.locked" class="lock-text">主角 Lv.{{ p.level }} 解锁</text>
            </view>
            <view class="product-action">
              <text class="product-price">{{ p.price }}</text>
              <button v-if="!p.locked" class="product-buy" @tap.stop="onBuy(p)">购买</button>
              <view v-else class="lock-btn">锁定</view>
            </view>
          </view>
        </view>
      </view>
    </scroll-view>
  </view>
</template>

<script setup>
const products = [
  { name: '基础刻印石', desc: '用于食灵基础天赋刻印', icon: '📜', price: '金币 × 100000', locked: false, level: 0 },
  { name: '高级刻印石', desc: '用于食灵高级天赋刻印', icon: '📜', price: '灵晶 × 300', locked: false, level: 0 },
  { name: '天赋重置卷', desc: '重置食灵天赋分配', icon: '🔄', price: '灵晶 × 800', locked: true, level: 30 },
  { name: '天赋潜能果', desc: '永久提升食灵天赋上限', icon: '🍎', price: '灵晶 × 1500', locked: true, level: 50 }
];
const onBack = () => uni.navigateBack();
const onBuy = (p) => uni.showToast({ title: `购买${p.name}`, icon: 'none' });
</script>

<style scoped>
.page { width: 100vw; min-height: 100vh; background: #0F0E1D; }
.navbar { position: fixed; top: 0; left: 0; right: 0; height: 88rpx; display: flex; align-items: center; padding: 0 32rpx; background: #16152A; border-bottom: 1rpx solid #2A293E; z-index: 100; box-sizing: border-box; }
.navbar-back { font-size: 36rpx; color: #FFFFFF; }
.navbar-title { font-size: 34rpx; font-weight: 600; color: #FFFFFF; margin-left: 40rpx; }
.navbar-spacer { flex: 1; }
.scroll { height: 100vh; padding-top: 88rpx; padding-bottom: 100rpx; box-sizing: border-box; }
.content { padding: 0 48rpx; box-sizing: border-box; }
.section-title { font-size: 32rpx; color: #FFFFFF; font-weight: 700; margin: 40rpx 0 12rpx 0; }
.section-sub { font-size: 24rpx; color: #8A8A9E; margin-bottom: 30rpx; }
.product-list { display: flex; flex-direction: column; gap: 16rpx; }
.product-card { display: flex; justify-content: space-between; align-items: center; background: rgba(255,255,255,0.04); border: 1rpx solid #2A293E; border-radius: 20rpx; padding: 24rpx 32rpx; }
.product-card.locked { opacity: 0.6; border-color: #2A293E; }
.product-card:active { background: rgba(255,255,255,0.08); }
.product-icon { font-size: 40rpx; flex-shrink: 0; }
.product-info { flex: 1; margin: 0 24rpx; }
.product-name { font-size: 26rpx; color: #FFFFFF; font-weight: 600; margin-bottom: 4rpx; }
.product-desc { font-size: 22rpx; color: #8A8A9E; margin-bottom: 6rpx; }
.lock-text { font-size: 20rpx; color: #8A8A9E; }
.product-action { display: flex; align-items: center; gap: 12rpx; flex-shrink: 0; }
.product-price { font-size: 24rpx; color: #E0D3A1; font-weight: 700; margin-right: 12rpx; }
.product-buy { width: 120rpx; height: 56rpx; line-height: 56rpx; background: linear-gradient(135deg, #E0D3A1 0%, #C9B87E 100%); color: #0F0E1D; font-size: 22rpx; font-weight: 700; border-radius: 28rpx; flex-shrink: 0; }
.product-buy:active { transform: scale(0.96); opacity: 0.85; }
.lock-btn { width: 120rpx; height: 56rpx; line-height: 56rpx; background: #2A293E; color: #8A8A9E; font-size: 22rpx; border-radius: 28rpx; flex-shrink: 0; }
</style>