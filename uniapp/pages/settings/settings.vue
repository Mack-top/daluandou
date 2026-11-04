<template>
  <view class="page">
    <!-- 自定义导航栏（组件化） -->
    <custom-navbar
      title="设置"
      :show-back="true"
      @back="onBack"
    />
    <scroll-view class="scroll" scroll-y="true" show-scrollbar="false">
      <view class="content">
        <!-- 音频设置 -->
        <view class="section-title">音频设置</text>
        <view class="setting-item">
          <text class="setting-label">音乐</text>
          <view class="switch" :class="{on: musicOn}" @tap="toggleMusic"></view>
        </view>
        <view class="setting-item">
          <text class="setting-label">音效</text>
          <view class="switch" :class="{on: sfxOn}" @tap="toggleSfx"></view>
        </view>
        <!-- 语言设置 -->
        <view class="section-title">语言设置</text>
        <view class="setting-item">
          <text class="setting-label">界面语言</text>
          <text class="setting-value">{{ language }}</text>
        </view>
        <!-- 账号 -->
        <view class="setting-item" @tap="onLogout">
          <text class="setting-label">退出登录</text>
          <text class="setting-arrow">▶</text>
        </view>
        <!-- 版本 -->
        <view class="setting-item">
          <text class="setting-label">版本号</text>
          <text class="setting-value">v1.0.0</text>
        </view>
      </view>
    </scroll-view>
  </view>
</template>

<script setup>
import CustomNavbar from '@/pages/components/CustomNavbar.vue';
import { ref } from 'vue';

const musicOn = ref(true);
const sfxOn = ref(true);
const language = ref('简体中文');
const onBack = () => uni.navigateBack();
const toggleMusic = () => {
  musicOn.value = !musicOn.value;
  uni.showToast({ title: musicOn.value ? '音乐已开启' : '音乐已关闭', icon: 'none' });
};
const toggleSfx = () => {
  sfxOn.value = !sfxOn.value;
  uni.showToast({ title: sfxOn.value ? '音效已开启' : '音效已关闭', icon: 'none' });
};
const onLogout = () => {
  uni.showModal({ title: '提示', content: '确定要退出登录吗？', success: (res) => { if (res.confirm) uni.reLaunch({ url: '/pages/index/index' }); } });
};
</script>

<style scoped>
.page { width: 100vw; min-height: 100vh; background: #0F0E1D; }
.scroll { height: 100vh; padding-top: 88rpx; padding-bottom: 100rpx; box-sizing: border-box; }
.content { padding: 0 48rpx; box-sizing: border-box; }
.section-title { font-size: 32rpx; color: #FFFFFF; font-weight: 700; margin: 40rpx 0 24rpx 0; }
.setting-item { display: flex; justify-content: space-between; align-items: center; background: rgba(255,255,255,0.04); border: 1rpx solid #2A293E; border-radius: 20rpx; padding: 20rpx 32rpx; margin-bottom: 16rpx; }
.setting-item:active { background: rgba(255,255,255,0.08); }
.setting-label { font-size: 26rpx; color: #FFFFFF; }
.setting-value { font-size: 24rpx; color: #B8B8C8; }
.setting-arrow { font-size: 24rpx; color: #8A8A9E; flex-shrink: 0; }
.switch { width: 60rpx; height: 32rpx; border-radius: 16rpx; border: 2rpx solid #2A293E; background: #1A192E; position: relative; flex-shrink: 0; }
.switch.on { border-color: #E0D3A1; background: #E0D3A1; }
.switch::after { content: ''; position: absolute; top: 2rpx; left: 2rpx; width: 24rpx; height: 24rpx; background: #0F0E1D; border-radius: 12rpx; transition: left 0.2s; }
.switch.on::after { left: 32rpx; }
</style>