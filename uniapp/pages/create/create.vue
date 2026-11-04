<!-- componentized -->
<template>
  <view class="page">
    <!-- 自定义导航栏 -->
        <custom-navbar title="初识灵界" :show-back="true" @back="onBack" />


    <scroll-view class="scroll" scroll-y="true" show-scrollbar="false">
      <view class="content">

        <!-- 欢迎语 -->
        <view class="welcome">
          <text class="welcome-title">尊贵的命运之子：</text>
          <text class="welcome-desc">
            欢迎来到灵界，每一个灵界生灵都会有自己的名字哟，你的名字是？
          </text>
        </view>

        <!-- 名字输入 -->
        <view class="input-section">
          <text class="input-label">你的名字</text>
          <view class="input-box">
            <input
              v-model="playerName"
              placeholder="请输入角色名称（2-8个字符）"
              maxlength="8"
              @input="onNameInput"
            />
          </view>
          <text v-if="nameError" class="error-tip">{{ nameError }}</text>
        </view>

        <!-- 性别选择 -->
        <view class="gender-section">
          <text class="section-title">性别选择</text>
          <view class="gender-options">
            <view
              v-for="g in genders"
              :key="g.value"
              class="gender-item"
              :class="{selected: selectedGender === g.value}"
              @tap="selectedGender = g.value"
            >
              <view class="gender-icon">{{ g.icon }}</view>
              <text class="gender-label">{{ g.label }}</text>
            </view>
          </view>
        </view>

        <!-- 食灵形象选择 -->
        <view class="avatar-section">
          <text class="section-title">选择初始食灵形象</text>
          <view class="avatar-grid">
            <view
              v-for="a in avatars"
              :key="a.id"
              class="avatar-item"
              :class="{selected: selectedAvatarId === a.id}"
              @tap="selectedAvatarId = a.id"
            >
              <view class="avatar-wrap">
                <view class="avatar-bg" :style="{backgroundColor: a.color}"></view>
                <text class="avatar-icon">{{ a.icon }}</text>
              </view>
              <text class="avatar-name">{{ a.name }}</text>
              <text class="avatar-desc">{{ a.desc }}</text>
              <view v-if="selectedAvatarId === a.id" class="avatar-check">✓</view>
            </view>
          </view>
        </view>

        <!-- 确定按钮 -->
        <view class="confirm-section">
          <base-button
            class="btn-confirm"
            :disabled="!canConfirm"
            @tap="onConfirm"
          >
            确定
          </base-button>
        </view>

      </view>
    </scroll-view>
  </view>
</template>

<script setup>
import CustomNavbar from '@/pages/components/CustomNavbar.vue';
import BaseButton from '@/pages/components/BaseButton.vue';
import { ref } from 'vue';

const playerName = ref('');
const selectedGender = ref('male');
const selectedAvatarId = ref('qingtuan');
const nameError = ref('');

const genders = [
  { value: 'male', label: '男生', icon: '♂' },
  { value: 'female', label: '女生', icon: '♀' }
];

const avatars = [
  { id: 'qingtuan', name: '青团', icon: '🍡', desc: '自然·治疗·SR', color: '#8FC2A3' },
  { id: 'lanwen', name: '蓝纹奶酪', icon: '🧀', desc: '水·法术·SSR', color: '#4A90D9' },
  { id: 'dinyin', name: '冬阴功', icon: '🍲', desc: '火·输出·SSR', color: '#E5484D' },
  { id: 'lafei', name: '拉菲', icon: '🍷', desc: '光·辅助·SSR', color: '#F0C419' },
  { id: 'kali', name: '咖喱', icon: '🍛', desc: '土·防御·SSR', color: '#C9A227' }
];

const canConfirm = computed(() => playerName.value.trim().length >= 2 && selectedAvatarId.value);

const onNameInput = (e) => {
  playerName.value = e.detail.value;
  nameError.value = '';
  if (playerName.value.trim().length > 0 && playerName.value.trim().length < 2) {
    nameError.value = '名称至少2个字符';
  }
};

