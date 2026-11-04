<template>
  <view class="page">
    <!-- 自定义导航栏 -->
    <view class="navbar">
      <text class="navbar-back" @tap="onBack">◀</text>
      <text class="navbar-title">主线剧情排行榜</text>
      <view class="navbar-spacer"></view>
    </view>

    <scroll-view class="scroll" scroll-y="true" show-scrollbar="false">
      <view class="content">

        <!-- 榜单标题 -->
        <view class="section-title">主线剧情进度排行</text>
        <text class="section-sub">按主线通关章节数排名</text>

        <!-- 榜单列表 -->
        <view class="rank-list">
          <view
            v-for="(r, i) in rankings"
            :key="i"
            class="rank-card"
            :class="{top3: i < 3}"
          >
            <view class="rank-number">{{ i + 1 }}</view>
            <view class="rank-info">
              <text class="rank-name">{{ r.name }}</text>
              <text class="rank-server">{{ r.server }}</text>
            </view>
            <view class="rank-score">
              <text class="score-value">{{ r.chapters }}章</text>
              <text class="score-label">已通关</text>
            </view>
            <view class="rank-action">
              <button class="btn-like" @tap.stop="onLike(i)">👍 {{ r.likes }}</button>
            </view>
          </view>
        </view>

      </view>
    </scroll-view>
  </view>
</template>

<script setup>
import { ref } from 'vue';

const rankings = ref([
  { name: '灵界之巅', server: '美食1服', chapters: 45, likes: 1250 },
  { name: '食神传说', server: '美食2服', chapters: 42, likes: 980 },
  { name: '厨艺宗师', server: '美食3服', chapters: 40, likes: 870 },
  { name: '甜点魔法', server: '美食4服', chapters: 38, likes: 760 },
  { name: '深夜食堂', server: '美食5服', chapters: 35, likes: 650 },
  { name: '初学者', server: '美食17服', chapters: 12, likes: 200 }
]);

const onBack = () => { uni.navigateBack(); };

const onLike = (index) => {
  rankings.value[index].likes += 1;
  uni.showToast({ title: '点赞成功', icon: 'none' });
};
</script>

<style scoped>
.page { width: 100vw; min-height: 100vh; background-color: #0F0E1D; position: relative; }
.navbar {
  position: fixed; top: 0; left: 0; right: 0; height: 88rpx;
  display: flex; align-items: center; padding: 0 32rpx;
  background-color: #16152A; border-bottom: 1rpx solid #2A293E; z-index: 100; box-sizing: border-box;
}
.navbar-back { font-size: 36rpx; color: #FFFFFF; }
.navbar-title { font-size: 30rpx; font-weight: 600; color: #FFFFFF; margin-left: 40rpx; }
.navbar-spacer { flex: 1; }
.scroll { height: 100vh; padding-top: 88rpx; padding-bottom: 100rpx; box-sizing: border-box; }
.content { padding: 0 48rpx; box-sizing: border-box; }
.section-title { font-size: 32rpx; color: #FFFFFF; font-weight: 700; margin: 40rpx 0 12rpx 0; }
.section-sub { font-size: 26rpx; color: #8A8A9E; margin-bottom: 30rpx; }
.rank-list { display: flex; flex-direction: column; gap: 16rpx; }
.rank-card {
  display: flex; justify-content: space-between; align-items: center;
  background: rgba(255,255,255,0.04); border: 1rpx solid #2A293E;
  border-radius: 20rpx; padding: 20rpx 32rpx;
}
.rank-card.top3 { border-color: #E0D3A1; background: rgba(224,211,161,0.1); }
.rank-number {
  width: 56rpx; height: 56rpx; line-height: 56rpx; text-align: center;
  border-radius: 28rpx; font-size: 26rpx; font-weight: 700; flex-shrink: 0;
}
.rank-card.top3 .rank-number { background: #E0D3A1; color: #0F0E1D; }
.rank-card:not(.top3) .rank-number { background: #1A192E; color: #8A8A9E; }
.rank-info { flex: 1; margin: 0 24rpx; }
.rank-name { font-size: 28rpx; color: #FFFFFF; font-weight: 600; margin-bottom: 6rpx; }
.rank-server { font-size: 22rpx; color: #8A8A9E; }
.rank-score {
  display: flex; flex-direction: column; align-items: flex-end; gap: 4rpx;
}
.score-value { font-size: 30rpx; color: #E0D3A1; font-weight: 700; }
.score-label { font-size: 22rpx; color: #B8B8C8; }
.rank-action { flex-shrink: 0; }
.btn-like {
  width: 140rpx; height: 56rpx; line-height: 56rpx;
  background: rgba(255,255,255,0.06); border: 1rpx solid #2A293E;
  color: #FFFFFF; font-size: 24rpx; border-radius: 28rpx;
}
.btn-like:active { background: rgba(255,255,255,0.12); }
</style>