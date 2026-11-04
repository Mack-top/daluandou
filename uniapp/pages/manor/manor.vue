<!-- componentized -->
<template>
  <view class="page">
        <custom-navbar title="灵界庄园" :show-back="true" @back="onBack" />

    <scroll-view class="scroll" scroll-y="true" show-scrollbar="false">
      <view class="content">
        <view class="section-title">庄园建筑</text>
        <view class="manor-grid">
          <view v-for="(b, i) in buildings" :key="i" class="building-card" :class="{locked: b.locked}" @tap="onBuildingTap(b)">
            <view class="building-icon">{{ b.icon }}</text>
            <view class="building-info">
              <text class="building-name">{{ b.name }}</text>
              <text class="building-level">Lv.{{ b.level }}</text>
            </view>
            <view class="building-action">
              <text v-if="b.locked" class="lock-text">未解锁</text>
              <base-button v-else class="btn-upgrade" @tap.stop="onUpgrade(b)">升级</base-button>
            </view>
          </view>
        </view>
        <view class="manor-hint">
          <text class="hint-text">升级建筑可提高世界树产出效率</text>
        </view>
      </view>
    </scroll-view>
  </view>
</template>

<script setup>
import CustomNavbar from '@/pages/components/CustomNavbar.vue';
import BaseButton from '@/pages/components/BaseButton.vue';
const buildings = [
  { name: '研制坊', level: 3, icon: '🔧', locked: false },
  { name: '时光屋', level: 2, icon: '⏳', locked: false },
  { name: '集市', level: 1, icon: '🏪', locked: false },
  { name: '占星', level: 1, icon: '🔮', locked: false },
  { name: '世界树', level: 2, icon: '🌳', locked: false },
  { name: '交易坊', level: 1, icon: '💱', locked: true }
];
const onBack = () => uni.navigateBack();
const onBuildingTap = (b) => {
  if (b.locked) { uni.showToast({ title: '建筑未解锁', icon: 'none' }); return; }
  uni.showToast({ title: `进入${b.name}`, icon: 'none' });
};
const onUpgrade = (b) => uni.showToast({ title: `${b.name}升级开发中`, icon: 'none' });
</script>

<style scoped>
.page { width: 100vw; min-height: 100vh; background: #0F0E1D; }
.scroll { height: 100vh; padding-top: 88rpx; padding-bottom: 100rpx; box-sizing: border-box; }
.content { padding: 0 48rpx; box-sizing: border-box; }
.section-title { font-size: 32rpx; color: #FFFFFF; font-weight: 700; margin: 40rpx 0 24rpx 0; }
.manor-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 20rpx; margin-bottom: 40rpx; }
.building-card { background: rgba(255,255,255,0.04); border: 1rpx solid #2A293E; border-radius: 20rpx; padding: 24rpx; text-align: center; position: relative; }
.building-card.locked { opacity: 0.6; border-color: #2A293E; }
.building-card:active { background: rgba(255,255,255,0.08); }
.building-icon { font-size: 48rpx; margin-bottom: 10rpx; }
.building-info { flex: 1; }
.building-name { font-size: 24rpx; color: #FFFFFF; font-weight: 600; margin-bottom: 4rpx; }
.building-level { font-size: 20rpx; color: #E0D3A1; }
.building-action { margin-top: 12rpx; }
.lock-text { font-size: 20rpx; color: #8A8A9E; margin-bottom: 8rpx; display: block; }
.btn-upgrade {
  width: 100%; height: 56rpx; line-height: 56rpx;
  background: linear-gradient(135deg, #E0D3A1 0%, #C9B87E 100%); color: #0F0E1D;
  font-size: 22rpx; font-weight: 700; border-radius: 28rpx;
}
.btn-upgrade:active { transform: scale(0.96); opacity: 0.85; }
.manor-hint { text-align: center; font-size: 22rpx; color: #8A8A9E; padding: 40rpx 0; }
</style>