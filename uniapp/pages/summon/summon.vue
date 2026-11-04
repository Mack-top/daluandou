<!-- componentized -->
<template>
  <view class="page">
        <custom-navbar title="食灵召唤" :show-back="true" @back="onBack" />

    <scroll-view class="scroll" scroll-y="true" show-scrollbar="false">
      <view class="content">

        <!-- 召唤卡池 -->
        <view class="section-title">召唤卡池</view>
        <view class="pool-list">
          <view v-for="(p, i) in pools" :key="i" class="pool-card" :class="{active: activePool === i}" @tap="activePool = i">
            <!-- 卡池美术资源（占位头像，资源到位后自动替换为真实图片） -->
            <view class="pool-avatar-container">
              <image class="pool-avatar" :src="getPoolAvatar(p.id)" mode="aspectFill" />
              <view class="avatar-placeholder" v-if="!hasAvatar(p.id)">{{ p.initial }}</view>
            </view>
            <view class="pool-info">
              <text class="pool-name">{{ p.name }}</text>
              <text class="pool-desc">{{ p.desc }}</text>
              <text class="pool-cost">{{ p.cost }}</text>
            </view>
            <view class="pool-rarity-badge" :class="`rarity-${p.rarity.toLowerCase()}`">{{ p.rarity }}</view>
          </view>
        </view>

        <!-- 召唤概率 -->
        <view class="rate-info">
          <text class="rate-label">召唤概率：</text>
          <text class="rate-value">SSR 2% | SR 18% | R 80%</text>
        </view>

        <!-- 召唤按钮 -->
        <view class="action-section">
          <base-button class="btn-single" @tap="onSummon(1)">单次召唤</base-button>
          <base-button class="btn-ten" @tap="onSummon(10)">十连召唤</base-button>
        </view>

        <!-- 最近获得（页面间通信演示：从 store 读取当前角色） -->
        <view v-if="store.state.currentCharacter" class="recent-section">
          <text class="section-title">最近获得</text>
          <view class="recent-card" @tap="onViewRecentCharacter">
            <view class="recent-avatar-container">
              <image class="recent-avatar" :src="getCharacterAvatar(store.state.currentCharacter.id)" mode="aspectFill" />
              <view class="avatar-placeholder" v-if="!hasAvatar(store.state.currentCharacter.id)">{{ store.state.currentCharacter.name.charAt(0) }}</view>
            </view>
            <view class="recent-info">
              <text class="recent-name">{{ store.state.currentCharacter.name }}</text>
              <text class="recent-rarity" :class="`rarity-${store.state.currentCharacter.rarity.toLowerCase()}`">{{ store.state.currentCharacter.rarity }}</text>
            </view>
            <text class="recent-tap">点击查看详情</text>
          </view>
        </view>

        <view class="guarantee">
          <text class="guarantee-text">未保底机制，每次召唤概率独立</text>
        </view>

      </view>
    </scroll-view>
  </view>
</template>

<script setup>
import CustomNavbar from '@/pages/components/CustomNavbar.vue';
import BaseButton from '@/pages/components/BaseButton.vue';
import { ref } from 'vue';
import { useStore } from 'vuex';
import { getCharacterAvatar, getStaticUrl } from '@/utils/resource.js';
import { eventBus } from '@/utils/event-bus.js';

const store = useStore();

const activePool = ref(0);
const pools = ref([
  { id: 'qing', name: '普通召唤', desc: '消耗食灵契约召唤', cost: '食灵契约 × 1', rarity: 'SR', initial: 'Q' },
  { id: 'blue-cheese', name: '高级召唤', desc: '消耗灵晶召唤，保底 SR', cost: '灵晶 × 50', rarity: 'SSR', initial: 'B' },
  { id: 'tom-yum', name: '限时召唤', desc: 'UP 食灵出率提升', cost: '灵晶 × 100', rarity: 'SSR', initial: 'T' },
]);

// 获取卡池头像路径（资源到位后自动加载真实图片）
const getPoolAvatar = (characterId) => {
  return getStaticUrl(`images/characters/${characterId}_avatar.png`);
};

// 检查是否有真实头像资源（目前返回 false，资源到位后改为 true）
const hasAvatar = (characterId) => {
  // 实际项目中可通过 uni.getImageInfo 检查资源是否存在
  return false;
};

const onBack = () => uni.navigateBack();

const onSummon = async (count) => {
  uni.showLoading({ title: '召唤中...' });

  // 模拟召唤结果：从当前卡池随机获得一个角色
  setTimeout(() => {
    uni.hideLoading();
    const pool = pools.value[activePool.value];
    const resultCharacter = {
      id: pool.id,
      name: pool.name.replace('召唤', '食灵'),
      rarity: pool.rarity,
    };

    // 页面间通信：通过 store 设置当前角色，供其他页面读取
    store.dispatch('setCurrentCharacter', resultCharacter);

    // 页面间通信：通过 eventBus 广播召唤结果
    eventBus.emit('summon-result', {
      count,
      character: resultCharacter,
      pool: pool.id,
      timestamp: new Date().toISOString(),
    });

    uni.showToast({ title: `获得${resultCharacter.name}（${resultCharacter.rarity}）`, icon: 'none', duration: 3000 });
  }, 1500);
};

