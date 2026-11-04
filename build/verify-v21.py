#!/usr/bin/env python3
"""v21 副本体系 + 功能开关部署验收（服务器侧执行）。"""
import json
import sqlite3
import urllib.request

BASE = 'http://127.0.0.1:8787'

print('--- 1. 数据库：v21 结构与种子 ---')
db = sqlite3.connect('/home/ubuntu/meishi/data/game.db')
tables = db.execute("SELECT COUNT(*) FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'").fetchone()[0]
migrations = db.execute('SELECT MAX(version) FROM schema_migrations').fetchone()[0]
dungeons = db.execute('SELECT id, name, unlock_level, unlock_open_day FROM dungeon_defs ORDER BY order_index').fetchall()
features = db.execute('SELECT COUNT(*), SUM(enabled) FROM feature_toggles').fetchone()
orphan_stages = db.execute('SELECT COUNT(*) FROM stage_defs WHERE dungeon_id IS NULL').fetchone()[0]
open_date = db.execute("SELECT updated_at FROM catalog_meta WHERE domain='server_open_date'").fetchone()
seven = db.execute("SELECT enabled, open_day, close_day FROM feature_toggles WHERE key='seven'").fetchone()
print(f'tables={tables}（期望 58）| max migration={migrations}（期望 21）')
print(f'dungeon_defs={len(dungeons)} 行（期望 6）:')
for row in dungeons:
    print(f'  {row[0]} {row[1]} Lv{row[2]} / 开服第{row[3]}天')
print(f'feature_toggles: {features[0]} 条，enabled {features[1]} 条')
print(f'stage_defs 未归属副本: {orphan_stages}（期望 0）')
print(f"server_open_date 持久化: {open_date[0] if open_date else None}")
print(f'seven 开关: enabled={seven[0]} open={seven[1]} close={seven[2]}（期望 1/1/7）')

print('--- 2. catalog 下发 dungeons / features / serverOpenDate ---')
catalog = json.load(urllib.request.urlopen(f'{BASE}/api/catalog'))['data']
print(f"catalog.dungeons={len(catalog.get('dungeons', []))}（期望 6）")
print(f"catalog.features={len(catalog.get('features', []))}（期望 21）")
print(f"serverOpenDate={catalog.get('serverOpenDate')} serverOpenDay={catalog.get('serverOpenDay')}")
stages_with_dungeon = sum(1 for s in catalog['stages'] if isinstance(s.get('dungeonId'), str))
print(f"stages={len(catalog['stages'])}，带 dungeonId 的 {stages_with_dungeon}（期望 21）")
equipment = len(catalog.get('equipment', []))
print(f"catalog.equipment={equipment}（期望 108）")

print('--- 3. 端点存在性 ---')
# GM 功能开关端点：未认证应 401/403（IP 白名单外可能 403），而非 404
for path, method in (('/api/admin/features', 'GET'),):
    try:
        urllib.request.urlopen(urllib.request.Request(f'{BASE}{path}', method=method))
        print(f'{path}: 200（异常：不应匿名可达）')
    except urllib.error.HTTPError as error:
        print(f'{path}: {error.code}（401/403=正常防护，404=异常）')

print('--- 4. 公网首页 ---')
home = urllib.request.urlopen(f'{BASE}/').read()
print(f'本机首页字节数: {len(home)}（期望 ~627056）')
marker = home.count('副本'.encode()) 
print(f"首页含「副本」文案: {marker} 处（>0 即新前端已上线）")
public = urllib.request.urlopen('https://940608.site/').read()
print(f'公网 https://940608.site/ 字节数: {len(public)}')
health = json.load(urllib.request.urlopen(f'{BASE}/api/health'))['data']
print(f"health: migrations={health['database']['migrations']} tables={health['database']['tables']} players={health['database']['players']}")
print('验收完成 ✅')
