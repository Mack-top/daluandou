<!-- componentized -->
<template>
  <view class="page">
        <custom-navbar title="阵容推荐" :show-back="true" @back="onBack" />

    <scroll-view class="scroll" scroll-y="true" show-scrollbar="false">
      <view class="content">
        <view class="section-title">推荐阵容</view>
        <view class="team-list">
          <view v-for="(t, i) in teams" :key="i" class="team-card" @tap="onDetail(t)">
            <view class="team-info">
              <text class="team-name">{{ t.name }}</text>
              <text class="team-desc">{{ t.desc }}</text>
            </view>
            <view class="team-members">
              <text v-for="(m, j) in t.members" :key="j" class="member">{{ m }}</text>
            </view>
            <view class="team-arrow">▶</view>
          </view>
        </view>
      </view>
    </scroll-view>
  </view>
</template>

<script setup>
import CustomNavbar from '@/pages/components/CustomNavbar.vue';
import BaseButton from '@/pages/components/BaseButton.vue';
const teams = [
  { name: '新手基础阵容', desc: '适合前期过渡，获取容易', members: ['青团', '蓝纹奶酪', '冬阴功'] },
  { name: '输出爆发阵容', desc: '高 burst 伤害，适合推图', members: ['冬阴功', '拉菲', '咖喱'] },
  { name: '生存控制阵容', desc: '高坦度与控制，适合高难副本', members: ['咖喱', '青团', '蓝纹奶酪'] }
];
const onBack = () => uni.navigateBack();
const onDetail = (t) => uni.showToast({ title: `查看${t.name}详情`, icon: 'none' });
</script>

<style scoped>
.page { width: 100vw; min-height: 100vh; background: #0F0E1D; }
.scroll { height: 100vh; padding-top: 88rpx; padding-bottom: 100rpx; box-sizing: border-box; }
.content { padding: 0 48rpx; box-sizing: border-box; }
.section-title { font-size: 32rpx; color: #FFFFFF; font-weight: 700; margin: 40rpx 0 24rpx 0; }
.team-list { display: flex; flex-direction: column; gap: 16rpx; }
.team-card { display: flex; justify-content: space-between; align-items: center; background: rgba(255,255,255,0.04); border: 1rpx solid #2A293E; border-radius: 20rpx; padding: 24rpx 32rpx; }
.team-card:active { background: rgba(255,255,255,0.08); }
.team-info { flex: 1; }
.team-name { font-size: 28rpx; color: #FFFFFF; font-weight: 600; margin-bottom: 6rpx; }
.team-desc { font-size: 24rpx; color: #8A8A9E; margin-bottom: 10rpx; }
.team-members { display: flex; gap: 10rpx; flex-wrap: wrap; margin-bottom: 10rpx; }
.member { font-size: 22rpx; color: #E0D3A1; background: rgba(224,211,161,0.1); padding: 4rpx 12rpx; border-radius: 10rpx; border: 1rpx solid rgba(224,211,161,0.2); }
.team-arrow { font-size: 24rpx; color: #E0D3A1; flex-shrink: 0; }
</style>