const onViewRecentCharacter = () => {
  const character = store.state.currentCharacter;
  if (!character) return;
  // 页面间通信：通过 navigateTo 传参跳转到角色详情页
  uni.navigateTo({
    url: `/pages/hero/hero?characterId=${character.id}&characterName=${encodeURIComponent(character.name)}&from=summon`,
    events: {
      // 监听从目标页面返回的数据
      onCharacterUpdated: (data) => {
        console.log('角色详情页返回数据:', data);
        uni.showToast({ title: `角色已更新：${data.name}`, icon: 'none' });
      }
    }
  });
};
</script>

<style scoped>
.page { width: 100vw; min-height: 100vh; background: #0F0E1D; }
.scroll { height: 100vh; padding-top: 88rpx; padding-bottom: 100rpx; box-sizing: border-box; }
.content { padding: 0 48rpx; box-sizing: border-box; }
.section-title { font-size: 32rpx; color: #FFFFFF; font-weight: 700; margin: 40rpx 0 24rpx 0; }
.pool-list { display: flex; flex-direction: column; gap: 16rpx; margin-bottom: 40rpx; }
.pool-card {
  display: flex; justify-content: space-between; align-items: center;
  background: rgba(255,255,255,0.04); border: 1rpx solid #2A293E;
  border-radius: 20rpx; padding: 24rpx 32rpx;
}
.pool-card.active { border-color: #E0D3A1; background: rgba(224,211,161,0.1); }
.pool-card:active { background: rgba(255,255,255,0.08); }
.pool-avatar-container {
  position: relative; width: 80rpx; height: 80rpx; border-radius: 40rpx;
  background: #1A192E; border: 2rpx solid #2A293E;
  overflow: hidden; flex-shrink: 0;
}
.pool-avatar {
  width: 100%; height: 100%; object-fit: cover; display: block;
}
.avatar-placeholder {
  width: 100%; height: 100%; border-radius: 40rpx;
  background: linear-gradient(135deg, rgba(255,255,255,0.08) 0%, rgba(255,255,255,0.02) 100%);
  display: flex; align-items: center; justify-content: center;
  font-size: 32rpx; font-weight: 700; color: #E0D3A1;
}
.pool-info { flex: 1; margin: 0 24rpx; }
.pool-name { font-size: 28rpx; color: #FFFFFF; font-weight: 600; margin-bottom: 6rpx; }
.pool-desc { font-size: 22rpx; color: #8A8A9E; margin-bottom: 6rpx; }
.pool-cost { font-size: 24rpx; color: #E0D3A1; font-weight: 600; }
.pool-rarity-badge {
  font-size: 22rpx; font-weight: 600; padding: 4rpx 16rpx;
  border-radius: 12rpx; text-transform: uppercase;
}
.pool-rarity-badge.rarity-sr { color: #00D2FF; border: 1rpx solid #00D2FF; background: rgba(0,210,255,0.1); }
.pool-rarity-badge.rarity-ssr { color: #E0D3A1; border: 1rpx solid #E0D3A1; background: rgba(224,211,161,0.1); }
.rate-info {
  background: rgba(255,255,255,0.04); border: 1rpx solid #2A293E;
  border-radius: 20rpx; padding: 24rpx 32rpx; margin-bottom: 30rpx; text-align: center;
}
.rate-label { font-size: 24rpx; color: #8A8A9E; margin-right: 10rpx; }
.rate-value { font-size: 24rpx; color: #E0D3A1; font-weight: 600; }
.action-section { display: flex; gap: 20rpx; margin-bottom: 30rpx; }
.btn-single, .btn-ten {
  flex: 1; height: 88rpx; line-height: 88rpx;
  background: rgba(255,255,255,0.06); border: 1rpx solid #2A293E;
  color: #FFFFFF; font-size: 28rpx; border-radius: 44rpx;
}
.btn-ten { background: linear-gradient(135deg, #E0D3A1 0%, #C9B87E 100%); color: #0F0E1D; font-weight: 700; }
.btn-single:active, .btn-ten:active { background: rgba(255,255,255,0.12); }
.recent-section { margin-bottom: 30rpx; }
.recent-card {
  display: flex; align-items: center; gap: 24rpx;
  background: rgba(255,255,255,0.04); border: 1rpx solid #E0D3A1;
  border-radius: 20rpx; padding: 24rpx 32rpx;
}
.recent-card:active { background: rgba(224,211,161,0.1); }
.recent-avatar-container {
  position: relative; width: 96rpx; height: 96rpx; border-radius: 48rpx;
  background: #1A192E; border: 2rpx solid #E0D3A1; overflow: hidden; flex-shrink: 0;
}
.recent-avatar { width: 100%; height: 100%; object-fit: cover; display: block; }
.recent-info { flex: 1; }
.recent-name { font-size: 28rpx; color: #FFFFFF; font-weight: 700; margin-bottom: 6rpx; }
.recent-rarity { font-size: 22rpx; font-weight: 600; padding: 2rpx 12rpx; border-radius: 12rpx; }
.recent-rarity.rarity-ssr { color: #E0D3A1; border: 1rpx solid #E0D3A1; background: rgba(224,211,161,0.1); }
.recent-tap { font-size: 22rpx; color: #8A8A9E; margin-top: 10rpx; }
.guarantee { text-align: center; font-size: 22rpx; color: #8A8A9E; }
</style>