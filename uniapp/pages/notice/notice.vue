<template>
  <view class="page">
    <!-- 自定义导航栏 -->
    <view class="navbar">
      <text class="navbar-back" @tap="onBack">◀</text>
      <text class="navbar-title">开服公告</text>
      <view class="navbar-spacer"></view>
    </view>

    <!-- 页面主体 -->
    <scroll-view class="scroll-content" scroll-y="true" show-scrollbar="false">
      <view class="content-wrapper">

        <!-- 公告标题 -->
        <view class="announce-header">
          <text class="announce-title">开服公告</text>
          <text class="announce-date">2024年1月15日 10:00</text>
        </view>

        <!-- 公告正文卡片 -->
        <view class="announce-card">
          <view class="announce-body">
            <text class="announce-paragraph">
              亲爱的命运之子：
            </text>
            <text class="announce-paragraph">
              时空之门今日正式开启，欢迎来到灵界大陆！
            </text>
            <text class="announce-paragraph">
              强大的食神，为何消失不见？封印的邪恶力量，为何重见天日？灵界大乱的背后，究竟隐藏了什么秘密？
            </text>
            <text class="announce-paragraph">
              探寻神秘的灵界，揭示迷雾中的真相，穿越异世界的奇幻冒险之旅，已经正式起航！
            </text>
          </view>

          <!-- 主线通关奖励预告 -->
          <view class="reward-preview">
            <view class="reward-title">
              <text class="reward-label">【主线通关】</text>
              <text class="reward-desc">通关前期主线关卡，即可获得</text>
            </view>
            <view class="reward-item">
              <text class="reward-name">5星SSR群攻食灵：蓝色夏威夷·艾薇儿</text>
              <text class="reward-desc">助您在冒险之路上乘风破浪</text>
            </view>
          </view>
        </view>

        <!-- 底部按钮 -->
        <view class="bottom-action">
          <button class="btn-close" @tap="onBack">我知道了</button>
        </view>

      </view>
    </scroll-view>
  </view>
</template>

<script setup>
import { onLoad } from 'vue';

// 公告内容（与003图OCR识别内容一致，后续可替换为后端接口获取）
const announceContent = [
  '亲爱的命运之子：',
  '时空之门今日正式开启，欢迎来到灵界大陆！',
  '强大的食神，为何消失不见？封印的邪恶力量，为何重见天日？灵界大乱的背后，究竟隐藏了什么秘密？',
  '探寻神秘的灵界，揭示迷雾中的真相，穿越异世界的奇幻冒险之旅，已经正式起航！'
];

const rewardInfo = {
  title: '【主线通关】',
  desc: '通关前期主线关卡，即可获得',
  name: '5星SSR群攻食灵：蓝色夏威夷·艾薇儿',
  detail: '助您在冒险之路上乘风破浪'
};

onLoad(() => {
  // 页面加载时可在此获取后端公告列表
  // uni.request({ url: '/api/announce/latest', ... })
});

// 返回上一页
const onBack = () => {
  uni.navigateBack();
};
</script>

<style scoped>
.page {
  width: 100vw;
  min-height: 100vh;
  background-color: #0F0E1D;
  position: relative;
}

.navbar {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  height: 88rpx;
  display: flex;
  align-items: center;
  padding: 0 32rpx;
  background-color: #16152A;
  border-bottom: 1rpx solid #2A293E;
  z-index: 100;
  box-sizing: border-box;
}

.navbar-back {
  font-size: 36rpx;
  color: #FFFFFF;
}

.navbar-title {
  font-size: 34rpx;
  font-weight: 600;
  color: #FFFFFF;
  margin-left: 40rpx;
}

.navbar-spacer {
  flex: 1;
}

.scroll-content {
  height: 100vh;
  padding-top: 88rpx;
  padding-bottom: 100rpx;
  box-sizing: border-box;
}

.content-wrapper {
  padding: 0 48rpx;
  box-sizing: border-box;
}

.announce-header {
  margin-top: 40rpx;
  margin-bottom: 32rpx;
  text-align: center;
}

.announce-title {
  font-size: 40rpx;
  font-weight: 700;
  color: #FFFFFF;
}

.announce-date {
  font-size: 26rpx;
  color: #8A8A9E;
  margin-top: 12rpx;
}

.announce-card {
  background-color: rgba(255, 255, 255, 0.04);
  border: 1rpx solid #2A293E;
  border-radius: 24rpx;
  padding: 40rpx 32rpx;
  box-sizing: border-box;
  margin-bottom: 40rpx;
}

.announce-body {
  margin-bottom: 40rpx;
}

.announce-paragraph {
  font-size: 30rpx;
  color: #FFFFFF;
  line-height: 1.8;
  margin-bottom: 24rpx;
  text-align: justify;
  text-align-last: auto;
}

.announce-paragraph:last-child {
  margin-bottom: 0;
}

.reward-preview {
  background-color: rgba(224, 211, 161, 0.08);
  border: 1rpx solid rgba(224, 211, 161, 0.2);
  border-radius: 20rpx;
  padding: 32rpx;
  box-sizing: border-box;
}

.reward-title {
  display: flex;
  align-items: center;
  gap: 12rpx;
  margin-bottom: 20rpx;
}

.reward-label {
  font-size: 30rpx;
  font-weight: 700;
  color: #E0D3A1;
}

.reward-desc {
  font-size: 28rpx;
  color: #B8B8C8;
}

.reward-item {
  display: flex;
  flex-direction: column;
  gap: 12rpx;
}

.reward-name {
  font-size: 32rpx;
  font-weight: 700;
  color: #FFFFFF;
}

.reward-name + .reward-desc {
  font-size: 28rpx;
  color: #E0D3A1;
  margin-top: 4rpx;
}

.bottom-action {
  padding: 0 48rpx;
  box-sizing: border-box;
  margin-top: 40rpx;
}

.btn-close {
  width: 600rpx;
  height: 96rpx;
  line-height: 96rpx;
  background: linear-gradient(135deg, #E0D3A1 0%, #C9B87E 100%);
  color: #0F0E1D;
  font-size: 34rpx;
  font-weight: 700;
  border-radius: 48rpx;
  box-shadow: 0 8rpx 24rpx rgba(224, 211, 161, 0.3);
}

.btn-close:active {
  transform: scale(0.96);
  opacity: 0.85;
}
</style>
