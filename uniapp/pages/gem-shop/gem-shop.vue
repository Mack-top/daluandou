<!-- componentized -->
<template>
  <view class="page">
        <custom-navbar title="灵晶商城" :show-back="true" @back="onBack" />

    <scroll-view class="scroll" scroll-y="true" show-scrollbar="false">
      <view class="content">
        <!-- 灵晶余额 -->
        <view class="balance-card">
          <text class="balance-label">当前灵晶：</text>
          <text class="balance-value">{{ gems }}</text>
          <base-button class="btn-recharge" @tap="onRecharge">充值</base-button>
        </view>
        <!-- 商品列表 -->
        <view class="section-title">灵晶礼包</text>
        <view class="product-list">
          <view v-for="(p, i) in products" :key="i" class="product-card" :class="{first: p.first}">
            <view class="product-icon-wrapper">
              <avatar-icon placeholder-char="💎" :size="'md'" :shape="'circle'" />
            </view>
            <view class="product-info">
              <text class="product-name">{{ p.name }}</text>
              <text class="product-desc">{{ p.desc }}</text>
              <text v-if="p.first" class="first-tag">首充双倍</text>
            </view>
            <view class="product-action">
              <text class="product-price">{{ p.price }}</text>
              <base-button class="product-buy" @tap.stop="onBuy(p)">购买</base-button>
            </view>
          </view>
        </view>
        <view class="shop-hint">
          <text class="hint-text">灵晶可用于商店购买、召唤、体力恢复等</text>
        </view>
      </view>
    </scroll-view>
  </view>
</template>

<script setup>
import CustomNavbar from '@/pages/components/CustomNavbar.vue';
import BaseButton from '@/pages/components/BaseButton.vue';
import AvatarIcon from '@/pages/components/AvatarIcon.vue';
import { ref } from 'vue';
const gems = ref(100);
const products = [
  { name: '新手礼包', desc: '食灵契约 × 10，金币 × 100000', price: '灵晶 × 68', first: true },
  { name: '成长基金', desc: '投资返还，累计获得大量灵晶', price: '灵晶 × 300', first: false },
  { name: '月卡', desc: '每日领取灵晶，持续 30 天', price: '灵晶 × 68', first: false },
  { name: '周卡', desc: '每日领取灵晶，持续 7 天', price: '灵晶 × 30', first: false },
  { name: '大额礼包', desc: '灵晶 × 6480，赠送稀有道具', price: '灵晶 × 6480', first: false }
];
const onBack = () => uni.navigateBack();
const onRecharge = () => uni.showToast({ title: '前往充值页面', icon: 'none' });
const onBuy = (p) => uni.showToast({ title: `购买${p.name}`, icon: 'none' });
</script>

<style scoped>
.page { width: 100vw; min-height: 100vh; background: #0F0E1D; }
.scroll { height: 100vh; padding-top: 88rpx; padding-bottom: 100rpx; box-sizing: border-box; }
.content { padding: 0 48rpx; box-sizing: border-box; }
.balance-card { background: linear-gradient(135deg, rgba(224,211,161,0.15) 0%, rgba(201,184,126,0.08) 100%); border: 1rpx solid rgba(224,211,161,0.3); border-radius: 24rpx; padding: 32rpx; margin-bottom: 30rpx; display: flex; justify-content: space-between; align-items: center; }
.balance-label { font-size: 26rpx; color: #FFFFFF; }
.balance-value { font-size: 36rpx; color: #E0D3A1; font-weight: 700; font-family: monospace; }
.btn-recharge { width: 120rpx; height: 56rpx; line-height: 56rpx; background: rgba(255,255,255,0.06); border: 1rpx solid #2A293E; color: #FFFFFF; font-size: 22rpx; border-radius: 28rpx; flex-shrink: 0; }
.btn-recharge:active { background: rgba(255,255,255,0.12); }
.section-title { font-size: 32rpx; color: #FFFFFF; font-weight: 700; margin: 30rpx 0 24rpx 0; }
.product-list { display: flex; flex-direction: column; gap: 16rpx; }
.product-card { display: flex; justify-content: space-between; align-items: center; background: rgba(255,255,255,0.04); border: 1rpx solid #2A293E; border-radius: 20rpx; padding: 24rpx 32rpx; }
.product-card.first { border-color: #E0D3A1; background: rgba(224,211,161,0.1); }
.product-card:active { background: rgba(255,255,255,0.08); }
.product-icon-wrapper { width: 40rpx; height: 40rpx; flex-shrink: 0; }
.product-info { flex: 1; margin: 0 24rpx; }
.product-name { font-size: 26rpx; color: #FFFFFF; font-weight: 600; margin-bottom: 4rpx; }
.product-desc { font-size: 22rpx; color: #8A8A9E; margin-bottom: 6rpx; }
.first-tag { font-size: 18rpx; color: #E5484D; background: rgba(229,72,77,0.15); padding: 2rpx 10rpx; border-radius: 10rpx; border: 1rpx solid rgba(229,72,77,0.3); font-weight: 600; }
.product-action { display: flex; align-items: center; gap: 12rpx; flex-shrink: 0; }
.product-price { font-size: 24rpx; color: #E0D3A1; font-weight: 700; margin-right: 12rpx; }
.product-buy { width: 140rpx; height: 56rpx; line-height: 56rpx; background: linear-gradient(135deg, #E0D3A1 0%, #C9B87E 100%); color: #0F0E1D; font-size: 22rpx; font-weight: 700; border-radius: 28rpx; flex-shrink: 0; }
.product-buy:active { transform: scale(0.96); opacity: 0.85; }
.shop-hint { text-align: center; font-size: 22rpx; color: #8A8A9E; padding: 40rpx 0; }
</style>