const onConfirm = () => {
  const name = playerName.value.trim();
  if (!name) {
    uni.showToast({ title: '请输入角色名称', icon: 'none' });
    return;
  }
  if (name.length < 2) {
    uni.showToast({ title: '名称至少2个字符', icon: 'none' });
    return;
  }
  uni.showLoading({ title: '创建中...' });
  setTimeout(() => {
    uni.hideLoading();
    uni.redirectTo({ url: '/pages/guide/guide' });
  }, 800);
};

const onBack = () => {
  uni.showModal({
    title: '提示',
    content: '返回将重新进入服务器选择，确定要返回吗？',
    success: (res) => { if (res.confirm) uni.navigateBack(); }
  });
};
</script>

<style scoped>
.page { width: 100vw; min-height: 100vh; background-color: #0F0E1D; position: relative; }
.scroll { height: 100vh; padding-top: 88rpx; padding-bottom: 100rpx; box-sizing: border-box; }
.content { padding: 0 48rpx; box-sizing: border-box; }
.welcome { margin-top: 60rpx; text-align: center; }
.welcome-title { font-size: 34rpx; color: #FFFFFF; font-weight: 600; margin-bottom: 16rpx; }
.welcome-desc { font-size: 28rpx; color: #B8B8C8; line-height: 1.6; }
.input-section { margin-top: 60rpx; }
.input-label { font-size: 30rpx; color: #FFFFFF; margin-bottom: 16rpx; display: block; }
.input-box {
  background: rgba(255,255,255,0.06); border: 1rpx solid #2A293E; border-radius: 20rpx;
  padding: 0 24rpx; height: 88rpx; display: flex; align-items: center;
}
.input-box input { flex: 1; color: #FFFFFF; font-size: 30rpx; background: transparent; border: none; outline: none; height: 100%; }
.error-tip { font-size: 24rpx; color: #E5484D; margin-top: 10rpx; }
.gender-section, .avatar-section { margin-top: 50rpx; }
.section-title { font-size: 30rpx; color: #FFFFFF; font-weight: 600; margin-bottom: 24rpx; }
.gender-options { display: flex; gap: 30rpx; }
.gender-item {
  display: flex; flex-direction: column; align-items: center; gap: 10rpx;
  padding: 24rpx; border: 1rpx solid #2A293E; border-radius: 20rpx;
  background: rgba(255,255,255,0.04); flex: 1;
}
.gender-item.selected { border-color: #E0D3A1; background: rgba(224,211,161,0.1); }
.gender-icon { font-size: 48rpx; }
.gender-label { font-size: 28rpx; color: #FFFFFF; }
.avatar-grid { display: flex; flex-wrap: wrap; gap: 24rpx; }
.avatar-item {
  width: 200rpx; display: flex; flex-direction: column; align-items: center; gap: 12rpx;
  padding: 20rpx; border: 1rpx solid #2A293E; border-radius: 20rpx;
  background: rgba(255,255,255,0.04); position: relative;
}
.avatar-item.selected { border-color: #E0D3A1; background: rgba(224,211,161,0.1); }
.avatar-wrap { width: 110rpx; height: 110rpx; border-radius: 55rpx; display: flex; align-items: center; justify-content: center; margin-bottom: 4rpx; }
.avatar-bg { width: 100%; height: 100%; border-radius: 55rpx; display: flex; align-items: center; justify-content: center; font-size: 56rpx; }
.avatar-icon { font-size: 56rpx; }
.avatar-name { font-size: 28rpx; color: #FFFFFF; font-weight: 600; }
.avatar-desc { font-size: 22rpx; color: #8A8A9E; }
.avatar-check { position: absolute; top: 12rpx; right: 12rpx; font-size: 32rpx; color: #E0D3A1; font-weight: 700; }
.confirm-section { margin-top: 60rpx; }
.btn-confirm {
  width: 600rpx; height: 96rpx; line-height: 96rpx;
  background: linear-gradient(135deg, #E0D3A1 0%, #C9B87E 100%);
  color: #0F0E1D; font-size: 36rpx; font-weight: 700; border-radius: 48rpx;
  box-shadow: 0 8rpx 24rpx rgba(224,211,161,0.3);
}
.btn-confirm:disabled { background: #2A293E; color: #666; box-shadow: none; }
</style>