<!-- componentized -->
<template>
  <view class="page">
    <!-- 自定义导航栏 -->
        <custom-navbar title="食灵提升" :show-back="true" @back="onBack" />


    <scroll-view class="scroll" scroll-y="true" show-scrollbar="false">
      <view class="content">

        <!-- 食灵信息 -->
        <view class="skill-header">
          <view class="skill-avatar">{{ currentSkill.avatar }}</text>
          <view class="skill-info">
            <text class="skill-name">{{ currentSkill.name }}</text>
            <text class="skill-rarity">{{ currentSkill.rarity }}</text>
          </view>
        </view>

        <!-- 技能详情 -->
        <view class="section-title">技能详情</text>
        <view class="skill-detail-card">
          <text class="skill-title">{{ currentSkill.skillName }}</text>
          <text class="skill-desc">{{ currentSkill.skillDesc }}</text>
          <view class="skill-cd">冷却时间：{{ currentSkill.cooldown }}秒</text>
          <view class="skill-unlock">
            <text class="unlock-label">升星解锁：</text>
            <text class="unlock-value">{{ currentSkill.unlockStar }}星</text>
          </view>
        </view>

        <!-- 提升按钮 -->
        <view class="action-section">
          <base-button class="btn-up" @tap="onUpgrade">提升技能</base-button>
        </view>

      </view>
    </scroll-view>
  </view>
</template>

<script setup>
import CustomNavbar from '@/pages/components/CustomNavbar.vue';
import BaseButton from '@/pages/components/BaseButton.vue';
import { ref } from 'vue';

const currentSkill = ref({
  name: '冬阴功',
  rarity: '5星SSR',
  avatar: '🍲',
  skillName: '烈焰盛宴',
  skillDesc: '对敌方全体造成火属性伤害，并有概率灼烧目标',
  cooldown: 5,
  unlockStar: 6
});

const onBack = () => { uni.navigateBack(); };

const onUpgrade = () => {
  uni.showToast({ title: '技能提升开发中', icon: 'none' });
};
</script>

<style scoped>
.page { width: 100vw; min-height: 100vh; background-color: #0F0E1D; position: relative; }
.scroll { height: 100vh; padding-top: 88rpx; padding-bottom: 100rpx; box-sizing: border-box; }
.content { padding: 0 48rpx; box-sizing: border-box; }
.skill-header {
  display: flex; align-items: center; gap: 32rpx;
  background: rgba(255,255,255,0.04); border: 1rpx solid #2A293E;
  border-radius: 24rpx; padding: 32rpx; margin-bottom: 30rpx;
}
.skill-avatar {
  width: 110rpx; height: 110rpx; border-radius: 55rpx;
  background: #1A192E; border: 1rpx solid #2A293E;
  display: flex; align-items: center; justify-content: center; flex-shrink: 0;
  font-size: 56rpx;
}
.skill-info { flex: 1; }
.skill-name { font-size: 34rpx; color: #FFFFFF; font-weight: 700; margin-bottom: 6rpx; }
.skill-rarity { font-size: 26rpx; color: #E0D3A1; }
.section-title { font-size: 32rpx; color: #FFFFFF; font-weight: 700; margin: 30rpx 0 24rpx 0; }
.skill-detail-card {
  background: rgba(255,255,255,0.04); border: 1rpx solid #2A293E;
  border-radius: 24rpx; padding: 32rpx; margin-bottom: 30rpx;
}
.skill-title { font-size: 30rpx; color: #E0D3A1; font-weight: 700; margin-bottom: 16rpx; }
.skill-desc { font-size: 28rpx; color: #FFFFFF; line-height: 1.6; margin-bottom: 20rpx; }
.skill-cd { font-size: 24rpx; color: #B8B8C8; margin-bottom: 20rpx; }
.skill-unlock {
  display: flex; justify-content: space-between; align-items: center;
}
.unlock-label { font-size: 24rpx; color: #B8B8C8; }
.unlock-value { font-size: 26rpx; color: #E0D3A1; font-weight: 700; }
.action-section { text-align: center; }
.btn-up {
  width: 500rpx; height: 96rpx; line-height: 96rpx;
  background: linear-gradient(135deg, #E0D3A1 0%, #C9B87E 100%);
  color: #0F0E1D; font-size: 34rpx; font-weight: 700; border-radius: 48rpx;
  box-shadow: 0 8rpx 24rpx rgba(224,211,161,0.3);
}
.btn-up:active { transform: scale(0.96); opacity: 0.85; }
</style>