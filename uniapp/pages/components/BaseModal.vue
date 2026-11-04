<template>
  <view v-if="visible" class="modal-overlay" @tap="onOverlayTap">
    <view class="modal-container" @tap.stop>
      <slot name="header"></slot>
      <view class="modal-body">
        <slot></slot>
      </view>
      <slot name="footer"></slot>
    </view>
  </view>
</template>

<script setup>
import { ref } from 'vue';

const props = defineProps({
  visible: { type: Boolean, default: false },
  closeOnOverlayClick: { type: Boolean, default: true },
});

const emit = defineEmits(['update:visible', 'close']);

const onOverlayTap = () => {
  if (props.closeOnOverlayClick) {
    emit('update:visible', false);
    emit('close');
  }
};
</script>

<style scoped>
.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0,0,0,0.6);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 200;
  width: 100vw;
  height: 100vh;
}
.modal-container {
  background: #1A192E;
  border: 1rpx solid #2A293E;
  border-radius: 24rpx;
  padding: 40rpx;
  width: 750rpx;
  max-width: 90vw;
  box-sizing: border-box;
  animation: modalFadeIn 0.2s ease;
}
@keyframes modalFadeIn {
  from { opacity: 0; transform: scale(0.95); }
  to { opacity: 1; transform: scale(1); }
}
.modal-body {
  margin: 24rpx 0;
  min-height: 100rpx;
}
</style>