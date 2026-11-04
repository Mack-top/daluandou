<!-- componentized -->
<template>
  <view class="page">
        <custom-navbar title="藏宝阁" :show-back="true" @back="onBack" />

    <scroll-view class="scroll" scroll-y="true" show-scrollbar="false">
      <view class="content">
        <!-- 刷新倒计时 -->
        <view class="refresh-card">
          <text class="refresh-label">商品刷新倒计时：</text>
          <text class="refresh-time">{{ countdown }}</text>
          <base-button class="btn-refresh" @tap="onRefresh">手动刷新</base-button>
        </view>
        <!-- 商品列表 -->
        <view class="section-title">限时商品</view>
        <view class="product-list">
          <view v-for="(p, i) in products" :key="i" class="product-card">
            <view class="product-icon-wrapper">
              <avatar-icon :placeholder-char="p.icon" :size="'md'" :shape="'circle'" />
            </view>
            <view class="product-info">
              <text class="product-name">{{ p.name }}</text>
              <text class="product-desc">{{ p.desc }}</text>
              <text class="product-limit">每日限购：{{ p.bought }}/{{ p.limit }}</text>
            </view>
            <view class="product-action">
              <text class="product-price">{{ p.price }}</text>
              <base-button class="product-buy" @tap.stop="onBuy(p)">购买</base-button>
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

const countdown = ref('04:12:30');
const products = ref([]);

// 商品图标映射（按稀有度）
const productIcon = (rarity) => {
  if (rarity === 'SSR') return '👑';
  if (rarity === 'SR') return '🌟';
  return '⭐';
};

// 从后端 catalog 获取角色作为商店商品（替换模拟数据）
const loadProducts = async () => {
  try {
    const result = await getCatalog();
    const characters = result.characters || [];
    products.value = characters.map((c, idx) => ({
      id: c.id,
      name: c.name,
      desc: `${c.title} · ${c.element} ${c.role}`,
      icon: productIcon(c.rarity),
      price: c.rarity === 'SSR' ? '灵晶 × 8000' : '灵晶 × 3000',
      limit: 1,
      bought: 0,
      basePower: c.basePower,
    }));
    if (products.value.length === 0) {
      products.value = [
        { name: '5星食灵自选箱', desc: '可选任意一名 5 星食灵', icon: '👑', price: '灵晶 × 8000', limit: 1, bought: 0 },
        { name: '史诗随机装备', desc: '随机获得一件史诗装备', icon: '⚔️', price: '灵晶 × 1500', limit: 3, bought: 1 },
        { name: '食灵契约 × 50', desc: '大量召唤券', icon: '📖', price: '金币 × 1000000', limit: 5, bought: 2 },
        { name: '经验药水（大）', desc: '大量主角经验', icon: '🧪', price: '金币 × 500000', limit: 10, bought: 5 },
      ];
    }
  } catch (e) {
    console.warn('load products failed', e);
    products.value = [
      { name: '5星食灵自选箱', desc: '可选任意一名 5 星食灵', icon: '👑', price: '灵晶 × 8000', limit: 1, bought: 0 },
      { name: '史诗随机装备', desc: '随机获得一件史诗装备', icon: '⚔️', price: '灵晶 × 1500', limit: 3, bought: 1 },
      { name: '食灵契约 × 50', desc: '大量召唤券', icon: '📖', price: '金币 × 1000000', limit: 5, bought: 2 },
      { name: '经验药水（大）', desc: '大量主角经验', icon: '🧪', price: '金币 × 500000', limit: 10, bought: 5 },
    ];
  }
};

onMounted(() => {
  loadProducts();
});

const onBack = () => uni.navigateBack();
const onRefresh = () => {
  uni.showModal({ title: '提示', content: '确定消耗 50 灵晶手动刷新商品吗？', success: (res) => { if (res.confirm) uni.showToast({ title: '刷新成功', icon: 'success' }); } });
};
const onBuy = (p) => {
  if (p.bought >= p.limit) {
    uni.showToast({ title: '今日购买次数已用完', icon: 'none' });
    return;
  }
  uni.showToast({ title: `购买${p.name}成功`, icon: 'success' });
};
</script>

<style scoped>
.page { width: 100vw; min-height: 100vh; background: #0F0E1D; }
.scroll { height: 100vh; padding-top: 88rpx; padding-bottom: 100rpx; box-sizing: border-box; }
.content { padding: 0 48rpx; box-sizing: border-box; }
.refresh-card { background: rgba(255,255,255,0.04); border: 1rpx solid #2A293E; border-radius: 24rpx; padding: 28rpx 32rpx; margin-bottom: 30rpx; display: flex; justify-content: space-between; align-items: center; }
.refresh-label { font-size: 26rpx; color: #B8B8C8; }
.refresh-time { font-size: 32rpx; color: #E0D3A1; font-weight: 700; font-family: monospace; margin: 0 24rpx; }
.btn-refresh { width: 140rpx; height: 56rpx; line-height: 56rpx; background: rgba(255,255,255,0.06); border: 1rpx solid #2A293E; color: #FFFFFF; font-size: 22rpx; border-radius: 28rpx; flex-shrink: 0; }
.btn-refresh:active { background: rgba(255,255,255,0.12); }
.section-title { font-size: 32rpx; color: #FFFFFF; font-weight: 700; margin: 30rpx 0 24rpx 0; }
.product-list { display: flex; flex-direction: column; gap: 16rpx; }
.product-card { display: flex; justify-content: space-between; align-items: center; background: rgba(255,255,255,0.04); border: 1rpx solid #2A293E; border-radius: 20rpx; padding: 24rpx 32rpx; }
.product-card:active { background: rgba(255,255,255,0.08); }
.product-icon-wrapper { width: 40rpx; height: 40rpx; flex-shrink: 0; }
.product-info { flex: 1; margin: 0 24rpx; }
.product-name { font-size: 26rpx; color: #FFFFFF; font-weight: 600; margin-bottom: 4rpx; }
.product-desc { font-size: 22rpx; color: #8A8A9E; margin-bottom: 6rpx; }
.product-limit { font-size: 20rpx; color: #8A8A9E; }
.product-action { display: flex; align-items: center; gap: 12rpx; flex-shrink: 0; }
.product-price { font-size: 24rpx; color: #E0D3A1; font-weight: 700; margin-right: 12rpx; }
.product-buy { width: 120rpx; height: 56rpx; line-height: 56rpx; background: linear-gradient(135deg, #E0D3A1 0%, #C9B87E 100%); color: #0F0E1D; font-size: 22rpx; font-weight: 700; border-radius: 28rpx; flex-shrink: 0; }
.product-buy:active { transform: scale(0.96); opacity: 0.85; }
</style>