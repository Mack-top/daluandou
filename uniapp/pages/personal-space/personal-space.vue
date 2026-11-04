<!-- componentized -->
<template>
  <view class="page">
        <custom-navbar title="个人空间" :show-back="true" @back="onBack" />

    <scroll-view class="scroll" scroll-y="true" show-scrollbar="false">
      <view class="content">
        <!-- 个人主页 -->
        <view class="profile-card">
          <view class="profile-avatar-wrapper">
            <avatar-icon :placeholder-char="avatar" :size="'xl'" :shape="'circle'" />
          </view>
          <view class="profile-info">
            <text class="profile-name">{{ profile.name }}</text>
            <text class="profile-id">ID: {{ profile.id }}</text>
            <text class="profile-level">等级 {{ profile.level }}</text>
            <text class="profile-power">战力 {{ profile.power }}</text>
          </view>
          <view class="profile-action">
            <base-button class="btn-edit" @tap="onEdit">编辑资料</base-button>
          </view>
        </view>
        <!-- 收藏/勋章 -->
        <view class="section-title">我的收藏</view>
        <view class="collection-grid">
          <view class="collection-item" v-for="(c, i) in collections" :key="i">
            <view class="collection-icon-wrapper">
              <avatar-icon :placeholder-char="c.icon" :size="'md'" :shape="'circle'" />
            </view>
            <text class="collection-name">{{ c.name }}</text>
          </view>
        </view>
        <!-- 地区设置 -->
        <view class="section-title">地区设置</view>
        <view class="setting-item" @tap="onRegion">
          <text class="setting-label">当前地区：{{ region }}</text>
          <view class="setting-arrow-wrapper">
            <avatar-icon placeholder-char="▶" :size="'sm'" :shape="'circle'" />
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
import { getSave } from '@/utils/api.js';

const avatar = ref('👤');
const profile = ref({ name: '食神小助手', id: '8821001', level: 1, power: 0 });
const region = ref('中国·香港');
const collections = ref([
  { name: '美食之王勋章', icon: '👑' },
  { name: '七日登录勋章', icon: '📅' },
  { name: '首充勋章', icon: '💎' }
]);

// 从后端存档获取玩家个人资料（替换模拟数据）
const loadProfile = async () => {
  try {
    const result = await getSave();
    const save = result.save || result;
    const profileData = save.profile || {};
    profile.value = {
      name: profileData.name || '食神小助手',
      id: save._id || '8821001',
      level: save.stars && Object.keys(save.stars).length > 0 ? Object.values(save.stars).reduce((a, b) => Math.max(a, b), 1) : 1,
      power: Math.floor((save.coins || 0) / 1000) + (save.gems || 0) * 10,
    };
    avatar.value = profileData.name ? profileData.name.charAt(0) : '👤';
  } catch (e) {
    console.warn('load profile failed', e);
  }
};

onMounted(() => {
  loadProfile();
});

const onBack = () => uni.navigateBack();
const onEdit = () => uni.showToast({ title: '编辑资料开发中', icon: 'none' });
const onRegion = () => uni.showToast({ title: '地区设置开发中', icon: 'none' });
</script>

<style scoped>
.page { width: 100vw; min-height: 100vh; background: #0F0E1D; }
.scroll { height: 100vh; padding-top: 88rpx; padding-bottom: 100rpx; box-sizing: border-box; }
.content { padding: 0 48rpx; box-sizing: border-box; }
.profile-card { background: rgba(255,255,255,0.04); border: 1rpx solid #2A293E; border-radius: 24rpx; padding: 32rpx; margin-bottom: 30rpx; display: flex; justify-content: space-between; align-items: center; }
.profile-avatar-wrapper { width: 96rpx; height: 96rpx; flex-shrink: 0; }
.profile-info { flex: 1; margin: 0 32rpx; }
.profile-name { font-size: 34rpx; color: #FFFFFF; font-weight: 700; margin-bottom: 8rpx; }
.profile-id { font-size: 22rpx; color: #8A8A9E; margin-bottom: 6rpx; }
.profile-level { font-size: 24rpx; color: #B8B8C8; margin-bottom: 6rpx; }
.profile-power { font-size: 28rpx; color: #E0D3A1; font-weight: 700; }
.profile-action { flex-shrink: 0; }
.btn-edit { width: 140rpx; height: 56rpx; line-height: 56rpx; background: rgba(255,255,255,0.06); border: 1rpx solid #2A293E; color: #FFFFFF; font-size: 22rpx; border-radius: 28rpx; flex-shrink: 0; }
.btn-edit:active { background: rgba(255,255,255,0.12); }
.section-title { font-size: 32rpx; color: #FFFFFF; font-weight: 700; margin: 30rpx 0 24rpx 0; }
.collection-grid { display: flex; gap: 24rpx; margin-bottom: 40rpx; }
.collection-item { background: rgba(255,255,255,0.04); border: 1rpx solid #2A293E; border-radius: 20rpx; padding: 24rpx; text-align: center; flex: 1; }
.collection-icon-wrapper { width: 48rpx; height: 48rpx; flex-shrink: 0; margin-bottom: 8rpx; }
.collection-name { font-size: 22rpx; color: #B8B8C8; }
.setting-item { display: flex; justify-content: space-between; align-items: center; background: rgba(255,255,255,0.04); border: 1rpx solid #2A293E; border-radius: 20rpx; padding: 20rpx 32rpx; margin-bottom: 16rpx; }
.setting-item:active { background: rgba(255,255,255,0.08); }
.setting-label { font-size: 26rpx; color: #FFFFFF; }
.setting-arrow-wrapper { width: 24rpx; height: 24rpx; flex-shrink: 0; }
</style>