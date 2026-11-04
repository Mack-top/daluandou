<template>
  <view class="page">
    <!-- 自定义导航栏（组件化） -->
    <custom-navbar
      title="好友"
      :show-back="true"
      @back="onBack"
    />
    <scroll-view class="scroll" scroll-y="true" show-scrollbar="false">
      <view class="content">
        <!-- 好友列表标签 -->
        <view class="tab-bar">
          <view v-for="tab in tabs" :key="tab" class="tab-item" :class="{active: activeTab === tab}" @tap="activeTab = tab">{{ tab }}</view>
        </view>

        <!-- 在线好友 -->
        <view class="section-title" v-if="activeTab === '好友列表'">好友列表</text>
        <view class="friend-list">
          <view v-for="(f, i) in friends" :key="i" class="friend-card" :class="{online: f.online}" @tap="() => onFriendTap(f)">
            <!-- 美术资源接入：好友头像使用 AvatarIcon 组件 -->
            <view class="friend-avatar-wrapper">
              <avatar-icon
                :placeholder-char="f.icon"
                :size="'md'"
                :shape="'circle'"
                :locked="!f.online"
              />
              <view v-if="f.online" class="online-dot"></view>
            </view>
            <view class="friend-info">
              <text class="friend-name">{{ f.name }}</text>
              <text class="friend-status" :class="{online: f.online}">{{ f.online ? '在线' : '离线' }}</text>
            </view>
            <view class="friend-power">战力 {{ f.power }}</text>
            <view class="friend-action">
              <base-button btn-type="primary" @tap.stop="() => onMessage(f)">私聊</base-button>
            </view>
          </view>
        </view>

        <!-- 空状态 -->
        <view v-if="friends.length === 0 && activeTab === '好友列表'" class="empty-state">
          <view class="empty-icon-wrapper">
            <avatar-icon :placeholder-char="'👥'" :size="'xl'" :shape="'circle'" />
          </view>
          <text class="empty-text">暂无好友</text>
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

const tabs = ['好友列表', '黑名单', '送礼'];
const activeTab = ref('好友列表');

const friends = ref([
  { name: '灵界旅人', icon: '🧙‍♂️', power: 67136, online: true },
  { name: '食神小助手', icon: '👼', power: 45200, online: false },
  { name: '厨艺大师', icon: '👨‍🍳', power: 89500, online: true },
  { name: '甜点爱好者', icon: '🍰', power: 32100, online: false }
]);

const onBack = () => uni.navigateBack();
const onFriendTap = (f) => { uni.showToast({ title: `查看${f.name}详情`, icon: 'none' }); };
const onMessage = (f) => { uni.showToast({ title: `给${f.name}发送私聊`, icon: 'none' }); };
</script>

<style scoped>
.page { width: 100vw; min-height: 100vh; background-color: #0F0E1D; position: relative; }
.scroll { height: 100vh; padding-top: 88rpx; padding-bottom: 100rpx; box-sizing: border-box; }
.content { padding: 0 48rpx; box-sizing: border-box; }
.tab-bar { display: flex; justify-content: center; gap: 40rpx; margin: 40rpx 0 30rpx 0; border-bottom: 1rpx solid #2A293E; padding-bottom: 16rpx; }
.tab-item { font-size: 28rpx; color: #8A8A9E; padding-bottom: 16rpx; }
.tab-item.active { color: #E0D3A1; border-bottom: 2rpx solid #E0D3A1; font-weight: 600; }
.section-title { font-size: 32rpx; color: #FFFFFF; font-weight: 700; margin-bottom: 24rpx; }
.friend-list { display: flex; flex-direction: column; gap: 18rpx; }
.friend-card { display: flex; justify-content: space-between; align-items: center; background: rgba(255,255,255,0.04); border: 1rpx solid #2A293E; border-radius: 20rpx; padding: 24rpx 32rpx; }
.friend-card:active { background: rgba(255,255,255,0.08); }
.friend-avatar-wrapper {
  position: relative; width: 80rpx; height: 80rpx; border-radius: 40rpx; flex-shrink: 0;
}
.online-dot {
  position: absolute; bottom: 4rpx; right: 4rpx; width: 16rpx; height: 16rpx; background: #4CAF50; border-radius: 8rpx; border: 2rpx solid #0F0E1D;
}
.friend-info { flex: 1; margin: 0 24rpx; }
.friend-name { font-size: 28rpx; color: #FFFFFF; font-weight: 600; margin-bottom: 4rpx; }
.friend-status { font-size: 22rpx; }
.friend-status.online { color: #4CAF50; }
.friend-power { font-size: 24rpx; color: #E0D3A1; font-weight: 600; }
.friend-action { display: flex; gap: 12rpx; flex-shrink: 0; }
.empty-state { display: flex; flex-direction: column; align-items: center; gap: 16rpx; margin-top: 100rpx; text-align: center; }
.empty-icon-wrapper { width: 120rpx; height: 120rpx; flex-shrink: 0; }
.empty-text { font-size: 28rpx; color: #8A8A9E; }
</style>