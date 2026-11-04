<!-- componentized -->
<template>
  <view class="page">
        <custom-navbar title="协会捐献" :show-back="true" @back="onBack" />

    <scroll-view class="scroll" scroll-y="true" show-scrollbar="false">
      <view class="content">
        <view class="section-title">资源捐献</view>
        <text class="section-sub">捐献资源可获得协会币和个人贡献度</text>
        <view class="donate-list">
          <view v-for="(d, i) in donateItems" :key="i" class="donate-card" @tap="onDonate(d)">
            <view class="donate-icon-wrapper">
              <avatar-icon :placeholder-char="d.icon" :size="'md'" :shape="'circle'" />
            </view>
            <view class="donate-info">
              <text class="donate-name">{{ d.name }}</text>
              <text class="donate-desc">{{ d.desc }}</text>
            </view>
            <view class="donate-reward">
              <view class="reward-icon-wrapper">
                <avatar-icon placeholder-char="🪙" :size="'sm'" :shape="'circle'" />
              </view>
              <text class="reward-value">+{{ d.guildCoin }} 协会币</text>
            </view>
          </view>
        </view>
        <!-- 个人贡献 -->
        <view class="contribution-card">
          <text class="contribution-title">今日个人贡献：{{ todayContribution }}</text>
          <view class="progress-bar"><view class="progress-fill" :style="{ width: progressPct + '%' }"></view></view>
          <text class="progress-text">{{ progressCurrent }} / {{ progressTotal }}</text>
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
const donateItems = [
  { name: '金币', desc: '捐献 100 万金币', icon: '💰', guildCoin: 100, cost: 1000000 },
  { name: '食灵精华', desc: '捐献 5000 食灵精华', icon: '⚡', guildCoin: 200, cost: 5000 },
  { name: '食灵契约', desc: '捐献 10 张食灵契约', icon: '📖', guildCoin: 500, cost: 10 },
  { name: '灵晶', desc: '捐献 500 灵晶', icon: '💎', guildCoin: 1000, cost: 500 }
];
const todayContribution = ref(12500);
const progressCurrent = ref(12500);
const progressTotal = ref(50000);
const progressPct = ref(25);
const onBack = () => uni.navigateBack();
const onDonate = (d) => uni.showToast({ title: `捐献${d.name}成功，获得${d.guildCoin}协会币`, icon: 'success' });
</script>

<style scoped>
.page { width: 100vw; min-height: 100vh; background: #0F0E1D; }
.scroll { height: 100vh; padding-top: 88rpx; padding-bottom: 100rpx; box-sizing: border-box; }
.content { padding: 0 48rpx; box-sizing: border-box; }
.section-title { font-size: 32rpx; color: #FFFFFF; font-weight: 700; margin: 40rpx 0 12rpx 0; }
.section-sub { font-size: 24rpx; color: #8A8A9E; margin-bottom: 30rpx; }
.donate-list { display: flex; flex-direction: column; gap: 16rpx; }
.donate-card { display: flex; justify-content: space-between; align-items: center; background: rgba(255,255,255,0.04); border: 1rpx solid #2A293E; border-radius: 20rpx; padding: 24rpx 32rpx; }
.donate-card:active { background: rgba(255,255,255,0.08); }
.donate-icon-wrapper { width: 40rpx; height: 40rpx; flex-shrink: 0; }
.donate-info { flex: 1; margin: 0 24rpx; }
.donate-name { font-size: 26rpx; color: #FFFFFF; font-weight: 600; margin-bottom: 4rpx; }
.donate-desc { font-size: 22rpx; color: #8A8A9E; }
.donate-reward { display: flex; align-items: center; gap: 8rpx; flex-shrink: 0; }
.reward-icon-wrapper { width: 24rpx; height: 24rpx; flex-shrink: 0; }
.reward-value { font-size: 24rpx; color: #E0D3A1; font-weight: 700; }
.contribution-card { background: rgba(255,255,255,0.04); border: 1rpx solid #2A293E; border-radius: 24rpx; padding: 32rpx; margin-top: 40rpx; }
.contribution-title { font-size: 28rpx; color: #E0D3A1; font-weight: 700; margin-bottom: 20rpx; }
.progress-bar { width: 100%; height: 16rpx; background: #2A293E; border-radius: 8rpx; overflow: hidden; margin-bottom: 12rpx; }
.progress-fill { height: 100%; background: linear-gradient(90deg, #E0D3A1, #C9B87E); border-radius: 8rpx; }
.progress-text { font-size: 22rpx; color: #B8B8C8; text-align: center; }
</style>