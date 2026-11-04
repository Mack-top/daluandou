#!/usr/bin/env python3
"""v19/v20 部署验收脚本（服务器侧执行，避开本机 SNI 干扰）。"""
import json
import sqlite3
import urllib.request

BASE = 'http://127.0.0.1:8787'

print('--- 1. 数据库：经验表 150 行 / 100 级续接 / growth 封顶 / v20 列 ---')
db = sqlite3.connect('/home/ubuntu/meishi/data/game.db')
rows = db.execute('SELECT COUNT(*) FROM level_exp_defs').fetchone()[0]
l100 = db.execute('SELECT exp_required FROM level_exp_defs WHERE level = 100').fetchone()
l150 = db.execute('SELECT exp_required FROM level_exp_defs WHERE level = 150').fetchone()
capped = db.execute('SELECT COUNT(*) FROM level_stats_defs WHERE growth_bp = 26000').fetchone()[0]
cols = [r[1] for r in db.execute("PRAGMA table_info(player_equipment)")]
players = db.execute('SELECT COUNT(*) FROM players').fetchone()[0]
wt_max = db.execute('SELECT MAX(worldtree_level) FROM players').fetchone()[0]
print(f'level_exp_defs 行数: {rows}（期望 150）')
print(f'L100 需求: {l100[0] if l100 else None}（期望 64880）| L150 需求: {l150[0] if l150 else None}（期望 0 = 封顶标记）')
print(f'growth_bp=26000 行数: {capped}（期望 51 = 100..150 封顶）')
print(f'player_equipment 含 substat_key/substat_value/wash_count: '
      f"{all(c in cols for c in ('substat_key', 'substat_value', 'wash_count'))}")
print(f'存量玩家: {players}（迁移前 3）| 最高等级: {wt_max}')

print('--- 2. catalog 下发 levels 域 ---')
catalog = json.load(urllib.request.urlopen(f'{BASE}/api/catalog'))['data']
levels = catalog['levels']
l100row = next(r for r in levels if r['level'] == 100)
l150row = next(r for r in levels if r['level'] == 150)
print(f"levels: {len(levels)} | L100 req {l100row['expRequired']} | L150 req {l150row['expRequired']} | L150 growthBp {l150row['growthBp']}")

print('--- 3. 新端点存在性（未认证应 401，而非 404；game.routes 挂 /api/game 前缀） ---')
for path, payload in (('/api/game/equipment/reforge', '{}'), ('/api/game/equipment/enhance', '{}'), ('/api/game/equipment/salvage', '{}')):
    req = urllib.request.Request(f'{BASE}{path}', data=payload.encode(), headers={'Content-Type': 'application/json'}, method='POST')
    try:
        urllib.request.urlopen(req)
        print(f'{path}: 200（异常：不应匿名可达）')
    except urllib.error.HTTPError as error:
        print(f'{path}: {error.code}（{"OK" if error.code == 401 else "异常"}）')

print('--- 4. 首页与公网 ---')
home = urllib.request.urlopen(f'{BASE}/').read()
print(f'首页字节数: {len(home)}（期望 ~619358）')
public = urllib.request.urlopen('https://940608.site/').read()
print(f'公网 https://940608.site/ 字节数: {len(public)}')
health = json.load(urllib.request.urlopen(f'{BASE}/api/health'))['data']
print(f"health: migrations={health['database']['migrations']} tables={health['database']['tables']} players={health['database']['players']}")
print('验收完成 ✅')
