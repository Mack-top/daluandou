<!-- componentized -->
<template>
  <view class="page">
        <custom-navbar title="协会宝库" :show-back="true" @back="onBack" />

    <scroll-view class="scroll" scroll-y="true" show-scrollbar="false">
      <view class="content">
        <!-- 宝库余额 -->
        <view class="vault-balance">
          <text class="balance-title">协会宝库余额</text>
          <view class="balance-row">
            <text class="balance-item"><text class="balance-icon">💰</text><text class="balance-value">{{ vault.gold }}</text></text>
            <text class="balance-item"><text class="balance-icon">📖</text><text class="balance-value">{{ vault.contract }}</text></text>
            <text class="balance-item"><text class="balance-icon">⚡</text><text class="balance-value">{{ vault.essence }}</text></text>
          </view>
        </view>
        <!-- 兑换商品 -->
        <view class="section-title">宝库兑换</text>
        <view class="exchange-list">
          <view v-for="(e, i) in exchangeItems" :key="i" class="exchange-card" :class="{locked: e.locked}" @tap="onExchange(e)">
            <view class="exchange-icon">{{ e.icon }}</text>
            <view class="exchange-info">
              <text class="exchange-name">{{ e.name }}</text>
              <text class="exchange-desc">{{ e.desc }}</text>
            </view>
            <view class="exchange-cost">
              <text class="cost-value">{{ e.cost }} 协会币</text>
              <text v-if="e.locked" class="lock-text">需协会 Lv.{{ e.level }}</text>
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
const vault = { gold: 5200000, contract: 850, essence: 45000 };
const exchangeItems = [
  { name: '食灵契约 × 5', desc: '协会成员专属兑换', icon: '📖', cost: 500, locked: false, level: 0 },
  { name: '食灵精华 × 5000', desc: '大量食灵精华兑换', icon: '⚡', cost: 1000, locked: false, level: 0 },
  { name: '史诗装备宝箱', desc: '开启获得随机史诗装备', icon: '📦', cost: 5000, locked: false, level: 0 },
  { name: '协会专属头像框', desc: '彰显协会身份', icon: '🖼️', cost: 20000, locked: true, level: 8 },
  { name: '5星SSR随机食灵', desc: '极品食灵随机获取', icon: '👑', cost: 100000, locked: true, level: 15 }
];
const onBack = () => uni.navigateBack();
const onExchange = (e) => {
  if (e.locked) {
    uni.showToast({ title: `协会等级达到${e.level}级解锁`, icon: 'none' });
    return;
  }
  uni.showToast({ title: '兑换成功，奖励已发放', icon: 'success' });
};
</script>

<style scoped>
.page { width: 100vw; min-height: 100vh; background: #0F0E1D; }
.scroll { height: 100vh; padding-top: 88rpx; padding-bottom: 100rpx; box-sizing: border-box; }
.content { padding: 0 48rpx; box-sizing: border-box; }
.vault-balance { background: linear-gradient(135deg, rgba(224,211,161,0.1) 0%, rgba(201,184,126,0.05) 100%); border: 1rpx solid rgba(224,211,161,0.3); border-radius: 24rpx; padding: 32rpx; margin-bottom: 30rpx; }
.balance-title { font-size: 28rpx; color: #FFFFFF; font-weight: 600; margin-bottom: 20rpx; }
.balance-row { display: flex; justify-content: space-around; }
.balance-item { text-align: center; }
.balance-icon { font-size: 32rpx; margin-bottom: 6rpx; display: block; }
.balance-value { font-size: 28rpx; color: #E0D3A1; font-weight: 700; }
.section-title { font-size: 32rpx; color: #FFFFFF; font-weight: 700; margin: 30rpx 0 24rpx 0; }
.exchange-list { display: flex; flex-direction: column; gap: 16rpx; }
.exchange-card { display: flex; justify-content: space-between; align-items: center; background: rgba(255,255,255,0.04); border: 1rpx solid #2A293E; border-radius: 20rpx; padding: 24rpx 32rpx; }
.exchange-card.locked { opacity: 0.6; border-color: #2A293E; }
.exchange-card:active { background: rgba(255,255,255,0.08); }
.exchange-icon { font-size: 40rpx; flex-shrink: 0; }
.exchange-info { flex: 1; margin: 0 24rpx; }
.exchange-name { font-size: 26rpx; color: #FFFFFF; font-weight: 600; margin-bottom: 4rpx; }
.exchange-desc { font-size: 22rpx; color: #8A8A9E; }
.exchange-cost { display: flex; flex-direction: column; align-items: flex-end; gap: 4rpx; flex-shrink: 0; }
.cost-value { font-size: 24rpx; color: #E0D3A1; font-weight: 700; }
.lock-text { font-size: 20rpx; color: #8A8A9E; }
</style>