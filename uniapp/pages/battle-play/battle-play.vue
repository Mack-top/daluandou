<!-- componentized -->
<template>
  <view class="page">
        <custom-navbar title="战斗进行中" :show-back="true" @back="onBack" />

    <view class="content">
      <!-- 战斗背景 -->
      <view class="battle-bg"></view>
      <!-- 我方食灵 -->
      <view class="side left">
        <text class="side-label">我方</text>
        <view class="member-row">
          <view v-for="(m, i) in myTeam" :key="i" class="battle-member">
            <view class="member-icon-wrapper">
              <avatar-icon :placeholder-char="m.icon" :size="'md'" :shape="'circle'" />
            </view>
            <view class="hp-bar"><view class="hp-fill" :style="{ width: m.hpPct + '%' }"></view></view>
            <text class="member-hp">{{ m.hp }}</text>
          </view>
        </view>
      </view>
      <!-- 敌方食灵 -->
      <view class="side right">
        <text class="side-label">敌方</text>
        <view class="member-row">
          <view v-for="(m, i) in enemyTeam" :key="i" class="battle-member">
            <view class="member-icon-wrapper">
              <avatar-icon :placeholder-char="m.icon" :size="'md'" :shape="'circle'" />
            </view>
            <view class="hp-bar"><view class="hp-fill" :style="{ width: m.hpPct + '%' }"></view></view>
            <text class="member-hp">{{ m.hp }}</text>
          </view>
        </view>
      </view>
      <!-- 战斗日志 -->
      <view class="battle-log">
        <text class="log-title">战斗日志</text>
        <view class="log-list">
          <text v-for="(l, i) in logs" :key="i" class="log-item">{{ l }}</text>
        </view>
      </view>
      <!-- 底部操作 -->
      <view class="bottom-control">
        <base-button class="btn-auto" @tap="onAuto">自动战斗</base-button>
        <base-button class="btn-skip" @tap="onSkip">跳过</base-button>
      </view>
    </view>
  </view>
</template>

<script setup>
import { ref, onMounted } from 'vue';
import CustomNavbar from '@/pages/components/CustomNavbar.vue';
import BaseButton from '@/pages/components/BaseButton.vue';
import AvatarIcon from '@/pages/components/AvatarIcon.vue';
import { battlePlay } from '@/utils/api.js';

const CHAR_ICONS = { 青团: '🍡', '蓝纹奶酪': '🧀', '冬阴功': '🍲', 拉菲: '🍷', 咖喱: '🍛' };

const myTeam = ref([]);
const enemyTeam = ref([]);
const logs = ref(['战斗准备中...']);
const battleId = ref('');

const iconOf = (name) => CHAR_ICONS[name] || '👤';

// 从后端开战（替换模拟战斗数据）
const startBattle = async () => {
  try {
    uni.showLoading({ title: '开战中...' });
    const stageId = '1-1'; // 默认首关，可从页面参数传入
    const result = await battlePlay({ stageId });
    const battle = result.battle;
    const units = battle.units || [];
    const allies = units.filter((u) => u.side === 'ally');
    const enemies = units.filter((u) => u.side === 'enemy');
    myTeam.value = allies.map((u) => ({
      name: u.name,
      icon: iconOf(u.name),
      hp: u.maxHp,
      hpPct: 100,
    }));
    enemyTeam.value = enemies.map((u) => ({
      name: u.name,
      icon: iconOf(u.name),
      hp: u.maxHp,
      hpPct: 100,
    }));
    battleId.value = battle.id;
    logs.value = [
      `战斗开始！阶段：${battle.stageName || stageId}`,
      `我方战力：${battle.power}，敌方战力：${battle.enemyPower}`,
      '敌我双方已进入战斗位置',
    ];
    uni.hideLoading();
  } catch (e) {
    uni.hideLoading();
    uni.showToast({ title: e.message || '开战失败', icon: 'none' });
  }
};

onMounted(() => {
  startBattle();
});

const onAuto = () => {
  uni.showToast({ title: '自动战斗已开启', icon: 'none' });
  // 自动跳转到结算页
  setTimeout(() => onSkip(), 2000);
};
const onSkip = () => {
  if (!battleId.value) {
    uni.showToast({ title: '战斗数据未就绪', icon: 'none' });
    return;
  }
  uni.showLoading({ title: '计算结果中...' });
  setTimeout(() => {
    uni.hideLoading();
    uni.redirectTo({ url: `/pages/battle-result/battle-result?battleId=${encodeURIComponent(battleId.value)}` });
  }, 1000);
};
</script>

<style scoped>
.page { width: 100vw; min-height: 100vh; background: #0F0E1D; position: relative; }
.content { padding-top: 88rpx; padding-bottom: 140rpx; box-sizing: border-box; height: 100vh; display: flex; flex-direction: column; }
.battle-bg { flex: 1; background: radial-gradient(circle at center, rgba(42,41,62,0.6) 0%, #0F0E1D 100%); position: relative; overflow: hidden; }
.side { position: absolute; left: 0; right: 0; display: flex; flex-direction: column; align-items: center; padding: 40rpx 0; }
.side.left { top: 20%; }
.side.right { bottom: 20%; }
.side-label { font-size: 24rpx; color: #8A8A9E; margin-bottom: 16rpx; }
.member-row { display: flex; gap: 30rpx; }
.battle-member { display: flex; flex-direction: column; align-items: center; gap: 8rpx; }
.member-icon-wrapper { width: 56rpx; height: 56rpx; flex-shrink: 0; }
.hp-bar { width: 120rpx; height: 10rpx; background: #2A293E; border-radius: 5rpx; overflow: hidden; }
.hp-fill { height: 100%; background: #4CAF50; border-radius: 5rpx; transition: width 0.5s; }
.member-hp { font-size: 20rpx; color: #B8B8C8; }
.battle-log { background: rgba(0,0,0,0.3); border: 1rpx solid #2A293E; border-radius: 16rpx; padding: 20rpx 32rpx; margin: 0 48rpx 20rpx 48rpx; max-height: 200rpx; }
.log-title { font-size: 24rpx; color: #E0D3A1; margin-bottom: 12rpx; }
.log-list { display: flex; flex-direction: column; gap: 6rpx; }
.log-item { font-size: 22rpx; color: #FFFFFF; line-height: 1.4; }
.bottom-control { display: flex; justify-content: center; gap: 20rpx; padding-bottom: 20rpx; }
.btn-auto, .btn-skip {
  width: 220rpx; height: 72rpx; line-height: 72rpx;
  background: rgba(255,255,255,0.06); border: 1rpx solid #2A293E;
  color: #FFFFFF; font-size: 26rpx; border-radius: 36rpx;
}
.btn-auto:active, .btn-skip:active { background: rgba(255,255,255,0.12); }
</style>