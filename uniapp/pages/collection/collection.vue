<!-- componentized -->
<template>
  <view class="page">
        <custom-navbar title="食灵图鉴" :show-back="true" @back="onBack" />

    <scroll-view class="scroll" scroll-y="true" show-scrollbar="false">
      <view class="content">
        <view class="section-title">已收录食灵 {{ ownedCount }} / {{ totalCount }}</view>
        <view class="collection-grid">
          <view v-for="(c, i) in collections" :key="i" class="collection-card" :class="{owned: c.owned}" @tap="onTap(c)">
            <!-- 食灵头像：美术资源接入，资源到位后自动显示真实图片 -->
            <view class="collection-avatar-container">
              <image class="collection-avatar" :src="getCharacterAvatar(c.id)" mode="aspectFill" v-if="c.owned" />
              <view class="avatar-placeholder" v-if="c.owned && !hasAvatar(c.id)">{{ c.initial }}</view>
              <view v-if="!c.owned" class="locked-placeholder">{{ c.initial }}</view>
            </view>
            <text class="collection-name">{{ c.name }}</text>
            <text class="collection-rarity" :class="`rarity-${c.rarity.toLowerCase()}`">{{ c.rarity }}</text>
            <view v-if="!c.owned" class="lock-mask">未解锁</view>
          </view>
        </view>
      </view>
    </scroll-view>
  </view>
</template>

<script setup>
import CustomNavbar from '@/pages/components/CustomNavbar.vue';
import BaseButton from '@/pages/components/BaseButton.vue';
import { ref, computed, onMounted, onUnmounted } from 'vue';
import { useStore } from 'vuex';
import { getCharacterAvatar, getStaticUrl } from '@/utils/resource.js';
import { eventBus } from '@/utils/event-bus.js';

const store = useStore();

const collections = ref([
  { id: 'qing', name: '青团', rarity: 'SR', icon: '🍡', initial: 'Q', owned: true },
  { id: 'blue-cheese', name: '蓝纹奶酪', rarity: 'SSR', icon: '🧀', initial: 'B', owned: true },
  { id: 'tom-yum', name: '冬阴功', rarity: 'SSR', icon: '🍲', initial: 'T', owned: true },
  { id: 'lafite', name: '拉菲', rarity: 'SSR', icon: '🍷', initial: 'L', owned: false },
  { id: 'curry', name: '咖喱', rarity: 'SSR', icon: '🍛', initial: 'C', owned: false },
]);

const ownedCount = computed(() => collections.value.filter(c => c.owned).length);
const totalCount = computed(() => collections.value.length);

// 检查是否有真实头像资源
const hasAvatar = (id) => {
  // 实际项目中可通过 uni.getImageInfo 检查资源是否存在
  return false;
};

const onBack = () => uni.navigateBack();

const onTap = (c) => {
  if (!c.owned) {
    uni.showToast({ title: '未招募该食灵', icon: 'none' });
    return;
  }

  // 页面间通信：设置当前角色到 store，供 hero 页读取
  store.dispatch('setCurrentCharacter', {
    id: c.id,
    name: c.name,
    rarity: c.rarity,
  });

  // 页面间通信：通过 navigateTo 传参跳转到 hero 页
  uni.navigateTo({
    url: `/pages/hero/hero?characterId=${c.id}&characterName=${encodeURIComponent(c.name)}&from=collection`,
    events: {
      // 监听从 hero 页返回的数据
      onCharacterUpdated: (data) => {
        uni.showToast({ title: `角色信息已更新：${data.name}`, icon: 'none' });
      }
    }
  });

  // 同时通过 eventBus 广播选中事件
  eventBus.emit('character-selected', {
    id: c.id,
    name: c.name,
    rarity: c.rarity,
    source: 'collection',
  });
};

onMounted(() => {
  // 恢复页面间通信状态
  store.dispatch('restorePageComm');
});

onUnmounted(() => {
  // 页面关闭时广播图鉴关闭事件
  eventBus.emit('collection-closed', {
    ownedCount: ownedCount.value,
    totalCount: totalCount.value,
    timestamp: new Date().toISOString(),
  });
});
</script>

<style scoped>
.page { width: 100vw; min-height: 100vh; background: #0F0E1D; }
.scroll { height: 100vh; padding-top: 88rpx; padding-bottom: 100rpx; box-sizing: border-box; }
.content { padding: 0 48rpx; box-sizing: border-box; }
.section-title { font-size: 32rpx; color: #FFFFFF; font-weight: 700; margin: 40rpx 0 24rpx 0; }
.collection-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 24rpx; margin-bottom: 40rpx; }
.collection-card { background: rgba(255,255,255,0.04); border: 1rpx solid #2A293E; border-radius: 20rpx; padding: 24rpx; text-align: center; position: relative; }
.collection-card.owned { border-color: #E0D3A1; background: rgba(224,211,161,0.08); }
.collection-card:not(.owned) { opacity: 0.6; }
.collection-card:active { background: rgba(255,255,255,0.08); }
.collection-avatar-container {
  position: relative; width: 96rpx; height: 96rpx; border-radius: 48rpx;
  background: #1A192E; border: 2rpx solid #2A293E;
  margin: 0 auto 12rpx; overflow: hidden; flex-shrink: 0;
}
.collection-avatar {
  width: 100%; height: 100%; object-fit: cover; display: block;
}
.avatar-placeholder {
  width: 100%; height: 100%; border-radius: 48rpx;
  background: linear-gradient(135deg, rgba(255,255,255,0.08) 0%, rgba(255,255,255,0.02) 100%);
  display: flex; align-items: center; justify-content: center;
  font-size: 40rpx; font-weight: 700; color: #E0D3A1;
}
.locked-placeholder {
  width: 100%; height: 100%; border-radius: 48rpx;
  background: rgba(0,0,0,0.4);
  display: flex; align-items: center; justify-content: center;
  font-size: 40rpx; font-weight: 700; color: #8A8A9E;
}
.collection-name { font-size: 26rpx; color: #FFFFFF; font-weight: 600; margin-bottom: 6rpx; }
.collection-rarity { font-size: 20rpx; font-weight: 600; padding: 2rpx 12rpx; border-radius: 12rpx; }
.collection-rarity.rarity-sr { color: #00D2FF; border: 1rpx solid #00D2FF; background: rgba(0,210,255,0.1); }
.collection-rarity.rarity-ssr { color: #E0D3A1; border: 1rpx solid #E0D3A1; background: rgba(224,211,161,0.1); }
.lock-mask {
  position: absolute; top: 0; left: 0; right: 0; bottom: 0;
  background: rgba(0,0,0,0.5); border-radius: 20rpx;
  display: flex; align-items: center; justify-content: center;
  font-size: 24rpx; color: #8A8A9E; font-weight: 600;
}
</style>