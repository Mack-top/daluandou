<!-- componentized -->
<template>
  <view class="page">
    <!-- 自定义导航栏 -->
        <custom-navbar title="战斗回放" :show-back="true" @back="onBack" />


    <scroll-view class="scroll" scroll-y="true" show-scrollbar="false">
      <view class="content">

        <!-- 页面标题 -->
        <view class="section-title">战斗录像列表</text>
        <text class="section-sub">查看历史战斗回放与战报</text>

        <!-- 录像列表 -->
        <view class="record-list">
          <view
            v-for="(r, i) in records"
            :key="i"
            class="record-card"
            @tap="() => onPlay(r)"
          >
            <view class="record-info">
              <text class="record-title">{{ r.title }}</text>
              <text class="record-desc">{{ r.desc }}</text>
              <view class="record-meta">
                <text class="meta-item">{{ r.stage }}</text>
                <text class="meta-item">{{ r.result }}</text>
                <text class="meta-item">{{ r.time }}</text>
              </view>
            </view>
            <view class="record-thumb">
              <text class="thumb-icon">⚔️</text>
            </view>
            <view class="record-arrow">▶</view>
          </view>
        </view>

        <!-- 空状态 -->
        <view v-if="records.length === 0" class="empty-state">
          <text class="empty-icon">📭</text>
          <text class="empty-text">暂无战斗录像</text>
        </view>

      </view>
    </scroll-view>
  </view>
</template>

<script setup>
import CustomNavbar from '@/pages/components/CustomNavbar.vue';
import BaseButton from '@/pages/components/BaseButton.vue';
import { ref } from 'vue';

const records = ref([
  { title: '主线 1-1 灵界初探', desc: '胜利 · MVP：青团', stage: '主线 1-1', result: '胜利', time: '2024-01-15 10:30' },
  { title: '主线 1-2 迷雾森林', desc: '胜利 · MVP：蓝纹奶酪', stage: '主线 1-2', result: '胜利', time: '2024-01-15 10:45' },
  { title: '主线 1-3 封印之地', desc: '胜利 · MVP：冬阴功', stage: '主线 1-3', result: '胜利', time: '2024-01-15 11:10' },
  { title: '日常挑战 灶火不熄', desc: '胜利 · MVP：拉菲', stage: '日常副本', result: '胜利', time: '2024-01-15 14:20' }
]);

const onBack = () => { uni.navigateBack(); };

const onPlay = (record) => {
  uni.showToast({ title: `播放：${record.title}`, icon: 'none' });
  // 后续跳转战斗回放详情页
};
</script>

<style scoped>
.page { width: 100vw; min-height: 100vh; background-color: #0F0E1D; position: relative; }
.scroll { height: 100vh; padding-top: 88rpx; padding-bottom: 100rpx; box-sizing: border-box; }
.content { padding: 0 48rpx; box-sizing: border-box; }
.section-title { font-size: 32rpx; color: #FFFFFF; font-weight: 700; margin: 40rpx 0 12rpx 0; }
.section-sub { font-size: 26rpx; color: #8A8A9E; margin-bottom: 30rpx; }
.record-list { display: flex; flex-direction: column; gap: 18rpx; }
.record-card {
  display: flex; justify-content: space-between; align-items: center;
  background: rgba(255,255,255,0.04); border: 1rpx solid #2A293E;
  border-radius: 20rpx; padding: 24rpx 32rpx;
}
.record-card:active { background: rgba(255,255,255,0.08); }
.record-info { flex: 1; }
.record-title { font-size: 28rpx; color: #FFFFFF; font-weight: 600; margin-bottom: 6rpx; }
.record-desc { font-size: 24rpx; color: #B8B8C8; margin-bottom: 10rpx; }
.record-meta { display: flex; gap: 16rpx; }
.meta-item {
  font-size: 22rpx; color: #8A8A9E; background: rgba(255,255,255,0.06);
  padding: 2rpx 12rpx; border-radius: 10rpx; border: 1rpx solid #2A293E;
}
.record-thumb {
  width: 80rpx; height: 80rpx; border-radius: 16rpx;
  background: #1A192E; border: 1rpx solid #2A293E;
  display: flex; align-items: center; justify-content: center; flex-shrink: 0;
}
.thumb-icon { font-size: 40rpx; }
.record-arrow { font-size: 24rpx; color: #E0D3A1; flex-shrink: 0; }
.empty-state {
  display: flex; flex-direction: column; align-items: center; gap: 16rpx;
  margin-top: 100rpx; text-align: center;
}
.empty-icon { font-size: 64rpx; }
.empty-text { font-size: 28rpx; color: #8A8A9E; }
</style>