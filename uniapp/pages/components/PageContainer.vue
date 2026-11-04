<template>
  <view class="page-container">
    <!-- 自定义导航栏 -->
    <custom-navbar
      v-if="showNavbar"
      :title="navbarTitle"
      :show-back="showBack"
      :back-text="backText"
      @back="onBack"
    >
      <template #actions>
        <slot name="navbar-actions"></slot>
      </template>
    </custom-navbar>

    <!-- 页面主体滚动区域 -->
    <scroll-view
      class="scroll"
      scroll-y="true"
      show-scrollbar="false"
      :style="{ paddingTop: navbarHeight, paddingBottom: bottomPadding }"
    >
      <view class="content">
        <slot></slot>
      </view>
    </scroll-view>
  </view>
</template>

<script setup>
import { computed } from 'vue';
import CustomNavbar from './CustomNavbar.vue';

const props = defineProps({
  showNavbar: { type: Boolean, default: true },
  navbarTitle: { type: String, default: '' },
  showBack: { type: Boolean, default: true },
  backText: { type: String, default: '◀' },
  bottomPadding: { type: String, default: '100rpx' },
});

const emit = defineEmits(['back']);

const navbarHeight = computed(() => (props.showNavbar ? '88rpx' : '0'));

const onBack = () => {
  emit('back');
};
</script>

<style scoped>
.page-container {
  width: 100vw;
  min-height: 100vh;
  background-color: #0F0E1D;
  position: relative;
}
.scroll {
  width: 100vw;
  box-sizing: border-box;
}
.content {
  padding: 0 48rpx;
  box-sizing: border-box;
  min-height: 100vh;
}
</style>