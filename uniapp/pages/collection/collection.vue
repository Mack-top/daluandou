<template>
  <view class="page">
    <view class="navbar">
      <text class="navbar-back" @tap="onBack">◀</text>
      <text class="navbar-title">食灵图鉴</text>
      <view class="navbar-spacer"></view>
    </view>
    <scroll-view class="scroll" scroll-y="true" show-scrollbar="false">
      <view class="content">
        <view class="section-title">已收录食灵 {{ ownedCount }} / {{ totalCount }}</text>
        <view class="collection-grid">
          <view v-for="(c, i) in collections" :key="i" class="collection-card" :class="{owned: c.owned}" @tap="onDetail(c)">
            <view class="collection-avatar">{{ c.icon }}</text>
            <text class="collection-name">{{ c.name }}</text>
            <text class="collection-rarity">{{ c.rarity }}</text>
            <view v-if="!c.owned" class="lock-mask">未解锁</view>
          </view>
        </view>
      </view>
    </scroll-view>
  </view>
</template>

<script setup>
import { ref, computed } from 'vue';
const collections = ref([
  { name: '青团', rarity: 'SR', icon: '🍡', owned: true },
  { name: '蓝纹奶酪', rarity: 'SSR', icon: '🧀', owned: true },
  { name: '冬阴功', rarity: 'SSR', icon: '🍲', owned: true },
  { name: '拉菲', rarity: 'SSR', icon: '🍷', owned: false },
  { name: '咖喱', rarity: 'SSR', icon: '🍛', owned: false }
]);
const ownedCount = computed(() => collections.value.filter(c => c.owned).length);
const totalCount = computed(() => collections.value.length);
const onBack = () => uni.navigateBack();
const onDetail = (c) => {
  if (!c.owned) { uni.showToast({ title: '未招募该食灵', icon: 'none' }); return; }
  uni.showToast({ title: `查看${c.name}详情`, icon: 'none' });
};
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
.collection-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 24rpx; margin-bottom: 40rpx; }
.collection-card { background: rgba(255,255,255,0.04); border: 1rpx solid #2A293E; border-radius: 20rpx; padding: 24rpx; text-align: center; position: relative; }
.collection-card.owned { border-color: #E0D3A1; background: rgba(224,211,161,0.08); }
.collection-card:not(.owned) { opacity: 0.6; }
.collection-card:active { background: rgba(255,255,255,0.08); }
.collection-avatar { font-size: 56rpx; margin-bottom: 10rpx; }
.collection-name { font-size: 26rpx; color: #FFFFFF; font-weight: 600; margin-bottom: 6rpx; }
.collection-rarity { font-size: 20rpx; color: #E0D3A1; font-weight: 600; }
.lock-mask { position: absolute; top: 0; left: 0; right: 0; bottom: 0; background: rgba(0,0,0,0.5); border-radius: 20rpx; display: flex; align-items: center; justify-content: center; font-size: 24rpx; color: #8A8A9E; font-weight: 600; }
</style>