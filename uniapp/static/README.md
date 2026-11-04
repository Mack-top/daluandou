# 美术资源目录规范

本目录统一管理 uni-app 前端项目的所有静态美术资源（图片、图标、字体等）。

## 目录结构

```
static/
├── images/                 # 位图资源
│   ├── characters/         # 食灵/角色立绘、头像
│   │   ├── {character_id}_avatar.png     # 角色头像（圆形）
│   │   ├── {character_id}_full.png       # 角色立绘（全身）
│   │   └── {character_id}_icon.png       # 角色小图标（32x32）
│   ├── items/              # 道具/装备图标
│   │   ├── {item_id}.png
│   │   └── rarity_{r}.png                # 品质框（R/SR/SSR）
│   ├── ui/                 # 界面元素
│   │   ├── btn_*.png               # 按钮背景
│   │   ├── card_*.png              # 卡片背景/装饰
│   │   ├── frame_*.png             # 边框/分割线
│   │   └── tip_*.png               # 提示气泡/徽章
│   ├── backgrounds/        # 页面背景图
│   │   ├── lobby_*.png             # 主城背景
│   │   ├── battle_*.png            # 战斗背景
│   │   └── default_*.png           # 默认占位背景
│   └── battle/             # 战斗特效/动画帧
│       ├── skill_*.png
│       └── hit_*.png
├── icons/                  # 矢量/位图图标
│   ├── nav_*.png           # 导航栏图标
│   ├── func_*.png          # 功能入口图标
│   ├── status_*.png        # 状态图标（在线/维护/爆满）
│   └── common/             # 通用图标（返回/设置/关闭等）
└── fonts/                  # 自定义字体
    └── *.ttf / *.woff2
```

## 命名规范

| 资源类型 | 命名格式 | 示例 |
|---------|---------|------|
| 角色头像 | `{id}_avatar.{ext}` | `qing_avatar.png` |
| 角色立绘 | `{id}_full.{ext}` | `qing_full.png` |
| 角色图标 | `{id}_icon.{ext}` | `qing_icon.png` |
| 道具图标 | `{id}.{ext}` | `starter_book.png` |
| 品质框 | `rarity_{r}.{ext}` | `rarity_SSR.png` |
| 按钮 | `btn_{purpose}.{ext}` | `btn_start.png` |
| 卡片 | `card_{purpose}.{ext}` | `card_gift.png` |
| 导航图标 | `nav_{name}.{ext}` | `nav_home.png` |
| 功能图标 | `func_{name}.{ext}` | `func_shop.png` |
| 状态图标 | `status_{state}.{ext}` | `status_online.png` |
| 背景 | `{scene}_{purpose}.{ext}` | `lobby_default.png` |

- 全部使用**小写字母 + 下划线**，禁止使用中文、空格、大写字母
- 扩展名推荐 `.png`（无损，支持透明），动态资源可用 `.webp`

## 引用方式

### 方式 1：utils/resource.js 辅助函数（推荐）

```js
import { getCharacterAvatar, getItemIcon, getStaticUrl } from '@/utils/resource.js'

// 获取角色头像
const avatarUrl = getCharacterAvatar('qing')

// 获取道具图标
const iconUrl = getItemIcon('starter_book')

// 获取任意静态资源绝对路径
const url = getStaticUrl('images/ui/btn_start.png')
```

### 方式 2：uni-app 静态目录语法

uni-app 编译时会将 `static/` 目录下的资源复制到构建输出目录，可直接通过相对路径引用：

```html
<!-- 在 .vue 页面中 -->
<image src="/static/images/characters/qing_avatar.png" />
<!-- 或 -->
<image src="static/images/characters/qing_avatar.png" />

<!-- CSS 中 -->
.background {
  background-image: url('/static/images/backgrounds/lobby_default.png');
}
```

### 方式 3：require 语法（编译时内联）

```html
<image src="@/static/images/characters/qing_avatar.png" />
```

## 占位资源

目前项目所有页面均采用纯 CSS 绘制，不依赖外部图片。`static/` 目录目前为空，等待美术资源交付后填充。

在资源到位前，可使用以下占位方案：
- 角色头像：CSS 圆形 + 首字母文本
- 道具图标：CSS 正方形 + 品质色边框
- 背景图：uni.scss 中定义的渐变背景

## 注意事项

1. **单个文件大小建议**：图片不超过 200KB，背景图不超过 500KB
2. **推荐尺寸**：头像 120x120，图标 48x48，卡片背景按 UI 稿尺寸
3. **多端适配**：uni-app 会自动处理 rpx/px 转换，无需额外处理
4. **打包优化**：未被引用的资源会被构建工具摇树删除，按需保留
