<!-- componentized -->
<template>
  <view class="page">
        <custom-navbar title="占星" :show-back="true" @back="onBack" />

    <scroll-view class="scroll" scroll-y="true" show-scrollbar="false">
      <view class="content">
        <!-- 星图 -->
        <view class="section-title">星图属性加成</text>
        <view class="zodiac-grid">
          <view v-for="(z, i) in zodiacs" :key="i" class="zodiac-card" :class="{active: z.active}">
            <text class="zodiac-name">{{ z.name }}</text>
            <text class="zodiac-effect">{{ z.effect }}</text>
            <view class="zodiac-status">{{ z.active ? '已激活' : '未激活' }}</text>
          </view>
        </view>
        <!-- 占星抽取 -->
        <view class="action-section">
          <base-button class="btn-astrology" @tap="onAstrology">占星抽取</base-button>
        </view>
      </view>
    </scroll-view>
  </view>
</template>

<script setup>
import CustomNavbar from '@/pages/components/CustomNavbar.vue';
import BaseButton from '@/pages/components/BaseButton.vue';
const zodiacs = [
  { name: '白羊座', effect: '攻击 +5%', active: true },
  { name: '金牛座', effect: '生命 +5%', active: true },
  { name: '双子座', effect: '速度 +3%', active: false },
  { name: '巨蟹座', effect: '治疗效果 +5%', active: false },
  { name: '狮子座', effect: '暴击率 +3%', active: false },
  { name: '处女座', effect: '暴伤 +3%', active: false }
];
const onBack = () => uni.navigateBack();
const onAstrology = () => uni.showToast({ title: '占星抽取开发中', icon: 'none' });
</script>

<style scoped>
.page { width: 100vw; min-height: 100vh; background: #0F0E1D; }
.scroll { height: 100vh; padding-top: 88rpx; padding-bottom: 100rpx; box-sizing: border-box; }
.content { padding: 0 48rpx; box-sizing: border-box; }
.section-title { font-size: 32rpx; color: #FFFFFF; font-weight: 700; margin: 40rpx 0 24rpx 0; }
.zodiac-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 20rpx; margin-bottom: 40rpx; }
.zodiac-card { background: rgba(255,255,255,0.04); border: 1rpx solid #2A293E; border-radius: 20rpx; padding: 24rpx; text-align: center; display: flex; flex-direction: column; align-items: center; gap: 10rpx; }
.zodiac-card.active { border-color: #E0D3A1; background: rgba(224,211,161,0.1); }
.zodiac-card:active { background: rgba(255,255,255,0.08); }
.zodiac-name { font-size: 26rpx; color: #FFFFFF; font-weight: 600; }
.zodiac-effect { font-size: 22rpx; color: #8A8A9E; margin-bottom: 8rpx; }
.zodiac-status { font-size: 20rpx; font-weight: 600; }
.zodiac-card.active .zodiac-status { color: #4CAF50; }
.zodiac-card:not(.active) .zodiac-status { color: #8A8A9E; }
.action-section { text-align: center; }
.btn-astrology { width: 500rpx; height: 96rpx; line-height: 96rpx; background: linear-gradient(135deg, #E0D3A1 0%, #C9B87E 100%); color: #0F0E1D; font-size: 34rpx; font-weight: 700; border-radius: 48rpx; box-shadow: 0 8rpx 24rpx rgba(224,211,161,0.3); }
.btn-astrology:active { transform: scale(0.96); opacity: 0.85; }
</style>