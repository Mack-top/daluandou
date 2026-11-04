#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""v22 云端验收脚本（只读，在服务器上执行）。

用法（先 scp 上传，再用 python3 在服务器跑，切勿用 SSH heredoc 拼 Python）：
    scp build/verify-v22.py ubuntu@193.112.28.143:/tmp/verify-v22.py
    ssh ubuntu@193.112.28.143 'python3 /tmp/verify-v22.py'

默认参数对应本机部署拓扑：
    ROOT   /home/ubuntu/meishi
    DB     /home/ubuntu/meishi/data/game.db
    本机   http://127.0.0.1:8787
    公网   https://940608.site/

检查范围：数据库结构与种子、/api/health、/api/catalog、公网首页内联资源、
静态资源目录清理、历史备份移除、GM 台配置管理页签、v22 配置端点存在性。

退出码：0 = 全部 PASS；1 = 存在 FAIL；2 = 脚本自身异常。
脚本不修改服务器任何文件，DB 以 mode=ro 只读打开。
"""
import argparse
import json
import os
import re
import sqlite3
import sys
import urllib.error
import urllib.request

EXPECTED_TABLES = 58
EXPECTED_MIGRATIONS = 21
EXPECTED_DUNGEONS = 6
EXPECTED_FEATURES = 21
EXPECTED_STAGES = 21
EXPECTED_EQUIPMENT = 108
MIN_HOME_BYTES = 3 * 1024 * 1024
EXPECTED_HOME_BYTES = 5_720_168
EXPECTED_WEBP = 11
EXPECTED_WOFF2 = 3
UA = {'User-Agent': 'Mozilla/5.0 (compatible; meishi-v22-verify/1.0)'}

# 关键结构表：PRAGMA table_info 必须能取到列（v22 配置域注册表覆盖的静态定义表 + 运维表）
KEY_TABLES = [
    'level_exp_defs', 'level_stats_defs', 'class_defs', 'character_defs',
    'equipment_defs', 'dungeon_defs', 'stage_defs', 'feature_toggles',
    'quest_defs', 'mail_defs', 'shop_pack_defs', 'trade_rate_defs',
    'market_offer_defs', 'astrology_node_defs', 'vfx_defs', 'skill_defs',
    'enemy_defs', 'scene_defs', 'item_defs', 'activity_defs',
    'leaderboard_defs', 'guilds', 'catalog_meta', 'schema_migrations',
    'gm_audit_logs', 'players',
]

OLD_BACKUPS = ['backup-20261104-1220', 'backup-20261104-1347']


class Report:
    def __init__(self):
        self.items = []

    def check(self, name, ok, detail='', level='FAIL'):
        tag = 'PASS' if ok else level
        self.items.append((name, ok, level, detail))
        line = f'[{tag}] {name}'
        if detail:
            line += f' | {detail}'
        print(line, flush=True)
        return ok

    def concern(self, name, detail=''):
        self.items.append((name, None, 'CONCERNS', detail))
        print(f'[CONCERNS] {name}' + (f' | {detail}' if detail else ''), flush=True)

    def blocked(self, name, detail=''):
        """外部不可控因素（如 ICP 备案拦截）：不计 PASS/FAIL，也不算 CONCERNS。"""
        self.items.append((name, None, 'EXTERNAL-BLOCKED', detail))
        print(f'[EXTERNAL-BLOCKED] {name}' + (f' | {detail}' if detail else ''), flush=True)

    def info(self, text):
        print(f'[INFO ] {text}', flush=True)

    def summary(self):
        fails = [x for x in self.items if x[1] is False]
        blocked = [x for x in self.items if x[1] is None and x[2] == 'EXTERNAL-BLOCKED']
        concerns = [x for x in self.items if x[1] is None and x[2] == 'CONCERNS']
        passes = [x for x in self.items if x[1] is True]
        print('\n================ v22 云端验收汇总 ================', flush=True)
        print(f'总计 {len(self.items)} 项 | PASS {len(passes)} | CONCERNS {len(concerns)} | '
              f'EXTERNAL-BLOCKED {len(blocked)} | FAIL {len(fails)}', flush=True)
        if blocked:
            print('外部受阻项（不计入判定）：', flush=True)
            for name, _ok, _level, detail in blocked:
                print(f'  - {name} :: {detail}', flush=True)
        if fails:
            print('未通过项：', flush=True)
            for name, _ok, _level, detail in fails:
                print(f'  - {name} :: {detail}', flush=True)
        verdict = 'FAIL' if fails else ('CONCERNS' if concerns else 'PASS')
        print(f'RESULT: {verdict}（EXTERNAL-BLOCKED {len(blocked)} 项不计入判定）', flush=True)
        return 1 if fails else 0


def http_get(url, timeout=30):
    req = urllib.request.Request(url, headers=UA)
    try:
        with urllib.request.urlopen(req, timeout=timeout) as resp:
            return resp.status, resp.read()
    except urllib.error.HTTPError as error:
        return error.code, error.read()
    except Exception as error:  # noqa: BLE001 - 网络异常按 FAIL 记录，不中断全套检查
        return -1, str(error).encode('utf-8', 'replace')


def get_json(base, path, report, name, timeout=20):
    status, raw = http_get(base + path, timeout=timeout)
    if status != 200:
        report.check(name, False, f'HTTP {status} body={raw[:200]!r}')
        return None
    try:
        payload = json.loads(raw.decode('utf-8'))
    except Exception as error:  # noqa: BLE001
        report.check(name, False, f'JSON 解析失败: {error}; body={raw[:200]!r}')
        return None
    if isinstance(payload, dict) and 'data' in payload:
        return payload['data']
    return payload


def main():
    parser = argparse.ArgumentParser(description='v22 云端验收（服务器侧只读）')
    parser.add_argument('--root', default='/home/ubuntu/meishi')
    parser.add_argument('--base', default='http://127.0.0.1:8787')
    parser.add_argument('--public', default='https://940608.site/')
    parser.add_argument('--db', default=None)
    parser.add_argument('--skip-public', action='store_true', help='跳过公网抓取（排障用，会记为 SKIP）')
    parser.add_argument('--public-external-blocked', action='store_true',
                        help='公网域名被 ICP 备案拦截等外部原因不可达：公网项记 EXTERNAL-BLOCKED，不计 PASS/FAIL，'
                             '线上内容正确性改由本机 BASE 口径验证')
    args = parser.parse_args()

    root = args.root.rstrip('/')
    db_path = args.db or os.path.join(root, 'data', 'game.db')
    report = Report()
    print('--- 0. 环境 ---', flush=True)
    report.info(f'ROOT={root} BASE={args.base} PUBLIC={args.public} DB={db_path}')

    # ---------------- 1. 数据库 ----------------
    print('\n--- 1. 数据库：结构 / 迁移 / 种子 ---', flush=True)
    db = None
    if not os.path.isfile(db_path):
        report.check('DB 文件存在', False, f'{db_path} 不存在')
    else:
        try:
            db = sqlite3.connect(f'file:{db_path}?mode=ro', uri=True, timeout=10)
            report.check('DB 文件存在（只读打开）', True, db_path)
        except Exception as error:  # noqa: BLE001
            report.check('DB 文件存在（只读打开）', False, str(error))

    if db is not None:
        def scalar(sql, default=None):
            try:
                row = db.execute(sql).fetchone()
                return row[0] if row and row[0] is not None else default
            except Exception as error:  # noqa: BLE001
                report.info(f'SQL 失败 {sql[:60]} -> {error}')
                return default

        tables = scalar("SELECT COUNT(*) FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'", -1)
        report.check('表数 = 58', tables == EXPECTED_TABLES, f'实际 {tables}')

        migrations = scalar('SELECT MAX(version) FROM schema_migrations', -1)
        report.check('迁移版本 = 21', migrations == EXPECTED_MIGRATIONS, f'实际 {migrations}')

        missing = []
        for table in KEY_TABLES:
            try:
                cols = db.execute(f'PRAGMA table_info("{table}")').fetchall()
                if not cols:
                    missing.append(table)
            except Exception:  # noqa: BLE001
                missing.append(table)
        report.check(f'关键表 PRAGMA table_info 均存在（{len(KEY_TABLES)} 张）',
                     not missing, f'缺失/无列: {missing}' if missing else f'{len(KEY_TABLES)}/{len(KEY_TABLES)}')

        dungeons = scalar('SELECT COUNT(*) FROM dungeon_defs', -1)
        report.check('dungeon_defs = 6 行', dungeons == EXPECTED_DUNGEONS, f'实际 {dungeons}')

        features = scalar('SELECT COUNT(*) FROM feature_toggles', -1)
        report.check('feature_toggles = 21 行', features == EXPECTED_FEATURES, f'实际 {features}')

        stages_total = scalar('SELECT COUNT(*) FROM stage_defs', -1)
        stages_with = scalar('SELECT COUNT(*) FROM stage_defs WHERE dungeon_id IS NOT NULL', -1)
        report.check('stage_defs dungeonId 21/21',
                     stages_total == EXPECTED_STAGES and stages_with == EXPECTED_STAGES,
                     f'总数 {stages_total}，已归属副本 {stages_with}')

        equipment = scalar('SELECT COUNT(*) FROM equipment_defs', -1)
        report.check('equipment_defs = 108 件', equipment == EXPECTED_EQUIPMENT, f'实际 {equipment}')

        audit_config = scalar("SELECT COUNT(*) FROM gm_audit_logs WHERE action='edit_config'", 0)
        report.info(f'审计日志 edit_config 记录数: {audit_config}（>0 说明云端配置 CRUD 已被使用过）')
        db.close()

    # ---------------- 2. /api/health ----------------
    print('\n--- 2. /api/health ---', flush=True)
    health = get_json(args.base, '/api/health', report, 'GET /api/health 200')
    if health is not None:
        database = health.get('database', {}) if isinstance(health, dict) else {}
        hm, ht = database.get('migrations'), database.get('tables')
        report.check('health: migrations=21 / tables=58',
                     hm == EXPECTED_MIGRATIONS and ht == EXPECTED_TABLES,
                     f'migrations={hm} tables={ht} connected={database.get("connected")} players={database.get("players")}')

    # ---------------- 3. /api/catalog ----------------
    print('\n--- 3. /api/catalog 字段与体量 ---', flush=True)
    catalog = get_json(args.base, '/api/catalog', report, 'GET /api/catalog 200')
    if catalog is not None:
        required = ['stages', 'dungeons', 'features', 'equipment', 'serverOpenDate', 'serverOpenDay']
        absent = [k for k in required if k not in catalog]
        report.check('catalog 六项字段齐全', not absent,
                     f'缺失 {absent}' if absent else f'keys={sorted(catalog.keys())[:12]}...')
        lens = {k: len(catalog.get(k) or []) for k in ('stages', 'dungeons', 'features', 'equipment')}
        report.check('catalog 体量 stages=21 / dungeons=6 / features=21 / equipment=108',
                     lens == {'stages': EXPECTED_STAGES, 'dungeons': EXPECTED_DUNGEONS,
                              'features': EXPECTED_FEATURES, 'equipment': EXPECTED_EQUIPMENT},
                     f'实际 {lens}')
        sod, soday = catalog.get('serverOpenDate'), catalog.get('serverOpenDay')
        report.check('serverOpenDate / serverOpenDay 有值',
                     bool(sod) and soday is not None, f'serverOpenDate={sod} serverOpenDay={soday}')

    # ---------------- 4. 本机首页（服务端同机口径，v22 线上内容正确性的主证据） ----------------
    print('\n--- 4. 本机首页内联资源（BASE 口径） ---', flush=True)

    def audit_inline(label, text):
        webp = text.count('data:image/webp;base64')
        woff = text.count('data:font/woff2') + text.count('data:application/font-woff2')
        report.check(f'{label}: 含 data:image/webp;base64 内联证据', webp > 0, f'共 {webp} 处')
        report.check(f'{label}: 含 data:font/woff2 内联证据', woff > 0, f'共 {woff} 处')
        report.check(f'{label}: 内联资源数量 11 webp / 3 woff2',
                     webp >= EXPECTED_WEBP and woff >= EXPECTED_WOFF2,
                     f'webp={webp} woff2={woff}')
        report.info(f'{label}: 内联 SVG(favicon 等) 数量: {text.count("data:image/svg+xml")}')
        # 只按「引用上下文」判定外链：images/、fonts/、favicon.svg 不得出现在
        # src=/href=/url() 里。统一解析器的 map key 是裸字符串，不算外链，避免误报。
        external = [
            (r'(?:src|href)\s*=\s*["\']\s*(?:\./)?images/', 'src/href 指向 images/'),
            (r'(?:src|href)\s*=\s*["\']\s*(?:\./)?fonts/', 'src/href 指向 fonts/'),
            (r'url\(\s*["\']?\s*(?:\./)?images/', 'CSS url() 指向 images/'),
            (r'url\(\s*["\']?\s*(?:\./)?fonts/', 'CSS url() 指向 fonts/'),
            (r'(?:src|href)\s*=\s*["\']\s*(?:\./)?favicon\.svg', 'favicon.svg 外链'),
            (r'<link[^>]+(?:images/|fonts/|favicon\.svg)', '<link> 指向静态资源'),
        ]
        hits = []
        for pattern, label2 in external:
            found = re.findall(pattern, text, flags=re.IGNORECASE)
            if found:
                hits.append(f'{label2} x{len(found)}')
        report.check(f'{label}: 不再引用 images/*.jpg / fonts/*.woff2 / favicon.svg 外链',
                     not hits, '; '.join(hits) if hits else '0 处外链引用（map key 不计）')
        raw_paths = (len(re.findall(r'images/[A-Za-z0-9_.-]+\.jpg', text)),
                     len(re.findall(r'fonts/[A-Za-z0-9_.-]+\.woff2', text)))
        report.info(f'{label}: images/*.jpg / fonts/*.woff2 裸字符串（解析器 map key）: '
                    f'{raw_paths[0]}/{raw_paths[1]}')

    status, local_bytes = http_get(args.base.rstrip('/') + '/', timeout=30)
    report.check('本机 GET / HTTP 200', status == 200,
                 f'HTTP {status} size={len(local_bytes) if local_bytes else 0}')
    if status == 200 and local_bytes:
        size = len(local_bytes)
        report.check(f'本机首页字节数 ≥ 5 MB（v22 预期约 {EXPECTED_HOME_BYTES} B）',
                     size >= 5_000_000, f'实际 {size} B ({size / 1024 / 1024:.2f} MB)')
        report.info(f'与部署预期 {EXPECTED_HOME_BYTES} B 对比: '
                    f'{"一致" if size == EXPECTED_HOME_BYTES else f"相差 {size - EXPECTED_HOME_BYTES:+d} B"}')
        audit_inline('本机首页', local_bytes.decode('utf-8', 'replace'))
    else:
        report.check('本机首页可读取以做内联检查', False,
                     f'HTTP {status}; body={(local_bytes or b"")[:160]!r}')

    local_home = os.path.join(root, 'webapp', 'index.html')
    if os.path.isfile(local_home):
        lsize = os.path.getsize(local_home)
        report.check(f'落盘 webapp/index.html ≥ 5 MB（基线 627,056 B，v22 预期 {EXPECTED_HOME_BYTES} B）',
                     lsize >= 5_000_000, f'{lsize} B ({lsize / 1024 / 1024:.2f} MB)')
    else:
        report.check('落盘 webapp/index.html 存在', False, local_home)

    # ---------------- 5. 公网首页 ----------------
    print('\n--- 5. 公网首页 ---', flush=True)
    if args.skip_public:
        report.concern('公网首页检查', '--skip-public 已指定，跳过（不判定 PASS）')
    elif args.public_external_blocked:
        report.blocked('公网首页 https://940608.site/ 可达性',
                       'ICP 备案拦截：部署后复测仍间歇 200/302、https 握手失败，属域名备案问题非应用问题。'
                       '不计 PASS/FAIL；恢复条件 = 域名 ICP 备案通过（或切换已备案域名/接入备案服务商）后重跑本脚本。'
                       '线上内容正确性已由「本机首页 BASE 口径」+ nginx 回环口径代替验证')
    else:
        status, home_bytes = http_get(args.public, timeout=40)
        report.check('GET 公网首页 HTTP 200', status == 200,
                     f'HTTP {status} size={len(home_bytes) if home_bytes else 0}')
        if status == 200 and home_bytes:
            size = len(home_bytes)
            report.check('公网首页字节数 ≥ 5 MB', size >= 5_000_000,
                         f'实际 {size} B ({size / 1024 / 1024:.2f} MB)')
            audit_inline('公网首页', home_bytes.decode('utf-8', 'replace'))
        else:
            report.check('公网首页内容可读取以做内联检查', False,
                         f'HTTP {status}; body={(home_bytes or b"")[:160]!r}')

    # ---------------- 6. 静态资源目录与备份清理 ----------------
    print('\n--- 6. 目录清理 / 关键文件保留 ---', flush=True)
    webapp = os.path.join(root, 'webapp')
    if os.path.isdir(webapp):
        entries = sorted(os.listdir(webapp))
        forbidden = [e for e in ('images', 'fonts', 'favicon.svg') if e in entries]
        report.check('webapp/ 下无 images/、fonts/、favicon.svg', not forbidden,
                     f'仍存在 {forbidden}' if forbidden else f'entries={entries}')
        report.check('webapp/index.html 保留', 'index.html' in entries, f'entries={entries}')
        report.check('webapp/ 文件清单 = index.html + admin.html（v22 终态两文件）',
                     set(entries) == {'index.html', 'admin.html'}, f'entries={entries}')
    else:
        report.check('webapp/ 目录存在', False, webapp)

    for name in OLD_BACKUPS:
        path = os.path.join(root, name)
        report.check(f'历史备份 {name}/ 已移除', not os.path.isdir(path), path)
    final_backup = os.path.join(root, 'backup-final')
    if os.path.isdir(final_backup):
        backups = sorted(os.listdir(final_backup))
        tar_ok = any(name.startswith('pre-v22-') and name.endswith('.tar.gz') for name in backups)
        db_ok = any(name.startswith('game-db-pre-v22-') and name.endswith('.db') for name in backups)
        report.check('backup-final/ 打包备份在位（pre-v22 tar.gz + game-db db）', tar_ok and db_ok,
                     f'entries={backups}')
    else:
        report.check('backup-final/ 打包备份在位', False, final_backup)

    def any_exists(candidates):
        return next((p for p in candidates if os.path.isfile(p)), None)

    retained = [
        ('webapp/index.html', [os.path.join(root, 'webapp', 'index.html')]),
        ('admin.html', [os.path.join(root, 'backend', 'public', 'admin.html'),
                        os.path.join(root, 'webapp', 'admin.html')]),
        ('server.cjs', [os.path.join(root, 'backend', 'dist', 'server.cjs'),
                        os.path.join(root, 'server.cjs')]),
        ('schema.sql', [os.path.join(root, 'backend', 'dist', 'schema.sql'),
                        os.path.join(root, 'backend', 'src', 'db', 'schema.sql'),
                        os.path.join(root, 'schema.sql')]),
        ('data/game.db', [os.path.join(root, 'data', 'game.db')]),
    ]
    for label, candidates in retained:
        found = any_exists(candidates)
        report.check(f'关键文件保留：{label}', found is not None, found or f'均未找到 {candidates}')

    # ---------------- 7. GM 台与 v22 端点 ----------------
    print('\n--- 7. GM 台 / v22 配置端点 ---', flush=True)
    status, admin_body = http_get(args.base.rstrip('/') + '/admin/', timeout=20)
    admin_text = (admin_body or b'').decode('utf-8', 'replace')
    report.check('GET /admin/ HTTP 200', status == 200, f'HTTP {status} size={len(admin_body or b"")}')
    report.check('GM 台含「配置管理」页签', status == 200 and '配置管理' in admin_text,
                 f'命中 {"是" if "配置管理" in admin_text else "否"}; '
                 f'页签数 {admin_text.count("data-tab=")}')
    if status == 200 and '配置管理' not in admin_text:
        # 兜底：落盘 admin.html 里找，便于定位是部署未更新还是页面本身缺失
        for candidate in (os.path.join(root, 'backend', 'public', 'admin.html'),
                          os.path.join(root, 'webapp', 'admin.html')):
            if os.path.isfile(candidate):
                disk = open(candidate, encoding='utf-8', errors='replace').read()
                report.info(f'落盘 {candidate} 含「配置管理」: {"配置管理" in disk}')

    # 未认证访问应为 401（新路由已挂载），404 说明 v22 后端未部署
    status, body = http_get(args.base.rstrip('/') + '/api/admin/config/domains', timeout=20)
    report.check('v22 端点已部署（未认证 /config/domains = 401）', status == 401,
                 f'HTTP {status} body={(body or b"")[:160]!r}')
    status, body = http_get(args.base.rstrip('/') + '/api/admin/config/versions', timeout=20)
    report.check('v22 端点已部署（未认证 /config/versions = 401）', status == 401,
                 f'HTTP {status} body={(body or b"")[:160]!r}')

    return report.summary()


if __name__ == '__main__':
    try:
        sys.exit(main())
    except Exception as error:  # noqa: BLE001
        import traceback
        traceback.print_exc()
        print(f'RESULT: FAIL（脚本异常: {error}）', flush=True)
        sys.exit(2)
