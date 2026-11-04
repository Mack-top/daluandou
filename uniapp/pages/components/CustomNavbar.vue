<template>
  <view class="custom-navbar">
    <!-- 返回按钮 -->
    <view v-if="showBack" class="navbar-back" @tap="onBack">
      <text class="back-icon">{{ backText }}</text>
    </view>
    <view v-else class="navbar-spacer-left"></view>

    <!-- 页面标题 -->
    <text class="navbar-title">{{ title }}</text>

    <!-- 右侧操作区 -->
    <view class="navbar-actions">
      <slot name="actions"></slot>
    </view>
    <view class="navbar-spacer-right"></view>
  </view>
</template>

<script setup>
import { computed } from 'vue';

const props = defineProps({
  title: { type: String, default: '' },
  showBack: { type: Boolean, default: true },
  backText: { type: String, default: '◀' },
});

const emit = defineEmits(['back']);

const onBack = () => {
  emit('back');
};
</script>

<style scoped>
.custom-navbar {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  height: 88rpx;
  display: flex;
  align-items: center;
  padding: 0 32rpx;
  background-color: #16152A;
  border-bottom: 1rpx solid #2A293E;
  z-index: 100;
  box-sizing: border-box;
  width: 100vw;
}
.navbar-back {
  font-size: 36rpx;
  color: #FFFFFF;
  flex-shrink: 0;
}
.navbar-spacer-left {
  width: 60rpx;
  flex-shrink: 0;
}
.navbar-title {
  font-size: 34rpx;
  font-weight: 600;
  color: #FFFFFF;
  text-align: center;
  flex: 1;
}
.navbar-actions {
  display: flex;
  align-items: center;
  gap: 20rpx;
  flex-shrink: 0;
}
.navbar-spacer-right {
  width: 60rpx;
  flex-shrink: 0;
}
</style>