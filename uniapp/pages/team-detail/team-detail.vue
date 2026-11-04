<!-- componentized -->
<template>
  <view class="page">
        <custom-navbar title="阵容说明" :show-back="true" @back="onBack" />

    <scroll-view class="scroll" scroll-y="true" show-scrollbar="false">
      <view class="content">
        <view class="section-title">圣器 / 光环 / 羁绊说明</text>
        <view class="card-grid">
          <view v-for="(c, i) in cards" :key="i" class="detail-card">
            <text class="card-title">{{ c.title }}</text>
            <text class="card-desc">{{ c.desc }}</text>
            <text class="card-effect">{{ c.effect }}</text>
          </view>
        </view>
      </view>
    </scroll-view>
  </view>
</template>

<script setup>
import CustomNavbar from '@/pages/components/CustomNavbar.vue';
import BaseButton from '@/pages/components/BaseButton.vue';
const cards = [
  { title: '圣器系统', desc: '为主角装备圣器，提升基础属性', effect: '攻击 +10%，生命 +10%' },
  { title: '光环系统', desc: '激活光环后为全队提供属性加成', effect: '全队速度 +5%' },
  { title: '羁绊系统', desc: '特定食灵组合激活羁绊，获得额外增益', effect: '火系羁绊：暴击率 +8%' }
];
const onBack = () => uni.navigateBack();
</script>

<style scoped>
.page { width: 100vw; min-height: 100vh; background: #0F0E1D; }
.scroll { height: 100vh; padding-top: 88rpx; padding-bottom: 100rpx; box-sizing: border-box; }
.content { padding: 0 48rpx; box-sizing: border-box; }
.section-title { font-size: 32rpx; color: #FFFFFF; font-weight: 700; margin: 40rpx 0 24rpx 0; }
.card-grid { display: flex; flex-direction: column; gap: 18rpx; }
.detail-card { background: rgba(255,255,255,0.04); border: 1rpx solid #2A293E; border-radius: 20rpx; padding: 28rpx 32rpx; }
.card-title { font-size: 28rpx; color: #E0D3A1; font-weight: 700; margin-bottom: 10rpx; }
.card-desc { font-size: 26rpx; color: #FFFFFF; margin-bottom: 10rpx; }
.card-effect { font-size: 24rpx; color: #8A8A9E; }
</style>