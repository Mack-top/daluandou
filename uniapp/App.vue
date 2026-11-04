<template>
  <view class="app-container">
    <page></page>
  </view>
</template>

<script>
export default {
  onLaunch(options) {
    console.log('App Launch', options);
  },
  onShow() {
    console.log('App Show');
  },
  onHide() {
    console.log('App Hide');
  }
};
</script>

<style>
.app-container {
  width: 100vw;
  height: 100vh;
  overflow: hidden;
}
</style>
