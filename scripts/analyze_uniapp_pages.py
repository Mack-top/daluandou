#!/usr/bin/env python3
"""分析uniapp页面组件化状态，生成修改清单。

扫描 uniapp/pages 下所有 .vue 页面，识别：
1. 是否已使用 CustomNavbar/BaseButton/BaseCard/BaseInput/BaseModal/AvatarIcon 组件
2. 是否仍使用 inline navbar（<view class="navbar">）
3. 是否仍使用原生 button 标签
4. 是否仍使用 emoji 图标文本
5. 缺少的组件导入

输出：uniapp_components_status.md 报告
"""

import os
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent / "uniapp" / "pages"
REPORT = Path(__file__).resolve().parent.parent / "uniapp_components_status.md"

COMPONENTS = [
    "CustomNavbar", "BaseCard", "BaseButton", "BaseInput", "BaseModal", "AvatarIcon"
]

INLINE_NAVBAR_RE = re.compile(r'<view\s+class=["\']navbar["\']')
NATIVE_BUTTON_RE = re.compile(r'<\s*button\b')
EMOJI_ICON_RE = re.compile(r'\{\{\s*[\w.]+\.icon\s*\}\}')
EMOJI_TEXT_RE = re.compile(r'🌶|🗺|📜|💎|👥|🧙|👼|👨|🍰|⚡|💰|💎|◀|▶')

results = []

vue_files = sorted(ROOT.rglob("*.vue"))
print(f"共发现 {len(vue_files)} 个页面文件")

for fpath in vue_files:
    rel = fpath.relative_to(ROOT.parent)
    text = fpath.read_text(encoding="utf-8", errors="ignore")

    used = [c for c in COMPONENTS if c in text]
    has_inline_navbar = bool(INLINE_NAVBAR_RE.search(text))
    has_native_button = bool(NATIVE_BUTTON_RE.search(text))
    has_emoji_icon = bool(EMOJI_ICON_RE.search(text))
    has_emoji_text = bool(EMOJI_TEXT_RE.search(text))

    # 判断 script setup 中是否已导入对应组件
    imported = [c for c in COMPONENTS if re.search(rf"from\s+['\"][^'\"]*{c}['\"]", text)]

    missing_imports = [c for c in used if c not in imported]

    results.append({
        "path": str(rel),
        "used": used,
        "imported": imported,
        "missing_imports": missing_imports,
        "inline_navbar": has_inline_navbar,
        "native_button": has_native_button,
        "emoji_icon": has_emoji_icon,
        "emoji_text": has_emoji_text,
        "needs_work": bool(
            has_inline_navbar or has_native_button or has_emoji_icon or has_emoji_text or missing_imports
        ),
    })

# 生成报告
lines = []
lines.append("# uniapp 页面组件化状态报告")
lines.append("")
lines.append(f"页面总数：{len(vue_files)}")
lines.append(f"已组件化页面（使用至少1个组件）：{sum(1 for r in results if r['used'])}")
lines.append(f"仍需工作页面：{sum(1 for r in results if r['needs_work'])}")
lines.append("")
lines.append("## 已接入组件的页面")
lines.append("")
for r in results:
    if r["used"]:
        lines.append(f"- `{r['path']}` — 使用：{', '.join(r['used'])}；导入：{', '.join(r['imported']) if r['imported'] else '⚠ 无导入'}")
lines.append("")
lines.append("## 仍需组件化改造的页面（按需求分类）")
lines.append("")

# 内联导航栏
inline_nav = [r for r in results if r["inline_navbar"]]
lines.append(f"### 1. 仍使用 inline navbar（需替换为 CustomNavbar）：{len(inline_nav)} 个")
for r in inline_nav:
    lines.append(f"- `{r['path']}`")
lines.append("")

# 原生按钮
native_btn = [r for r in results if r["native_button"]]
lines.append(f"### 2. 仍使用原生 <button> 标签（需替换为 BaseButton）：{len(native_btn)} 个")
for r in native_btn:
    lines.append(f"- `{r['path']}`")
lines.append("")

# emoji 图标
emoji = [r for r in results if r["emoji_icon"] or r["emoji_text"]]
lines.append(f"### 3. 仍使用 emoji 图标文本（需替换为 AvatarIcon）：{len(emoji)} 个")
for r in emoji:
    tags = []
    if r["emoji_icon"]:
        tags.append("emoji-绑定")
    if r["emoji_text"]:
        tags.append("emoji-文本")
    lines.append(f"- `{r['path']}` — {', '.join(tags)}")
lines.append("")

# 缺少导入
missing = [r for r in results if r["missing_imports"]]
lines.append(f"### 4. 使用了组件但缺少 import 语句：{len(missing)} 个")
for r in missing:
    lines.append(f"- `{r['path']}` — 缺少：{', '.join(r['missing_imports'])}")
lines.append("")

lines.append("## 完全未使用任何组件的页面")
lines.append("")
none_used = [r for r in results if not r["used"] and r["needs_work"]]
for r in none_used:
    tags = []
    if r["inline_navbar"]:
        tags.append("inline-navbar")
    if r["native_button"]:
        tags.append("native-button")
    if r["emoji_icon"]:
        tags.append("emoji-icon")
    if r["emoji_text"]:
        tags.append("emoji-text")
    lines.append(f"- `{r['path']}` — {', '.join(tags) if tags else '无明显模式'}")
lines.append("")

REPORT.write_text("\n".join(lines), encoding="utf-8")
print(f"\n报告已生成：{REPORT}")
print(f"已组件化：{sum(1 for r in results if r['used'])} / {len(vue_files)}")
print(f"仍需工作：{sum(1 for r in results if r['needs_work'])} / {len(vue_files)}")
