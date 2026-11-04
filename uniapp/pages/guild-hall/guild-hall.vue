<!-- componentized -->
<template>
  <view class="page">
        <custom-navbar title="食灵协会" :show-back="true" @back="onBack" />

    <scroll-view class="scroll" scroll-y="true" show-scrollbar="false">
      <view class="content">
        <!-- 协会头部 -->
        <view class="guild-header">
          <view class="guild-icon-wrapper">
            <avatar-icon placeholder-char="🏛️" :size="'md'" :shape="'circle'" />
          </view>
          <view class="guild-info">
            <text class="guild-name">{{ guild.name }}</text>
            <text class="guild-id">协会ID：{{ guild.id }}</text>
            <text class="guild-level">协会等级：Lv.{{ guild.level }}</text>
          </view>
          <view class="guild-action">
            <base-button class="btn-apply" @tap="onApply">申请加入</base-button>
          </view>
        </view>
        <view class="guild-stats">
          <view class="stat-item">
            <text class="stat-value">{{ guild.memberCount }}</text>
            <text class="stat-label">成员数量</text>
          </view>
          <view class="stat-item">
            <text class="stat-value">{{ guild.activity }}</text>
            <text class="stat-label">活跃度</text>
          </view>
          <view class="stat-item">
            <text class="stat-value">{{ guild.contribution }}</text>
            <text class="stat-label">总贡献</text>
          </view>
        </view>
        <!-- 协会公告 -->
        <view class="section-title">协会公告</view>
        <view class="notice-card">
          <text class="notice-text">{{ guild.notice }}</text>
        </view>
        <!-- 快捷入口 -->
        <view class="section-title">快捷入口</view>
        <view class="quick-menu">
          <view class="menu-item" @tap="onMembers">成员列表</view>
          <view class="menu-item" @tap="onCheckin">协会签到</view>
          <view class="menu-item" @tap="onDonate">协会捐献</view>
          <view class="menu-item" @tap="onVault">协会宝库</view>
        </view>
      </view>
    </scroll-view>
  </view>
</template>

<script setup>
import CustomNavbar from '@/pages/components/CustomNavbar.vue';
import BaseButton from '@/pages/components/BaseButton.vue';
import AvatarIcon from '@/pages/components/AvatarIcon.vue';
const guild = {
  id: '8821',
  name: '美食之巅',
  level: 5,
  memberCount: 48,
  activity: '85%',
  contribution: 125000,
  notice: '欢迎新成员！每日签到获取协会币，捐献资源提升协会等级。'
};
const onBack = () => uni.navigateBack();
const onApply = () => uni.showToast({ title: '已发送入会申请', icon: 'none' });
const onMembers = () => uni.showToast({ title: '打开成员列表', icon: 'none' });
const onCheckin = () => uni.showToast({ title: '打开签到页面', icon: 'none' });
const onDonate = () => uni.showToast({ title: '打开捐献页面', icon: 'none' });
const onVault = () => uni.showToast({ title: '打开宝库页面', icon: 'none' });
</script>

<style scoped>
.page { width: 100vw; min-height: 100vh; background: #0F0E1D; }
.scroll { height: 100vh; padding-top: 88rpx; padding-bottom: 100rpx; box-sizing: border-box; }
.content { padding: 0 48rpx; box-sizing: border-box; }
.guild-header { display: flex; align-items: center; gap: 24rpx; background: rgba(255,255,255,0.04); border: 1rpx solid #2A293E; border-radius: 24rpx; padding: 28rpx 32rpx; margin-bottom: 30rpx; }
.guild-icon-wrapper { width: 56rpx; height: 56rpx; flex-shrink: 0; }
.guild-info { flex: 1; }
.guild-name { font-size: 34rpx; color: #FFFFFF; font-weight: 700; margin-bottom: 8rpx; }
.guild-id { font-size: 22rpx; color: #8A8A9E; margin-bottom: 6rpx; }
.guild-level { font-size: 24rpx; color: #E0D3A1; font-weight: 600; }
.guild-action { flex-shrink: 0; }
.btn-apply { width: 140rpx; height: 56rpx; line-height: 56rpx; background: rgba(255,255,255,0.06); border: 1rpx solid #2A293E; color: #FFFFFF; font-size: 22rpx; border-radius: 28rpx; }
.btn-apply:active { background: rgba(255,255,255,0.12); }
.guild-stats { display: flex; justify-content: space-between; margin-bottom: 30rpx; }
.stat-item { text-align: center; flex: 1; }
.stat-value { font-size: 32rpx; color: #E0D3A1; font-weight: 700; }
.stat-label { font-size: 22rpx; color: #8A8A9E; margin-top: 6rpx; display: block; }
.section-title { font-size: 32rpx; color: #FFFFFF; font-weight: 700; margin: 30rpx 0 20rpx 0; }
.notice-card { background: rgba(255,255,255,0.04); border: 1rpx solid #2A293E; border-radius: 20rpx; padding: 24rpx 32rpx; margin-bottom: 30rpx; }
.notice-text { font-size: 26rpx; color: #B8B8C8; line-height: 1.6; }
.quick-menu { display: grid; grid-template-columns: repeat(2, 1fr); gap: 20rpx; }
.menu-item { background: rgba(255,255,255,0.04); border: 1rpx solid #2A293E; border-radius: 20rpx; padding: 28rpx; text-align: center; font-size: 26rpx; color: #FFFFFF; }
.menu-item:active { background: rgba(255,255,255,0.08); }
</style>