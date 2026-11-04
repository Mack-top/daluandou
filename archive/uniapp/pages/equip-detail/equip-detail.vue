<template>
  <view class="page">
    <view class="navbar">
      <text class="navbar-back" @tap="onBack">◀</text>
      <text class="navbar-title">装备详情</text>
      <view class="navbar-spacer"></view>
    </view>
    <scroll-view class="scroll" scroll-y="true" show-scrollbar="false">
      <view class="content">
        <view class="equip-header">
          <view class="equip-icon">{{ equip.icon }}</text>
          <view class="equip-info">
            <text class="equip-name">{{ equip.name }}</text>
            <text class="equip-rarity">{{ equip.rarity }}</text>
            <text class="equip-slot">{{ equip.slot }}</text>
          </view>
        </view>
        <view class="section-title">属性加成</text>
        <view class="attr-list">
          <view v-for="(a, i) in equip.attrs" :key="i" class="attr-row">
            <text class="attr-name">{{ a.name }}</text>
            <text class="attr-value">+{{ a.value }}</text>
          </view>
        </view>
        <view class="section-title">装备说明</text>
        <text class="equip-desc">{{ equip.desc }}</text>
        <view class="action-section">
          <button class="btn-strengthen" @tap="onStrengthen">强化</button>
          <button class="btn-refine" @tap="onRefine">洗练</button>
          <button class="btn-decompose" @tap="onDecompose">分解</button>
        </view>
      </view>
    </scroll-view>
  </view>
</template>

<script setup>
const equip = {
  name: '星夜头饰',
  rarity: '史诗',
  slot: '头部',
  icon: '👑',
  desc: '被黄金守护灵眷顾的头饰，为佩戴者提供额外防御加成。',
  attrs: [
    { name: '生命', value: 500 },
    { name: '防御', value: 120 },
    { name: '速度', value: 15 }
  ]
};
const onBack = () => uni.navigateBack();
const onStrengthen = () => uni.showToast({ title: '强化开发中', icon: 'none' });
const onRefine = () => uni.showToast({ title: '洗练开发中', icon: 'none' });
const onDecompose = () => uni.showToast({ title: '分解开发中', icon: 'none' });
</script>

<style scoped>
.page { width: 100vw; min-height: 100vh; background: #0F0E1D; }
.navbar { position: fixed; top: 0; left: 0; right: 0; height: 88rpx; display: flex; align-items: center; padding: 0 32rpx; background: #16152A; border-bottom: 1rpx solid #2A293E; z-index: 100; box-sizing: border-box; }
.navbar-back { font-size: 36rpx; color: #FFFFFF; }
.navbar-title { font-size: 34rpx; font-weight: 600; color: #FFFFFF; margin-left: 40rpx; }
.navbar-spacer { flex: 1; }
.scroll { height: 100vh; padding-top: 88rpx; padding-bottom: 100rpx; box-sizing: border-box; }
.content { padding: 0 48rpx; box-sizing: border-box; }
.equip-header { background: rgba(255,255,255,0.04); border: 1rpx solid #2A293E; border-radius: 24rpx; padding: 32rpx; margin-bottom: 30rpx; display: flex; align-items: center; gap: 28rpx; }
.equip-icon { font-size: 64rpx; flex-shrink: 0; }
.equip-info { flex: 1; }
.equip-name { font-size: 34rpx; color: #E0D3A1; font-weight: 700; margin-bottom: 8rpx; }
.equip-rarity { font-size: 26rpx; color: #B8B8C8; margin-bottom: 6rpx; }
.equip-slot { font-size: 24rpx; color: #8A8A9E; }
.section-title { font-size: 32rpx; color: #FFFFFF; font-weight: 700; margin: 30rpx 0 20rpx 0; }
.attr-list { background: rgba(255,255,255,0.04); border: 1rpx solid #2A293E; border-radius: 20rpx; padding: 24rpx 32rpx; margin-bottom: 30rpx; }
.attr-row { display: flex; justify-content: space-between; padding: 12rpx 0; border-bottom: 1rpx solid rgba(255,255,255,0.03); }
.attr-row:last-child { border-bottom: none; }
.attr-name { font-size: 26rpx; color: #FFFFFF; }
.attr-value { font-size: 26rpx; color: #4CAF50; font-weight: 700; }
.equip-desc { font-size: 24rpx; color: #8A8A9E; line-height: 1.6; margin-bottom: 30rpx; }
.action-section { display: flex; gap: 16rpx; margin-bottom: 40rpx; }
.btn-strengthen, .btn-refine, .btn-decompose {
  flex: 1; height: 80rpx; line-height: 80rpx;
  background: rgba(255,255,255,0.06); border: 1rpx solid #2A293E;
  color: #FFFFFF; font-size: 26rpx; border-radius: 40rpx;
}
.btn-strengthen:active, .btn-refine:active, .btn-decompose:active { background: rgba(255,255,255,0.12); }
</style>