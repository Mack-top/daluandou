<!-- componentized -->
<template>
  <view class="page">
    <!-- 自定义导航栏 -->
        <custom-navbar title="开服庆典-主线通关奖励" :show-back="true" @back="onBack" />


    <scroll-view class="scroll" scroll-y="true" show-scrollbar="false">
      <view class="content">

        <!-- 活动说明 -->
        <view class="desc-card">
          <text class="desc-title">主线通关奖励</text>
          <text class="desc-text">通关前期主线关卡，即可获得丰厚奖励</text>
        </view>

        <!-- 主线章节进度 -->
        <view class="section-title">主线章节</view>
        <view class="chapter-list">
          <view
            v-for="(c, i) in chapters"
            :key="c.id"
            class="chapter-card"
            :class="{cleared: c.cleared, locked: c.locked}"
            @tap="() => onClaimChapter(c)"
          >
            <view class="chapter-info">
              <text class="chapter-name">{{ c.name }}</text>
              <text class="chapter-desc">{{ c.desc }}</text>
            </view>
            <view class="chapter-rewards">
              <text v-for="(r, j) in c.rewards" :key="j" class="reward-chip">{{ r }}</text>
            </view>
            <view class="chapter-action">
              <text v-if="c.cleared" class="status-cleared">已通关</text>
              <text v-else-if="c.locked" class="status-locked">未解锁</text>
              <base-button v-else class="btn-claim">领取</base-button>
            </view>
          </view>
        </view>

      </view>
    </scroll-view>
  </view>
</template>

<script setup>
import CustomNavbar from '@/pages/components/CustomNavbar.vue';
import BaseButton from '@/pages/components/BaseButton.vue';
import { ref } from 'vue';

const chapters = ref([
  { id: 1, name: '主线 1-1', desc: '灵界初探', rewards: ['食灵契约 × 5', '金币 × 50000'], cleared: true, locked: false },
  { id: 2, name: '主线 1-2', desc: '迷雾森林', rewards: ['食灵契约 × 5', '食灵精华 × 100'], cleared: true, locked: false },
  { id: 3, name: '主线 1-3', desc: '封印之地', rewards: ['食灵契约 × 10', '金币 × 100000'], cleared: true, locked: false },
  { id: 4, name: '主线 2-4', desc: '时空之门', rewards: ['5星SSR群攻食灵：蓝色夏威夷·艾薇儿'], cleared: false, locked: false },
  { id: 5, name: '主线 3-8', desc: '食神殿堂', rewards: ['食灵契约 × 20', '灵晶 × 200'], cleared: false, locked: true }
]);

const onBack = () => { uni.navigateBack(); };

const onClaimChapter = (c) => {
  if (c.cleared) {
    uni.showToast({ title: '奖励已领取', icon: 'none' });
    return;
  }
  if (c.locked) {
    uni.showToast({ title: '章节未解锁', icon: 'none' });
    return;
  }
  c.cleared = true;
  uni.showToast({ title: '通关奖励已发放', icon: 'success' });
};
</script>

<style scoped>
.page { width: 100vw; min-height: 100vh; background-color: #0F0E1D; position: relative; }
.scroll { height: 100vh; padding-top: 88rpx; padding-bottom: 100rpx; box-sizing: border-box; }
.content { padding: 0 48rpx; box-sizing: border-box; }
.desc-card {
  background: rgba(224,211,161,0.1); border: 1rpx solid rgba(224,211,161,0.3);
  border-radius: 24rpx; padding: 32rpx; margin-bottom: 30rpx; text-align: center;
}
.desc-title { font-size: 30rpx; color: #E0D3A1; font-weight: 700; margin-bottom: 12rpx; }
.desc-text { font-size: 26rpx; color: #B8B8C8; }
.section-title {
  font-size: 30rpx; color: #FFFFFF; font-weight: 600; margin: 30rpx 0 20rpx 0;
}
.chapter-list { display: flex; flex-direction: column; gap: 16rpx; }
.chapter-card {
  display: flex; justify-content: space-between; align-items: center;
  background: rgba(255,255,255,0.04); border: 1rpx solid #2A293E;
  border-radius: 20rpx; padding: 20rpx 32rpx;
}
.chapter-card.locked { opacity: 0.6; }
.chapter-card.cleared { border-color: #4CAF50; background: rgba(76,175,80,0.08); }
.chapter-info { flex: 1; }
.chapter-name { font-size: 28rpx; color: #FFFFFF; font-weight: 600; margin-bottom: 6rpx; }
.chapter-desc { font-size: 22rpx; color: #8A8A9E; }
.chapter-rewards { display: flex; gap: 12rpx; flex: 1; margin: 0 30rpx; flex-wrap: wrap; }
.reward-chip {
  font-size: 18rpx; color: #B8B8C8; background: rgba(255,255,255,0.06);
  padding: 4rpx 10rpx; border-radius: 10rpx; border: 1rpx solid #2A293E;
  white-space: nowrap;
}
.chapter-action { display: flex; align-items: center; gap: 12rpx; }
.status-cleared { font-size: 24rpx; color: #4CAF50; font-weight: 600; }
.status-locked { font-size: 24rpx; color: #8A8A9E; font-weight: 600; }
.btn-claim {
  width: 120rpx; height: 56rpx; line-height: 56rpx;
  background: linear-gradient(135deg, #E0D3A1 0%, #C9B87E 100%);
  color: #0F0E1D; font-size: 24rpx; font-weight: 700; border-radius: 28rpx;
  flex-shrink: 0;
}
</style>