<template>
  <view class="page">
    <view class="navbar">
      <text class="navbar-back" @tap="onBack">◀</text>
      <text class="navbar-title">升星豪礼</text>
      <view class="navbar-spacer"></view>
    </view>
    <scroll-view class="scroll" scroll-y="true" show-scrollbar="false">
      <view class="content">
        <view class="section-title">食灵升星</text>
        <text class="section-sub">提升食星等级，解锁更高属性上限</text>
        <!-- 当前选中的食灵 -->
        <view class="select-card">
          <text class="select-label">当前食灵：</text>
          <text class="select-name">{{ currentChar.name }}</text>
          <text class="select-star">{{ currentChar.rarity }} · 当前 {{ currentChar.star }} 星</text>
        </view>
        <!-- 升星阶段 -->
        <view class="stage-list">
          <view v-for="(s, i) in stages" :key="i" class="stage-card" :class="{active: s.active, locked: s.locked, completed: s.completed}" @tap="onStage(s)">
            <view class="stage-info">
              <text class="stage-name">{{ s.name }}</text>
              <text class="stage-desc">{{ s.desc }}</text>
            </view>
            <view class="stage-rewards">
              <text v-for="(r, j) in s.rewards" :key="j" class="reward-chip">{{ r }}</text>
            </view>
            <view class="stage-action">
              <text v-if="s.completed" class="status-done">已完成</text>
              <text v-else-if="s.locked" class="status-lock">锁定</text>
              <button v-else class="btn-ascend">升星</button>
            </view>
          </view>
        </view>
        <!-- 升星消耗 -->
        <view class="cost-card">
          <text class="cost-title">升星消耗：</text>
          <view class="cost-items">
            <view v-for="(c, i) in costs" :key="i" class="cost-item">
              <text class="cost-icon">{{ c.icon }}</text>
              <text class="cost-value">{{ c.value }}</text>
            </view>
          </view>
        </view>
        <view class="action-section">
          <button class="btn-ascend-main" @tap="onAscendMain">执行升星</button>
        </view>
      </view>
    </scroll-view>
  </view>
</template>

<script setup>
const currentChar = { name: '冬阴功', rarity: '5星SSR', star: 3 };
const stages = [
  { name: '1星→2星', desc: '基础属性提升', rewards: ['食灵精华 × 1000', '金币 × 100000'], active: true, locked: false, completed: false },
  { name: '2星→3星', desc: '解锁新技能槽位', rewards: ['食灵精华 × 3000', '升星石 × 5'], active: false, locked: false, completed: false },
  { name: '3星→4星', desc: '属性上限突破', rewards: ['食灵精华 × 8000', '升星石 × 15'], active: false, locked: true, completed: false },
  { name: '4星→5星', desc: '觉醒隐藏潜能', rewards: ['食灵精华 × 20000', '升星石 × 50'], active: false, locked: true, completed: false }
];
const costs = [
  { icon: '⚡', value: '食灵精华 × 5000' },
  { icon: '💰', value: '金币 × 500000' },
  { icon: '💎', value: '升星石 × 10' }
];
const onBack = () => uni.navigateBack();
const onStage = (s) => {
  if (s.locked) { uni.showToast({ title: '阶段锁定，需先完成前置升星', icon: 'none' }); return; }
  uni.showToast({ title: `选择${s.name}`, icon: 'none' });
};
const onAscendMain = () => uni.showToast({ title: '升星开发中', icon: 'none' });
</script>

