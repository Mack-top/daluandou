<!-- componentized -->
<template>
  <view class="page">
    <!-- 自定义导航栏 -->
        <custom-navbar title="{{ title }}" :show-back="true" @back="onBack" />


    <scroll-view class="scroll" scroll-y="true" show-scrollbar="false">
      <view class="content">
        <view class="protocol-card">
          <text class="protocol-content">{{ content }}</text>
        </view>

        <!-- 底部同意按钮（仅在从首页进入时显示） -->
        <view v-if="fromIndex" class="action-section">
          <base-button class="btn-agree" @tap="onAgree">同意并继续</base-button>
        </view>
      </view>
    </scroll-view>
  </view>
</template>

<script setup>
import CustomNavbar from '@/pages/components/CustomNavbar.vue';
import BaseButton from '@/pages/components/BaseButton.vue';
import { ref, onMounted } from 'vue';

const props = defineProps([]);
const title = ref('用户协议');
const content = ref('');
const fromIndex = ref(false);

// 协议内容
const protocolContent = {
  user: `《美食大乱斗》游戏用户协议

欢迎阅读《美食大乱斗》游戏用户协议（以下简称“本协议”）。本协议是您与游戏运营方之间关于使用本游戏服务的法律协议。

1. 服务内容
本游戏提供角色扮演、策略战斗、社交互动等游戏服务。您需要注册账号后方可使用。

2. 账号注册
您应提供真实、准确、完整的个人信息进行注册。账号仅限本人使用，不得转让。

3. 使用规范
您应遵守法律法规，不得使用外挂、不得恶意攻击、不得散布虚假信息。

4. 知识产权
游戏中的所有内容（包括但不限于软件、图片、音频、文字）的知识产权归运营方所有。

5. 免责声明
运营方对因网络原因导致的服务中断不承担责任。

6. 协议修改
运营方有权修改本协议，修改后的协议将在游戏内公示。

7. 联系我们
如有疑问，请通过游戏内客服联系我们。`,
  privacy: `《美食大乱斗》隐私保护指引

我们非常重视您的个人隐私保护。本指引说明我们如何收集、使用、存储和保护您的个人信息。

1. 信息收集
我们可能收集您的设备信息、账号信息、游戏行为数据等，用于提供游戏服务。

2. 信息使用
收集的信息仅用于账号管理、游戏匹配、客服支持、服务优化等目的。

3. 信息存储
您的信息将存储在安全的服务器上，保存期限为账号注销后 30 天。

4. 信息共享
未经您同意，我们不会将您的个人信息提供给第三方，除法律要求外。

5. 信息保护
我们采用加密传输、访问控制等安全措施保护您的信息。

6. 您的权利
您可以随时查询、修改、删除自己的个人信息，或注销账号。

7. 联系我们
如有隐私相关问题，请通过游戏内客服联系我们。`
};

onLoad((options) => {
  const type = options?.type || 'user';
  title.value = type === 'user' ? '用户协议' : '隐私保护指引';
  content.value = protocolContent[type] || protocolContent.user;
  // 判断是否从首页进入（有 fromIndex 参数或无返回路径时显示同意按钮）
  fromIndex.value = options?.fromIndex === 'true';
});

const onBack = () => uni.navigateBack();

const onAgree = () => {
  uni.redirectTo({ url: '/pages/create/create' });
};
</script>

<style scoped>
.page { width: 100vw; min-height: 100vh; background: #0F0E1D; }
.scroll { height: 100vh; padding-top: 88rpx; padding-bottom: 100rpx; box-sizing: border-box; }
.content { padding: 0 48rpx; box-sizing: border-box; }
.protocol-card {
  background: rgba(255,255,255,0.04); border: 1rpx solid #2A293E;
  border-radius: 20rpx; padding: 32rpx; margin-bottom: 40rpx;
}
.protocol-content {
  font-size: 26rpx; color: #B8B8C8; line-height: 1.8;
  white-space: pre-line;
}
.action-section { margin-bottom: 40rpx; }
.btn-agree {
  width: 600rpx; height: 96rpx; line-height: 96rpx;
  background: linear-gradient(135deg, #E0D3A1 0%, #C9B87E 100%);
  color: #0F0E1D; font-size: 36rpx; font-weight: 700;
  border-radius: 48rpx; box-shadow: 0 8rpx 24rpx rgba(224, 211, 161, 0.3);
}
.btn-agree:active { opacity: 0.85; }
</style>