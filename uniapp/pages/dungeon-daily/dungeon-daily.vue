<!-- componentized -->
<template>
  <view class="page">
        <custom-navbar title="日常副本" :show-back="true" @back="onBack" />

    <scroll-view class="scroll" scroll-y="true" show-scrollbar="false">
      <view class="content">
        <view class="section-title">每日可挑战副本</text>
        <view class="dungeon-list">
          <view v-for="(d, i) in dungeons" :key="i" class="dungeon-card" :class="{locked: d.locked, cleared: d.cleared}" @tap="onEnter(d)">
            <view class="dungeon-icon">{{ d.icon }}</text>
            <view class="dungeon-info">
              <text class="dungeon-name">{{ d.name }}</text>
              <text class="dungeon-desc">{{ d.desc }}</text>
              <text class="dungeon-cost">体力 {{ d.cost }}</text>
            </view>
            <view class="dungeon-action">
              <text v-if="d.cleared" class="status-done">已完成</text>
              <text v-else-if="d.locked" class="status-lock">锁定</text>
              <base-button v-else class="btn-enter">进入</base-button>
            </view>
          </view>
        </view>
      </view>
    </scroll-view>
  </view>
</template>

<script setup>
import CustomNavbar from '@/pages/components/CustomNavbar.vue';
import BaseButton from '@/pages/components/BaseButton.vue';
const dungeons = [
  { name: '经验副本', desc: '获得大量主角经验', icon: '📚', cost: 10, locked: false, cleared: false },
  { name: '金币副本', desc: '获得大量金币', icon: '💰', cost: 10, locked: false, cleared: true },
  { name: '食灵精华副本', desc: '获得食灵精华', icon: '⚡', cost: 15, locked: false, cleared: false },
  { name: '升星石副本', desc: '获得升星石', icon: '💎', cost: 20, locked: true, cleared: false },
  { name: '装备碎片副本', desc: '获得随机装备碎片', icon: '📦', cost: 20, locked: true, cleared: false }
];
const onBack = () => uni.navigateBack();
const onEnter = (d) => {
  if (d.locked) { uni.showToast({ title = '副本未解锁', icon: 'none' }); return; }
  uni.showToast({ title = `进入${d.name}`, icon: 'none' });
};
</script>

<style scoped>
.page { width: 100vw; min-height: 100vh; background: #0F0E1D; }
.scroll { height: 100vh; padding-top: 88rpx; padding-bottom: 100rpx; box-sizing: border-box; }
.content { padding: 0 48rpx; box-sizing: border-box; }
.section-title { font-size: 32rpx; color: #FFFFFF; font-weight: 700; margin: 40rpx 0 24rpx 0; }
.dungeon-list { display: flex; flex-direction: column; gap: 16rpx; }
.dungeon-card { display: flex; justify-content: space-between; align-items: center; background: rgba(255,255,255,0.04); border: 1rpx solid #2A293E; border-radius: 20rpx; padding: 24rpx 32rpx; }
.dungeon-card.locked { opacity: 0.6; border-color: #2A293E; }
.dungeon-card.cleared { border-color: #4CAF50; background: rgba(76,175,80,0.08); opacity: 0.85; }
.dungeon-card:active { background: rgba(255,255,255,0.08); }
.dungeon-icon { font-size: 48rpx; flex-shrink: 0; }
.dungeon-info { flex: 1; margin: 0 24rpx; }
.dungeon-name { font-size: 26rpx; color: #FFFFFF; font-weight: 600; margin-bottom: 6rpx; }
.dungeon-desc { font-size: 22rpx; color: #8A8A9E; margin-bottom: 6rpx; }
.dungeon-cost { font-size: 20rpx; color: #E0D3A1; font-weight: 600; }
.dungeon-action { display: flex; align-items: center; gap: 12rpx; flex-shrink: 0; }
.status-done { font-size: 22rpx; color: #4CAF50; font-weight: 600; }
.status-lock { font-size: 22rpx; color: #8A8A9E; font-weight: 600; }
.btn-enter { width: 100rpx; height: 48rpx; line-height: 48rpx; background: linear-gradient(135deg, #E0D3A1 0%, #C9B87E 100%); color: #0F0E1D; font-size: 20rpx; font-weight: 700; border-radius: 24rpx; flex-shrink: 0; }
.btn-enter:active { transform: scale(0.96); opacity: 0.85; }
</style>