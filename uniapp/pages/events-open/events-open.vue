<!-- componentized -->
<template>
  <view class="page">
        <custom-navbar title="开服活动" :show-back="true" @back="onBack" />

    <scroll-view class="scroll" scroll-y="true" show-scrollbar="false">
      <view class="content">
        <view class="section-title">开服限时活动</view>
        <view class="activity-list">
          <view v-for="(a, i) in activities" :key="i" class="activity-card" :class="{ended: a.ended}" @tap="onEnter(a)">
            <view class="activity-icon-wrapper">
              <avatar-icon :placeholder-char="a.icon" :size="'md'" :shape="'circle'" />
            </view>
            <view class="activity-info">
              <text class="activity-name">{{ a.name }}</text>
              <text class="activity-desc">{{ a.desc }}</text>
              <text class="activity-time">{{ a.ended ? '已结束' : a.time }}</text>
            </view>
            <view class="activity-status">
              <text v-if="a.ended" class="status-ended">已结束</text>
              <base-button v-else class="btn-go">前往</base-button>
            </view>
          </view>
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
import { listActivities } from '@/utils/api.js';

const activities = ref([]);

// 活动图标映射（按活动类型）
const activityIcon = (type) => {
  if (type === 'login') return '📅';
  if (type === 'charge') return '💰';
  if (type === 'collect') return '🎁';
  return '📢';
};

// 从后端 /game/activities 获取活动列表（替换模拟数据）
const loadActivities = async () => {
  try {
    const result = await listActivities();
    const list = Array.isArray(result) ? result : (result.activities || []);
    const now = Date.now();
    activities.value = list.map((a) => {
      const ended = a.endAt && new Date(a.endAt).getTime() < now;
      return {
        id: a.id,
        name: a.name,
        desc: a.type === 'login' ? '登录累计奖励' : (a.type === 'charge' ? '充值达标奖励' : '收集兑换奖励'),
        icon: activityIcon(a.type),
        time: ended ? '已结束' : '活动进行中',
        ended,
      };
    });
    if (activities.value.length === 0) {
      activities.value = [
        { name: '七日签到', desc: '登录累计奖励', icon: '📅', time: '活动进行中', ended: false },
        { name: '充能狂欢', desc: '充值达标奖励', icon: '💰', time: '活动进行中', ended: false },
        { name: '香料收集', desc: '收集兑换奖励', icon: '🎁', time: '活动进行中', ended: false },
      ];
    }
  } catch (e) {
    console.warn('load activities failed', e);
    activities.value = [
      { name: '七日签到', desc: '登录累计奖励', icon: '📅', time: '活动进行中', ended: false },
      { name: '充能狂欢', desc: '充值达标奖励', icon: '💰', time: '活动进行中', ended: false },
      { name: '香料收集', desc: '收集兑换奖励', icon: '🎁', time: '活动进行中', ended: false },
    ];
  }
};

onMounted(() => {
  loadActivities();
});

const onBack = () => uni.navigateBack();
const onEnter = (a) => {
  if (a.ended) { uni.showToast({ title: '活动已结束', icon: 'none' }); return; }
  uni.showToast({ title: `进入${a.name}`, icon: 'none' });
};
</script>

<style scoped>
.page { width: 100vw; min-height: 100vh; background: #0F0E1D; }
.scroll { height: 100vh; padding-top: 88rpx; padding-bottom: 100rpx; box-sizing: border-box; }
.content { padding: 0 48rpx; box-sizing: border-box; }
.section-title { font-size: 32rpx; color: #FFFFFF; font-weight: 700; margin: 40rpx 0 24rpx 0; }
.activity-list { display: flex; flex-direction: column; gap: 16rpx; }
.activity-card { display: flex; justify-content: space-between; align-items: center; background: rgba(255,255,255,0.04); border: 1rpx solid #2A293E; border-radius: 20rpx; padding: 24rpx 32rpx; }
.activity-card.ended { opacity: 0.6; border-color: #2A293E; }
.activity-card:active { background: rgba(255,255,255,0.08); }
.activity-icon-wrapper { width: 48rpx; height: 48rpx; flex-shrink: 0; }
.activity-info { flex: 1; margin: 0 24rpx; }
.activity-name { font-size: 28rpx; color: #FFFFFF; font-weight: 600; margin-bottom: 6rpx; }
.activity-desc { font-size: 22rpx; color: #8A8A9E; margin-bottom: 6rpx; }
.activity-time { font-size: 22rpx; color: #E0D3A1; font-weight: 600; }
.activity-card.ended .activity-time { color: #8A8A9E; }
.activity-status { flex-shrink: 0; }
.status-ended { font-size: 22rpx; color: #8A8A9E; font-weight: 600; }
.btn-go { width: 120rpx; height: 56rpx; line-height: 56rpx; background: linear-gradient(135deg, #E0D3A1 0%, #C9B87E 100%); color: #0F0E1D; font-size: 22rpx; font-weight: 700; border-radius: 28rpx; flex-shrink: 0; }
.btn-go:active { transform: scale(0.96); opacity: 0.85; }
</style>