<!-- componentized -->
<template>
  <view class="page">
    <!-- 自定义导航栏 -->
        <custom-navbar title="玩家详情" :show-back="true" @back="onBack" />


    <scroll-view class="scroll" scroll-y="true" show-scrollbar="false">
      <view class="content">

        <!-- 玩家主信息 -->
        <view class="player-header">
          <view class="player-avatar">
            <view class="avatar-icon-wrapper">
              <avatar-icon placeholder-char="👤" :size="'md'" :shape="'circle'" />
            </view>
          </view>
          <view class="player-info">
            <text class="player-name">{{ player.name }}</text>
            <text class="player-server">{{ player.server }}</text>
            <text class="player-power">战力 {{ player.power }}</text>
          </view>
          <view class="player-level">Lv.{{ player.level }}</view>
        </view>

        <!-- 属性面板 -->
        <view class="section-title">属性面板</view>
        <view class="attr-grid">
          <view class="attr-card">
            <text class="attr-label">生命</text>
            <text class="attr-value">{{ player.attr.hp }}</text>
          </view>
          <view class="attr-card">
            <text class="attr-label">攻击</text>
            <text class="attr-value">{{ player.attr.atk }}</text>
          </view>
          <view class="attr-card">
            <text class="attr-label">防御</text>
            <text class="attr-value">{{ player.attr.def }}</text>
          </view>
          <view class="attr-card">
            <text class="attr-label">速度</text>
            <text class="attr-value">{{ player.attr.spd }}</text>
          </view>
        </view>

        <!-- 食灵阵容 -->
        <view class="section-title">主力食灵阵容</view>
        <view class="team-list">
          <view
            v-for="(c, i) in team"
            :key="i"
            class="team-card"
          >
            <view class="team-avatar-wrapper">
              <avatar-icon :placeholder-char="c.icon" :size="'md'" :shape="'circle'" />
            </view>
            <view class="team-info">
              <text class="team-name">{{ c.name }}</text>
              <text class="team-rarity">{{ c.rarity }} · {{ c.element }} · {{ c.role }}</text>
            </view>
            <text class="team-power">战力 {{ c.power }}</text>
          </view>
        </view>

        <!-- 操作按钮 -->
        <view class="action-row">
          <base-button class="btn-action" @tap="onAddFriend">加为好友</base-button>
          <base-button class="btn-action" @tap="onSendMail">发送邮件</base-button>
        </view>

      </view>
    </scroll-view>
  </view>
</template>

<script setup>
import CustomNavbar from '@/pages/components/CustomNavbar.vue';
import BaseButton from '@/pages/components/BaseButton.vue';
import AvatarIcon from '@/pages/components/AvatarIcon.vue';
import { ref } from 'vue';

const player = ref({
  name: '食神小助手',
  server: '美食17服',
  level: 42,
  power: 125000,
  attr: { hp: 45000, atk: 12000, def: 6500, spd: 380 }
});

const team = ref([
  { name: '冬阴功', rarity: '5星SSR', element: '火', role: '输出', power: 35000, icon: '🍲' },
  { name: '拉菲', rarity: '5星SSR', element: '光', role: '辅助', power: 32000, icon: '🍷' },
  { name: '咖喱', rarity: '5星SSR', element: '土', role: '防御', power: 28000, icon: '🍛' },
  { name: '蓝纹奶酪', rarity: '5星SSR', element: '水', role: '法术', power: 30000, icon: '🧀' }
]);

const onBack = () => { uni.navigateBack(); };

const onAddFriend = () => {
  uni.showToast({ title: '已发送好友申请', icon: 'none' });
};

const onSendMail = () => {
  uni.showToast({ title: '打开写信界面', icon: 'none' });
};
</script>

<style scoped>
.page { width: 100vw; min-height: 100vh; background-color: #0F0E1D; position: relative; }
.scroll { height: 100vh; padding-top: 88rpx; padding-bottom: 100rpx; box-sizing: border-box; }
.content { padding: 0 48rpx; box-sizing: border-box; }
.player-header {
  display: flex; align-items: center; gap: 32rpx;
  background: rgba(255,255,255,0.04); border: 1rpx solid #2A293E;
  border-radius: 24rpx; padding: 32rpx; margin-bottom: 30rpx;
}
.player-avatar {
  width: 110rpx; height: 110rpx; border-radius: 55rpx;
  background: #1A192E; border: 1rpx solid #2A293E;
  display: flex; align-items: center; justify-content: center; flex-shrink: 0;
}
.avatar-icon-wrapper { width: 56rpx; height: 56rpx; flex-shrink: 0; }
.player-info { flex: 1; }
.player-name { font-size: 34rpx; color: #FFFFFF; font-weight: 700; margin-bottom: 6rpx; }
.player-server { font-size: 24rpx; color: #8A8A9E; margin-bottom: 8rpx; }
.player-power { font-size: 30rpx; color: #E0D3A1; font-weight: 700; }
.player-level {
  font-size: 32rpx; color: #FFFFFF; font-weight: 700;
  background: #1A192E; border: 1rpx solid #2A293E;
  padding: 12rpx 24rpx; border-radius: 20rpx; flex-shrink: 0;
}
.section-title { font-size: 32rpx; color: #FFFFFF; font-weight: 700; margin: 30rpx 0 24rpx 0; }
.attr-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 20rpx; margin-bottom: 30rpx; }
.attr-card {
  background: rgba(255,255,255,0.04); border: 1rpx solid #2A293E;
  border-radius: 20rpx; padding: 24rpx; text-align: center;
}
.attr-label { font-size: 24rpx; color: #8A8A9E; margin-bottom: 8rpx; display: block; }
.attr-value { font-size: 28rpx; color: #FFFFFF; font-weight: 700; }
.team-list { display: flex; flex-direction: column; gap: 16rpx; margin-bottom: 30rpx; }
.team-card {
  display: flex; justify-content: space-between; align-items: center;
  background: rgba(255,255,255,0.04); border: 1rpx solid #2A293E;
  border-radius: 20rpx; padding: 20rpx 32rpx;
}
.team-avatar-wrapper { width: 40rpx; height: 40rpx; flex-shrink: 0; }
.team-info { flex: 1; margin: 0 24rpx; }
.team-name { font-size: 26rpx; color: #FFFFFF; font-weight: 600; margin-bottom: 6rpx; }
.team-rarity { font-size: 22rpx; color: #E0D3A1; }
.team-power { font-size: 24rpx; color: #B8B8C8; font-weight: 600; }
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