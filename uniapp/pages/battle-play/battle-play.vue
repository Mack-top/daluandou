<template>
  <view class="page">
    <view class="navbar">
      <text class="navbar-title">战斗进行中</text>
      <view class="navbar-spacer"></view>
    </view>
    <view class="content">
      <!-- 战斗背景 -->
      <view class="battle-bg"></view>
      <!-- 我方食灵 -->
      <view class="side left">
        <text class="side-label">我方</text>
        <view class="member-row">
          <view v-for="(m, i) in myTeam" :key="i" class="battle-member">
            <text class="member-icon">{{ m.icon }}</text>
            <view class="hp-bar"><view class="hp-fill" :style="{ width: m.hpPct + '%' }"></view></view>
            <text class="member-hp">{{ m.hp }}</text>
          </view>
        </view>
      </view>
      <!-- 敌方食灵 -->
      <view class="side right">
        <text class="side-label">敌方</text>
        <view class="member-row">
          <view v-for="(m, i) in enemyTeam" :key="i" class="battle-member">
            <text class="member-icon">{{ m.icon }}</text>
            <view class="hp-bar"><view class="hp-fill" :style="{ width: m.hpPct + '%' }"></view></view>
            <text class="member-hp">{{ m.hp }}</text>
          </view>
        </view>
      </view>
      <!-- 战斗日志 -->
      <view class="battle-log">
        <text class="log-title">战斗日志</text>
        <view class="log-list">
          <text v-for="(l, i) in logs" :key="i" class="log-item">{{ l }}</text>
        </view>
      </view>
      <!-- 底部操作 -->
      <view class="bottom-control">
        <button class="btn-auto" @tap="onAuto">自动战斗</button>
        <button class="btn-skip" @tap="onSkip">跳过</button>
      </view>
    </view>
  </view>
</template>

<script setup>
import { ref } from 'vue';
const myTeam = [
  { name: '青团', icon: '🍡', hp: 4500, hpPct: 90 },
  { name: '蓝纹奶酪', icon: '🧀', hp: 3800, hpPct: 85 }
];
const enemyTeam = [
  { name: '邪恶食神', icon: '👹', hp: 5200, hpPct: 95 },
  { name: '封印使徒', icon: '👺', hp: 4100, hpPct: 70 }
];
const logs = ref([
  '战斗开始！',
  '青团 使用 治疗术，为队友恢复生命',
  '冬阴功 发动 烈焰盛宴，对敌方造成伤害',
  '敌方 邪恶食神 受到致命打击'
]);
const onAuto = () => uni.showToast({ title: '自动战斗已开启', icon: 'none' });
const onSkip = () => {
  uni.showLoading({ title: '计算结果中...' });
  setTimeout(() => { uni.hideLoading(); uni.redirectTo({ url: '/pages/battle-result/battle-result' }); }, 1000);
};
</script>

<style scoped>
.page { width: 100vw; min-height: 100vh; background: #0F0E1D; position: relative; }
.navbar { position: fixed; top: 0; left: 0; right: 0; height: 88rpx; display: flex; align-items: center; padding: 0 32rpx; background: rgba(22,21,42,0.9); border-bottom: 1rpx solid #2A293E; z-index: 100; box-sizing: border-box; }
.navbar-title { font-size: 34rpx; font-weight: 600; color: #FFFFFF; margin-left: 40rpx; }
.navbar-spacer { flex: 1; }
.content { padding-top: 88rpx; padding-bottom: 140rpx; box-sizing: border-box; height: 100vh; display: flex; flex-direction: column; }
.battle-bg { flex: 1; background: radial-gradient(circle at center, rgba(42,41,62,0.6) 0%, #0F0E1D 100%); position: relative; overflow: hidden; }
.side { position: absolute; left: 0; right: 0; display: flex; flex-direction: column; align-items: center; padding: 40rpx 0; }
.side.left { top: 20%; }
.side.right { bottom: 20%; }
.side-label { font-size: 24rpx; color: #8A8A9E; margin-bottom: 16rpx; }
.member-row { display: flex; gap: 30rpx; }
.battle-member { display: flex; flex-direction: column; align-items: center; gap: 8rpx; }
.member-icon { font-size: 56rpx; }
.hp-bar { width: 120rpx; height: 10rpx; background: #2A293E; border-radius: 5rpx; overflow: hidden; }
.hp-fill { height: 100%; background: #4CAF50; border-radius: 5rpx; transition: width 0.5s; }
.member-hp { font-size: 20rpx; color: #B8B8C8; }
.battle-log { background: rgba(0,0,0,0.3); border: 1rpx solid #2A293E; border-radius: 16rpx; padding: 20rpx 32rpx; margin: 0 48rpx 20rpx 48rpx; max-height: 200rpx; }
.log-title { font-size: 24rpx; color: #E0D3A1; margin-bottom: 12rpx; }
.log-list { display: flex; flex-direction: column; gap: 6rpx; }
.log-item { font-size: 22rpx; color: #FFFFFF; line-height: 1.4; }
.bottom-control { display: flex; justify-content: center; gap: 20rpx; padding-bottom: 20rpx; }
.btn-auto, .btn-skip {
  width: 220rpx; height: 72rpx; line-height: 72rpx;
  background: rgba(255,255,255,0.06); border: 1rpx solid #2A293E;
  color: #FFFFFF; font-size: 26rpx; border-radius: 36rpx;
}
.btn-auto:active, .btn-skip:active { background: rgba(255,255,255,0.12); }
</style>