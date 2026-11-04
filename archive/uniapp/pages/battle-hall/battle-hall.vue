<template>
  <view class="page">
    <!-- 自定义导航栏 -->
    <view class="navbar">
      <text class="navbar-back" @tap="onBack">◀</text>
      <text class="navbar-title">主线关卡大厅</text>
      <view class="navbar-spacer"></view>
    </view>

    <scroll-view class="scroll" scroll-y="true" show-scrollbar="false">
      <view class="content">

        <!-- 篝火挂机区域 -->
        <view class="idle-card">
          <text class="idle-title">篝火挂机</text>
          <view class="idle-status">
            <text class="status-text">补给效率：{{ supplyEfficiency }}%</text>
          </view>
          <view class="idle-actions">
            <button class="btn-idle" @tap="onStartIdle">开始挂机</button>
            <button class="btn-idle" @tap="onCollectIdle">领取收益</button>
          </view>
        </view>

        <!-- 关卡列表 -->
        <view class="section-title">主线关卡</text>
        <view class="stage-list">
          <view
            v-for="(s, i) in stages"
            :key="s.id"
            class="stage-card"
            :class="{cleared: s.cleared, locked: s.locked, current: s.current}"
            @tap="() => onStageTap(s)"
          >
            <view class="stage-info">
              <text class="stage-name">{{ s.name }}</text>
              <text class="stage-desc">{{ s.desc }}</text>
              <view class="stage-stars">
                <text v-for="(star, j) in s.stars" :key="j" class="star">{{ star }}</text>
              </view>
            </view>
            <view class="stage-action">
              <text v-if="s.cleared" class="status-cleared">已通关</text>
              <text v-else-if="s.locked" class="status-locked">未解锁</text>
              <button v-else class="btn-stage">挑战</button>
            </view>
          </view>
        </view>

      </view>
    </scroll-view>
  </view>
</template>

<script setup>
import { ref } from 'vue';

const supplyEfficiency = ref(115);

const stages = ref([
  { id: 1, name: '主线 1-1', desc: '灵界初探', stars: ['★','★','★'], cleared: true, locked: false, current: false },
  { id: 2, name: '主线 1-2', desc: '迷雾森林', stars: ['★','★','☆'], cleared: true, locked: false, current: false },
  { id: 3, name: '主线 1-3', desc: '封印之地', stars: ['★','☆','☆'], cleared: true, locked: false, current: false },
  { id: 4, name: '主线 2-4', desc: '时空之门', stars: [], cleared: false, locked: false, current: true },
  { id: 5, name: '主线 3-8', desc: '食神殿堂', stars: [], cleared: false, locked: true, current: false }
]);

const onBack = () => { uni.navigateBack(); };

const onStartIdle = () => {
  uni.showToast({ title: '开始篝火挂机', icon: 'none' });
};

const onCollectIdle = () => {
  uni.showToast({ title: '收益已发放到邮箱', icon: 'success' });
};

const onStageTap = (s) => {
  if (s.locked) {
    uni.showToast({ title: '关卡未解锁', icon: 'none' });
    return;
  }
  uni.showToast({ title: `进入${s.name}`, icon: 'none' });
  // 后续跳转战斗准备页
};
</script>

<style scoped>
.page { width: 100vw; min-height: 100vh; background-color: #0F0E1D; position: relative; }
.navbar {
  position: fixed; top: 0; left: 0; right: 0; height: 88rpx;
  display: flex; align-items: center; padding: 0 32rpx;
  background-color: #16152A; border-bottom: 1rpx solid #2A293E; z-index: 100; box-sizing: border-box;
}
.navbar-back { font-size: 36rpx; color: #FFFFFF; }
.navbar-title { font-size: 34rpx; font-weight: 600; color: #FFFFFF; margin-left: 40rpx; }
.navbar-spacer { flex: 1; }
.scroll { height: 100vh; padding-top: 88rpx; padding-bottom: 100rpx; box-sizing: border-box; }
.content { padding: 0 48rpx; box-sizing: border-box; }
.idle-card {
  background: linear-gradient(135deg, rgba(224,211,161,0.1) 0%, rgba(201,184,126,0.05) 100%);
  border: 1rpx solid rgba(224,211,161,0.3); border-radius: 24rpx;
  padding: 32rpx; margin-bottom: 30rpx; text-align: center;
}
.idle-title { font-size: 32rpx; color: #E0D3A1; font-weight: 700; margin-bottom: 16rpx; }
.idle-status { margin-bottom: 24rpx; }
.status-text { font-size: 28rpx; color: #FFFFFF; }
.idle-actions { display: flex; gap: 20rpx; justify-content: center; }
.btn-idle {
  flex: 1; max-width: 260rpx; height: 80rpx; line-height: 80rpx;
  background: rgba(255,255,255,0.06); border: 1rpx solid #2A293E;
  color: #FFFFFF; font-size: 26rpx; border-radius: 40rpx;
}
.btn-idle:active { background: rgba(255,255,255,0.12); }
.section-title { font-size: 32rpx; color: #FFFFFF; font-weight: 700; margin: 30rpx 0 24rpx 0; }
.stage-list { display: flex; flex-direction: column; gap: 16rpx; }
.stage-card {
  display: flex; justify-content: space-between; align-items: center;
  background: rgba(255,255,255,0.04); border: 1rpx solid #2A293E;
  border-radius: 20rpx; padding: 20rpx 32rpx;
}
.stage-card.current { border-color: #E0D3A1; background: rgba(224,211,161,0.1); }
.stage-card.cleared { border-color: #4CAF50; background: rgba(76,175,80,0.08); opacity: 0.85; }
.stage-card.locked { opacity: 0.6; }
.stage-info { flex: 1; }
.stage-name { font-size: 28rpx; color: #FFFFFF; font-weight: 600; margin-bottom: 6rpx; }
.stage-desc { font-size: 22rpx; color: #8A8A9E; margin-bottom: 10rpx; }
.stage-stars { display: flex; gap: 6rpx; }
.star { font-size: 22rpx; }
.star:not(:first-child) { color: #2A293E; }
.stage-action { display: flex; align-items: center; gap: 12rpx; }
.status-cleared { font-size: 24rpx; color: #4CAF50; font-weight: 600; }
.status-locked { font-size: 24rpx; color: #8A8A9E; font-weight: 600; }
.btn-stage {
  width: 120rpx; height: 56rpx; line-height: 56rpx;
  background: linear-gradient(135deg, #E0D3A1 0%, #C9B87E 100%);
  color: #0F0E1D; font-size: 24rpx; font-weight: 700; border-radius: 28rpx;
  flex-shrink: 0;
}
</style>