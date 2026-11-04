<!-- componentized -->
<template>
  <view class="page">
    <!-- 自定义导航栏 -->
        <custom-navbar title="主城助手" :show-back="true" @back="onBack" />


    <scroll-view class="scroll" scroll-y="true" show-scrollbar="false">
      <view class="content">

        <!-- 页面标题 -->
        <view class="section-title">看板娘选择</text>
        <text class="section-sub">选择主城助手形象</text>

        <!-- 助手列表 -->
        <view class="assistant-list">
          <view
            v-for="(a, i) in assistants"
            :key="a.id"
            class="assistant-card"
            :class="{selected: selectedId === a.id, using: a.using}"
            @tap="() => onSelect(a)"
          >
            <view class="assistant-avatar">
              <text class="avatar-icon">{{ a.icon }}</text>
              <view v-if="a.using" class="using-badge">使用中</view>
            </view>
            <view class="assistant-info">
              <text class="assistant-name">{{ a.name }}</text>
              <text class="assistant-desc">{{ a.desc }}</text>
            </view>
            <view class="assistant-action">
              <view v-if="selectedId === a.id" class="check-mark">✓</view>
              <base-button v-else class="btn-select" @tap.stop="onSelect(a)">选择</base-button>
            </view>
          </view>
        </view>

        <!-- 确认按钮 -->
        <view class="confirm-section">
          <base-button
            class="btn-confirm"
            :disabled="!selectedId"
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

const selectedId = ref(null);

const assistants = ref([
  { id: 'maid', name: '洛依依', desc: '优雅的主城助手，擅长迎宾', icon: '👩‍🍳', using: false },
  { id: 'butler', name: '岩螺春', desc: '稳重的管家型助手，行事利落', icon: '👨‍🍳', using: false },
  { id: 'fairy', name: '法国蜗牛', desc: '可爱的精灵型助手，活泼俏皮', icon: '🐌', using: true },
  { id: 'knight', name: '魏螺去', desc: '武士风格助手，守护灵界安全', icon: '🛡️', using: false }
]);

const onBack = () => { uni.navigateBack(); };

const onSelect = (assistant) => {
  if (assistant.using) {
    uni.showToast({ title: '当前已使用该助手', icon: 'none' });
    return;
  }
  // 取消其他使用中状态
  assistants.value.forEach(a => { a.using = false; });
  assistant.using = true;
  selectedId.value = assistant.id;
  uni.showToast({ title: `已选择${assistant.name}`, icon: 'none' });
};

const onConfirm = () => {
  if (!selectedId.value) {
    uni.showToast({ title: '请先选择一个助手', icon: 'none' });
    return;
  }
  const selected = assistants.value.find(a => a.id === selectedId.value);
  uni.showToast({ title: `助手${selected.name}已设置为使用中`, icon: 'success' });
  uni.navigateBack();
};
</script>

<style scoped>
.page { width: 100vw; min-height: 100vh; background-color: #0F0E1D; position: relative; }
.scroll { height: 100vh; padding-top: 88rpx; padding-bottom: 100rpx; box-sizing: border-box; }
.content { padding: 0 48rpx; box-sizing: border-box; }
.section-title { font-size: 32rpx; color: #FFFFFF; font-weight: 700; margin: 40rpx 0 12rpx 0; }
.section-sub { font-size: 26rpx; color: #8A8A9E; margin-bottom: 30rpx; }
.assistant-list { display: flex; flex-direction: column; gap: 18rpx; }
.assistant-card {
  display: flex; justify-content: space-between; align-items: center;
  background: rgba(255,255,255,0.04); border: 1rpx solid #2A293E;
  border-radius: 20rpx; padding: 24rpx 32rpx;
}
.assistant-card:active { background: rgba(255,255,255,0.08); }
.assistant-card.selected { border-color: #E0D3A1; background: rgba(224,211,161,0.1); }
.assistant-card.using { border-color: #4CAF50; background: rgba(76,175,80,0.08); }
.assistant-avatar {
  position: relative; width: 90rpx; height: 90rpx; border-radius: 45rpx;
  background: #1A192E; border: 1rpx solid #2A293E;
  display: flex; align-items: center; justify-content: center; flex-shrink: 0;
}
.avatar-icon { font-size: 44rpx; }
.using-badge {
  position: absolute; bottom: 4rpx; right: 4rpx;
  font-size: 18rpx; color: #0F0E1D; background: #4CAF50;
  padding: 2rpx 8rpx; border-radius: 10rpx; font-weight: 600;
}
.assistant-info { flex: 1; margin: 0 24rpx; }
.assistant-name { font-size: 28rpx; color: #FFFFFF; font-weight: 600; margin-bottom: 6rpx; }
.assistant-desc { font-size: 22rpx; color: #8A8A9E; }
.assistant-action { display: flex; align-items: center; gap: 12rpx; flex-shrink: 0; }
.check-mark { font-size: 32rpx; color: #E0D3A1; font-weight: 700; }
.btn-select {
  width: 110rpx; height: 56rpx; line-height: 56rpx;
  background: linear-gradient(135deg, #E0D3A1 0%, #C9B87E 100%);
  color: #0F0E1D; font-size: 24rpx; font-weight: 700; border-radius: 28rpx;
  flex-shrink: 0;
}
.confirm-section { margin-top: 50rpx; }
.btn-confirm {
  width: 600rpx; height: 96rpx; line-height: 96rpx;
  background: linear-gradient(135deg, #E0D3A1 0%, #C9B87E 100%);
  color: #0F0E1D; font-size: 36rpx; font-weight: 700; border-radius: 48rpx;
  box-shadow: 0 8rpx 24rpx rgba(224,211,161,0.3);
}
.btn-confirm:disabled { background: #2A293E; color: #666; box-shadow: none; }
</style>