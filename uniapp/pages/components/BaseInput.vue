<template>
  <view class="input-item">
    <view v-if="label" class="input-label">{{ label }}</view>
    <view class="input-box" :class="{ error }">
      <input
        class="input-inner"
        v-model="modelValue"
        :type="type"
        :placeholder="placeholder"
        :disabled="disabled"
        :maxlength="maxlength"
        @input="onInput"
        @focus="onFocus"
        @blur="onBlur"
      />
      <view v-if="showPassword" class="input-toggle" @tap="togglePassword">{{ passwordVisible ? '🙈' : '👁' }}</view>
    </view>
    <view v-if="errorMessage" class="input-error">{{ errorMessage }}</view>
  </view>
</template>

<script setup>
import { ref, computed } from 'vue';

const props = defineProps({
  modelValue: { type: String, default: '' },
  label: { type: String, default: '' },
  type: { type: String, default: 'text' },
  placeholder: { type: String, default: '' },
  disabled: { type: Boolean, default: false },
  maxlength: { type: Number, default: 0 },
  error: { type: Boolean, default: false },
  errorMessage: { type: String, default: '' },
  showPassword: { type: Boolean, default: false },
});

const emit = defineEmits(['update:modelValue', 'input', 'focus', 'blur']);

const passwordVisible = ref(false);

const onInput = (e) => {
  emit('update:modelValue', e.detail.value);
  emit('input', e.detail.value);
};

const onFocus = (e) => emit('focus', e.detail);
const onBlur = (e) => emit('blur', e.detail);

const togglePassword = () => {
  if (props.showPassword) {
    passwordVisible.value = !passwordVisible.value;
  }
};

const inputType = computed(() => {
  if (props.showPassword && props.type === 'password') {
    return passwordVisible.value ? 'text' : 'password';
  }
  return props.type;
});
</script>

<style scoped>
.input-item {
  display: flex;
  flex-direction: column;
  margin-bottom: 32rpx;
}
.input-label {
  font-size: 28rpx;
  color: #B8B8C8;
  margin-bottom: 12rpx;
}
.input-box {
  display: flex;
  align-items: center;
  background-color: rgba(255,255,255,0.06);
  border: 1rpx solid #2A293E;
  border-radius: 20rpx;
  padding: 0 24rpx;
  height: 88rpx;
  box-sizing: border-box;
  position: relative;
}
.input-box.error {
  border-color: #E5484D;
}
.input-inner {
  flex: 1;
  color: #FFFFFF;
  font-size: 30rpx;
  height: 100%;
  line-height: 88rpx;
  background: transparent;
  border: none;
  outline: none;
}
.input-toggle {
  font-size: 28rpx;
  color: #8A8A9E;
  padding: 0 12rpx;
}
.input-error {
  font-size: 24rpx;
  color: #E5484D;
  margin-top: 8rpx;
}
</style>