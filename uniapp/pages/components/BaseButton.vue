<template>
  <button
    class="base-btn"
    :class="[btnType, { disabled, full }]"
    :disabled="disabled"
    @tap="onTap"
  >
    <slot></slot>
  </button>
</template>

<script setup>
import { computed } from 'vue';

const props = defineProps({
  btnType: { type: String, default: 'primary' }, // 'primary', 'secondary', 'danger', 'text'
  disabled: { type: Boolean, default: false },
  full: { type: Boolean, default: false },
});

const emit = defineEmits(['tap']);

const onTap = () => {
  if (props.disabled) return;
  emit('tap');
};
</script>

<style scoped>
.base-btn {
  display: flex;
  justify-content: center;
  align-items: center;
  border-radius: 50rpx;
  font-size: 32rpx;
  font-weight: 600;
  height: 88rpx;
  line-height: 88rpx;
  text-align: center;
  transition: all 0.2s;
  border: none;
  outline: none;
  width: 100%;
  box-sizing: border-box;
}
.base-btn:active:not(:disabled) {
  transform: scale(0.96);
}
.base-btn:disabled {
  opacity: 0.5;
}

/* 主按钮：金色渐变 */
.base-btn.btn-primary {
  background: linear-gradient(135deg, #E0D3A1 0%, #C9B87E 100%);
  color: #0F0E1D;
}

/* 次按钮：白色边框 */
.base-btn.btn-secondary {
  background-color: rgba(255,255,255,0.06);
  color: #FFFFFF;
  border: 1rpx solid #2A293E;
}

/* 危险按钮：红色 */
.base-btn.btn-danger {
  background-color: #E5484D;
  color: #FFFFFF;
}

/* 文本按钮：无背景 */
.base-btn.btn-text {
  background: none;
  color: #E0D3A1;
}

/* 全宽 */
.base-btn.btn-full {
  width: 100%;
}

/* 大按钮 */
.base-btn.btn-lg {
  height: 104rpx;
  line-height: 104rpx;
  font-size: 36rpx;
  border-radius: 52rpx;
}

/* 小按钮 */
.base-btn.btn-sm {
  height: 64rpx;
  line-height: 64rpx;
  font-size: 24rpx;
  border-radius: 32rpx;
}
</style>