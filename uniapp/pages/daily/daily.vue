<!-- componentized -->
<template>
  <view class="page">
    <!-- 自定义导航栏 -->
        <custom-navbar title="每日充值" :show-back="true" @back="onBack" />


    <scroll-view class="scroll" scroll-y="true" show-scrollbar="false">
      <view class="content">

        <!-- 每日充值标题 -->
        <view class="section-title">每日礼遇</view>
        <text class="section-sub">每日可领取一次任意档位奖励</text>

        <!-- 档位选择 -->
        <view class="tier-list">
          <view
            v-for="(t, i) in tiers"
            :key="i"
            class="tier-card"
            :class="{selected: selectedTier === i, claimed: t.claimed}"
            @tap="() => selectTier(i)"
          >
            <view class="tier-left">
              <text class="tier-name">{{ t.name }}</text>
              <text class="tier-price">充值 {{ t.price }} 元</text>
            </view>
            <view class="tier-rewards">
              <text v-for="(r, j) in t.rewards" :key="j" class="reward-chip">{{ r }}</text>
            </view>
            <view class="tier-action">
              <text v-if="t.claimed" class="status-claimed">已领取</text>
              <base-button v-else class="btn-claim" @tap.stop="onClaim(t)">领取</base-button>
            </view>
          </view>
        </view>

        <!-- 充值说明 -->
        <view class="hint">
          每日充值奖励将在次日 00:00 重置，未领取的奖励将通过邮件发送。
        </view>

      </view>
    </scroll-view>
  </view>
</template>

<script setup>
import CustomNavbar from '@/pages/components/CustomNavbar.vue';
import BaseButton from '@/pages/components/BaseButton.vue';
import { ref } from 'vue';

const tiers = ref([
  { name: '基础档位', price: 6, rewards: ['食灵契约 × 2', '金币 × 200000', '每日宝箱 × 1'], claimed: false },
  { name: '进阶档位', price: 30, rewards: ['食灵契约 × 4', '金币 × 500000', '每日宝箱 × 2'], claimed: false },
  { name: '尊贵档位', price: 68, rewards: ['食灵契约 × 10', '金币 × 1200000', '每日宝箱 × 5'], claimed: false }
]);

const selectedTier = ref(0);

const onBack = () => { uni.navigateBack(); };

const selectTier = (index) => {
  selectedTier.value = index;
};

const onClaim = (t) => {
  if (t.claimed) {
    uni.showToast({ title: '今日已领取', icon: 'none' });
    return;
  }
  t.claimed = true;
  uni.showToast({ title: '奖励已发放到邮箱', icon: 'success' });
};
</script>

<style scoped>
.page { width: 100vw; min-height: 100vh; background-color: #0F0E1D; position: relative; }
.scroll { height: 100vh; padding-top: 88rpx; padding-bottom: 100rpx; box-sizing: border-box; }
.content { padding: 0 48rpx; box-sizing: border-box; }
.section-title { font-size: 32rpx; color: #FFFFFF; font-weight: 700; margin: 40rpx 0 12rpx 0; }
.section-sub { font-size: 26rpx; color: #8A8A9E; margin-bottom: 30rpx; }
.tier-list { display: flex; flex-direction: column; gap: 18rpx; }
.tier-card {
  display: flex; justify-content: space-between; align-items: center;
  background: rgba(255,255,255,0.04); border: 1rpx solid #2A293E;
  border-radius: 20rpx; padding: 24rpx 32rpx;
}
.tier-card.selected { border-color: #E0D3A1; background: rgba(224,211,161,0.1); }
.tier-card.claimed { border-color: #4CAF50; background: rgba(76,175,80,0.08); opacity: 0.85; }
.tier-left { flex: 1; }
.tier-name { font-size: 30rpx; color: #FFFFFF; font-weight: 600; }
.tier-price { font-size: 24rpx; color: #E0D3A1; margin-top: 6rpx; display: block; }
.tier-rewards { display: flex; gap: 12rpx; flex: 1; margin: 0 30rpx; }
.reward-chip {
  font-size: 22rpx; color: #B8B8C8; background: rgba(255,255,255,0.06);
  padding: 4rpx 12rpx; border-radius: 10rpx; border: 1rpx solid #2A293E;
}
.tier-action { display: flex; align-items: center; gap: 12rpx; }
.status-claimed { font-size: 26rpx; color: #4CAF50; font-weight: 600; }
.btn-claim {
  width: 140rpx; height: 64rpx; line-height: 64rpx;
  background: linear-gradient(135deg, #E0D3A1 0%, #C9B87E 100%);
  color: #0F0E1D; font-size: 26rpx; font-weight: 700; border-radius: 32rpx;
  flex-shrink: 0;
}
.hint {
  font-size: 24rpx; color: #8A8A9E; text-align: center; margin-top: 40rpx; line-height: 1.6;
}
</style>