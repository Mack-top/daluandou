<template>
  <view class="item-card" :class="{ locked, claimed, active }" @tap="onTap">
    <!-- 物品图标：接入美术资源 -->
    <view class="item-icon-wrapper">
      <avatar-icon
        :item-id="item.iconId"
        :src="item.icon"
        :size="iconSize"
        :shape="iconShape"
        :locked="item.locked"
        rarity="SSR"
      />
    </view>
    <view class="item-content">
      <text class="item-name">{{ item.name }}</text>
      <text class="item-desc">{{ item.desc }}</text>
      <view v-if="item.qty !== undefined" class="item-qty">×{{ item.qty }}</view>
    </view>
    <view class="item-action">
      <slot name="action"></slot>
      <text class="item-arrow">▶</text>
    </view>
  </view>
</template>

<script setup>
import { computed } from 'vue';

const props = defineProps({
  item: { type: Object, required: true },
  locked: { type: Boolean, default: false },
  claimed: { type: Boolean, default: false },
  active: { type: Boolean, default: false },
  iconSize: { type: String, default: 'md' },
  iconShape: { type: String, default: 'square' },
});

const emit = defineEmits(['tap']);

const onTap = () => {
  if (props.locked) return;
  emit('tap', props.item);
};
</script>

<style scoped>
.item-card {
  display: flex;
  justify-content: space-between;
  align-items: center;
  background: rgba(255,255,255,0.04);
  border: 1rpx solid #2A293E;
  border-radius: 20rpx;
  padding: 20rpx 32rpx;
  box-sizing: border-box;
  transition: all 0.2s;
}
.item-card:active {
  background: rgba(255,255,255,0.08);
}
.item-card.locked {
  opacity: 0.6;
}
.item-card.claimed {
  border-color: #4CAF50;
  background: rgba(76,175,80,0.08);
  opacity: 0.85;
}
.item-card.active {
  border-color: #E0D3A1;
  background: rgba(224,211,161,0.1);
}
.item-icon-wrapper {
  width: 72rpx;
  height: 72rpx;
  flex-shrink: 0;
}
.item-content {
  flex: 1;
  margin: 0 24rpx;
}
.item-name {
  font-size: 26rpx;
  color: #FFFFFF;
  font-weight: 600;
  margin-bottom: 4rpx;
}
.item-desc {
  font-size: 22rpx;
  color: #8A8A9E;
  margin-bottom: 6rpx;
}
.item-qty {
  font-size: 22rpx;
  color: #E0D3A1;
  font-weight: 600;
}
.item-action {
  display: flex;
  align-items: center;
  gap: 12rpx;
  flex-shrink: 0;
}
.item-arrow {
  font-size: 26rpx;
  color: #8A8A9E;
}
</style>