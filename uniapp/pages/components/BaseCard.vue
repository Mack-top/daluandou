<template>
  <view class="base-card" :class="[cardType, { locked, claimed, active }]" @tap="onTap">
    <view class="card-left">
      <slot name="icon"></slot>
      <view class="card-content">
        <slot name="content"></view>
      </view>
    </view>
    <view class="card-right">
      <slot name="action"></slot>
    </view>
  </view>
</template>

<script setup>
import { computed } from 'vue';

const props = defineProps({
  cardType: { type: String, default: '' }, // 'item', 'achievement', 'opponent', 'pool', 'equip'
  locked: { type: Boolean, default: false },
  claimed: { type: Boolean, default: false },
  active: { type: Boolean, default: false },
});

const emit = defineEmits(['tap']);

const onTap = () => {
  if (props.locked) return;
  emit('tap');
};
</script>

<style scoped>
.base-card {
  display: flex;
  justify-content: space-between;
  align-items: center;
  background: rgba(255,255,255,0.04);
  border: 1rpx solid #2A293E;
  border-radius: 20rpx;
  padding: 24rpx 32rpx;
  box-sizing: border-box;
  transition: all 0.2s;
}
.base-card:active {
  background: rgba(255,255,255,0.08);
}
.base-card.locked {
  opacity: 0.6;
}
.base-card.claimed {
  border-color: #4CAF50;
  background: rgba(76,175,80,0.08);
  opacity: 0.85;
}
.base-card.active {
  border-color: #E0D3A1;
  background: rgba(224,211,161,0.1);
}
.card-left {
  display: flex;
  align-items: center;
  gap: 24rpx;
  flex: 1;
}
.card-content {
  flex: 1;
}
.card-right {
  display: flex;
  align-items: center;
  gap: 12rpx;
  flex-shrink: 0;
}
</style>