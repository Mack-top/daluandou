<template>
  <view class="page">
    <view class="navbar">
      <text class="navbar-back" @tap="onBack">◀</text>
      <text class="navbar-title">协会成员</text>
      <view class="navbar-spacer"></view>
    </view>
    <scroll-view class="scroll" scroll-y="true" show-scrollbar="false">
      <view class="content">
        <view class="section-title">成员列表（{{ members.length }}人）</text>
        <view class="member-list">
          <view v-for="(m, i) in members" :key="i" class="member-card" :class="{chairman: m.role === '会长', elder: m.role === '长老'}" @tap="onMemberTap(m)">
            <view class="member-avatar">{{ m.icon }}</text>
            <view class="member-info">
              <text class="member-name">{{ m.name }}<text v-if="m.role" class="role-tag">{{ m.role }}</text></text>
              <text class="member-server">{{ m.server }}</text>
            </view>
            <view class="member-stats">
              <text class="stat-label">战力</text>
              <text class="stat-value">{{ m.power }}</text>
            </view>
            <view class="member-stats">
              <text class="stat-label">贡献</text>
              <text class="stat-value">{{ m.contribution }}</text>
            </view>
            <view class="member-status">{{ m.online ? '在线' : '离线' }}</text>
          </view>
        </view>
      </view>
    </scroll-view>
  </view>
</template>

<script setup>
import { ref } from 'vue';
const members = ref([
  { name: '食神之王', role: '会长', server: '美食17服', icon: '👑', power: 185000, contribution: 50000, online: true },
  { name: '厨艺大师', role: '长老', server: '美食17服', icon: '👨‍🍳', power: 120000, contribution: 32000, online: true },
  { name: '甜点爱好者', role: '成员', server: '美食1服', icon: '🍰', power: 89500, contribution: 15000, online: false },
  { name: '深夜食堂', role: '成员', server: '美食2服', icon: '🍜', power: 76000, contribution: 12000, online: true },
  { name: '灵界旅人', role: '成员', server: '美食3服', icon: '🧙‍♂️', power: 67136, contribution: 8000, online: false },
  { name: '初学者', role: '成员', server: '美食17服', icon: '👶', power: 32000, contribution: 2000, online: true }
]);
const onBack = () => uni.navigateBack();
const onMemberTap = (m) => uni.showToast({ title: `查看${m.name}详情`, icon: 'none' });
</script>

<style scoped>
.page { width: 100vw; min-height: 100vh; background: #0F0E1D; }
.navbar { position: fixed; top: 0; left: 0; right: 0; height: 88rpx; display: flex; align-items: center; padding: 0 32rpx; background: #16152A; border-bottom: 1rpx solid #2A293E; z-index: 100; box-sizing: border-box; }
.navbar-back { font-size: 36rpx; color: #FFFFFF; }
.navbar-title { font-size: 34rpx; font-weight: 600; color: #FFFFFF; margin-left: 40rpx; }
.navbar-spacer { flex: 1; }
.scroll { height: 100vh; padding-top: 88rpx; padding-bottom: 100rpx; box-sizing: border-box; }
.content { padding: 0 48rpx; box-sizing: border-box; }
.section-title { font-size: 32rpx; color: #FFFFFF; font-weight: 700; margin: 40rpx 0 24rpx 0; }
.member-list { display: flex; flex-direction: column; gap: 16rpx; }
.member-card { display: flex; justify-content: space-between; align-items: center; background: rgba(255,255,255,0.04); border: 1rpx solid #2A293E; border-radius: 20rpx; padding: 24rpx 32rpx; }
.member-card:active { background: rgba(255,255,255,0.08); }
.member-card.chairman { border-color: #E0D3A1; background: rgba(224,211,161,0.1); }
.member-card.elder { border-color: #B8B8C8; background: rgba(184,184,200,0.05); }
.member-avatar { font-size: 48rpx; flex-shrink: 0; }
.member-info { flex: 1; margin: 0 24rpx; }
.member-name { font-size: 28rpx; color: #FFFFFF; font-weight: 600; }
.role-tag { font-size: 20rpx; color: #E0D3A1; background: rgba(224,211,161,0.15); padding: 2rpx 10rpx; border-radius: 10rpx; margin-left: 10rpx; border: 1rpx solid rgba(224,211,161,0.3); }
.member-server { font-size: 22rpx; color: #8A8A9E; margin-top: 4rpx; display: block; }
.member-stats { display: flex; flex-direction: column; gap: 4rpx; }
.stat-label { font-size: 20rpx; color: #8A8A9E; }
.stat-value { font-size: 24rpx; color: #FFFFFF; font-weight: 600; }
.member-status { font-size: 24rpx; font-weight: 600; flex-shrink: 0; }
</style>