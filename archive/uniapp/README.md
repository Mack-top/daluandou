# uniapp 项目归档

本目录为《美食大乱斗》uniapp 前端项目的归档快照。

## 归档信息

- 归档时间：2026-11-05
- 分支：arena/3260e9f8-daluandou
- 页面总数：297 个（对应参考截图 001-295，新增 protocol/guide 2 个）
- 源位置：uniapp/（归档前路径）

## 目录结构

```
archive/uniapp/
├── App.vue                 # uni-app 应用入口
├── main.js                 # 应用主入口（挂载 vuex store）
├── manifest.json           # uni-app 清单配置
├── package.json            # 项目依赖配置
├── pages.json              # 页面路由注册（297 个页面，无重复）
├── uni.scss                # 全局样式（深色主题、响应式媒体查询）
├── TEST_REPORT.md          # 全面测试报告
├── gen_pages_117_118.py    # 页面生成脚本（第 117-118 页）
├── gen_pages_69_118.py     # 页面生成脚本（第 69-118 页）
├── pages/                  # 297 个页面目录（每个目录含 .vue 页面文件）
│   ├── index/index.vue     # 001 启动页
│   ├── server-list/server-list.vue  # 002 选择服务器
│   ├── notice/notice.vue   # 003 开服公告
│   ├── ...                 # 其余 294 个页面
│   └── ...
└── store/
    └── index.js            # vuex 状态管理（登录态/token/持久化）
```

## 测试结果摘要

| 测试项 | 状态 |
|--------|------|
| 路由注册 | ✓ 297/297 一一对应，无重复 |
| 页面语法 | ✓ 全部 template/script/style 匹配 |
| 路由链路 | ✓ 12 个 URL 全部有效 |
| 核心导航 | ✓ 启动→服务器→公告→协议→角色创建→引导→主城→战斗→结果 |
| 交互功能 | ✓ toast(127处)、modal(5处)、跳转(14处)、表单校验 |
| 鉴权功能 | ◐ vuex 持久化、登录检查（部分页面） |
| 组件化 | ◐ 页面内联，未抽取独立组件 |
| 响应式 | ✓ 媒体查询 + rpx 单位 |
| 构建预览 | ✗ 受 uni-app 工具链环境限制 |

详见 `TEST_REPORT.md`。

## 相关 PR

- https://github.com/Mack-top/daluandou/pull/2
