#!/usr/bin/env python3
"""
批量替换 uniapp 页面中的 emoji 图标为 AvatarIcon 组件。

处理模式：
1. <text class="xxx">{{ var.icon }}</text> → <view class="xxx-wrapper"><avatar-icon :placeholder-char="var.icon" :size="'md'" :shape="'circle'" /></view>
2. <view class="xxx">{{ var.icon }}</view> → 同上
3. <text class="xxx">EMOJI</text> → <view class="xxx-wrapper"><avatar-icon placeholder-char="EMOJI" :size="'md'" :shape="'circle'" /></view>
4. <view class="xxx">EMOJI</view> → 同上

5. 在 script setup 中添加 AvatarIcon import（如果页面中使用了 AvatarIcon 但尚未 import）
6. 更新 CSS：将 .xxx { font-size: YYrpx; } 替换为 .xxx-wrapper { width: YYrpx; height: YYrpx; flex-shrink: 0; }

使用前请先备份，处理后需人工复核每个页面。
"""

import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent / "uniapp" / "pages"

# emoji 字符范围
EMOJI_RE = re.compile(r'[\U0001F300-\U0001F9FF\U00002600-\U000026FF\U00002700-\U000027BF\uFE0F\u00A9\u00AE\u2122]')

# 动态绑定模式：<text class="xxx">{{ var.icon }}</text> 或 <view class="xxx">{{ var.icon }}</view>
DYNAMIC_ICON_RE = re.compile(
    r'<(text|view)\s+class=["\']([^"\']+)["\'][^>]*>\s*\{\{\s*(\w+)\.icon\s*\}\}\s*</\1>',
    re.DOTALL,
)

# 静态 emoji 模式：<text class="xxx">EMOJI</text> 或 <view class="xxx">EMOJI</view>
STATIC_EMOJI_RE = re.compile(
    r'<(text|view)\s+class=["\']([^"\']+)["\'][^>]*>\s*(' + EMOJI_RE.pattern + r')\s*</\1>',
    re.DOTALL,
)

PROCESSED_MARKER = "<!-- emoji-replaced -->"


def needs_replace(text: str) -> bool:
    """判断页面是否包含需要替换的 emoji。"""
    if PROCESSED_MARKER in text:
        return False
    if DYNAMIC_ICON_RE.search(text):
        return True
    if STATIC_EMOJI_RE.search(text):
        return True
    return False


def add_import(text: str) -> str:
    """在 script setup 中添加 AvatarIcon import。"""
    if "AvatarIcon" in text:
        return text
    # 查找 <script setup>
    m = re.search(r'<script setup>', text)
    if not m:
        return text
    # 查找第一条 import 语句
    first_import = re.search(r'^import\s', text[m.end():], re.MULTILINE)
    if first_import:
        pos = m.end() + first_import.start()
        import_line = "import AvatarIcon from '@/pages/components/AvatarIcon.vue';\n"
        text = text[:pos] + import_line + text[pos:]
    else:
        # 没有 import，在 <script setup> 后添加
        insert_pos = m.end()
        import_block = "\nimport AvatarIcon from '@/pages/components/AvatarIcon.vue';"
        text = text[:insert_pos] + import_block + text[insert_pos:]
    return text


def replace_dynamic(text: str) -> str:
    """替换动态绑定的 icon。"""
    def replacer(m):
        tag = m.group(1)
        cls = m.group(2)
        var = m.group(3)
        wrapper_cls = cls + "-wrapper"
        return (
            f'<view class="{wrapper_cls}">\n'
            f'  <avatar-icon :placeholder-char="{var}.icon" :size="\'md\'" :shape="\'circle\'" />\n'
            f'</view>'
        )
    return DYNAMIC_ICON_RE.sub(replacer, text)


def replace_static_emoji(text: str) -> str:
    """替换静态 emoji。"""
    def replacer(m):
        tag = m.group(1)
        cls = m.group(2)
        emoji = m.group(3)
        wrapper_cls = cls + "-wrapper"
        return (
            f'<view class="{wrapper_cls}">\n'
            f'  <avatar-icon placeholder-char="{emoji}" :size="\'md\'" :shape="\'circle\'" />\n'
            f'</view>'
        )
    return STATIC_EMOJI_RE.sub(replacer, text)


def update_css(text: str) -> str:
    """更新 CSS，将 .xxx { font-size: YYrpx; } 替换为 .xxx-wrapper 样式。"""
    # 查找所有带 font-size 的类样式，为对应的 -wrapper 添加样式
    # 这里简化处理：只处理最常见的模式
    font_size_pattern = re.compile(r'(\.\S+)\s*\{\s*font-size:\s*(\d+)rpx;\s*\}')
    
    def css_replacer(m):
        cls = m.group(1)
        size = m.group(2)
        # 只替换非 -wrapper 的类
        if cls.endswith("-wrapper"):
            return m.group(0)
        wrapper_cls = cls + "-wrapper"
        # 检查是否已经有 wrapper 样式
        if re.search(r'\.' + re.escape(wrapper_cls) + r'\s*\{', text):
            return m.group(0)
        new_style = f'.{wrapper_cls} {{ width: {size}rpx; height: {size}rpx; flex-shrink: 0; }}\n'
        return m.group(0) + '\n' + new_style
    
    return font_size_pattern.sub(css_replacer, text)


def process_file(path: Path) -> str:
    text = path.read_text(encoding="utf-8")
    
    if not needs_replace(text):
        return "skip"
    
    # 替换动态绑定
    text = replace_dynamic(text)
    # 替换静态 emoji
    text = replace_static_emoji(text)
    # 添加 import
    text = add_import(text)
    # 更新 CSS
    text = update_css(text)
    # 添加标记
    text = PROCESSED_MARKER + "\n" + text
    
    path.write_text(text, encoding="utf-8")
    return "ok"


def main():
    limit = int(sys.argv[1]) if len(sys.argv) > 1 else 0
    vue_files = sorted(ROOT.rglob("*.vue"))
    stats = {"ok": 0, "skip": 0}
    count = 0
    
    for fpath in vue_files:
        if "/components/" in str(fpath):
            continue
        if limit and count >= limit:
            break
        result = process_file(fpath)
        stats[result] = stats.get(result, 0) + 1
        if result == "ok":
            count += 1
            print(f"[OK] {fpath.relative_to(ROOT.parent)}")
        else:
            print(f"[SKIP] {fpath.relative_to(ROOT.parent)}")
    
    print(f"\n=== 统计 ===")
    print(f"成功处理: {stats['ok']}")
    print(f"跳过: {stats['skip']}")
    print(f"总计: {len(vue_files)}")


if __name__ == "__main__":
    main()
