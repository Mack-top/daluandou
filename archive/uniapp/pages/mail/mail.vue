<template>
  <view class="page">
    <view class="navbar">
      <text class="navbar-back" @tap="onBack">◀</text>
      <text class="navbar-title">邮件</text>
      <view class="navbar-spacer"></view>
    </view>
    <scroll-view class="scroll" scroll-y="true" show-scrollbar="false">
      <view class="content">
        <view class="section-title">邮件列表</text>
        <view class="mail-list">
          <view v-for="(m, i) in mails" :key="i" class="mail-card" :class="{read: m.read, hasAttachment: m.hasAttachment}" @tap="onOpen(m)">
            <view class="mail-icon">{{ m.icon }}</text>
            <view class="mail-info">
              <text class="mail-title">{{ m.title }}</text>
              <text class="mail-desc">{{ m.desc }}</text>
              <text class="mail-time">{{ m.time }}</text>
            </view>
            <view class="mail-status">
              <text v-if="m.read" class="status-read">已读</text>
              <text v-else class="status-unread">未读</text>
              <text v-if="m.hasAttachment" class="status-attachment">📎</text>
            </view>
          </view>
        </view>
        <view class="action-section">
          <button class="btn-claim-all" @tap="onClaimAll">一键领取所有附件</button>
        </view>
      </view>
    </scroll-view>
  </view>
</template>

<script setup>
const mails = [
  { title: '欢迎邮件', desc: '欢迎来到美食大乱斗，祝您游戏愉快！', icon: '📬', time: '2024-01-15 10:00', read: true, hasAttachment: false },
  { title: '系统奖励', desc: '您获得了新手礼包奖励，请查收附件。', icon: '🎁', time: '2024-01-15 09:30', read: false, hasAttachment: true },
  { title: '任务奖励', desc: '恭喜完成每日任务，奖励已发放。', icon: '✅', time: '2024-01-14 20:15', read: true, hasAttachment: false },
  { title: '协会邀请', desc: '您收到了来自"美食之巅"协会的入会邀请。', icon: '🏛️', time: '2024-01-14 18:00', read: false, hasAttachment: false },
  { title: '维护补偿', desc: '因服务器维护，向全服玩家发放补偿奖励。', icon: '🔧', time: '2024-01-13 14:00', read: false, hasAttachment: true }
];
const onBack = () => uni.navigateBack();
const onOpen = (m) => {
  if (!m.read) {
    m.read = true;
    uni.showToast({ title = `查看${m.title}`, icon: 'none' });
  }
  if (m.hasAttachment) {
    uni.showToast({ title = '附件已发放到背包', icon: 'success' });
  }
};
const onClaimAll = () => {
  uni.showToast({ title = '所有邮件附件已领取', icon: 'success' });
};
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
.mail-list { display: flex; flex-direction: column; gap: 16rpx; }
.mail-card { display: flex; justify-content: space-between; align-items: center; background: rgba(255,255,255,0.04); border: 1rpx solid #2A293E; border-radius: 20rpx; padding: 24rpx 32rpx; }
.mail-card:active { background: rgba(255,255,255,0.08); }
.mail-card.read { opacity: 0.7; }
.mail-icon { font-size: 40rpx; flex-shrink: 0; }
.mail-info { flex: 1; margin: 0 24rpx; }
.mail-title { font-size: 26rpx; color: #FFFFFF; font-weight: 600; margin-bottom: 6rpx; }
.mail-desc { font-size: 22rpx; color: #8A8A9E; margin-bottom: 6rpx; }
.mail-time { font-size: 20rpx; color: #8A8A9E; }
.mail-status { display: flex; flex-direction: column; align-items: flex-end; gap: 6rpx; flex-shrink: 0; }
.status-read { font-size: 20rpx; color: #8A8A9E; }
.status-unread { font-size: 20rpx; color: #E0D3A1; font-weight: 600; }
.status-attachment { font-size: 24rpx; margin-top: 4rpx; }
.action-section { text-align: center; margin-top: 40rpx; }
.btn-claim-all { width: 500rpx; height: 96rpx; line-height: 96rpx; background: linear-gradient(135deg, #E0D3A1 0%, #C9B87E 100%); color: #0F0E1D; font-size: 32rpx; font-weight: 700; border-radius: 48rpx; box-shadow: 0 8rpx 24rpx rgba(224,211,161,0.3); }
.btn-claim-all:active { transform: scale(0.96); opacity: 0.85; }
</style>