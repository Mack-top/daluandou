<!-- componentized -->
<template>
  <view class="page">
        <custom-navbar title="每日任务" :show-back="true" @back="onBack" />

    <scroll-view class="scroll" scroll-y="true" show-scrollbar="false">
      <view class="content">
        <view class="section-title">日常委托</view>
        <view class="quest-list">
          <view v-for="(q, i) in quests" :key="i" class="quest-card" :class="{completed: q.completed}" @tap="onClaim(q)">
            <view class="quest-info">
              <text class="quest-name">{{ q.name }}</text>
              <text class="quest-desc">{{ q.desc }}</text>
              <text class="quest-progress">{{ q.progress }}</text>
            </view>
            <view class="quest-action">
              <text v-if="q.completed" class="status-done">已完成</text>
              <base-button v-else class="btn-go">前往</base-button>
            </view>
            <view class="quest-reward">{{ q.reward }}</view>
          </view>
        </view>
        <!-- 活跃宝箱 -->
        <view class="section-title">活跃宝箱</view>
        <view class="chest-list">
          <view v-for="(c, i) in chests" :key="i" class="chest-card" :class="{claimed: c.claimed, active: c.active}">
            <text class="chest-label">活跃度 {{ c.threshold }}</text>
            <view class="chest-icon-wrapper">
              <avatar-icon placeholder-char="📦" :size="'md'" :shape="'circle'" />
            </view>
            <text class="chest-status">{{ c.claimed ? '已领取' : (c.active ? '可领取' : '锁定') }}</text>
          </view>
        </view>
      </view>
    </scroll-view>
  </view>
</template>

<script setup>
import CustomNavbar from '@/pages/components/CustomNavbar.vue';
import BaseButton from '@/pages/components/BaseButton.vue';
import AvatarIcon from '@/pages/components/AvatarIcon.vue';
const quests = [
  { name: '食灵召唤', desc: '今日召唤1次食灵', progress: '0/1', reward: '金币 × 50000', completed: false },
  { name: '领取每日礼遇', desc: '在每日充值中领取任意档位奖励', progress: '0/1', reward: '灵晶 × 20', completed: false },
  { name: '七日之约', desc: '今日领取1次登录赠礼', progress: '1/1', reward: '食灵精华 × 50', completed: true },
  { name: '灶火不熄', desc: '今日取得2场战斗胜利', progress: '1/2', reward: '食灵精华 × 60', completed: false },
  { name: '赶集的清晨', desc: '今日在集市兑换1次', progress: '0/1', reward: '食灵精华 × 80', completed: false }
];
const chests = [
  { threshold: 50, active: true, claimed: false },
  { threshold: 100, active: false, claimed: false },
  { threshold: 150, active: false, claimed: false },
  { threshold: 200, active: false, claimed: false }
];
const onBack = () => uni.navigateBack();
const onClaim = (q) => {
  if (q.completed) { uni.showToast({ title: '奖励已领取', icon: 'none' }); return; }
  uni.showToast({ title: '前往完成任务', icon: 'none' });
};
</script>

<style scoped>
.page { width: 100vw; min-height: 100vh; background: #0F0E1D; }
.scroll { height: 100vh; padding-top: 88rpx; padding-bottom: 100rpx; box-sizing: border-box; }
.content { padding: 0 48rpx; box-sizing: border-box; }
.section-title { font-size: 32rpx; color: #FFFFFF; font-weight: 700; margin: 40rpx 0 24rpx 0; }
.quest-list { display: flex; flex-direction: column; gap: 16rpx; }
.quest-card { display: flex; justify-content: space-between; align-items: center; background: rgba(255,255,255,0.04); border: 1rpx solid #2A293E; border-radius: 20rpx; padding: 20rpx 32rpx; }
.quest-card.completed { border-color: #4CAF50; background: rgba(76,175,80,0.08); opacity: 0.85; }
.quest-card:active { background: rgba(255,255,255,0.08); }
.quest-info { flex: 1; }
.quest-name { font-size: 26rpx; color: #FFFFFF; font-weight: 600; margin-bottom: 6rpx; }
.quest-desc { font-size: 22rpx; color: #8A8A9E; margin-bottom: 6rpx; }
.quest-progress { font-size: 20rpx; color: #E0D3A1; font-weight: 600; }
.quest-action { display: flex; align-items: center; gap: 12rpx; flex-shrink: 0; }
.status-done { font-size: 22rpx; color: #4CAF50; font-weight: 600; }
.btn-go { width: 100rpx; height: 48rpx; line-height: 48rpx; background: rgba(255,255,255,0.06); border: 1rpx solid #2A293E; color: #FFFFFF; font-size: 20rpx; border-radius: 24rpx; flex-shrink: 0; }
.btn-go:active { background: rgba(255,255,255,0.12); }
.quest-reward { font-size: 20rpx; color: #B8B8C8; flex-shrink: 0; }
.chest-list { display: flex; justify-content: space-around; margin-top: 40rpx; }
.chest-card { display: flex; flex-direction: column; align-items: center; gap: 10rpx; padding: 24rpx; background: rgba(255,255,255,0.04); border: 1rpx solid #2A293E; border-radius: 20rpx; flex: 1; max-width: 220rpx; }
.chest-card.active { border-color: #E0D3A1; background: rgba(224,211,161,0.1); }
.chest-card.claimed { border-color: #4CAF50; background: rgba(76,175,80,0.08); }
.chest-icon-wrapper { width: 56rpx; height: 56rpx; flex-shrink: 0; margin-bottom: 4rpx; }
.chest-label { font-size: 22rpx; color: #E0D3A1; font-weight: 600; }
.chest-status { font-size: 20rpx; font-weight: 600; }
.chest-card.active .chest-status { color: #4CAF50; }
.chest-card.claimed .chest-status { color: #8A8A9E; }
.chest-card:not(.active):not(.claimed) .chest-status { color: #8A8A9E; }
</style>