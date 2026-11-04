<!-- componentized -->
<template>
  <view class="page">
        <custom-navbar title="好友申请" :show-back="true" @back="onBack" />

    <scroll-view class="scroll" scroll-y="true" show-scrollbar="false">
      <view class="content">
        <view class="section-title">好友申请列表</text>
        <view class="apply-list">
          <view v-for="(a, i) in applies" :key="i" class="apply-card">
            <view class="apply-avatar">{{ a.icon }}</text>
            <view class="apply-info">
              <text class="apply-name">{{ a.name }}</text>
              <text class="apply-server">{{ a.server }}</text>
              <text class="apply-power">战力 {{ a.power }}</text>
            </view>
            <view class="apply-action">
              <base-button class="btn-accept" @tap.stop="onAccept(a)">接受</base-button>
              <base-button class="btn-reject" @tap.stop="onReject(a)">拒绝</base-button>
            </view>
          </view>
        </view>
        <view v-if="applies.length === 0" class="empty-state">
          <text class="empty-icon">📭</text>
          <text class="empty-text">暂无好友申请</text>
        </view>
      </view>
    </scroll-view>
  </view>
</template>

<script setup>
import CustomNavbar from '@/pages/components/CustomNavbar.vue';
import BaseButton from '@/pages/components/BaseButton.vue';
const applies = [
  { name: '灵界旅人', server: '美食1服', icon: '🧙‍♂️', power: 67136 },
  { name: '甜点爱好者', server: '美食3服', icon: '🍰', power: 32100 },
  { name: '深夜食堂', server: '美食5服', icon: '🍜', power: 76000 }
];
const onBack = () => uni.navigateBack();
const onAccept = (a) => {
  uni.showToast({ title = `已接受${a.name}的好友申请`, icon: 'success' });
};
const onReject = (a) => {
  uni.showToast({ title = `已拒绝${a.name}`, icon: 'none' });
};
</script>

<style scoped>
.page { width: 100vw; min-height: 100vh; background: #0F0E1D; }
.scroll { height: 100vh; padding-top: 88rpx; padding-bottom: 100rpx; box-sizing: border-box; }
.content { padding: 0 48rpx; box-sizing: border-box; }
.section-title { font-size: 32rpx; color: #FFFFFF; font-weight: 700; margin: 40rpx 0 24rpx 0; }
.apply-list { display: flex; flex-direction: column; gap: 16rpx; }
.apply-card { display: flex; justify-content: space-between; align-items: center; background: rgba(255,255,255,0.04); border: 1rpx solid #2A293E; border-radius: 20rpx; padding: 24rpx 32rpx; }
.apply-card:active { background: rgba(255,255,255,0.08); }
.apply-avatar { font-size: 48rpx; flex-shrink: 0; }
.apply-info { flex: 1; margin: 0 24rpx; }
.apply-name { font-size: 26rpx; color: #FFFFFF; font-weight: 600; margin-bottom: 4rpx; }
.apply-server { font-size: 22rpx; color: #8A8A9E; margin-bottom: 6rpx; }
.apply-power { font-size: 22rpx; color: #E0D3A1; font-weight: 600; }
.apply-action { display: flex; gap: 12rpx; flex-shrink: 0; }
.btn-accept, .btn-reject {
  width: 100rpx; height: 56rpx; line-height: 56rpx;
  font-size: 20rpx; font-weight: 600; border-radius: 28rpx; flex-shrink: 0;
}
.btn-accept { background: linear-gradient(135deg, #E0D3A1 0%, #C9B87E 100%); color: #0F0E1D; }
.btn-reject { background: rgba(255,255,255,0.06); border: 1rpx solid #2A293E; color: #FFFFFF; }
.btn-accept:active, .btn-reject:active { background: rgba(255,255,255,0.12); }
.empty-state { display: flex; flex-direction: column; align-items: center; gap: 16rpx; margin-top: 100rpx; text-align: center; }
.empty-icon { font-size: 64rpx; }
.empty-text { font-size: 28rpx; color: #8A8A9E; }
</style>