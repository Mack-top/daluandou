<!-- componentized -->
<template>
  <view class="page">
        <custom-navbar title="世界树" :show-back="true" @back="onBack" />

    <scroll-view class="scroll" scroll-y="true" show-scrollbar="false">
      <view class="content">
        <!-- 世界树主体 -->
        <view class="worldtree-card">
          <text class="tree-icon">🌳</text>
          <text class="tree-name">世界树</text>
          <text class="tree-level">等级：{{ level }}</text>
          <text class="tree-desc">提升世界树等级，增加各设施产出效率</text>
          <view class="progress-bar">
            <view class="progress-fill" :style="{ width: progressPct + '%' }"></view>
          </view>
          <text class="progress-text">{{ currentExp }} / {{ totalExp }}</text>
        </view>
        <!-- 升级按钮 -->
        <view class="action-section">
          <base-button class="btn-upgrade" @tap="onUpgrade">升级世界树</base-button>
        </view>
        <!-- 产出预览 -->
        <view class="section-title">当前产出加成</text>
        <view class="bonus-list">
          <view v-for="(b, i) in bonuses" :key="i" class="bonus-item">
            <text class="bonus-name">{{ b.name }}</text>
            <text class="bonus-value">{{ b.value }}</text>
          </view>
        </view>
      </view>
    </scroll-view>
  </view>
</template>

<script setup>
import CustomNavbar from '@/pages/components/CustomNavbar.vue';
import BaseButton from '@/pages/components/BaseButton.vue';
import { ref } from 'vue';
const level = ref(2);
const currentExp = ref(1500);
const totalExp = ref(3000);
const progressPct = ref(50);
const bonuses = [
  { name: '金币产出', value: '+10%' },
  { name: '食灵精华产出', value: '+10%' },
  { name: '挂机收益', value: '+15%' }
];
const onBack = () => uni.navigateBack();
const onUpgrade = () => uni.showToast({ title: '世界树升级开发中', icon: 'none' });
</script>

<style scoped>
.page { width: 100vw; min-height: 100vh; background: #0F0E1D; }
.scroll { height: 100vh; padding-top: 88rpx; padding-bottom: 100rpx; box-sizing: border-box; }
.content { padding: 0 48rpx; box-sizing: border-box; }
.worldtree-card { background: linear-gradient(135deg, rgba(76,175,80,0.1) 0%, rgba(56,142,60,0.05) 100%); border: 1rpx solid rgba(76,175,80,0.3); border-radius: 24rpx; padding: 40rpx 32rpx; text-align: center; margin-bottom: 30rpx; }
.tree-icon { font-size: 80rpx; margin-bottom: 16rpx; }
.tree-name { font-size: 36rpx; color: #4CAF50; font-weight: 700; margin-bottom: 8rpx; }
.tree-level { font-size: 30rpx; color: #FFFFFF; margin-bottom: 16rpx; }
.tree-desc { font-size: 24rpx; color: #B8B8C8; margin-bottom: 24rpx; }
.progress-bar { width: 100%; max-width: 500rpx; height: 16rpx; background: #2A293E; border-radius: 8rpx; overflow: hidden; margin: 0 auto 12rpx auto; }
.progress-fill { height: 100%; background: linear-gradient(90deg, #4CAF50, #8BC34A); border-radius: 8rpx; }
.progress-text { font-size: 22rpx; color: #8A8A9E; text-align: center; }
.action-section { text-align: center; margin-bottom: 40rpx; }
.btn-upgrade { width: 500rpx; height: 96rpx; line-height: 96rpx; background: linear-gradient(135deg, #E0D3A1 0%, #C9B87E 100%); color: #0F0E1D; font-size: 34rpx; font-weight: 700; border-radius: 48rpx; box-shadow: 0 8rpx 24rpx rgba(224,211,161,0.3); }
.btn-upgrade:active { transform: scale(0.96); opacity: 0.85; }
.section-title { font-size: 32rpx; color: #FFFFFF; font-weight: 700; margin: 30rpx 0 24rpx 0; }
.bonus-list { display: flex; flex-direction: column; gap: 16rpx; }
.bonus-item { display: flex; justify-content: space-between; align-items: center; background: rgba(255,255,255,0.04); border: 1rpx solid #2A293E; border-radius: 20rpx; padding: 20rpx 32rpx; }
.bonus-name { font-size: 26rpx; color: #FFFFFF; }
.bonus-value { font-size: 26rpx; color: #4CAF50; font-weight: 700; }
</style>