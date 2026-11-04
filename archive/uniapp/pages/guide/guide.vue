<template>
  <view class="page">
    <!-- 自定义导航栏 -->
    <view class="navbar">
      <text class="navbar-back" @tap="onBack">◀</text>
      <text class="navbar-title">新手引导</text>
      <view class="navbar-spacer"></view>
    </view>

    <scroll-view class="scroll" scroll-y="true" show-scrollbar="false">
      <view class="content">

        <!-- 引导标题 -->
        <view class="guide-title">欢迎来到《美食大乱斗》</view>
        <view class="guide-subtitle">快速了解游戏核心玩法</view>

        <!-- 引导步骤列表 -->
        <view class="step-list">
          <view v-for="(step, i) in steps" :key="i" class="step-item">
            <view class="step-number">{{ i + 1 }}</view>
            <view class="step-info">
              <text class="step-name">{{ step.name }}</text>
              <text class="step-desc">{{ step.desc }}</text>
            </view>
          </view>
        </view>

        <!-- 进入游戏按钮 -->
        <view class="action-section">
          <button class="btn-enter" @tap="onEnterGame">进入主城</button>
        </view>

      </view>
    </scroll-view>
  </view>
</template>

<script setup>
import { ref } from 'vue';

const steps = [
  { name: '食灵召唤', desc: '通过召唤获得稀有食灵，组建你的梦幻战队' },
  { name: '主城建设', desc: '在主城中升级建筑，解锁更多功能玩法' },
  { name: '战斗冒险', desc: '组队挑战副本，击败强敌获得丰厚奖励' },
  { name: '协会玩法', desc: '加入协会，与协会成员一起参与协会活动' },
  { name: '竞技场', desc: '与其他玩家实时对战，争夺排名和荣誉' }
];

const onBack = () => uni.navigateBack();

const onEnterGame = () => {
  uni.redirectTo({ url: '/pages/lobby/lobby' });
};
</script>

<style scoped>
.page { width: 100vw; min-height: 100vh; background: #0F0E1D; }
.navbar {
  position: fixed; top: 0; left: 0; right: 0; height: 88rpx;
  display: flex; align-items: center; padding: 0 32rpx;
  background: #16152A; border-bottom: 1rpx solid #2A293E; z-index: 100; box-sizing: border-box;
}
.navbar-back { font-size: 36rpx; color: #FFFFFF; }
.navbar-title { font-size: 34rpx; font-weight: 600; color: #FFFFFF; margin-left: 40rpx; }
.navbar-spacer { flex: 1; }
.scroll { height: 100vh; padding-top: 88rpx; padding-bottom: 100rpx; box-sizing: border-box; }
.content { padding: 0 48rpx; box-sizing: border-box; }
.guide-title {
  font-size: 40rpx; color: #FFFFFF; font-weight: 700;
  text-align: center; margin: 60rpx 0 16rpx 0;
}
.guide-subtitle {
  font-size: 28rpx; color: #B8B8C8;
  text-align: center; margin-bottom: 50rpx;
}
.step-list { display: flex; flex-direction: column; gap: 24rpx; margin-bottom: 50rpx; }
.step-item {
  display: flex; align-items: flex-start; gap: 20rpx;
  background: rgba(255,255,255,0.04); border: 1rpx solid #2A293E;
  border-radius: 20rpx; padding: 24rpx 32rpx;
}
.step-number {
  width: 48rpx; height: 48rpx; line-height: 48rpx; text-align: center;
  background: linear-gradient(135deg, #E0D3A1 0%, #C9B87E 100%);
  color: #0F0E1D; font-size: 24rpx; font-weight: 700; border-radius: 24rpx;
  flex-shrink: 0;
}
.step-info { flex: 1; }
.step-name {
  font-size: 28rpx; color: #FFFFFF; font-weight: 600; margin-bottom: 8rpx;
}
.step-desc {
  font-size: 24rpx; color: #8A8A9E; line-height: 1.5;
}
.action-section { margin-bottom: 40rpx; }
.btn-enter {
  width: 600rpx; height: 96rpx; line-height: 96rpx;
  background: linear-gradient(135deg, #E0D3A1 0%, #C9B87E 100%);
  color: #0F0E1D; font-size: 36rpx; font-weight: 700;
  border-radius: 48rpx; box-shadow: 0 8rpx 24rpx rgba(224, 211, 161, 0.3);
}
.btn-enter:active { opacity: 0.85; }
</style>