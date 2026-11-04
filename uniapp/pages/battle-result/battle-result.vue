<!-- componentized -->
<template>
  <view class="page">
        <custom-navbar title="战斗结果" :show-back="true" @back="onBack" />

    <scroll-view class="scroll" scroll-y="true" show-scrollbar="false">
      <view class="content">
        <view class="result-banner" :class="{victory: isVictory}">
          <text class="result-text">{{ isVictory ? '胜利' : '失败' }}</text>
        </view>
        <view class="section-title">战斗结算</view>
        <view class="mvp-card">
          <text class="mvp-label">MVP</text>
          <view class="mvp-avatar-wrapper">
            <avatar-icon :placeholder-char="mvp.icon" :size="'md'" :shape="'circle'" />
          </view>
          <text class="mvp-name">{{ mvp.name }}</text>
          <text class="mvp-damage">伤害 {{ mvp.damage }} / 治疗 {{ mvp.heal }}</text>
        </view>
        <view class="reward-list">
          <view v-for="(r, i) in rewards" :key="i" class="reward-item">
            <view class="reward-icon-wrapper">
              <avatar-icon :placeholder-char="r.icon" :size="'md'" :shape="'circle'" />
            </view>
            <text class="reward-name">{{ r.name }} × {{ r.amount }}</text>
          </view>
        </view>
        <view class="action-section">
          <base-button class="btn-again" @tap="onAgain">再次挑战</base-button>
          <base-button class="btn-back" @tap="onBack">返回</base-button>
        </view>
      </view>
    </scroll-view>
  </view>
</template>

<script setup>
import { ref, onMounted, getCurrentInstance } from 'vue';
import CustomNavbar from '@/pages/components/CustomNavbar.vue';
import BaseButton from '@/pages/components/BaseButton.vue';
import AvatarIcon from '@/pages/components/AvatarIcon.vue';
import { battleResult } from '@/utils/api.js';

const CHAR_ICONS = { 青团: '🍡', '蓝纹奶酪': '🧀', '冬阴功': '🍲', 拉菲: '🍷', 咖喱: '🍛' };
const iconOf = (name) => CHAR_ICONS[name] || '👤';

const isVictory = ref(false);
const mvp = ref({ name: '未知', icon: '👤', damage: 0, heal: 0 });
const rewards = ref([]);
const stageName = ref('');
const rounds = ref(0);

// 从页面查询参数获取 battleId（替换 uni.setStorageSync 传参）
const battleId = ref('');
onMounted(() => {
  const instance = getCurrentInstance();
  const pageQuery = instance?.proxy?.$page?.query || {};
  battleId.value = pageQuery?.battleId || '';
});

// 从后端结算战斗（替换模拟结果）
const loadResult = async () => {
  const id = battleId.value;
  if (!id) {
    uni.showToast({ title: '未找到战斗记录', icon: 'none' });
    setTimeout(() => uni.navigateBack(), 1500);
    return;
  }
  try {
    uni.showLoading({ title: '结算中...' });
    const result = await battleResult({ battleId: id });
    const battle = result.battle;
    isVictory.value = battle.win === true;
    stageName.value = battle.stageName || '未知关卡';
    rounds.value = battle.rounds || 0;

    // 奖励：后端返回的 rewards（含 exp、item、currency 等）
    const rewardList = (result.rewards || []).map((r) => ({
      icon: r.kind === 'exp' ? '✨' : r.kind === 'character' ? '📜' : r.kind === 'coin' ? '💰' : r.kind === 'gem' ? '💎' : r.kind === 'leaf' ? '⚡' : '📦',
      name: r.label || r.kind,
      amount: r.amount,
    }));
    rewards.value = rewardList;

    // MVP：从回合中找出对敌方造成伤害最高的我方单位
    const turns = battle.turns || [];
    const damageMap = {};
    const healMap = {};
    for (const t of turns) {
      if (t.kind === 'attack' || t.kind === 'skill') {
        damageMap[t.actor] = (damageMap[t.actor] || 0) + t.amount;
      } else if (t.kind === 'heal') {
        healMap[t.actor] = (healMap[t.actor] || 0) + t.amount;
      }
    }
    const myNames = (battle.units || [])
      .filter((u) => u.side === 'ally')
      .map((u) => u.name);
    let bestName = myNames[0] || '未知';
    let bestDmg = 0;
    for (const name of myNames) {
      const d = damageMap[name] || 0;
      const h = healMap[name] || 0;
      const total = d + h;
      if (total > bestDmg) {
        bestDmg = total;
        bestName = name;
      }
    }
    mvp.value = {
      name: bestName,
      icon: iconOf(bestName),
      damage: damageMap[bestName] || 0,
      heal: healMap[bestName] || 0,
    };

    uni.hideLoading();
  } catch (e) {
    uni.hideLoading();
    uni.showToast({ title: e.message || '结算失败', icon: 'none' });
  }
};

