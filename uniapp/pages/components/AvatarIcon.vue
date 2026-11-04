<template>
  <view class="avatar-wrapper" :class="[size, shape, rarityClass]" :style="style">
    <!-- 真实图片资源（资源到位后自动加载） -->
    <image
      v-if="src"
      class="avatar-image"
      :src="src"
      mode="aspectFill"
      @error="onImageError"
      @load="onImageLoad"
    />
    <!-- 占位：显示首字母或自定义字符 -->
    <view v-else class="avatar-placeholder">{{ displayChar }}</view>
    <!-- 品质边框 -->
    <view v-if="showRarityFrame" class="rarity-frame" :class="`rarity-${rarity}`"></view>
    <!-- 锁定遮罩 -->
    <view v-if="locked" class="lock-mask">🔒</view>
  </view>
</template>

<script setup>
import { ref } from 'vue';
import { getCharacterAvatar, getItemIcon, getStaticUrl } from '@/utils/resource.js';

const props = defineProps({
  src: { type: String, default: '' }, // 直接传入图片URL
  characterId: { type: String, default: '' }, // 角色ID，自动生成头像URL
  itemId: { type: String, default: '' }, // 物品ID，自动生成图标URL
  size: { type: String, default: 'md' }, // 'sm', 'md', 'lg', 'xl'
  shape: { type: String, default: 'circle' }, // 'circle', 'square'
  rarity: { type: String, default: '' }, // 'R', 'SR', 'SSR'
  showRarityFrame: { type: Boolean, default: false },
  locked: { type: Boolean, default: false },
  placeholderChar: { type: String, default: '' }, // 自定义占位字符
});

const emit = defineEmits(['load', 'error']);

const hasRealImage = ref(false);
const imageError = ref(false);

const displayChar = computed(() => {
  if (props.placeholderChar) return props.placeholderChar;
  if (props.characterId) return props.characterId.charAt(0).toUpperCase();
  if (props.itemId) return props.itemId.charAt(0).toUpperCase();
  return '?';
});

const sizeClass = computed(() => {
  const map = { sm: 'avatar-sm', md: 'avatar-md', lg: 'avatar-lg', xl: 'avatar-xl' };
  return map[props.size] || 'avatar-md';
});

const shapeClass = computed(() => {
  return props.shape === 'square' ? 'avatar-square' : 'avatar-circle';
});

const rarityClass = computed(() => {
  return props.rarity ? `rarity-${props.rarity.toLowerCase()}` : '';
});

const style = computed(() => {
  const sizes = { sm: '72rpx', md: '96rpx', lg: '120rpx', xl: '160rpx' };
  const size = sizes[props.size] || sizes.md;
  return {
    width: size,
    height: size,
  };
});

/* 自动生成资源URL */
const resolvedSrc = computed(() => {
  if (props.src) return props.src;
  if (props.characterId) return getCharacterAvatar(props.characterId);
  if (props.itemId) return getItemIcon(props.itemId);
  return '';
});

const onImageLoad = () => {
  hasRealImage.value = true;
  imageError.value = false;
  emit('load');
};

const onImageError = () => {
  imageError.value = true;
  hasRealImage.value = false;
  emit('error');
};
</script>

<style scoped>
.avatar-wrapper {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
  background: rgba(255,255,255,0.04);
  border: 1rpx solid #2A293E;
  flex-shrink: 0;
}
.avatar-wrapper.avatar-circle {
  border-radius: 50%;
}
.avatar-wrapper.avatar-square {
  border-radius: 12rpx;
}
.avatar-wrapper.avatar-sm { width: 72rpx; height: 72rpx; }
.avatar-wrapper.avatar-md { width: 96rpx; height: 96rpx; }
.avatar-wrapper.avatar-lg { width: 120rpx; height: 120rpx; }
.avatar-wrapper.avatar-xl { width: 160rpx; height: 160rpx; }

.avatar-image {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
}

.avatar-placeholder {
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  background: linear-gradient(135deg, rgba(255,255,255,0.08) 0%, rgba(255,255,255,0.02) 100%);
  font-size: 32rpx;
  font-weight: 700;
  color: #E0D3A1;
}

/* 品质边框 */
.rarity-frame {
  position: absolute;
  inset: -2rpx;
  border-radius: inherit;
  pointer-events: none;
  z-index: 5;
}
.rarity-frame.rarity-r { border: 2rpx solid #B8B8C8; }
.rarity-frame.rarity-sr { border: 2rpx solid #00D2FF; box-shadow: 0 0 12rpx rgba(0,210,255,0.3); }
.rarity-frame.rarity-ssr { border: 2rpx solid #E0D3A1; box-shadow: 0 0 16rpx rgba(224,211,161,0.4); }

/* 锁定遮罩 */
.lock-mask {
  position: absolute;
  inset: 0;
  background: rgba(0,0,0,0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 32rpx;
  z-index: 10;
}
</style>