<template>
  <view class="page">
    <!-- 自定义导航栏（组件化） -->
    <custom-navbar
      title="背包"
      :show-back="true"
      @back="onBack"
    >
      <template #actions>
        <base-button btn-type="text" @tap="onSort">整理</base-button>
        <base-button btn-type="text" @tap="onDecompose">分解</base-button>
      </template>
    </custom-navbar>

    <scroll-view class="scroll" scroll-y="true" show-scrollbar="false">
      <view class="content">
        <!-- 标签页 -->
        <view class="tab-bar">
          <view v-for="(t, i) in tabs" :key="i" class="tab-item" :class="{active: activeTab === i}" @tap="activeTab = i">{{ t }}</view>
        </view>
        <!-- 物品列表（使用 ItemCard 组件化 + AvatarIcon 美术资源） -->
        <view class="item-list">
          <view v-for="(item, i) in items[activeTab]" :key="i" class="item-card" @tap="onItemTap(item)">
            <!-- 美术资源接入：AvatarIcon 组件，资源到位后自动加载真实图片 -->
            <view class="item-icon-wrapper">
              <avatar-icon
                :placeholder-char="item.icon"
                :size="iconSize"
                :shape="iconShape"
                :locked="item.locked"
              />
            </view>
            <view class="item-info">
              <text class="item-name">{{ item.name }}</text>
              <text class="item-desc">{{ item.desc }}</text>
            </view>
            <text v-if="item.qty !== undefined" class="item-qty">×{{ item.qty }}</text>
            <view class="item-arrow">▶</view>
          </view>
        </view>
      </view>
    </scroll-view>
  </view>
</template>

<script setup>
import { ref } from 'vue';
import CustomNavbar from '@/pages/components/CustomNavbar.vue';
import BaseButton from '@/pages/components/BaseButton.vue';
import AvatarIcon from '@/pages/components/AvatarIcon.vue';

const tabs = ['全部', '装备', '材料', '消耗'];
const activeTab = ref(0);
const iconSize = ref('md');
const iconShape = ref('square');

const items = {
  0: [
    { name: '史诗装备箱', desc: '开启可获得随机史诗装备', icon: '📦', qty: 3, locked: false },
    { name: '食灵契约', desc: '用于召唤新食灵', icon: '📖', qty: 15, locked: false },
    { name: '食灵精华', desc: '用于食灵升级', icon: '⚡', qty: 5200, locked: false },
    { name: '灵味原浆', desc: '用于主角升级', icon: '🍵', qty: 500000, locked: false }
  ],
  1: [
    { name: '星夜头饰', desc: '防御+50', icon: '👑', qty: 1, locked: false },
    { name: '灵界法袍', desc: '生命+500', icon: '👕', qty: 1, locked: false }
  ],
  2: [
    { name: '升星石', desc: '用于食灵升星', icon: '💎', qty: 12, locked: false },
    { name: '觉醒之灵', desc: '用于食灵觉醒', icon: '✨', qty: 3, locked: false }
  ],
  3: [
    { name: '小型体力药水', desc: '恢复 60 点体力', icon: '🧪', qty: 5, locked: false },
    { name: '中型体力药水', desc: '恢复 150 点体力', icon: '🧪', qty: 2, locked: false }
  ]
};

const onBack = () => uni.navigateBack();
const onItemTap = (item) => uni.showToast({ title: `查看${item.name}详情`, icon: 'none' });
const onSort = () => uni.showToast({ title: '背包已整理', icon: 'none' });
const onDecompose = () => uni.showToast({ title: '分解开发中', icon: 'none' });
</script>

<style scoped>
.page { width: 100vw; min-height: 100vh; background: #0F0E1D; }
.scroll { height: 100vh; padding-top: 88rpx; padding-bottom: 100rpx; box-sizing: border-box; }
.content { padding: 0 48rpx; box-sizing: border-box; }
.tab-bar { display: flex; justify-content: center; gap: 40rpx; margin: 30rpx 0 24rpx 0; border-bottom: 1rpx solid #2A293E; padding-bottom: 16rpx; }
.tab-item { font-size: 28rpx; color: #8A8A9E; padding-bottom: 16rpx; }
.tab-item.active { color: #E0D3A1; border-bottom: 2rpx solid #E0D3A1; font-weight: 600; }
.item-list { display: flex; flex-direction: column; gap: 16rpx; }
.item-card { display: flex; justify-content: space-between; align-items: center; background: rgba(255,255,255,0.04); border: 1rpx solid #2A293E; border-radius: 20rpx; padding: 20rpx 32rpx; }
.item-card:active { background: rgba(255,255,255,0.08); }
.item-icon-wrapper {
  width: 72rpx;
  height: 72rpx;
  flex-shrink: 0;
}
.item-info { flex: 1; margin: 0 24rpx; }
.item-name { font-size: 26rpx; color: #FFFFFF; font-weight: 600; margin-bottom: 4rpx; }
.item-desc { font-size: 22rpx; color: #8A8A9E; margin-bottom: 6rpx; }
.item-qty { font-size: 24rpx; color: #E0D3A1; font-weight: 600; }
.item-arrow { font-size: 24rpx; color: #8A8A9E; flex-shrink: 0; }
</style>