<!-- componentized -->
<template>
  <view class="page">
    <!-- 自定义导航栏 -->
        <custom-navbar title="章节详情" :show-back="true" @back="onBack" />


    <scroll-view class="scroll" scroll-y="true" show-scrollbar="false">
      <view class="content">

        <!-- 章节标题 -->
        <view class="chapter-header">
          <text class="chapter-name">{{ currentChapter.name }}</text>
          <text class="chapter-desc">{{ currentChapter.desc }}</text>
        </view>

        <!-- 收益与掉落 -->
        <view class="section-title">收益与掉落</view>
        <view class="reward-grid">
          <view
            v-for="(r, i) in rewards"
            :key="i"
            class="reward-card"
          >
            <view class="reward-icon-wrapper">
              <avatar-icon :placeholder-char="r.icon" :size="'md'" :shape="'circle'" />
            </view>
            <text class="reward-name">{{ r.name }}</text>
            <text class="reward-desc">{{ r.desc }}</text>
          </view>
        </view>

        <!-- 前往按钮 -->
        <view class="action-section">
          <base-button class="btn-go" @tap="onGo">前往挑战</base-button>
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

const currentChapter = ref({ name: '封印之地', desc: '古老封印沉睡之处，蕴含强大的食灵力量' });

const rewards = ref([
  { icon: '📖', name: '食灵契约', desc: '掉落概率：高' },
  { icon: '💰', name: '金币', desc: '掉落概率：中' },
  { icon: '⚡', name: '食灵精华', desc: '掉落概率：低' },
  { icon: '👑', name: '史诗装备碎片', desc: '掉落概率：极低' }
]);

const onBack = () => { uni.navigateBack(); };

const onGo = () => {
  uni.showToast({ title: `前往挑战${currentChapter.value.name}`, icon: 'none' });
};
</script>

<style scoped>
.page { width: 100vw; min-height: 100vh; background-color: #0F0E1D; position: relative; }
.scroll { height: 100vh; padding-top: 88rpx; padding-bottom: 100rpx; box-sizing: border-box; }
.content { padding: 0 48rpx; box-sizing: border-box; }
.chapter-header {
  background: rgba(255,255,255,0.04); border: 1rpx solid #2A293E;
  border-radius: 24rpx; padding: 32rpx; margin-bottom: 30rpx; text-align: center;
}
.chapter-name { font-size: 36rpx; color: #FFFFFF; font-weight: 700; margin-bottom: 8rpx; }
.chapter-desc { font-size: 26rpx; color: #B8B8C8; }
.section-title { font-size: 32rpx; color: #FFFFFF; font-weight: 700; margin: 30rpx 0 24rpx 0; }
.reward-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 20rpx; margin-bottom: 40rpx; }
.reward-card {
  display: flex; flex-direction: column; align-items: center; gap: 12rpx;
  background: rgba(255,255,255,0.04); border: 1rpx solid #2A293E;
  border-radius: 20rpx; padding: 28rpx 20rpx; text-align: center;
}
.reward-icon-wrapper { width: 44rpx; height: 44rpx; flex-shrink: 0; }
.reward-name { font-size: 26rpx; color: #FFFFFF; font-weight: 600; }
.reward-desc { font-size: 22rpx; color: #8A8A9E; }
.action-section { text-align: center; }
.btn-go {
  width: 500rpx; height: 96rpx; line-height: 96rpx;
  background: linear-gradient(135deg, #E0D3A1 0%, #C9B87E 100%);
  color: #0F0E1D; font-size: 34rpx; font-weight: 700; border-radius: 48rpx;
  box-shadow: 0 8rpx 24rpx rgba(224,211,161,0.3);
}
.btn-go:active { transform: scale(0.96); opacity: 0.85; }
</style>