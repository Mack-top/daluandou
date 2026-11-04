<!-- componentized -->
<template>
  <view class="page">
        <custom-navbar title="资源副本" :show-back="true" @back="onBack" />

    <scroll-view class="scroll" scroll-y="true" show-scrollbar="false">
      <view class="content">
        <view class="section-title">资源获取副本</view>
        <view class="resource-list">
          <view v-for="(r, i) in resources" :key="i" class="resource-card" @tap="onEnter(r)">
            <view class="resource-icon-wrapper">
              <avatar-icon :placeholder-char="r.icon" :size="'md'" :shape="'circle'" />
            </view>
            <view class="resource-info">
              <text class="resource-name">{{ r.name }}</text>
              <text class="resource-desc">{{ r.desc }}</text>
              <text class="resource-drops">{{ r.drops }}</text>
            </view>
            <view class="resource-arrow-wrapper">
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
import { getCatalog } from '@/utils/api.js';

const resources = ref([]);

// 资源副本图标映射（按掉落奖励类型）
const resourceIcon = (rewards) => {
  const kinds = rewards.map((r) => r.kind);
  if (kinds.includes('coin')) return '💰';
  if (kinds.includes('leaf')) return '⚡';
  if (kinds.includes('gem')) return '💎';
  if (kinds.includes('book')) return '📖';
  if (kinds.includes('potion')) return '🧪';
  return '📦';
};

// 从后端 catalog 获取资源副本列表（替换模拟数据）
const loadResources = async () => {
  try {
    const result = await getCatalog();
    const stages = result.stages || [];
    resources.value = stages.map((s, idx) => {
      const rewards = Array.isArray(s.rewards) ? s.rewards : [];
      const drops = rewards.map((r) => `${r.label || '奖励'} × ${r.amount || 0}`).join('、') || '未知奖励';
      return {
        id: s.id,
        name: s.name,
        desc: `${s.chapter} · 建议战力 ${s.suggestedPower}`,
        icon: resourceIcon(rewards),
        drops,
        cost: 10 + idx * 5,
      };
    });
    if (resources.value.length === 0) {
      resources.value = [
        { name: '金币矿脉', desc: '第一章 · 建议战力 7000', icon: '💰', drops: '金币 × 10000' },
        { name: '食灵精华矿', desc: '第一章 · 建议战力 16000', icon: '⚡', drops: '食灵精华 × 40' },
        { name: '升星石矿', desc: '第二章 · 建议战力 28000', icon: '💎', drops: '升星石 × 少量' },
      ];
    }
  } catch (e) {
    console.warn('load resources failed', e);
    resources.value = [
      { name: '金币矿脉', desc: '掉落大量金币', icon: '💰', drops: '金币 × 大量' },
      { name: '食灵精华矿', desc: '掉落食灵精华', icon: '⚡', drops: '食灵精华 × 中量' },
      { name: '升星石矿', desc: '掉落升星石', icon: '💎', drops: '升星石 × 少量' },
      { name: '装备碎片矿', desc: '掉落随机装备碎片', icon: '📦', drops: '装备碎片 × 随机' },
      { name: '经验药水矿', desc: '掉落经验药水', icon: '🧪', drops: '经验药水 × 中量' },
    ];
  }
};

onMounted(() => {
  loadResources();
});

const onBack = () => uni.navigateBack();
const onEnter = (r) => uni.showToast({ title: `进入${r.name}`, icon: 'none' });
</script>

<style scoped>
.page { width: 100vw; min-height: 100vh; background: #0F0E1D; }
.scroll { height: 100vh; padding-top: 88rpx; padding-bottom: 100rpx; box-sizing: border-box; }
.content { padding: 0 48rpx; box-sizing: border-box; }
.section-title { font-size: 32rpx; color: #FFFFFF; font-weight: 700; margin: 40rpx 0 24rpx 0; }
.resource-list { display: flex; flex-direction: column; gap: 16rpx; }
.resource-card { display: flex; justify-content: space-between; align-items: center; background: rgba(255,255,255,0.04); border: 1rpx solid #2A293E; border-radius: 20rpx; padding: 24rpx 32rpx; }
.resource-card:active { background: rgba(255,255,255,0.08); }
.resource-icon-wrapper { width: 48rpx; height: 48rpx; flex-shrink: 0; }
.resource-info { flex: 1; margin: 0 24rpx; }
.resource-name { font-size: 26rpx; color: #FFFFFF; font-weight: 600; margin-bottom: 6rpx; }
.resource-desc { font-size: 22rpx; color: #8A8A9E; margin-bottom: 6rpx; }
.resource-drops { font-size: 22rpx; color: #E0D3A1; font-weight: 600; }
.resource-arrow-wrapper { width: 24rpx; height: 24rpx; flex-shrink: 0; }
</style>