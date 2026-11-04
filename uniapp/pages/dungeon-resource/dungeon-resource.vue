<template>
  <view class="page">
    <view class="navbar">
      <text class="navbar-back" @tap="onBack">◀</text>
      <text class="navbar-title">资源副本</text>
      <view class="navbar-spacer"></view>
    </view>
    <scroll-view class="scroll" scroll-y="true" show-scrollbar="false">
      <view class="content">
        <view class="section-title">资源获取副本</text>
        <view class="resource-list">
          <view v-for="(r, i) in resources" :key="i" class="resource-card" @tap="onEnter(r)">
            <view class="resource-icon">{{ r.icon }}</text>
            <view class="resource-info">
              <text class="resource-name">{{ r.name }}</text>
              <text class="resource-desc">{{ r.desc }}</text>
              <text class="resource-drops">{{ r.drops }}</text>
            </view>
            <view class="resource-arrow">▶</view>
          </view>
        </view>
      </view>
    </scroll-view>
  </view>
</template>

<script setup>
const resources = [
  { name: '金币矿脉', desc: '掉落大量金币', icon: '💰', drops: '金币 × 大量' },
  { name: '食灵精华矿', desc: '掉落食灵精华', icon: '⚡', drops: '食灵精华 × 中量' },
  { name: '升星石矿', desc: '掉落升星石', icon: '💎', drops: '升星石 × 少量' },
  { name: '装备碎片矿', desc: '掉落随机装备碎片', icon: '📦', drops: '装备碎片 × 随机' },
  { name: '经验药水矿', desc: '掉落经验药水', icon: '🧪', drops: '经验药水 × 中量' }
];
const onBack = () => uni.navigateBack();
const onEnter = (r) => uni.showToast({ title = `进入${r.name}`, icon: 'none' });
</script>

<style scoped>
.page { width: 100vw; min-height: 100vh; background: #0F0E1D; }
.navbar { position: fixed; top: 0; left: 0; right: 0; height: 88rpx; display: flex; align-items: center; padding: 0 32rpx; background: #16152A; border-bottom: 1rpx solid #2A293E; z-index: 100; box-sizing: border-box; }
.navbar-back { font-size: 36rpx; color: #FFFFFF; }
.navbar-title { font-size: 34rpx; font-weight: 600; color: #FFFFFF; margin-left: 40rpx; }
.navbar-spacer { flex: 1; }
.scroll { height: 100vh; padding-top: 88rpx; padding-bottom: 100rpx; box-sizing: border-box; }
.content { padding: 0 48rpx; box-sizing: border-box; }
.section-title { font-size: 32rpx; color: #FFFFFF; font-weight: 700; margin: 40rpx 0 24rpx 0; }
.resource-list { display: flex; flex-direction: column; gap: 16rpx; }
.resource-card { display: flex; justify-content: space-between; align-items: center; background: rgba(255,255,255,0.04); border: 1rpx solid #2A293E; border-radius: 20rpx; padding: 24rpx 32rpx; }
.resource-card:active { background: rgba(255,255,255,0.08); }
.resource-icon { font-size: 48rpx; flex-shrink: 0; }
.resource-info { flex: 1; margin: 0 24rpx; }
.resource-name { font-size: 26rpx; color: #FFFFFF; font-weight: 600; margin-bottom: 6rpx; }
.resource-desc { font-size: 22rpx; color: #8A8A9E; margin-bottom: 6rpx; }
.resource-drops { font-size: 22rpx; color: #E0D3A1; font-weight: 600; }
.resource-arrow { font-size: 24rpx; color: #E0D3A1; flex-shrink: 0; }
</style>