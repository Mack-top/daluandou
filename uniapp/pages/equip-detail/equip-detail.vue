<!-- componentized -->
<template>
  <view class="page">
        <custom-navbar title="{{ equipName }}" :show-back="true" @back="onBack" />

    <scroll-view class="scroll" scroll-y="true" show-scrollbar="false">
      <view class="content">
        <view class="equip-header">
          <!-- 装备图标：美术资源接入，资源到位后自动显示真实图片 -->
          <view class="equip-icon-container">
            <image class="equip-icon" :src="getItemIcon(iconId)" mode="aspectFill" v-if="iconId" />
            <view class="avatar-placeholder-wrapper" v-if="!iconId">
              <avatar-icon :placeholder-char="equipIcon" :size="'md'" :shape="'circle'" />
            </view>
          </view>
          <view class="equip-info">
            <text class="equip-name">{{ equipName }}</text>
            <text class="equip-rarity" :class="`rarity-${rarity.toLowerCase()}`">{{ rarity }}</text>
            <text class="equip-slot">{{ equipSlot }}</text>
          </view>
        </view>
        <view class="section-title">属性加成</text>
        <view class="attr-list">
          <view v-for="(a, i) in equipAttrs" :key="i" class="attr-row">
            <text class="attr-name">{{ a.name }}</text>
            <text class="attr-value">+{{ a.value }}</text>
          </view>
        </view>
        <view class="section-title">装备说明</text>
        <text class="equip-desc">{{ equipDesc }}</text>
        <view class="action-section">
          <base-button class="btn-strengthen" @tap="onStrengthen">强化</base-button>
          <base-button class="btn-refine" @tap="onRefine">洗练</base-button>
          <base-button class="btn-decompose" @tap="onDecompose">分解</base-button>
        </view>
        <!-- 页面间通信：返回数据给上一级页面 -->
        <view class="comm-tip">
          <text class="comm-text">页面间通信：返回装备数据给主角页</text>
        </view>
      </view>
    </scroll-view>
  </view>
</template>

<script setup>
import CustomNavbar from '@/pages/components/CustomNavbar.vue';
import BaseButton from '@/pages/components/BaseButton.vue';
import AvatarIcon from '@/pages/components/AvatarIcon.vue';
import { ref, onLoad, onUnmounted } from 'vue';
import { useStore } from 'vuex';
import { getItemIcon, getStaticUrl } from '@/utils/resource.js';
import { eventBus } from '@/utils/event-bus.js';

const store = useStore();

// 装备数据（从页面参数读取）
const equipId = ref('');
const iconId = ref('');
const equipIcon = ref('👑');
const equipName = ref('星夜头饰');
const rarity = ref('史诗');
const equipSlot = ref('头部');
const equipDesc = ref('被黄金守护灵眷顾的头饰，为佩戴者提供额外防御加成。');
const equipAttrs = ref([
  { name: '生命', value: 500 },
  { name: '防御', value: 120 },
  { name: '速度', value: 15 },
]);

// 获取装备图标路径
const getItemIcon = (id) => {
  return getItemIcon(id);
};

onLoad((options) => {
  // 接收页面跳转参数（页面间通信）
  if (options.equipId) {
    equipId.value = decodeURIComponent(options.equipId);
    equipName.value = options.equipId; // 实际项目中可从后端或配置表获取完整数据
  }
  if (options.equipIconId) {
    iconId.value = options.equipIconId;
  }
  if (options.from) {
    // 记录来源页面，用于返回时通知
    console.log('装备详情页来源:', options.from);
  }

  // 恢复页面间通信状态
  store.dispatch('restorePageComm');
});

onUnmounted(() => {
  // 页面关闭时，通过 eventBus 向上一级页面发送装备变更通知
  eventBus.emit('equipment-updated', {
    id: equipId.value,
    name: equipName.value,
    rarity: rarity.value,
    slot: equipSlot.value,
    timestamp: new Date().toISOString(),
  });

  // 同时尝试通过 openerChannel 发送（uni-app 原生页面间通信）
  const openerChannel = uni.getOpenerEventChannel();
  if (openerChannel) {
    openerChannel.emit('equipDetailClosed', {
      equipId: equipId.value,
      name: equipName.value,
    });
  }
});

const onBack = () => uni.navigateBack();

const onStrengthen = () => uni.showToast({ title: '强化开发中', icon: 'none' });
const onRefine = () => uni.showToast({ title: '洗练开发中', icon: 'none' });
const onDecompose = () => uni.showToast({ title: '分解开发中', icon: 'none' });
</script>

<style scoped>
.page { width: 100vw; min-height: 100vh; background: #0F0E1D; }
.scroll { height: 100vh; padding-top: 88rpx; padding-bottom: 100rpx; box-sizing: border-box; }
.content { padding: 0 48rpx; box-sizing: border-box; }
.equip-header {
  background: rgba(255,255,255,0.04); border: 1rpx solid #2A293E; border-radius: 24rpx; padding: 32rpx; margin-bottom: 30rpx; display: flex; align-items: center; gap: 28rpx;
}
.equip-icon-container {
  position: relative; width: 100rpx; height: 100rpx; border-radius: 50rpx;
  background: #1A192E; border: 2rpx solid #2A293E; overflow: hidden; flex-shrink: 0;
}
.equip-icon {
  width: 100%; height: 100%; object-fit: cover; display: block;
}
.avatar-placeholder-wrapper {
  width: 100%; height: 100%; border-radius: 50rpx;
  background: linear-gradient(135deg, rgba(255,255,255,0.08) 0%, rgba(255,255,255,0.02) 100%);
  display: flex; align-items: center; justify-content: center;
}
.equip-info { flex: 1; }
.equip-name { font-size: 34rpx; color: #E0D3A1; font-weight: 700; margin-bottom: 8rpx; }
.equip-rarity { font-size: 26rpx; margin-bottom: 6rpx; font-weight: 600; }
.equip-rarity.rarity-史诗 { color: #B8B8C8; border: 1rpx solid #B8B8C8; padding: 2rpx 12rpx; border-radius: 12rpx; background: rgba(184,184,200,0.1); }
.equip-rarity.rarity-ssr { color: #E0D3A1; border: 1rpx solid #E0D3A1; padding: 2rpx 12rpx; border-radius: 12rpx; background: rgba(224,211,161,0.1); }
.equip-rarity.rarity-sr { color: #00D2FF; border: 1rpx solid #00D2FF; padding: 2rpx 12rpx; border-radius: 12rpx; background: rgba(0,210,255,0.1); }
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
/* 页面间通信提示 */
.comm-tip {
  background: rgba(0,210,255,0.1); border: 1rpx solid #00D2FF;
  border-radius: 16rpx; padding: 16rpx 24rpx; margin-bottom: 40rpx;
}
.comm-text { font-size: 22rpx; color: #00D2FF; }
</style>