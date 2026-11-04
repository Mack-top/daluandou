<!-- componentized -->
<template>
  <view class="page">
    <!-- 自定义导航栏 -->
        <custom-navbar title="{{ pageTitle }}" :show-back="true" @back="onBack" />


    <scroll-view class="scroll" scroll-y="true" show-scrollbar="false">
      <view class="content">

        <!-- 主角信息 -->
        <view class="hero-header">
          <!-- 主角头像：美术资源接入，资源到位后自动显示真实图片 -->
          <view class="hero-avatar-container">
            <image class="hero-avatar" :src="getCharacterAvatar(characterId)" mode="aspectFill" />
            <view class="avatar-placeholder-wrapper" v-if="!hasAvatar">
              <avatar-icon :placeholder-char="characterName.charAt(0)" :size="'xl'" :shape="'circle'" />
            </view>
          </view>
          <view class="hero-info">
            <text class="hero-name">{{ characterName }}</text>
            <text class="hero-level">{{ characterLevel }} 级</text>
            <text class="hero-power">战力 {{ heroPower }}</text>
          </view>
        </view>

        <!-- 属性面板 -->
        <view class="section-title">属性面板</view>
        <view class="attr-grid">
          <view class="attr-card">
            <text class="attr-label">生命</text>
            <text class="attr-value">{{ attr.hp }}</text>
          </view>
          <view class="attr-card">
            <text class="attr-label">攻击</text>
            <text class="attr-value">{{ attr.atk }}</text>
          </view>
          <view class="attr-card">
            <text class="attr-label">防御</text>
            <text class="attr-value">{{ attr.def }}</text>
          </view>
          <view class="attr-card">
            <text class="attr-label">速度</text>
            <text class="attr-value">{{ attr.spd }}</text>
          </view>
        </view>

        <!-- 装备栏 -->
        <view class="section-title">装备栏</view>
        <view class="equip-list">
          <view
            v-for="(e, i) in equipSlots"
            :key="i"
            class="equip-card"
            :class="{empty: !e.item}"
            @tap="() => onEquipTap(i)"
          >
            <!-- 装备图标：美术资源接入 -->
            <view class="equip-slot-container">
              <image class="equip-icon" :src="getItemIcon(e.item?.iconId)" mode="aspectFill" v-if="e.item && e.item.iconId" />
              <view class="avatar-placeholder-wrapper" v-if="e.item && !e.item.iconId">
                <avatar-icon :placeholder-char="e.item.icon" :size="'md'" :shape="'circle'" />
              </view>
              <text v-if="!e.item" class="equip-empty">+</text>
            </view>
            <view class="equip-info">
              <text class="equip-name">{{ e.item ? e.item.name : '未装备' }}</text>
              <text class="equip-desc">{{ e.item ? e.item.desc : '点击装备' }}</text>
            </view>
          </view>
        </view>

        <!-- 页面间通信：显示从召唤页传来的角色信息 -->
        <view v-if="fromSummon" class="summon-notice">
          <text class="notice-label">✨ 来自召唤页的通知</text>
          <text class="notice-text">{{ summonMessage }}</text>
        </view>

        <!-- 按钮 -->
        <view class="action-row">
          <base-button class="btn-action" @tap="onAttrDetail">属性详情</base-button>
          <base-button class="btn-action" @tap="onEquipManage">装备管理</base-button>
          <base-button class="btn-action" @tap="onViewCollection">查看图鉴</base-button>
        </view>

      </view>
    </scroll-view>
  </view>
</template>

<script setup>
import CustomNavbar from '@/pages/components/CustomNavbar.vue';
import BaseButton from '@/pages/components/BaseButton.vue';
import AvatarIcon from '@/pages/components/AvatarIcon.vue';
import { ref, computed, onMounted, onUnmounted } from 'vue';
import { useStore } from 'vuex';
import { getCharacterAvatar, getItemIcon, getStaticUrl } from '@/utils/resource.js';
import { eventBus } from '@/utils/event-bus.js';

const store = useStore();

// 页面参数（通过 navigateTo 传递）
const characterId = ref('');
const characterName = ref('主角');
const characterLevel = ref(15);
const heroPower = ref(67136);
const fromSummon = ref(false);
const summonMessage = ref('');

const pageTitle = computed(() => characterName.value || '主角');

const attr = ref({ hp: 12500, atk: 3400, def: 1800, spd: 220 });

const equipSlots = ref([
  { slot: '武器', item: null },
  { slot: '头盔', item: { name: '星夜头饰', desc: '防御+50', icon: '👑', iconId: 'helmet_starlight' } },
  { slot: '衣服', item: { name: '灵界法袍', desc: '生命+500', icon: '👕', iconId: 'robe_spirit' } },
  { slot: '饰品', item: null },
]);

// 检查是否有真实头像资源
const hasAvatar = ref(false);

// 页面间通信：监听召唤页广播的召唤结果
const summonUnsubscribe = eventBus.on('summon-result', (data) => {
  console.log('收到召唤结果:', data);
  summonMessage.value = `获得 ${data.character.name}（${data.character.rarity}）`;
  fromSummon.value = true;
  // 更新当前角色信息
  characterName.value = data.character.name;
  characterId.value = data.character.id;
});

// 页面间通信：监听从装备详情页返回的数据
const equipUpdateUnsubscribe = eventBus.on('equipment-updated', (data) => {
  console.log('装备已更新:', data);
  uni.showToast({ title: `装备已更新：${data.name}`, icon: 'none' });
});

