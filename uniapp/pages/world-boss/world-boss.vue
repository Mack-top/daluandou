<!-- componentized -->
<template>
  <view class="page">
        <custom-navbar title="世界BOSS" :show-back="true" @back="onBack" />

    <scroll-view class="scroll" scroll-y="true" show-scrollbar="false">
      <view class="content">
        <!-- BOSS信息 -->
        <view class="boss-card">
          <view class="boss-icon-wrapper">
            <avatar-icon placeholder-char="🐉" :size="'md'" :shape="'circle'" />
          </view>
          <view class="boss-info">
            <text class="boss-name">{{ boss.name }}</text>
            <text class="boss-hp">HP: {{ boss.hp }}</text>
            <text class="boss-desc">{{ boss.desc }}</text>
          </view>
          <view class="boss-action">
            <base-button class="btn-fight" @tap="onFight">挑战</base-button>
          </view>
        </view>
        <!-- 倒计时 -->
        <view class="countdown-card">
          <text class="cd-label">下次开放：</text>
          <text class="cd-time">{{ countdown }}</text>
        </view>
        <!-- 排行榜 -->
        <view class="section-title">伤害排行榜</view>
        <view class="rank-list">
          <view v-for="(r, i) in rankings" :key="i" class="rank-card">
            <text class="rank-no">{{ i + 1 }}</text>
            <text class="rank-name">{{ r.name }}</text>
            <text class="rank-damage">{{ r.damage }} 伤害</text>
            <text class="rank-reward">{{ r.reward }}</text>
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
import { getEnemies, getLeaderboards } from '@/utils/api.js';

const boss = ref({ name: '远古食神', hp: '98%', desc: '全服协作挑战，造成伤害越高奖励越丰厚' });
const countdown = ref('02:34:12');
const rankings = ref([]);

// 从后端获取 BOSS 定义与伤害排行榜（替换模拟数据）
const loadWorldBoss = async () => {
  try {
    const [enemies, leaderboard] = await Promise.all([
      getEnemies('boss'),
      getLeaderboards(),
    ]);
    if (enemies && enemies.length > 0) {
      const b = enemies[0];
      boss.value = {
        name: b.name || '远古食神',
        hp: b.maxHp ? `${Math.floor((b.maxHp / (b.maxHp + 1000000)) * 100)}%` : '98%',
        desc: b.desc || '全服协作挑战，造成伤害越高奖励越丰厚',
      };
    }
    if (leaderboard && leaderboard.length > 0) {
      rankings.value = leaderboard.slice(0, 5).map((entry) => ({
        name: entry.playerName || entry.name || '未知玩家',
        damage: entry.score || 0,
        reward: '食灵契约 × 50',
      }));
    } else {
      rankings.value = [
        { name: '剑圣小助手', damage: 5200000, reward: '食灵契约 × 50' },
        { name: '食神传说', damage: 4800000, reward: '食灵契约 × 40' },
        { name: '深夜食堂', damage: 4100000, reward: '食灵契约 × 30' },
        { name: '甜点魔法', damage: 3500000, reward: '食灵契约 × 20' },
        { name: '灵界旅人', damage: 2900000, reward: '食灵契约 × 10' },
      ];
    }
  } catch (e) {
    console.warn('load world-boss failed', e);
  }
};

onMounted(() => {
  loadWorldBoss();
});

const onBack = () => uni.navigateBack();
const onFight = () => uni.showToast({ title: '世界BOSS挑战开发中', icon: 'none' });
</script>

<style scoped>
.page { width: 100vw; min-height: 100vh; background: #0F0E1D; }
.scroll { height: 100vh; padding-top: 88rpx; padding-bottom: 100rpx; box-sizing: border-box; }
.content { padding: 0 48rpx; box-sizing: border-box; }
.boss-card { background: linear-gradient(135deg, rgba(229,72,77,0.15) 0%, rgba(180,40,45,0.08) 100%); border: 1rpx solid rgba(229,72,77,0.3); border-radius: 24rpx; padding: 32rpx; margin-bottom: 30rpx; display: flex; justify-content: space-between; align-items: center; }
.boss-icon-wrapper { width: 80rpx; height: 80rpx; flex-shrink: 0; }
.boss-info { flex: 1; margin: 0 32rpx; }
.boss-name { font-size: 36rpx; color: #FFFFFF; font-weight: 700; margin-bottom: 8rpx; }
.boss-hp { font-size: 30rpx; color: #E5484D; font-weight: 700; margin-bottom: 8rpx; }
.boss-desc { font-size: 24rpx; color: #B8B8C8; }
.boss-action { flex-shrink: 0; }
.btn-fight { width: 160rpx; height: 80rpx; line-height: 80rpx; background: linear-gradient(135deg, #E0D3A1 0%, #C9B87E 100%); color: #0F0E1D; font-size: 28rpx; font-weight: 700; border-radius: 40rpx; box-shadow: 0 8rpx 24rpx rgba(224,211,161,0.3); }
.btn-fight:active { transform: scale(0.96); opacity: 0.85; }
.countdown-card { background: rgba(255,255,255,0.04); border: 1rpx solid #2A293E; border-radius: 20rpx; padding: 24rpx 32rpx; margin-bottom: 30rpx; display: flex; justify-content: space-between; align-items: center; }
.cd-label { font-size: 26rpx; color: #B8B8C8; }
.cd-time { font-size: 34rpx; color: #E0D3A1; font-weight: 700; font-family: monospace; }
.section-title { font-size: 32rpx; color: #FFFFFF; font-weight: 700; margin: 30rpx 0 24rpx 0; }
.rank-list { display: flex; flex-direction: column; gap: 12rpx; }
.rank-card { display: flex; justify-content: space-between; align-items: center; background: rgba(255,255,255,0.04); border: 1rpx solid #2A293E; border-radius: 16rpx; padding: 16rpx 24rpx; }
.rank-no { font-size: 24rpx; color: #E0D3A1; font-weight: 700; flex-shrink: 0; }
.rank-name { font-size: 24rpx; color: #FFFFFF; font-weight: 600; flex: 1; margin: 0 24rpx; }
.rank-damage { font-size: 22rpx; color: #B8B8C8; flex-shrink: 0; }
.rank-reward { font-size: 20rpx; color: #4CAF50; font-weight: 600; flex-shrink: 0; }
</style>