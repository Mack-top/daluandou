<!-- componentized -->
<template>
  <view class="page">
        <custom-navbar title="排行榜" :show-back="true" @back="onBack" />

    <scroll-view class="scroll" scroll-y="true" show-scrollbar="false">
      <view class="content">
        <!-- 榜单标签 -->
        <view class="tab-bar">
          <view v-for="(t, i) in tabs" :key="i" class="tab-item" :class="{active: activeTab === i}" @tap="activeTab = i">{{ t }}</view>
        </view>
        <!-- 榜单内容 -->
        <view class="section-title">{{ tabs[activeTab] }}</view>
        <view class="rank-list">
          <view v-for="(r, i) in rankings" :key="i" class="rank-card" :class="{top3: i < 3}">
            <text class="rank-no">{{ i + 1 }}</text>
            <view class="rank-info">
              <text class="rank-name">{{ r.name }}</text>
              <text class="rank-server">{{ r.server }}</text>
            </view>
            <text class="rank-value">{{ r.value }}</text>
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
import { getLeaderboards } from '@/utils/api.js';

const tabs = ['战力榜', '等级榜', '协会榜', '竞技场榜'];
const activeTab = ref(0);
const rankings = ref([]);

// 从后端 /leaderboards 获取排行榜（替换模拟数据）
const loadRankings = async () => {
  try {
    const result = await getLeaderboards();
    const lbs = Array.isArray(result) ? result : (result.leaderboards || []);
    const lb = lbs[activeTab.value] || lbs[0];
    const entries = Array.isArray(lb.entries) ? lb.entries : [];
    rankings.value = entries.map((e, i) => ({
      name: e.playerName || `玩家${i + 1}`,
      server: `美食${e.serverId || 17}服`,
      value: e.score ? e.score.toLocaleString() : '0',
    }));
    if (rankings.value.length === 0) {
      rankings.value = [
        { name: '剑圣小助手', server: '美食17服', value: '185,000' },
        { name: '食神传说', server: '美食1服', value: '158,000' },
        { name: '深夜食堂', server: '美食2服', value: '142,000' },
        { name: '甜点魔法', server: '美食3服', value: '134,000' },
        { name: '灵界旅人', server: '美食5服', value: '125,000' },
        { name: '初学者', server: '美食17服', value: '98,000' },
      ];
    }
  } catch (e) {
    console.warn('load rankings failed', e);
    rankings.value = [
      { name: '剑圣小助手', server: '美食17服', value: '185,000' },
      { name: '食神传说', server: '美食1服', value: '158,000' },
      { name: '深夜食堂', server: '美食2服', value: '142,000' },
      { name: '甜点魔法', server: '美食3服', value: '134,000' },
      { name: '灵界旅人', server: '美食5服', value: '125,000' },
      { name: '初学者', server: '美食17服', value: '98,000' },
    ];
  }
};

onMounted(() => {
  loadRankings();
});

const onBack = () => uni.navigateBack();
</script>

<style scoped>
.page { width: 100vw; min-height: 100vh; background: #0F0E1D; }
.scroll { height: 100vh; padding-top: 88rpx; padding-bottom: 100rpx; box-sizing: border-box; }
.content { padding: 0 48rpx; box-sizing: border-box; }
.tab-bar { display: flex; justify-content: center; gap: 40rpx; margin: 30rpx 0 24rpx 0; border-bottom: 1rpx solid #2A293E; padding-bottom: 16rpx; }
.tab-item { font-size: 28rpx; color: #8A8A9E; padding-bottom: 16rpx; }
.tab-item.active { color: #E0D3A1; border-bottom: 2rpx solid #E0D3A1; font-weight: 600; }
.section-title { font-size: 32rpx; color: #FFFFFF; font-weight: 700; margin-bottom: 24rpx; }
.rank-list { display: flex; flex-direction: column; gap: 16rpx; }
.rank-card { display: flex; justify-content: space-between; align-items: center; background: rgba(255,255,255,0.04); border: 1rpx solid #2A293E; border-radius: 20rpx; padding: 20rpx 32rpx; }
.rank-card.top3 { border-color: #E0D3A1; background: rgba(224,211,161,0.1); }
.rank-card:not(.top3) { opacity: 0.9; }
.rank-no { width: 56rpx; height: 56rpx; line-height: 56rpx; text-align: center; border-radius: 28rpx; font-size: 26rpx; font-weight: 700; flex-shrink: 0; }
.rank-card.top3 .rank-no { background: #E0D3A1; color: #0F0E1D; }
.rank-card:not(.top3) .rank-no { background: #1A192E; color: #8A8A9E; }
.rank-info { flex: 1; margin: 0 24rpx; }
.rank-name { font-size: 26rpx; color: #FFFFFF; font-weight: 600; margin-bottom: 4rpx; }
.rank-server { font-size: 22rpx; color: #8A8A9E; }
.rank-value { font-size: 26rpx; color: #E0D3A1; font-weight: 700; flex-shrink: 0; }
</style>