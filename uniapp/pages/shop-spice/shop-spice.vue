<!-- componentized -->
<template>
  <view class="page">
        <custom-navbar title="香料商店" :show-back="true" @back="onBack" />

    <scroll-view class="scroll" scroll-y="true" show-flex="false">
      <view class="content">
        <view class="section-title">稀有商品</text>
        <view class="product-list">
          <view v-for="(p, i) in products" :key="i" class="product-card">
            <view class="product-icon-wrapper">
              <avatar-icon :placeholder-char="p.icon" :size="'md'" :shape="'square'" />
            </view>
            <view class="product-info">
              <text class="product-name">{{ p.name }}</text>
              <text class="product-rarity">{{ p.rarity }}</text>
              <text class="product-desc">{{ p.desc }}</text>
            </view>
            <view class="product-action">
              <text class="product-price">{{ p.price }}</text>
              <base-button class="product-buy" @tap.stop="onBuy(p)">购买</base-button>
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
const products = [
  { name: '食灵契约大礼包', rarity: '传说', desc: '必出 5 星食灵', icon: '📦', price: '灵晶 × 5000' },
  { name: '史诗装备宝箱', rarity: '史诗', desc: '开启获得随机史诗装备', icon: '📦', price: '灵晶 × 1200' },
  { name: '食灵精华大礼', rarity: '稀有', desc: '食灵精华 × 10000', icon: '⚡', price: '金币 × 500000' },
  { name: '升星石 × 20', rarity: '稀有', desc: '用于食灵升星', icon: '💎', price: '金币 × 200000' }
];
const onBack = () => uni.navigateBack();
const onBuy = (p) => uni.showToast({ title: `购买${p.name}`, icon: 'none' });
</script>

<style scoped>
.page { width: 100vw; min-height: 100vh; background: #0F0E1D; }
.scroll { height: 100vh; padding-top: 88rpx; padding-bottom: 100rpx; box-sizing: border-box; }
.content { padding: 0 48rpx; box-sizing: border-box; }
.section-title { font-size: 32rpx; color: #FFFFFF; font-weight: 700; margin: 40rpx 0 24rpx 0; }
.product-list { display: flex; flex-direction: column; gap: 16rpx; }
.product-card { display: flex; justify-content: space-between; align-items: center; background: rgba(255,255,255,0.04); border: 1rpx solid #2A293E; border-radius: 20rpx; padding: 24rpx 32rpx; }
.product-card:active { background: rgba(255,255,255,0.08); }
.product-icon-wrapper { width: 56rpx; height: 56rpx; flex-shrink: 0; }
.product-info { flex: 1; margin: 0 24rpx; }
.product-name { font-size: 26rpx; color: #FFFFFF; font-weight: 600; margin-bottom: 4rpx; }
.product-rarity { font-size: 22rpx; color: #E0D3A1; font-weight: 600; margin-bottom: 6rpx; display: block; }
.product-desc { font-size: 22rpx; color: #8A8A9E; }
.product-action { display: flex; align-items: center; gap: 12rpx; flex-shrink: 0; }
.product-price { font-size: 24rpx; color: #E0D3A1; font-weight: 700; margin-right: 12rpx; }
.product-buy { width: 120rpx; height: 56rpx; line-height: 56rpx; background: linear-gradient(135deg, #E0D3A1 0%, #C9B87E 100%); color: #0F0E1D; font-size: 22rpx; font-weight: 700; border-radius: 28rpx; flex-shrink: 0; }
.product-buy:active { transform: scale(0.96); opacity: 0.85; }
</style>