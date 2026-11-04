#!/usr/bin/env python3
"""
批量组件化 uniapp 页面。

处理规则：
1. 跳过已包含 CustomNavbar 的页面
2. 替换标准 inline navbar 为 <custom-navbar> 组件（使用字符串查找，避免正则嵌套问题）
3. 替换原生 <button> 为 <base-button> 组件
4. 在 script setup 中添加 import 语句
5. 调整 CSS：移除 .navbar 相关样式，scroll-view 增加 padding-top

使用前请先备份，处理后需人工复核每个页面。
"""

import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent / "uniapp" / "pages"

PROCESSED_MARKER = "<!-- componentized -->"

IMPORT_TEMPLATE = "import CustomNavbar from '@/pages/components/CustomNavbar.vue';\nimport BaseButton from '@/pages/components/BaseButton.vue';"

CUSTOM_NAVBAR_TEMPLATE = '<custom-navbar title="{title}" :show-back="true" @back="onBack" />'


def find_navbar_block(text: str):
    """查找 inline navbar 块的起止位置。返回 (start, end) 或 None。

    使用负向先行断言，确保匹配到的是 navbar 自身的 </view>，
    而不是内部 <view class="navbar-spacer"> 的 </view>。
    """
    # 先移除 navbar-spacer 自闭合标签，避免嵌套干扰
    text_clean = re.sub(
        r'<view\s+class=["\']navbar-spacer["\']\s*/?>\s*\n?',
        '',
        text,
    )
    start_tag = '<view class="navbar">'
    start = text_clean.find(start_tag)
    if start == -1:
        m = re.search(r'<view\s+class=["\']navbar["\']>', text_clean)
        if not m:
            return None
        start = m.start()
    end_tag = "</view>"
    end = text_clean.find(end_tag, start + len(start_tag))
    if end == -1:
        return None
    # 在原始 text 中找到对应位置（因为只移除了 spacer，长度变化但相对位置不变）
    # 重新在原始 text 中查找：先找开始标签，再找结束标签
    start_orig = text.find(start_tag)
    if start_orig == -1:
        m = re.search(r'<view\s+class=["\']navbar["\']>', text)
        if not m:
            return None
        start_orig = m.start()
    end_orig = text.find(end_tag, start_orig + len(start_tag))
    if end_orig == -1:
        return None
    return start_orig, end_orig + len(end_tag)


def process_file(path: Path) -> str:
    text = path.read_text(encoding="utf-8")

    # 已处理或已有 CustomNavbar，跳过
    if "CustomNavbar" in text or PROCESSED_MARKER in text:
        return "skip"

    # 提取 navbar 标题
    m = re.search(r'<text\s+class=["\']navbar-title["\']>(.*?)</text>', text, re.DOTALL)
    title = m.group(1).strip() if m else "页面"

    # 先移除整个 navbar-spacer 元素（含结束标签，避免嵌套 </view> 干扰后续查找）
    text = re.sub(
        r'\s*<view\s+class=["\']navbar-spacer["\'][^>]*>\s*</view>\s*\n?',
        '',
        text,
    )

    # 查找 inline navbar 块：<view class="navbar"> ... </view>
    start_tag = '<view class="navbar">'
    start = text.find(start_tag)
    if start == -1:
        m = re.search(r'<view\s+class=["\']navbar["\']>', text)
        if not m:
            return "no-inline-navbar"
        start = m.start()
    end_tag = "</view>"
    end = text.find(end_tag, start + len(start_tag))
    if end == -1:
        return "no-inline-navbar"
    nav_end = end + len(end_tag)

    # 替换 navbar 块为 custom-navbar（保持原有缩进）
    custom_navbar = CUSTOM_NAVBAR_TEMPLATE.format(title=title)
    line_start = text.rfind("\n", 0, start) + 1
    indent = text[line_start:start]
    text = text[:start] + indent + custom_navbar + "\n" + text[nav_end:]

    # 替换原生 button 为 base-button
    text = re.sub(r'<\s*button\b', "<base-button", text)
    text = re.sub(r'</\s*button\s*>', "</base-button>", text)

    # 添加 import 语句
    if "import " not in text:
        text = text.replace("<script setup>", "<script setup>\n" + IMPORT_TEMPLATE, 1)
    else:
        first_import = re.search(r'^import\s', text, re.MULTILINE)
        if first_import:
            pos = first_import.start()
            text = text[:pos] + IMPORT_TEMPLATE + "\n" + text[pos:]

    # CSS 调整：移除 .navbar 及子样式
    for cls in ["navbar", "navbar-back", "navbar-title", "navbar-spacer"]:
        text = re.sub(
            r'\.' + cls + r'\s*\{[^}]*\}\s*\n?',
            '',
            text,
            flags=re.DOTALL,
        )

    # scroll-view 增加 padding-top: 88rpx
    scroll_match = re.search(r'\.scroll\s*\{', text)
    if scroll_match:
        start = scroll_match.end() - 1
        depth = 1
        end = start
        for i in range(start, len(text)):
            if text[i] == '{':
                depth += 1
            elif text[i] == '}':
                depth -= 1
                if depth == 0:
                    end = i
                    break
        if depth == 0:
            scroll_block = text[start:end + 1]
            if 'padding-top' not in scroll_block:
                new_block = scroll_block.rstrip() + '; padding-top: 88rpx; }'
                text = text[:start] + new_block + text[end + 1:]

    # 添加处理标记
    text = PROCESSED_MARKER + "\n" + text

    path.write_text(text, encoding="utf-8")
    return "ok"


def main():
    limit = int(sys.argv[1]) if len(sys.argv) > 1 else 0
    vue_files = sorted(ROOT.rglob("*.vue"))
    stats = {"ok": 0, "skip": 0, "no-inline-navbar": 0}
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
        elif result == "skip":
            print(f"[SKIP] {fpath.relative_to(ROOT.parent)}")
        else:
            print(f"[NO-NAVBAR] {fpath.relative_to(ROOT.parent)}")

    print(f"\n=== 统计 ===")
    print(f"成功处理: {stats['ok']}")
    print(f"跳过(已组件化): {stats['skip']}")
    print(f"无 inline navbar: {stats['no-inline-navbar']}")
    print(f"总计: {len(vue_files)}")


if __name__ == "__main__":
    main()
