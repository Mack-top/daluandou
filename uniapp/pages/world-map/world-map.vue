<!-- componentized -->
<template>
  <view class="page">
    <!-- 自定义导航栏 -->
        <custom-navbar title="世界地图" :show-back="true" @back="onBack" />


    <scroll-view class="scroll" scroll-y="true" show-scrollbar="false">
      <view class="content">

        <!-- 地图标题 -->
        <view class="map-header">
          <text class="map-title">灵界大陆</text>
          <text class="map-desc">探索各个区域，开启主线冒险</text>
        </view>

        <!-- 区域地图卡片 -->
        <view class="region-list">
          <view
            v-for="(r, i) in regions"
            :key="r.id"
            class="region-card"
            :class="{unlocked: r.unlocked, current: r.current, locked: r.locked}"
            @tap="() => onRegionTap(r)"
          >
            <view class="region-icon-wrapper">
              <avatar-icon :placeholder-char="r.icon" :size="'md'" :shape="'circle'" />
            </view>
            <view class="region-info">
              <text class="region-name">{{ r.name }}</text>
              <text class="region-desc">{{ r.desc }}</text>
              <text class="region-status" :class="{unlocked: r.unlocked, locked: r.locked}">
                {{ r.locked ? '未解锁' : (r.current ? '当前区域' : '可探索') }}
              </text>
            </view>
            <view class="region-arrow-wrapper">
              <avatar-icon placeholder-char="▶" :size="'sm'" :shape="'circle'" />
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
import AvatarIcon from '@/pages/components/AvatarIcon.vue';
import { ref } from 'vue';

const regions = ref([
  { id: 1, name: '迷雾森林', desc: '灵界入口区域，适合新手探索', icon: '🌲', unlocked: true, current: false, locked: false },
  { id: 2, name: '封印之地', desc: '古老封印沉睡之处', icon: '🔒', unlocked: true, current: true, locked: false },
  { id: 3, name: '时空之门', desc: '连接异世界的通道', icon: '🌀', unlocked: false, current: false, locked: true },
  { id: 4, name: '食神殿堂', desc: '食灵们的聚集地', icon: '🍽️', unlocked: false, current: false, locked: true },
  { id: 5, name: '深渊裂隙', desc: '危险与机遇并存', icon: '🌋', unlocked: false, current: false, locked: true }
]);

const onBack = () => { uni.navigateBack(); };

const onRegionTap = (r) => {
  if (r.locked) {
    uni.showToast({ title: '区域未解锁', icon: 'none' });
    return;
  }
  uni.showToast({ title: `进入${r.name}`, icon: 'none' });
  // 后续跳转章节详情页
};
</script>

<style scoped>
.page { width: 100vw; min-height: 100vh; background-color: #0F0E1D; position: relative; }
.scroll { height: 100vh; padding-top: 88rpx; padding-bottom: 100rpx; box-sizing: border-box; }
.content { padding: 0 48rpx; box-sizing: border-box; }
.map-header {
  text-align: center; margin-top: 60rpx; margin-bottom: 40rpx;
}
.map-title { font-size: 40rpx; color: #FFFFFF; font-weight: 700; margin-bottom: 12rpx; }
.map-desc { font-size: 26rpx; color: #B8B8C8; }
.region-list { display: flex; flex-direction: column; gap: 20rpx; }
.region-card {
  display: flex; justify-content: space-between; align-items: center;
  background: rgba(255,255,255,0.04); border: 1rpx solid #2A293E;
  border-radius: 20rpx; padding: 28rpx 32rpx;
}
.region-card:active { background: rgba(255,255,255,0.08); }
.region-card.current { border-color: #E0D3A1; background: rgba(224,211,161,0.1); }
.region-card.locked { opacity: 0.6; }
.region-icon-wrapper { width: 48rpx; height: 48rpx; flex-shrink: 0; }
.region-info { flex: 1; margin: 0 24rpx; }
.region-name { font-size: 30rpx; color: #FFFFFF; font-weight: 600; margin-bottom: 8rpx; }
.region-desc { font-size: 24rpx; color: #8A8A9E; margin-bottom: 8rpx; }
.region-status {
  font-size: 24rpx; font-weight: 600;
}
.region-status.unlocked { color: #E0D3A1; }
.region-status.locked { color: #8A8A9E; }
.region-arrow-wrapper { width: 24rpx; height: 24rpx; flex-shrink: 0; }
</style>