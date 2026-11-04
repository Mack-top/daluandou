<template>
  <view class="page">
    <view class="navbar">
      <text class="navbar-back" @tap="onBack">◀</text>
      <text class="navbar-title">背包</text>
      <view class="navbar-spacer"></view>
    </view>
    <scroll-view class="scroll" scroll-y="true" show-scrollbar="false">
      <view class="content">
        <!-- 标签页 -->
        <view class="tab-bar">
          <view v-for="(t, i) in tabs" :key="i" class="tab-item" :class="{active: activeTab === i}" @tap="activeTab = i">{{ t }}</view>
        </view>
        <!-- 物品列表 -->
        <view class="item-list">
          <view v-for="(item, i) in items[activeTab]" :key="i" class="item-card" @tap="onItemTap(item)">
            <view class="item-icon">{{ item.icon }}</text>
            <view class="item-info">
              <text class="item-name">{{ item.name }}</text>
              <text class="item-desc">{{ item.desc }}</text>
            </view>
            <text class="item-qty">×{{ item.qty }}</text>
            <view class="item-arrow">▶</view>
          </view>
        </view>
        <!-- 底部操作 -->
        <view class="bottom-action">
          <button class="btn-sort" @tap="onSort">整理</button>
          <button class="btn-decompose" @tap="onDecompose">分解</button>
        </view>
      </view>
    </scroll-view>
  </view>
</template>

<script setup>
import { ref } from 'vue';
const tabs = ['全部', '装备', '材料', '消耗'];
const activeTab = ref(0);
const items = {
  0: [
    { name: '史诗装备箱', desc: '开启可获得随机史诗装备', icon: '📦', qty: 3 },
    { name: '食灵契约', desc: '用于召唤新食灵', icon: '📖', qty: 15 },
    { name: '食灵精华', desc: '用于食灵升级', icon: '⚡', qty: 5200 },
    { name: '灵味原浆', desc: '用于主角升级', icon: '🍵', qty: 500000 }
  ],
  1: [
    { name: '星夜头饰', desc: '防御+50', icon: '👑', qty: 1 },
    { name: '灵界法袍', desc: '生命+500', icon: '👕', qty: 1 }
  ],
  2: [
    { name: '升星石', desc: '用于食灵升星', icon: '💎', qty: 12 },
    { name: '觉醒之灵', desc: '用于食灵觉醒', icon: '✨', qty: 3 }
  ],
  3: [
    { name: '小型体力药水', desc: '恢复 60 点体力', icon: '🧪', qty: 5 },
    { name: '中型体力药水', desc: '恢复 150 点体力', icon: '🧪', qty: 2 }
  ]
};
const onBack = () => uni.navigateBack();
const onItemTap = (item) => uni.showToast({ title: `查看${item.name}详情`, icon: 'none' });
const onSort = () => uni.showToast({ title: '背包已整理', icon: 'none' });
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
.tab-bar { display: flex; justify-content: center; gap: 40rpx; margin: 30rpx 0 24rpx 0; border-bottom: 1rpx solid #2A293E; padding-bottom: 16rpx; }
.tab-item { font-size: 28rpx; color: #8A8A9E; padding-bottom: 16rpx; }
.tab-item.active { color: #E0D3A1; border-bottom: 2rpx solid #E0D3A1; font-weight: 600; }
.item-list { display: flex; flex-direction: column; gap: 16rpx; }
.item-card { display: flex; justify-content: space-between; align-items: center; background: rgba(255,255,255,0.04); border: 1rpx solid #2A293E; border-radius: 20rpx; padding: 20rpx 32rpx; }
.item-card:active { background: rgba(255,255,255,0.08); }
.item-icon { font-size: 40rpx; flex-shrink: 0; }
.item-info { flex: 1; margin: 0 24rpx; }
.item-name { font-size: 26rpx; color: #FFFFFF; font-weight: 600; margin-bottom: 4rpx; }
.item-desc { font-size: 22rpx; color: #8A8A9E; }
.item-qty { font-size: 24rpx; color: #E0D3A1; font-weight: 600; }
.item-arrow { font-size: 24rpx; color: #8A8A9E; flex-shrink: 0; }
.bottom-action { display: flex; justify-content: center; gap: 20rpx; margin-top: 40rpx; padding-bottom: 30rpx; }
.btn-sort, .btn-decompose {
  width: 260rpx; height: 72rpx; line-height: 72rpx;
  background: rgba(255,255,255,0.06); border: 1rpx solid #2A293E;
  color: #FFFFFF; font-size: 26rpx; border-radius: 36rpx;
}
.btn-sort:active, .btn-decompose:active { background: rgba(255,255,255,0.12); }
</style>