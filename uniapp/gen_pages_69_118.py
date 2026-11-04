# -*- coding: utf-8 -*-
import os

BASE = '/home/user/daluandou/uniapp/pages'

COMMON_STYLE = """
.page { width: 100vw; min-height: 100vh; background: #0F0E1D; }
.navbar { position: fixed; top: 0; left: 0; right: 0; height: 88rpx; display: flex; align-items: center; padding: 0 32rpx; background: #16152A; border-bottom: 1rpx solid #2A293E; z-index: 100; box-sizing: border-box; }
.navbar-back { font-size: 36rpx; color: #FFFFFF; }
.navbar-title { font-size: 34rpx; font-weight: 600; color: #FFFFFF; margin-left: 40rpx; }
.navbar-spacer { flex: 1; }
.scroll { height: 100vh; padding-top: 88rpx; padding-bottom: 100rpx; box-sizing: border-box; }
.content { padding: 0 48rpx; box-sizing: border-box; }
.section-title { font-size: 32rpx; color: #FFFFFF; font-weight: 700; margin: 40rpx 0 24rpx 0; }
.card { background: rgba(255,255,255,0.04); border: 1rpx solid #2A293E; border-radius: 24rpx; padding: 32rpx; margin-bottom: 30rpx; }
.btn { width: 600rpx; height: 96rpx; line-height: 96rpx; background: linear-gradient(135deg, #E0D3A1 0%, #C9B87E 100%); color: #0F0E1D; font-size: 34rpx; font-weight: 700; border-radius: 48rpx; box-shadow: 0 8rpx 24rpx rgba(224,211,161,0.3); text-align: center; margin: 0 auto; }
.btn:active { transform: scale(0.96); opacity: 0.85; }
"""

pages = [
    (69, 'artifact', '圣器系统'),
    (70, 'halo', '光环系统'),
    (71, 'bond', '羁绊系统'),
    (72, 'char-detail', '食灵详情'),
    (73, 'char-skill', '食灵技能'),
    (74, 'char-evolve', '食灵进阶'),
    (75, 'arena-qual', '资格赛排行榜'),
    (76, 'arena-main', '主线排行榜'),
    (77, 'arena-fight', '竞技场战斗'),
    (78, 'arena-rank', '竞技场排名'),
    (79, 'tower-reward', '爬塔奖励'),
    (80, 'tower-rank', '爬塔排行'),
    (81, 'boss-dmg', '世界BOSS伤害'),
    (82, 'boss-rank', '世界BOSS排名'),
    (83, 'boss-award', '世界BOSS奖励'),
    (84, 'battlepass', '战令系统'),
    (85, 'battlepass-task', '战令任务'),
    (86, 'battlepass-award', '战令奖励'),
    (87, 'fund', '基金系统'),
    (88, 'fund-award', '基金奖励'),
    (89, 'month-card', '月卡界面'),
    (90, 'week-card', '周卡界面'),
    (91, 'cum-recharge', '累计充值'),
    (92, 'daily-tier', '每日充值档位'),
    (93, 'first-detail', '首充礼包详情'),
    (94, 'seven-detail', '七日登录详情'),
    (95, 'signin', '签到系统'),
    (96, 'signin-award', '签到奖励'),
    (97, 'bp-task', '战令每期任务'),
    (98, 'activity-detail', '活动中心详情'),
    (99, 'limit-activity', '限时活动详情'),
    (100, 'activity-award', '活动奖励预览'),
    (101, 'trade-detail', '交易坊兑换详情'),
    (102, 'trade-record', '交易记录'),
    (103, 'astro-detail', '占星详情'),
    (104, 'astro-result', '占星结果'),
    (105, 'tree-upgrade', '世界树升级详情'),
    (106, 'tree-output', '世界树产出详情'),
    (107, 'chronicle-prog', '食神记进度'),
    (108, 'chronicle-award', '食神记奖励'),
    (109, 'chronicle-mat', '食神记食材'),
    (110, 'ancient-tree', '古树参天'),
    (111, 'fund-ui', '基金界面'),
    (112, 'limit-shop', '限时商店'),
    (113, 'cross-shop', '跨服商店'),
    (114, 'honor-shop', '荣誉商店'),
    (115, 'arena-coin-shop', '竞技币商店'),
    (116, 'guild-coin-shop', '协会币商店'),
]

def make_page(num, dirname, title):
    return f'''<template>
  <view class="page">
    <view class="navbar">
      <text class="navbar-back" @tap="onBack">◀</text>
      <text class="navbar-title">{title}</text>
      <view class="navbar-spacer"></view>
    </view>
    <scroll-view class="scroll" scroll-y="true" show-scrollbar="false">
      <view class="content">
        <view class="section-title">{title}</text>
        <view class="card">
          <text class="card-desc">该界面对应参考图 {num:03d}，视觉与交互逻辑将严格还原设计图。</text>
        </view>
        <view class="action-section">
          <button class="btn" @tap="onBack">返回</button>
        </view>
      </view>
    </scroll-view>
  </view>
</template>

<script setup>
const onBack = () => uni.navigateBack();
</script>

<style scoped>
{COMMON_STYLE}
.card-desc {{ font-size: 24rpx; color: #B8B8C8; line-height: 1.6; }}
.action-section {{ text-align: center; }}
</style>'''

for num, dirname, title in pages:
    filepath = os.path.join(BASE, dirname, f'{dirname}.vue')
    with open(filepath, 'w', encoding='utf-8') as f:
        f.write(make_page(num, dirname, title))

print(f'生成 {len(pages)} 个页面文件')
