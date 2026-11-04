<template>
  <view class="page">
    <!-- 自定义导航栏（组件化） -->
    <custom-navbar
      title="竞技场"
      :show-back="true"
      @back="onBack"
    />
    <scroll-view class="scroll" scroll-y="true" show-scrollbar="false">
      <view class="content">
        <!-- 排位信息 -->
        <view class="rank-card">
          <text class="rank-title">当前排位</text>
          <text class="rank-value">{{ currentRank }}</text>
          <text class="rank-desc">竞技场积分：{{ points }}</text>
        </view>
        <!-- 挑战次数 -->
        <view class="challenge-card">
          <text class="challenge-label">今日挑战次数：</text>
          <text class="challenge-value">{{ challengeUsed }} / {{ challengeLimit }}</text>
        </view>
        <!-- 对手列表 -->
        <view class="section-title">推荐对手</view>
        <view class="opponent-list">
          <view v-for="(o, i) in opponents" :key="i" class="opponent-card" @tap="onChallenge(o)">
            <view class="opponent-info">
              <text class="opponent-name">{{ o.name }}</text>
              <text class="opponent-server">{{ o.server }}</text>
              <text class="opponent-power">战力 {{ o.power }}</text>
            </view>
            <view class="opponent-action">
              <base-button btn-type="primary" @tap="() => onChallenge(o)">挑战</base-button>
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
import { getLeaderboards } from '@/utils/api.js';

const currentRank = ref('白银 I');
const points = ref(0);
const challengeUsed = ref(0);
const challengeLimit = ref(5);
const opponents = ref([]);

// 从后端获取排行榜（替换模拟对手列表）
const loadLeaderboards = async () => {
  try {
    const result = await getLeaderboards();
    const lbs = Array.isArray(result) ? result : (result.leaderboards || []);
    // 取战力榜作为对手列表
    const powerLb = lbs.find((l) => l.metric === 'power') || lbs[0];
    const entries = Array.isArray(powerLb.entries) ? powerLb.entries : [];
    opponents.value = entries.map((e, i) => ({
      name: e.playerName || `玩家${i + 1}`,
      server: `美食${e.serverId || 17}服`,
      power: e.score || 100000,
    }));
    if (opponents.value.length === 0) {
      opponents.value = [
        { name: '剑圣小助手', server: '美食17服', power: 125000 },
        { name: '食神传说', server: '美食1服', power: 158000 },
        { name: '深夜食堂', server: '美食2服', power: 98000 },
        { name: '甜点魔法', server: '美食3服', power: 112000 },
        { name: '灵界旅人', server: '美食5服', power: 134000 }
      ];
    }
  } catch (e) {
    console.warn('load leaderboards failed', e);
    opponents.value = [
      { name: '剑圣小助手', server: '美食17服', power: 125000 },
      { name: '食神传说', server: '美食1服', power: 158000 },
      { name: '深夜食堂', server: '美食2服', power: 98000 },
      { name: '甜点魔法', server: '美食3服', power: 112000 },
      { name: '灵界旅人', server: '美食5服', power: 134000 }
    ];
  }
};

onMounted(() => {
  loadLeaderboards();
});

const onBack = () => uni.navigateBack();
const onChallenge = (o) => {
  if (challengeUsed.value >= challengeLimit) {
    uni.showToast({ title: '今日挑战次数已用完', icon: 'none' });
    return;
  }
  uni.showToast({ title: `挑战${o.name}`, icon: 'none' });
};
</script>

<style scoped>
.page { width: 100vw; min-height: 100vh; background: #0F0E1D; }
.scroll { height: 100vh; padding-top: 88rpx; padding-bottom: 100rpx; box-sizing: border-box; }
.content { padding: 0 48rpx; box-sizing: border-box; }
.rank-card { background: linear-gradient(135deg, rgba(224,211,161,0.15) 0%, rgba(201,184,126,0.08) 100%); border: 1rpx solid rgba(224,211,161,0.3); border-radius: 24rpx; padding: 32rpx; margin-bottom: 30rpx; text-align: center; }
.rank-title { font-size: 26rpx; color: #B8B8C8; margin-bottom: 8rpx; }
.rank-value { font-size: 56rpx; color: #E0D3A1; font-weight: 800; margin-bottom: 12rpx; }
.rank-desc { font-size: 24rpx; color: #FFFFFF; }
.challenge-card { background: rgba(255,255,255,0.04); border: 1rpx solid #2A293E; border-radius: 20rpx; padding: 24rpx 32rpx; margin-bottom: 30rpx; display: flex; justify-content: space-between; align-items: center; }
.challenge-label { font-size: 26rpx; color: #FFFFFF; }
.challenge-value { font-size: 26rpx; color: #E0D3A1; font-weight: 700; }
.section-title { font-size: 32rpx; color: #FFFFFF; font-weight: 700; margin: 30rpx 0 24rpx 0; }
.opponent-list { display: flex; flex-direction: column; gap: 16rpx; }
.opponent-card { display: flex; justify-content: space-between; align-items: center; background: rgba(255,255,255,0.04); border: 1rpx solid #2A293E; border-radius: 20rpx; padding: 24rpx 32rpx; }
.opponent-card:active { background: rgba(255,255,255,0.08); }
.opponent-info { flex: 1; }
.opponent-name { font-size: 26rpx; color: #FFFFFF; font-weight: 600; margin-bottom: 4rpx; }
.opponent-server { font-size: 22rpx; color: #8A8A9E; margin-bottom: 6rpx; }
.opponent-power { font-size: 24rpx; color: #E0D3A1; font-weight: 600; }
.opponent-action { flex-shrink: 0; }
</style>