<style scoped>
.page { width: 100vw; min-height: 100vh; background: #0F0E1D; }
.navbar { position: fixed; top: 0; left: 0; right: 0; height: 88rpx; display: flex; align-items: center; padding: 0 32rpx; background: #16152A; border-bottom: 1rpx solid #2A293E; z-index: 100; box-sizing: border-box; }
.navbar-back { font-size: 36rpx; color: #FFFFFF; }
.navbar-title { font-size: 34rpx; font-weight: 600; color: #FFFFFF; margin-left: 40rpx; }
.navbar-spacer { flex: 1; }
.scroll { height: 100vh; padding-top: 88rpx; padding-bottom: 100rpx; box-sizing: border-box; }
.content { padding: 0 48rpx; box-sizing: border-box; }
.section-title { font-size: 32rpx; color: #FFFFFF; font-weight: 700; margin: 40rpx 0 12rpx 0; }
.section-sub { font-size: 24rpx; color: #8A8A9E; margin-bottom: 30rpx; }
.select-card { background: rgba(255,255,255,0.04); border: 1rpx solid #2A293E; border-radius: 20rpx; padding: 24rpx 32rpx; margin-bottom: 30rpx; display: flex; justify-content: space-between; align-items: center; }
.select-label { font-size: 24rpx; color: #8A8A9E; }
.select-name { font-size: 30rpx; color: #E0D3A1; font-weight: 700; margin-bottom: 6rpx; display: block; }
.select-star { font-size: 24rpx; color: #B8B8C8; }
.stage-list { display: flex; flex-direction: column; gap: 16rpx; margin-bottom: 30rpx; }
.stage-card { display: flex; justify-content: space-between; align-items: center; background: rgba(255,255,255,0.04); border: 1rpx solid #2A293E; border-radius: 20rpx; padding: 24rpx 32rpx; }
.stage-card.active { border-color: #E0D3A1; background: rgba(224,211,161,0.1); }
.stage-card.locked { opacity: 0.6; }
.stage-card.completed { border-color: #4CAF50; background: rgba(76,175,80,0.08); }
.stage-card:active { background: rgba(255,255,255,0.08); }
.stage-info { flex: 1; }
.stage-name { font-size: 26rpx; color: #FFFFFF; font-weight: 600; margin-bottom: 6rpx; }
.stage-desc { font-size: 22rpx; color: #8A8A9E; }
.stage-rewards { display: flex; gap: 12rpx; flex: 1; margin: 0 30rpx; flex-wrap: wrap; }
.reward-chip { font-size: 20rpx; color: #B8B8C8; background: rgba(255,255,255,0.06); padding: 4rpx 10rpx; border-radius: 10rpx; border: 1rpx solid #2A293E; }
.stage-action { display: flex; align-items: center; gap: 12rpx; flex-shrink: 0; }
.status-done { font-size: 24rpx; color: #4CAF50; font-weight: 600; }
.status-lock { font-size: 24rpx; color: #8A8A9E; font-weight: 600; }
.btn-ascend { width: 120rpx; height: 56rpx; line-height: 56rpx; background: linear-gradient(135deg, #E0D3A1 0%, #C9B87E 100%); color: #0F0E1D; font-size: 22rpx; font-weight: 700; border-radius: 28rpx; flex-shrink: 0; }
.btn-ascend:active { transform: scale(0.96); opacity: 0.85; }
.cost-card { background: rgba(255,255,255,0.04); border: 1rpx solid #2A293E; border-radius: 20rpx; padding: 24rpx 32rpx; margin-bottom: 30rpx; }
.cost-title { font-size: 26rpx; color: #FFFFFF; font-weight: 600; margin-bottom: 16rpx; }
.cost-items { display: flex; gap: 24rpx; flex-wrap: wrap; }
.cost-item { display: flex; align-items: center; gap: 8rpx; }
.cost-icon { font-size: 28rpx; flex-shrink: 0; }
.cost-value { font-size: 24rpx; color: #E0D3A1; font-weight: 600; }
.action-section { text-align: center; }
.btn-ascend-main { width: 600rpx; height: 96rpx; line-height: 96rpx; background: linear-gradient(135deg, #E0D3A1 0%, #C9B87E 100%); color: #0F0E1D; font-size: 34rpx; font-weight: 700; border-radius: 48rpx; box-shadow: 0 8rpx 24rpx rgba(224,211,161,0.3); }
.btn-ascend-main:active { transform: scale(0.96); opacity: 0.85; }
</style>