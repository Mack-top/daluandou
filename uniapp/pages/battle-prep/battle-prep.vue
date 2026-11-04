<!-- componentized -->
<template>
  <view class="page">
        <custom-navbar title="战斗准备" :show-back="true" @back="onBack" />

    <scroll-view class="scroll" scroll-y="true" show-scrollbar="false">
      <view class="content">
        <view class="section-title">出战阵容</text>
        <view class="team-grid">
          <view v-for="(s, i) in slots" :key="i" class="slot-card" @tap="onSelectSlot(i)">
            <view class="slot-pos">{{ s.pos }}</text>
            <view v-if="s.member" class="slot-member-wrapper">
              <avatar-icon :placeholder-char="s.member.icon" :size="'md'" :shape="'circle'" />
            </view>
            <view v-else class="slot-empty-wrapper">
              <avatar-icon :placeholder-char="'+'" :size="'md'" :shape="'circle'" />
            </view>
            <text class="slot-name">{{ s.member ? s.member.name : '空位' }}</text>
          </view>
        </view>
        <view class="action-section">
          <base-button class="btn-start" @tap="onStartBattle">开始战斗</base-button>
        </view>
      </view>
    </scroll-view>
  </view>
</template>

<script setup>
import CustomNavbar from '@/pages/components/CustomNavbar.vue';
import BaseButton from '@/pages/components/BaseButton.vue';
import AvatarIcon from '@/pages/components/AvatarIcon.vue';
import { ref } from 'vue';
const slots = ref([
  { pos: '1号位', member: { name: '青团', icon: '🍡' } },
  { pos: '2号位', member: null },
  { pos: '3号位', member: null },
  { pos: '4号位', member: null },
  { pos: '5号位', member: null }
]);
const onBack = () => uni.navigateBack();
const onSelectSlot = (i) => uni.showToast({ title: '选择食灵开发中', icon: 'none' });
const onStartBattle = () => {
  uni.showLoading({ title: '加载战斗中...' });
  setTimeout(() => { uni.hideLoading(); uni.navigateTo({ url: '/pages/battle-play/battle-play' }); }, 800);
};
</script>

<style scoped>
.page { width: 100vw; min-height: 100vh; background: #0F0E1D; }
.scroll { height: 100vh; padding-top: 88rpx; padding-bottom: 100rpx; box-sizing: border-box; }
.content { padding: 0 48rpx; box-sizing: border-box; }
.section-title { font-size: 32rpx; color: #FFFFFF; font-weight: 700; margin: 40rpx 0 24rpx 0; }
.team-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 20rpx; margin-bottom: 40rpx; }
.slot-card { background: rgba(255,255,255,0.04); border: 1rpx solid #2A293E; border-radius: 20rpx; padding: 24rpx; text-align: center; display: flex; flex-direction: column; align-items: center; gap: 10rpx; }
.slot-card:active { background: rgba(255,255,255,0.08); }
.slot-pos { font-size: 22rpx; color: #8A8A9E; margin-bottom: 8rpx; }
.slot-member-wrapper { width: 48rpx; height: 48rpx; flex-shrink: 0; margin-bottom: 6rpx; }
.slot-empty-wrapper { width: 48rpx; height: 48rpx; flex-shrink: 0; margin-bottom: 6rpx; }
.slot-name { font-size: 24rpx; color: #FFFFFF; }
.action-section { text-align: center; }
.btn-start { width: 600rpx; height: 96rpx; line-height: 96rpx; background: linear-gradient(135deg, #E0D3A1 0%, #C9B87E 100%); color: #0F0E1D; font-size: 34rpx; font-weight: 700; border-radius: 48rpx; box-shadow: 0 8rpx 24rpx rgba(224,211,161,0.3); }
.btn-start:active { transform: scale(0.96); opacity: 0.85; }
</style>