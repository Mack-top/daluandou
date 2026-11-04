<!-- componentized -->
<template>
  <view class="page">
        <custom-navbar title="邮件" :show-back="true" @back="onBack" />

    <scroll-view class="scroll" scroll-y="true" show-scrollbar="false">
      <view class="content">
        <view class="section-title">邮件列表</view>
        <view class="mail-list">
          <view v-for="(m, i) in mails" :key="i" class="mail-card" :class="{read: m.read, hasAttachment: m.hasAttachment}" @tap="onOpen(m)">
            <view class="mail-icon-wrapper">
              <avatar-icon :placeholder-char="m.icon" :size="'md'" :shape="'circle'" />
            </view>
            <view class="mail-info">
              <text class="mail-title">{{ m.title }}</text>
              <text class="mail-desc">{{ m.desc }}</text>
              <text class="mail-time">{{ m.time }}</text>
            </view>
            <view class="mail-status">
              <text v-if="m.read" class="status-read">已读</text>
              <text v-else class="status-unread">未读</text>
              <view v-if="m.hasAttachment" class="status-attachment-wrapper">
                <avatar-icon placeholder-char="📎" :size="'sm'" :shape="'circle'" />
              </view>
            </view>
          </view>
        </view>
        <view class="action-section">
          <base-button class="btn-claim-all" @tap="onClaimAll">一键领取所有附件</base-button>
        </view>
      </view>
    </scroll-view>
  </view>
</template>

<script setup>
import { ref, onMounted } from 'vue';
import CustomNavbar from '@/pages/components/CustomNavbar.vue';
import BaseButton from '@/pages/components/BaseButton.vue';
import AvatarIcon from '@/pages/components/AvatarIcon.vue';
import { listMail } from '@/utils/api.js';

const mails = ref([]);

// 邮件图标映射（按发件人/类型，资源到位后可替换为真实图片）
const iconFor = (sender) => {
  const s = (sender || '').toLowerCase();
  if (s.includes('运营') || s.includes('维护')) return '🔧';
  if (s.includes('协会') || s.includes('青团')) return '🏛️';
  if (s.includes('竞技场') || s.includes('排行')) return '🏆';
  return '📬';
};

// 从后端获取邮件列表（替换模拟数据）
const loadMail = async () => {
  try {
    const result = await listMail();
    const list = Array.isArray(result) ? result : (result.mails || []);
    mails.value = list.map((m) => ({
      id: m.id,
      title: m.title,
      desc: m.excerpt || '',
      icon: iconFor(m.sender),
      time: m.time,
      read: !!m.read,
      hasAttachment: !m.claimed && (m.rewards && m.rewards.length > 0),
      rewards: m.rewards || [],
    }));
  } catch (e) {
    console.warn('load mail failed', e);
    mails.value = [];
  }
};

onMounted(() => {
  loadMail();
});

const onBack = () => uni.navigateBack();
const onOpen = (m) => {
  if (!m.read) {
    uni.showToast({ title: `查看${m.title}`, icon: 'none' });
  }
  if (m.hasAttachment) {
    uni.showToast({ title: '附件已发放到背包', icon: 'success' });
  }
};
const onClaimAll = () => {
  uni.showToast({ title: '所有邮件附件已领取', icon: 'success' });
};
</script>

<style scoped>
.page { width: 100vw; min-height: 100vh; background: #0F0E1D; }
.scroll { height: 100vh; padding-top: 88rpx; padding-bottom: 100rpx; box-sizing: border-box; }
.content { padding: 0 48rpx; box-sizing: border-box; }
.section-title { font-size: 32rpx; color: #FFFFFF; font-weight: 700; margin: 40rpx 0 24rpx 0; }
.mail-list { display: flex; flex-direction: column; gap: 16rpx; }
.mail-card { display: flex; justify-content: space-between; align-items: center; background: rgba(255,255,255,0.04); border: 1rpx solid #2A293E; border-radius: 20rpx; padding: 24rpx 32rpx; }
.mail-card:active { background: rgba(255,255,255,0.08); }
.mail-card.read { opacity: 0.7; }
.mail-icon-wrapper { width: 40rpx; height: 40rpx; flex-shrink: 0; }
.mail-info { flex: 1; margin: 0 24rpx; }
.mail-title { font-size: 26rpx; color: #FFFFFF; font-weight: 600; margin-bottom: 6rpx; }
.mail-desc { font-size: 22rpx; color: #8A8A9E; margin-bottom: 6rpx; }
.mail-time { font-size: 20rpx; color: #8A8A9E; }
.mail-status { display: flex; flex-direction: column; align-items: flex-end; gap: 6rpx; flex-shrink: 0; }
.status-read { font-size: 20rpx; color: #8A8A9E; }
.status-unread { font-size: 20rpx; color: #E0D3A1; font-weight: 600; }
.status-attachment-wrapper { width: 24rpx; height: 24rpx; flex-shrink: 0; margin-top: 4rpx; }
.action-section { text-align: center; margin-top: 40rpx; }
.btn-claim-all { width: 500rpx; height: 96rpx; line-height: 96rpx; background: linear-gradient(135deg, #E0D3A1 0%, #C9B87E 100%); color: #0F0E1D; font-size: 32rpx; font-weight: 700; border-radius: 48rpx; box-shadow: 0 8rpx 24rpx rgba(224,211,161,0.3); }
.btn-claim-all:active { transform: scale(0.96); opacity: 0.85; }
</style>