onLoad((options) => {
  // 接收页面跳转参数
  if (options.characterId) {
    characterId.value = options.characterId;
  }
  if (options.characterName) {
    characterName.value = decodeURIComponent(options.characterName);
  }
  if (options.from === 'summon') {
    fromSummon.value = true;
    summonMessage.value = '从召唤页跳转而来，当前角色已同步';
  }

  // 恢复页面间通信状态
  store.dispatch('restorePageComm');

  // 如果 store 中有当前角色，优先使用
  if (store.state.currentCharacter) {
    characterName.value = store.state.currentCharacter.name;
    characterId.value = store.state.currentCharacter.id;
  }
});

onUnmounted(() => {
  // 取消订阅，防止内存泄漏
  summonUnsubscribe();
  equipUpdateUnsubscribe();
});

const onBack = () => {
  uni.navigateBack();
};

const onEquipTap = (index) => {
  const slot = equipSlots.value[index];
  if (slot.item) {
    // 页面间通信：通过 navigateTo 传参跳转到装备详情页
    uni.navigateTo({
      url: `/pages/equip-detail/equip-detail?equipId=${encodeURIComponent(slot.item.name)}&equipIconId=${slot.item.iconId || ''}&from=hero`,
      events: {
        // 监听从装备详情页返回的数据
        onEquipChanged: (data) => {
          uni.showToast({ title: `装备已变更：${data.name}`, icon: 'none' });
        }
      }
    });
  } else {
    uni.showToast({ title: `装备${slot.slot}`, icon: 'none' });
  }
};

const onAttrDetail = () => {
  uni.showToast({ title: '属性详情开发中', icon: 'none' });
};

const onEquipManage = () => {
  uni.showToast({ title: '装备管理开发中', icon: 'none' });
};

const onViewCollection = () => {
  uni.navigateTo({ url: '/pages/collection/collection' });
};
</script>

<style scoped>
.page { width: 100vw; min-height: 100vh; background-color: #0F0E1D; position: relative; }
.scroll { height: 100vh; padding-top: 88rpx; padding-bottom: 100rpx; box-sizing: border-box; }
.content { padding: 0 48rpx; box-sizing: border-box; }
.hero-header {
  display: flex; align-items: center; gap: 32rpx;
  background: rgba(255,255,255,0.04); border: 1rpx solid #2A293E;
  border-radius: 24rpx; padding: 32rpx; margin-bottom: 30rpx;
}
.hero-avatar-container {
  position: relative; width: 120rpx; height: 120rpx; border-radius: 60rpx;
  background: #1A192E; border: 2rpx solid #2A293E; overflow: hidden; flex-shrink: 0;
}
.hero-avatar {
  width: 100%; height: 100%; object-fit: cover; display: block;
}
.avatar-placeholder-wrapper {
  width: 100%; height: 100%; border-radius: 60rpx;
  background: linear-gradient(135deg, rgba(255,255,255,0.08) 0%, rgba(255,255,255,0.02) 100%);
  display: flex; align-items: center; justify-content: center;
}
.hero-info { flex: 1; }
.hero-name { font-size: 34rpx; color: #FFFFFF; font-weight: 700; margin-bottom: 8rpx; }
.hero-level { font-size: 26rpx; color: #B8B8C8; margin-bottom: 8rpx; }
.hero-power { font-size: 30rpx; color: #E0D3A1; font-weight: 700; }
.section-title { font-size: 32rpx; color: #FFFFFF; font-weight: 700; margin: 30rpx 0 24rpx 0; }
.attr-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 20rpx; margin-bottom: 30rpx; }
.attr-card {
  background: rgba(255,255,255,0.04); border: 1rpx solid #2A293E;
  border-radius: 20rpx; padding: 24rpx; text-align: center;
}
.attr-label { font-size: 24rpx; color: #8A8A9E; margin-bottom: 8rpx; display: block; }
.attr-value { font-size: 28rpx; color: #FFFFFF; font-weight: 700; }
.equip-list { display: flex; flex-direction: column; gap: 16rpx; margin-bottom: 30rpx; }
.equip-card {
  display: flex; justify-content: space-between; align-items: center;
  background: rgba(255,255,255,0.04); border: 1rpx solid #2A293E;
  border-radius: 20rpx; padding: 20rpx 32rpx;
}
.equip-card.empty { opacity: 0.6; }
.equip-card:active { background: rgba(255,255,255,0.08); }
.equip-slot-container {
  position: relative; width: 60rpx; height: 60rpx; border-radius: 30rpx;
  background: #1A192E; border: 1rpx solid #2A293E;
  display: flex; align-items: center; justify-content: center; flex-shrink: 0;
  overflow: hidden;
}
.equip-icon {
  width: 100%; height: 100%; object-fit: cover; display: block;
}
.equip-empty { font-size: 32rpx; color: #8A8A9E; }
.equip-info { flex: 1; margin: 0 24rpx; }
.equip-name { font-size: 26rpx; color: #FFFFFF; font-weight: 600; margin-bottom: 4rpx; }
.equip-desc { font-size: 22rpx; color: #B8B8C8; }
/* 召唤页通知栏 */
.summon-notice {
  display: flex; align-items: center; gap: 16rpx;
  background: rgba(224,211,161,0.1); border: 1rpx solid #E0D3A1;
  border-radius: 20rpx; padding: 20rpx 32rpx; margin-bottom: 30rpx;
}
.notice-label { font-size: 24rpx; color: #E0D3A1; font-weight: 700; }
.notice-text { font-size: 26rpx; color: #FFFFFF; flex: 1; }
.action-row { display: flex; gap: 20rpx; margin-top: 30rpx; }
.btn-action {
  flex: 1; height: 80rpx; line-height: 80rpx;
  background: rgba(255,255,255,0.06); border: 1rpx solid #2A293E;
  color: #FFFFFF; font-size: 28rpx; border-radius: 40rpx;
}
.btn-action:active { background: rgba(255,255,255,0.12); }
</style>