onMounted(() => {
  loadResult();
});

const onBack = () => uni.navigateBack();
const onAgain = () => {
  uni.redirectTo({ url: '/pages/battle-play/battle-play' });
};
</script>

<style scoped>
.page { width: 100vw; min-height: 100vh; background: #0F0E1D; }
.scroll { height: 100vh; padding-top: 88rpx; padding-bottom: 100rpx; box-sizing: border-box; }
.content { padding: 0 48rpx; box-sizing: border-box; display: flex; flex-direction: column; align-items: center; justify-content: center; min-height: 100%; }
.result-banner { font-size: 56rpx; font-weight: 800; margin: 60rpx 0 30rpx 0; }
.result-banner.victory { color: #4CAF50; text-shadow: 0 0 30rpx rgba(76,175,80,0.4); }
.result-banner:not(.victory) { color: #E5484D; text-shadow: 0 0 30rpx rgba(229,72,77,0.4); }
.section-title { font-size: 32rpx; color: #FFFFFF; font-weight: 700; margin-bottom: 24rpx; }
.mvp-card { background: rgba(255,255,255,0.04); border: 1rpx solid #2A293E; border-radius: 24rpx; padding: 32rpx; text-align: center; margin-bottom: 30rpx; width: 640rpx; }
.mvp-label { font-size: 24rpx; color: #E0D3A1; margin-bottom: 12rpx; display: block; }
.mvp-avatar-wrapper { width: 64rpx; height: 64rpx; flex-shrink: 0; margin-bottom: 10rpx; }
.mvp-name { font-size: 30rpx; color: #FFFFFF; font-weight: 700; margin-bottom: 8rpx; }
.mvp-damage { font-size: 24rpx; color: #B8B8C8; }
.reward-list { display: flex; flex-direction: column; gap: 14rpx; width: 100%; max-width: 640rpx; margin-bottom: 40rpx; }
.reward-item { display: flex; align-items: center; gap: 16rpx; font-size: 26rpx; color: #FFFFFF; }
.reward-icon-wrapper { width: 32rpx; height: 32rpx; flex-shrink: 0; }
.reward-name { color: #E0D3A1; font-weight: 600; }
.action-section { width: 100%; display: flex; gap: 20rpx; }
.btn-again, .btn-back {
  flex: 1; height: 96rpx; line-height: 96rpx;
  font-size: 32rpx; font-weight: 700; border-radius: 48rpx;
}
.btn-again { background: linear-gradient(135deg, #E0D3A1 0%, #C9B87E 100%); color: #0F0E1D; box-shadow: 0 8rpx 24rpx rgba(224,211,161,0.3); }
.btn-back { background: rgba(255,255,255,0.06); border: 1rpx solid #2A293E; color: #FFFFFF; }
.btn-again:active { transform: scale(0.96); opacity: 0.85; }
.btn-back:active { background: rgba(255,255,255,0.12); }
</style>