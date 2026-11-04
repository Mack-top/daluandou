<!-- componentized -->
<template>
  <view class="page">
        <custom-navbar title="聊天" :show-back="true" @back="onBack" />

    <view class="content">
      <!-- 频道标签 -->
      <view class="tab-bar">
        <view v-for="(t, i) in tabs" :key="i" class="tab-item" :class="{active: activeTab === i}" @tap="activeTab = i">{{ t }}</view>
      </view>
      <!-- 聊天消息 -->
      <scroll-view class="msg-scroll" scroll-y="true" show-scrollbar="false">
        <view class="msg-list">
          <view v-for="(m, i) in messages" :key="i" class="msg-item" :class="{self: m.self, system: m.type === 'system'}">
            <view class="msg-avatar-wrapper">
              <avatar-icon :placeholder-char="m.icon" :size="'md'" :shape="'circle'" />
            </view>
            <view class="msg-content">
              <text v-if="!m.self" class="msg-name">{{ m.name }}</text>
              <text class="msg-text">{{ m.text }}</text>
              <text class="msg-time">{{ m.time }}</text>
            </view>
          </view>
        </view>
      </scroll-view>
      <!-- 输入区 -->
      <view class="input-area">
        <view class="input-box">
          <input v-model="inputText" placeholder="输入聊天内容..." class="chat-input" />
        </view>
        <base-button class="btn-send" @tap="onSend">发送</base-button>
      </view>
    </view>
  </view>
</template>

<script setup>
import CustomNavbar from '@/pages/components/CustomNavbar.vue';
import BaseButton from '@/pages/components/BaseButton.vue';
import AvatarIcon from '@/pages/components/AvatarIcon.vue';
import { ref } from 'vue';
const tabs = ['世界', '协会', '私聊'];
const activeTab = ref(0);
const inputText = ref('');
const messages = ref([
  { name: '系统', icon: '📢', text: '欢迎来到美食大乱斗世界！', time: '10:00', type: 'system' },
  { name: '灵界旅人', icon: '🧙‍♂️', text: '大家好，新手报到！', time: '10:05', self: false },
  { name: '食神小助手', icon: '👼', text: '欢迎新朋友，有问题可以问我。', time: '10:06', self: false },
  { name: '我', icon: '👤', text: '谢谢欢迎！', time: '10:07', self: true }
]);
const onBack = () => uni.navigateBack();
const onSend = () => {
  if (!inputText.value.trim()) return;
  messages.value.push({ name: '我', icon: '👤', text: inputText.value, time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }), self: true });
  inputText.value = '';
};
</script>

<style scoped>
.page { width: 100vw; min-height: 100vh; background: #0F0E1D; display: flex; flex-direction: column; }
.tab-bar { display: flex; justify-content: center; gap: 40rpx; margin: 16rpx 0; border-bottom: 1rpx solid #2A293E; padding-bottom: 16rpx; }
.tab-item { font-size: 28rpx; color: #8A8A9E; padding-bottom: 16rpx; }
.tab-item.active { color: #E0D3A1; border-bottom: 2rpx solid #E0D3A1; font-weight: 600; }
.msg-scroll { flex: 1; overflow: scroll; padding: 0 32rpx; box-sizing: border-box; }
.msg-list { display: flex; flex-direction: column; gap: 16rpx; }
.msg-item { display: flex; gap: 12rpx; align-items: flex-start; }
.msg-item.self { flex-direction: row-reverse; }
.msg-item.system { justify-content: center; }
.msg-avatar-wrapper { width: 36rpx; height: 36rpx; flex-shrink: 0; }
.msg-content { max-width: 70%; }
.msg-item.self .msg-content { text-align: right; }
.msg-item.system .msg-content { text-align: center; }
.msg-name { font-size: 20rpx; color: #E0D3A1; font-weight: 600; margin-bottom: 4rpx; display: block; }
.msg-text {
  font-size: 24rpx; color: #FFFFFF;
  padding: 12rpx 20rpx;
  border-radius: 16rpx;
  background: rgba(255,255,255,0.06);
  border: 1rpx solid #2A293E;
  line-height: 1.5;
  display: inline-block;
  max-width: 100%;
}
.msg-item.self .msg-text { background: linear-gradient(135deg, #E0D3A1 0%, #C9B87E 100%); color: #0F0E1D; border-color: transparent; }
.msg-item.system .msg-text { background: transparent; border: none; color: #8A8A9E; padding: 0; }
.msg-time { font-size: 18rpx; color: #8A8A9E; margin-top: 4rpx; display: block; }
.input-area { padding: 20rpx 32rpx; background: #1A192E; border-top: 1rpx solid #2A293E; }
.input-box { display: flex; align-items: center; gap: 12rpx; background: rgba(255,255,255,0.04); border: 1rpx solid #2A293E; border-radius: 24rpx; padding: 0 20rpx; }
.chat-input { flex: 1; color: #FFFFFF; font-size: 26rpx; background: transparent; border: none; outline: none; height: 80rpx; }
.btn-send { width: 100rpx; height: 80rpx; line-height: 80rpx; background: linear-gradient(135deg, #E0D3A1 0%, #C9B87E 100%); color: #0F0E1D; font-size: 26rpx; font-weight: 700; border-radius: 40rpx; flex-shrink: 0; }
.btn-send:active { transform: scale(0.96); opacity: 0.85; }
</style>