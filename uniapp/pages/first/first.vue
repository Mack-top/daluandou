<!-- emoji-replaced -->
<!-- componentized -->
<template>
  <view class="page">
    <!-- 自定义导航栏 -->
        <custom-navbar title="首充赠礼" :show-back="true" @back="onBack" />


    <scroll-view class="scroll" scroll-y="true" show-scrollbar="false">
      <view class="content">

        <!-- 首充大礼包 -->
        <view class="main-gift">
          <text class="gift-tag">萌新首充</text>
          <text class="gift-title">首充赠礼</text>
          <text class="gift-desc">蓝纹奶酪 / 三日礼遇</text>
          <view class="gift-avatar-wrapper">
  <avatar-icon placeholder-char="🧀" :size="'md'" :shape="'circle'" />
</view>
          <text class="gift-char">蓝纹奶酪</text>
          <text class="gift-rarity">5星SSR · 水 · 法术</text>
          <view class="gift-rewards">
            <text class="reward-chip">食灵契约 × 2</text>
            <text class="reward-chip">食灵精华 × 500</text>
            <text class="reward-chip">灵味原浆 × 1000000</text>
          </view>
          <base-button class="btn-first" @tap="onFirstCharge">首充购买</base-button>
        </view>

        <!-- 豪华赠礼 -->
        <view class="section-title">豪华赠礼</text>
        <view class="deluxe-card" v-for="(d, i) in deluxeGifts" :key="i" @tap="onBuyDeluxe(d)">
          <text class="deluxe-label">{{ d.label }}</text>
          <view class="deluxe-rewards">
            <text v-for="(r, j) in d.rewards" :key="j" class="reward-chip">{{ r }}</text>
          </view>
          <text class="deluxe-price">{{ d.price }}</text>
        </view>

        <!-- 充值档位说明 -->
        <view class="hint">
          首次充值任意档位即可获得蓝纹奶酪及三日礼遇奖励，奖励将通过邮件发送。
        </view>

      </view>
    </scroll-view>
  </view>
</template>

<script setup>
import AvatarIcon from '@/pages/components/AvatarIcon.vue';
import CustomNavbar from '@/pages/components/CustomNavbar.vue';
import BaseButton from '@/pages/components/BaseButton.vue';
import { ref } from 'vue';

const deluxeGifts = ref([
  { label: '第一日礼遇', rewards: ['食灵契约 × 2', '金币 × 200000'], price: '6元' },
  { label: '第二日礼遇', rewards: ['食灵契约 × 4', '金币 × 500000'], price: '30元' },
  { label: '第三日礼遇', rewards: ['史诗装备 × 1', '灵晶 × 100', '金币 × 1000000'], price: '68元' }
]);

const onBack = () => { uni.navigateBack(); };
const onFirstCharge = () => { uni.showToast({ title: '前往充值页面', icon: 'none' }); };
const onBuyDeluxe = (d) => { uni.showToast({ title: `购买${d.label}`, icon: 'none' }); };
</script>

<style scoped>
.page { width: 100vw; min-height: 100vh; background-color: #0F0E1D; position: relative; }
.scroll { height: 100vh; padding-top: 88rpx; padding-bottom: 100rpx; box-sizing: border-box; }
.content { padding: 0 48rpx; box-sizing: border-box; }
.main-gift {
  text-align: center; background: rgba(255,255,255,0.04);
  border: 1rpx solid #2A293E; border-radius: 24rpx; padding: 40rpx 32rpx; margin-bottom: 30rpx;
}
.gift-tag { font-size: 24rpx; color: #E5484D; font-weight: 700; margin-bottom: 12rpx; display: block; }
.gift-title { font-size: 36rpx; color: #FFFFFF; font-weight: 700; margin-bottom: 8rpx; }
.gift-desc { font-size: 26rpx; color: #B8B8C8; margin-bottom: 24rpx; }
.gift-avatar { font-size: 80rpx; margin: 20rpx 0; }
.gift-char { font-size: 30rpx; color: #E0D3A1; font-weight: 700; margin-bottom: 6rpx; display: block; }
.gift-rarity { font-size: 24rpx; color: #B8B8C8; margin-bottom: 24rpx; display: block; }
.gift-rewards { display: flex; justify-content: center; gap: 16rpx; margin-bottom: 24rpx; }
.reward-chip {
  font-size: 22rpx; color: #B8B8C8; background: rgba(255,255,255,0.06);
  padding: 6rpx 16rpx; border-radius: 12rpx; border: 1rpx solid #2A293E;
}
.btn-first {
  width: 600rpx; height: 96rpx; line-height: 96rpx;
  background: linear-gradient(135deg, #E0D3A1 0%, #C9B87E 100%);
  color: #0F0E1D; font-size: 34rpx; font-weight: 700; border-radius: 48rpx;
  box-shadow: 0 8rpx 24rpx rgba(224,211,161,0.3);
}
.section-title {
  font-size: 30rpx; color: #FFFFFF; font-weight: 600; margin: 30rpx 0 20rpx 0;
}
.deluxe-card {
  display: flex; justify-content: space-between; align-items: center;
  background: rgba(255,255,255,0.04); border: 1rpx solid #2A293E;
  border-radius: 20rpx; padding: 20rpx 32rpx; margin-bottom: 16rpx;
}
.deluxe-label { font-size: 28rpx; color: #FFFFFF; }
.deluxe-rewards { display: flex; gap: 14rpx; flex: 1; margin: 0 30rpx; }
.deluxe-price { font-size: 26rpx; color: #E0D3A1; font-weight: 700; }
.hint {
  font-size: 24rpx; color: #8A8A9E; text-align: center; margin-top: 40rpx; line-height: 1.6;
}
</style>