<template>
  <view class="page">
    <!-- 自定义导航栏 -->
    <view class="navbar">
      <text class="navbar-back" @tap="onBack">◀</text>
      <text class="navbar-title">主角</text>
      <view class="navbar-spacer"></view>
    </view>

    <scroll-view class="scroll" scroll-y="true" show-scrollbar="false">
      <view class="content">

        <!-- 主角信息 -->
        <view class="hero-header">
          <view class="hero-avatar">
            <text class="avatar-icon">👤</text>
          </view>
          <view class="hero-info">
            <text class="hero-name">{{ heroName }}</text>
            <text class="hero-level">等级 {{ heroLevel }}</text>
            <text class="hero-power">战力 {{ heroPower }}</text>
          </view>
        </view>

        <!-- 属性面板 -->
        <view class="section-title">属性面板</text>
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
        <view class="section-title">装备栏</text>
        <view class="equip-list">
          <view
            v-for="(e, i) in equipSlots"
            :key="i"
            class="equip-card"
            :class="{empty: !e.item}"
            @tap="() => onEquipTap(i)"
          >
            <view class="equip-slot">
              <text v-if="e.item" class="equip-icon">{{ e.item.icon }}</text>
              <text v-else class="equip-empty">+</text>
            </view>
            <view class="equip-info">
              <text class="equip-name">{{ e.item ? e.item.name : '未装备' }}</text>
              <text class="equip-desc">{{ e.item ? e.item.desc : '点击装备' }}</text>
            </view>
          </view>
        </view>

        <!-- 按钮 -->
        <view class="action-row">
          <button class="btn-action" @tap="onAttrDetail">属性详情</button>
          <button class="btn-action" @tap="onEquipManage">装备管理</button>
        </view>

      </view>
    </scroll-view>
  </view>
</template>

<script setup>
import { ref } from 'vue';

const heroName = ref('青团');
const heroLevel = ref(15);
const heroPower = ref(67136);

const attr = ref({ hp: 12500, atk: 3400, def: 1800, spd: 220 });

const equipSlots = ref([
  { slot: '武器', item: null },
  { slot: '头盔', item: { name: '星夜头饰', desc: '防御+50', icon: '👑' } },
  { slot: '衣服', item: { name: '灵界法袍', desc: '生命+500', icon: '👕' } },
  { slot: '饰品', item: null }
]);

const onBack = () => { uni.navigateBack(); };

const onEquipTap = (index) => {
  const slot = equipSlots.value[index];
  if (slot.item) {
    uni.showToast({ title: `查看${slot.item.name}详情`, icon: 'none' });
  } else {
    uni.showToast({ title: `装备${slot.slot}`, icon: 'none' });
  }
};

const onAttrDetail = () => { uni.showToast({ title: '属性详情开发中', icon: 'none' }); };
const onEquipManage = () => { uni.showToast({ title: '装备管理开发中', icon: 'none' }); };
</script>

<style scoped>
.page { width: 100vw; min-height: 100vh; background-color: #0F0E1D; position: relative; }
.navbar {
  position: fixed; top: 0; left: 0; right: 0; height: 88rpx;
  display: flex; align-items: center; padding: 0 32rpx;
  background-color: #16152A; border-bottom: 1rpx solid #2A293E; z-index: 100; box-sizing: border-box;
}
.navbar-back { font-size: 36rpx; color: #FFFFFF; }
.navbar-title { font-size: 34rpx; font-weight: 600; color: #FFFFFF; margin-left: 40rpx; }
.navbar-spacer { flex: 1; }
.scroll { height: 100vh; padding-top: 88rpx; padding-bottom: 100rpx; box-sizing: border-box; }
.content { padding: 0 48rpx; box-sizing: border-box; }
.hero-header {
  display: flex; align-items: center; gap: 32rpx;
  background: rgba(255,255,255,0.04); border: 1rpx solid #2A293E;
  border-radius: 24rpx; padding: 32rpx; margin-bottom: 30rpx;
}
.hero-avatar {
  width: 110rpx; height: 110rpx; border-radius: 55rpx;
  background: #1A192E; border: 1rpx solid #2A293E;
  display: flex; align-items: center; justify-content: center; flex-shrink: 0;
}
.avatar-icon { font-size: 56rpx; }
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
.equip-slot {
  width: 60rpx; height: 60rpx; border-radius: 30rpx;
  background: #1A192E; border: 1rpx solid #2A293E;
  display: flex; align-items: center; justify-content: center; flex-shrink: 0;
}
.equip-icon { font-size: 32rpx; }
.equip-empty { font-size: 32rpx; color: #8A8A9E; }
.equip-info { flex: 1; margin: 0 24rpx; }
.equip-name { font-size: 26rpx; color: #FFFFFF; font-weight: 600; margin-bottom: 4rpx; }
.equip-desc { font-size: 22rpx; color: #B8B8C8; }
.action-row {
  display: flex; gap: 20rpx; margin-top: 30rpx;
}
.btn-action {
  flex: 1; height: 80rpx; line-height: 80rpx;
  background: rgba(255,255,255,0.06); border: 1rpx solid #2A293E;
  color: #FFFFFF; font-size: 28rpx; border-radius: 40rpx;
}
.btn-action:active { background: rgba(255,255,255,0.12); }
</style>