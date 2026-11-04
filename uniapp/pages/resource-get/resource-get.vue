<!-- componentized -->
<template>
  <view class="page">
        <custom-navbar title="资源获取" :show-back="true" @back="onBack" />

    <scroll-view class="scroll" scroll-y="true" show-scrollbar="false">
      <view class="content">
        <view class="section-title">资源获取途径</view>
        <view class="source-list">
          <view v-for="(s, i) in sources" :key="i" class="source-card" @tap="onGo(s)">
            <view class="source-icon-wrapper">
              <avatar-icon :placeholder-char="s.icon" :size="'md'" :shape="'circle'" />
            </view>
            <view class="source-info">
              <text class="source-name">{{ s.name }}</text>
              <text class="source-desc">{{ s.desc }}</text>
            </view>
            <view class="source-arrow-wrapper">
              <avatar-icon placeholder-char="▶" :size="'sm'" :shape="'circle'" />
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
import { listItems } from '@/utils/api.js';

const sources = ref([
  { name: '主线副本', desc: '通关主线关卡获得大量资源', icon: '🗺️' },
  { name: '日常委托', desc: '完成每日任务获取基础资源', icon: '📋' },
  { name: '挂机收益', desc: '时光屋自动累积离线收益', icon: '⏳' },
  { name: '商店兑换', desc: '使用代币在集市兑换资源', icon: '🏪' },
  { name: '邮件附件', desc: '领取系统发送的奖励邮件', icon: '📬' }
]);

// 从后端 /game/items 获取背包资源（替换模拟数据）
const loadResources = async () => {
  try {
    const result = await listItems();
    const items = result.items || [];
    if (items.length > 0) {
      // 将背包物品作为可获取资源展示在列表前
      const itemSources = items.slice(0, 3).map((item) => ({
        name: item.name || item.template_id || '未知资源',
        desc: `背包拥有：${item.amount || item.count || 0}`,
        icon: '📦',
      }));
      sources.value = [...itemSources, ...sources.value];
    }
  } catch (e) {
    console.warn('load resources failed', e);
  }
};

onMounted(() => {
  loadResources();
});

const onBack = () => uni.navigateBack();
const onGo = (s) => uni.showToast({ title: `前往${s.name}`, icon: 'none' });
</script>

<style scoped>
.page { width: 100vw; min-height: 100vh; background: #0F0E1D; }
.scroll { height: 100vh; padding-top: 88rpx; padding-bottom: 100rpx; box-sizing: border-box; }
.content { padding: 0 48rpx; box-sizing: border-box; }
.section-title { font-size: 32rpx; color: #FFFFFF; font-weight: 700; margin: 40rpx 0 24rpx 0; }
.source-list { display: flex; flex-direction: column; gap: 16rpx; }
.source-card { display: flex; justify-content: space-between; align-items: center; background: rgba(255,255,255,0.04); border: 1rpx solid #2A293E; border-radius: 20rpx; padding: 24rpx 32rpx; }
.source-card:active { background: rgba(255,255,255,0.08); }
.source-icon-wrapper { width: 40rpx; height: 40rpx; flex-shrink: 0; }
.source-info { flex: 1; margin: 0 24rpx; }
.source-name { font-size: 28rpx; color: #FFFFFF; font-weight: 600; margin-bottom: 6rpx; }
.source-desc { font-size: 24rpx; color: #8A8A9E; }
.source-arrow-wrapper { width: 24rpx; height: 24rpx; flex-shrink: 0; }
</style>