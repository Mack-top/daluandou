#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""v22 本地 API 冒烟：GM 登录 -> 全配置域 -> CRUD 全链路 -> 安全边界 -> 审计 -> 清理。

用法（本地执行，需后端已在 127.0.0.1:8787 运行）：
    python3 build/verify-admin-config.py
    python3 build/verify-admin-config.py --username gm-admin --password '<GM 口令>'
    GM_USERNAME=gm-admin GM_PASSWORD='<口令>' python3 build/verify-admin-config.py
    python3 build/verify-admin-config.py --bootstrap-gm   # 无口令时的应急自举（见下方说明）
    # 包裹外部工具（如 Playwright）：先 prepare，跑完务必 restore
    python3 build/verify-admin-config.py --prepare-gm-only
    GM_PASSWORD=QaV22Smoke2026 npx playwright test tests/admin-config.spec.ts --project=desktop
    python3 build/verify-admin-config.py --restore-gm-only

--bootstrap-gm（可选、需人工批准）：
    把本地 backend/data/game.db 中已存在的 gm-admin 的 password_hash 临时换成
    一个已知 scrypt 摘要用于登录，原摘要与 status 写入 build/.qa-v22-gm-backup.json，
    finally 中无条件还原并校验。不新增/删除 GM 账号，审计日志仍挂在原账号上，
    不触碰任何玩家数据表。上次异常残留的备份会在启动时先自动还原。

安全约定：
    * 所有新建行主键统一为 qa-v22-<timestamp>-<suffix>，只落在 vfx / skills 两个
      不易被引用的静态定义域，绝不写 player_* / 订单 / 会话等玩家数据表。
    * 所有临时行在 finally 中经 API 删除（skills 先于 vfx，避免外键保护拦截）。
    * 失败时打印 HTTP 状态码与响应体。

退出码：0 = 全部 PASS（CONCERNS 不影响）；1 = 存在 FAIL / 阻塞；2 = 脚本异常。
"""
import argparse
import base64
import hashlib
import json
import os
import secrets
import sqlite3
import sys
import time
import urllib.error
import urllib.request

HERE = os.path.dirname(os.path.abspath(__file__))
DEFAULT_DB = os.path.abspath(os.path.join(HERE, '..', 'backend', 'data', 'game.db'))
BACKUP_FILE = os.path.join(HERE, '.qa-v22-gm-backup.json')
# 仅用于 --prepare-gm-only / --restore-gm-only 包裹外部工具（如 Playwright）的固定本地临时口令
BOOTSTRAP_PASSWORD = os.getenv('QA_BOOTSTRAP_PASSWORD', 'QaV22Smoke2026')

# 与 backend/src/config/config-domains.ts 对齐的静态定义表清单（22 可写 + 4 只读）
EXPECTED_WRITABLE_TABLES = {
    'level_exp_defs', 'level_stats_defs', 'class_defs', 'character_defs', 'equipment_defs',
    'dungeon_defs', 'stage_defs', 'feature_toggles', 'quest_defs', 'mail_defs',
    'shop_pack_defs', 'trade_rate_defs', 'market_offer_defs', 'astrology_node_defs',
    'vfx_defs', 'skill_defs', 'enemy_defs', 'scene_defs', 'item_defs', 'activity_defs',
    'leaderboard_defs', 'guilds',
}
# 只读运维表：catalog_versions / migrations / battle_passes；另有 table='' 的虚拟运行时参数域
EXPECTED_READONLY_TABLES = {'catalog_meta', 'schema_migrations', 'battle_passes'}
EXPECTED_CATALOG = {'stages': 21, 'dungeons': 6, 'features': 21, 'equipment': 108}

VFX_ROW = {
    'name': 'QA v22 temp',
    'type': 'ui',
    'asset_path': 'qa://inline',
    'duration_ms': 0,
    'sort_index': 999999,
}


class StopSmoke(Exception):
    """提前中止（凭据缺失 / 阻塞），仍执行 finally 清理。"""


class Report:
    def __init__(self):
        self.items = []

    def check(self, name, ok, detail=''):
        self.items.append((name, bool(ok), 'FAIL', detail))
        print(f"[{'PASS' if ok else 'FAIL'}] {name}" + (f' | {detail}' if detail else ''), flush=True)
        return bool(ok)

    def concern(self, name, detail=''):
        self.items.append((name, None, 'CONCERNS', detail))
        print(f'[CONCERNS] {name}' + (f' | {detail}' if detail else ''), flush=True)

    def info(self, text):
        print(f'[INFO ] {text}', flush=True)

    def summary(self):
        fails = [x for x in self.items if x[1] is False]
        concerns = [x for x in self.items if x[1] is None]
        passes = [x for x in self.items if x[1] is True]
        print('\n================ v22 本地 API 冒烟汇总 ================', flush=True)
        print(f'总计 {len(self.items)} 项 | PASS {len(passes)} | '
              f'CONCERNS {len(concerns)} | FAIL {len(fails)}', flush=True)
        for name, _ok, _level, detail in fails:
            print(f'  - FAIL {name} :: {detail}', flush=True)
        for name, _ok, _level, detail in concerns:
            print(f'  - CONCERNS {name} :: {detail}', flush=True)
        result = 'FAIL' if fails else ('CONCERNS' if concerns else 'PASS')
        print(f'RESULT: {result}', flush=True)
        return 1 if fails else 0


def http(base, method, path, body=None, token=None, timeout=15):
    url = base.rstrip('/') + path
    data = json.dumps(body, ensure_ascii=False).encode('utf-8') if body is not None else None
    headers = {'Accept': 'application/json'}
    if data is not None:
        headers['Content-Type'] = 'application/json'
    if token:
        headers['Authorization'] = 'Bearer ' + token
    req = urllib.request.Request(url, data=data, headers=headers, method=method)
    try:
        with urllib.request.urlopen(req, timeout=timeout) as resp:
            status, raw = resp.status, resp.read()
    except urllib.error.HTTPError as error:
        status, raw = error.code, error.read()
    except Exception as error:  # noqa: BLE001
        return -1, None, f'{type(error).__name__}: {error}'
    text = raw.decode('utf-8', 'replace')
    try:
        payload = json.loads(text)
    except Exception:  # noqa: BLE001
        payload = None
    return status, payload, text


def data_of(payload):
    if isinstance(payload, dict) and 'data' in payload:
        return payload['data']
    return payload


def err_text(payload, raw):
    if isinstance(payload, dict):
        err = payload.get('error')
        if isinstance(err, dict):
            return f"{err.get('code', '')} {err.get('message', '')}".strip()
    return (raw or '')[:300]


def brief(status, payload, raw, limit=220):
    return f'HTTP {status} body={(raw if isinstance(raw, str) else str(raw))[:limit]}'


def cleanup_rows(base, token, report, extra=None):
    """删除本次及历史 qa-v22-* 临时行；skills 必须先于 vfx（外键引用保护）。"""
    pairs = list(extra or [])
    for domain in ('skills', 'vfx'):
        st, pl, _rw = http(base, 'GET', f'/api/admin/config/{domain}', token=token)
        body = data_of(pl) or {}
        rows = body.get('rows') if isinstance(body, dict) else []
        if st != 200:
            report.info(f'清理阶段 GET {domain} 返回 HTTP {st}，跳过该域发现')
            continue
        for row in rows or []:
            rid = str(row.get('id', ''))
            if rid.startswith('qa-v22-'):
                pairs.append((domain, rid))
    remaining = []
    for domain in ('skills', 'vfx'):
        for dom, rid in list(pairs):
            if dom != domain:
                continue
            st, _pl, rw = http(base, 'DELETE', f'/api/admin/config/{domain}/{rid}', token=token)
            if st not in (200, 404):
                report.info(f'清理 {domain}/{rid} 返回 HTTP {st}: {rw[:120]}')
                remaining.append((dom, rid))
            pairs.remove((dom, rid))
    return pairs + remaining


# ---------------- GM 自举（可选，可完全还原） ----------------

def scrypt_hash(password):
    salt = secrets.token_bytes(16)
    digest = hashlib.scrypt(password.encode('utf-8'), salt=salt,
                            n=16384, r=8, p=1, dklen=64, maxmem=64 * 1024 * 1024)
    return ('scrypt$16384$8$1$' + base64.b64encode(salt).decode('ascii')
            + '$' + base64.b64encode(digest).decode('ascii'))


class GmBootstrap:
    """临时替换既有 gm-admin 的口令摘要；finally 无条件还原。"""

    def __init__(self, db_path, username, password, report):
        self.db_path = db_path
        self.username = username
        self.password = password
        self.report = report
        self.active = False

    def _restore_from_file(self):
        if not os.path.isfile(BACKUP_FILE):
            return False
        try:
            with open(BACKUP_FILE, encoding='utf-8') as handle:
                backup = json.load(handle)
            conn = sqlite3.connect(self.db_path, timeout=10)
            conn.execute('UPDATE gm_accounts SET password_hash = ?, status = ? WHERE id = ?',
                         (backup['password_hash'], backup['status'], backup['id']))
            conn.commit()
            row = conn.execute('SELECT password_hash, status FROM gm_accounts WHERE id = ?',
                               (backup['id'],)).fetchone()
            conn.close()
            ok = row is not None and row[0] == backup['password_hash'] and row[1] == backup['status']
            if ok:
                os.remove(BACKUP_FILE)
                self.report.info('已还原上次异常残留的 GM 口令摘要备份')
            return ok
        except Exception as error:  # noqa: BLE001
            self.report.info(f'还原历史备份失败（继续尝试新备份）: {error}')
            return False

    def prepare(self):
        self._restore_from_file()
        if not os.path.isfile(self.db_path):
            self.report.check('GM 自举：本地 DB 存在', False, self.db_path)
            return False
        try:
            conn = sqlite3.connect(self.db_path, timeout=10)
            row = conn.execute('SELECT id, password_hash, status FROM gm_accounts WHERE username = ?',
                               (self.username,)).fetchone()
            if row is None:
                conn.close()
                self.report.check('GM 自举：找到目标 GM 账号', False, self.username)
                return False
            backup = {'id': row[0], 'username': self.username,
                      'password_hash': row[1], 'status': row[2]}
            with open(BACKUP_FILE, 'w', encoding='utf-8') as handle:
                json.dump(backup, handle, ensure_ascii=False)
            conn.execute("UPDATE gm_accounts SET password_hash = ?, status = 'active' WHERE id = ?",
                         (scrypt_hash(self.password), row[0]))
            conn.commit()
            conn.close()
            self.active = True
            self.report.check('GM 自举：临时口令已写入（原摘要已备份）', True,
                              f'backup={BACKUP_FILE}')
            return True
        except Exception as error:  # noqa: BLE001
            self.report.check('GM 自举：临时口令写入', False, str(error))
            return False

    def restore_from_backup(self):
        """供 --restore-gm-only 使用：按备份文件还原并校验。"""
        if not os.path.isfile(BACKUP_FILE):
            return False
        self.active = True
        self.restore()
        return True

    def restore(self):
        if not self.active:
            return
        try:
            with open(BACKUP_FILE, encoding='utf-8') as handle:                backup = json.load(handle)
            conn = sqlite3.connect(self.db_path, timeout=10)
            conn.execute('UPDATE gm_accounts SET password_hash = ?, status = ? WHERE id = ?',
                         (backup['password_hash'], backup['status'], backup['id']))
            conn.commit()
            row = conn.execute('SELECT password_hash, status FROM gm_accounts WHERE id = ?',
                               (backup['id'],)).fetchone()
            conn.close()
            ok = row is not None and row[0] == backup['password_hash'] and row[1] == backup['status']
            self.report.check('GM 自举：原口令摘要已还原', ok,
                              f'username={backup["username"]} status={backup["status"]}')
            if ok:
                os.remove(BACKUP_FILE)
        except Exception as error:  # noqa: BLE001
            self.report.check('GM 自举：原口令摘要已还原', False,
                              f'{error}; 请手工按 {BACKUP_FILE} 还原')


# ---------------- 主流程 ----------------

def main():
    parser = argparse.ArgumentParser(description='v22 本地配置 CRUD API 冒烟')
    parser.add_argument('--base', default=os.getenv('QA_BASE_URL', 'http://127.0.0.1:8787'))
    parser.add_argument('--username', default=os.getenv('GM_USERNAME') or os.getenv('GM_SEED_USERNAME') or 'gm-admin')
    parser.add_argument('--password', default=os.getenv('GM_PASSWORD') or os.getenv('GM_SEED_PASSWORD'))
    parser.add_argument('--db', default=DEFAULT_DB)
    parser.add_argument('--bootstrap-gm', action='store_true',
                        help='无口令时临时替换既有 gm-admin 的口令摘要（可完全还原，需人工批准）')
    parser.add_argument('--prepare-gm-only', action='store_true',
                        help='仅临时替换 gm-admin 口令摘要并打印，供外部工具（Playwright）使用')
    parser.add_argument('--restore-gm-only', action='store_true',
                        help='仅按备份文件还原 gm-admin 口令摘要')
    args = parser.parse_args()

    report = Report()
    if args.prepare_gm_only or args.restore_gm_only:
        boot = GmBootstrap(args.db, args.username, BOOTSTRAP_PASSWORD, report)
        if args.prepare_gm_only:
            ok = boot.prepare()
            if ok:
                print(f'QA_BOOTSTRAP_PASSWORD={BOOTSTRAP_PASSWORD}', flush=True)
            return 0 if ok else 1
        if boot.restore_from_backup():
            return report.summary()
        report.info('无备份文件，无需还原')
        return 0

    token = None
    bootstrap = None
    temp_rows = []
    stamp = f'qa-v22-{int(time.time())}-{secrets.token_hex(3)}'
    crud_id = f'{stamp}-crud'
    fk_vfx_id = f'{stamp}-fkv'
    fk_skill_id = f'{stamp}-fks'
    rogue_id = f'{stamp}-rogue'

    print('--- 0. 环境 ---', flush=True)
    report.info(f'BASE={args.base} USER={args.username} DB={args.db} STAMP={stamp}')
    report.info('临时主键只落在 vfx / skills 域；不触碰玩家数据表')

    try:
        # ---------------- 1. GM 登录 ----------------
        print('\n--- 1. GM 登录 ---', flush=True)
        if not args.password:
            if not args.bootstrap_gm:
                report.check('GM 登录凭据可用', False,
                             '未提供 GM_PASSWORD / GM_SEED_PASSWORD，且未指定 --bootstrap-gm；'
                             '本项 BLOCKED，其余用例无法执行')
                raise StopSmoke()
            args.password = 'QaV22Smoke' + str(int(time.time()))
            bootstrap = GmBootstrap(args.db, args.username, args.password, report)
            if not bootstrap.prepare():
                raise StopSmoke()

        status, payload, raw = http(args.base, 'POST', '/api/admin/login',
                                    {'username': args.username, 'password': args.password})
        login = data_of(payload) or {}
        if isinstance(login, dict):
            token = login.get('token')
        report.check('POST /api/admin/login 200 + token',
                     status == 200 and bool(token), brief(status, payload, raw))
        if not token:
            report.check('GM 会话可用', False, '无 token，后续用例无法执行（BLOCKED）')
            raise StopSmoke()
        role = (login.get('gm') or {}).get('role') if isinstance(login, dict) else None
        report.check('GM 角色具备 edit_config 权限（super/ops）', role in ('super', 'ops'),
                     f'role={role}')

        def call(method, path, body=None, timeout=15):
            return http(args.base, method, path, body=body, token=token, timeout=timeout)

        # ---------------- 2. 域清单 ----------------
        print('\n--- 2. 配置域清单 / 版本戳 ---', flush=True)
        status, payload, raw = call('GET', '/api/admin/config/domains')
        d_body = data_of(payload) or {}
        domains = d_body.get('domains') if isinstance(d_body, dict) else None
        if not isinstance(domains, list) or not domains:
            report.check('GET /config/domains 返回非空 domains', False, brief(status, payload, raw))
            raise StopSmoke()
        report.check('GET /config/domains 200 + 非空列表', status == 200 and len(domains) > 0,
                     f'共 {len(domains)} 个配置域')

        writable = [d for d in domains if not d.get('readOnly')]
        readonly = [d for d in domains if d.get('readOnly')]
        tables = {d.get('table') for d in domains}
        missing_w = sorted(EXPECTED_WRITABLE_TABLES - tables)
        missing_r = sorted(EXPECTED_READONLY_TABLES - tables)
        report.check('覆盖全部静态定义表 + 只读运维域',
                     not missing_w and not missing_r and len(readonly) >= 1,
                     f'可写 {len(writable)} / 只读 {len(readonly)} / 共 {len(domains)}；'
                     f'缺失可写={missing_w} 缺失只读={missing_r}')
        if len(writable) != 23:
            report.concern('契约声明「23 张静态定义表」与实现不一致',
                           f'实现可写域 {len(writable)} 个、只读域 {len(readonly)} 个（含虚拟运行时参数域）、'
                           f'共 {len(domains)} 个配置域；契约写 23 静态表 + 只读域')
        virtual = [d.get('key') for d in domains if d.get('table') == '']
        report.check('虚拟只读域「运行时参数」存在（table=""）', len(virtual) >= 1,
                     f'虚拟域: {virtual}')


        bad_fields = []
        optional_missing = set()
        for d in domains:
            # 虚拟「运行时参数」域 table 合法值为空串，用键存在判定而非真值判定
            if not all([d.get('key'), 'table' in d, d.get('columns'),
                        ('pk' in d or 'primaryKey' in d), isinstance(d.get('readOnly'), bool)]):
                bad_fields.append(d.get('key'))
            for optional in ('primaryKey', 'rowCount', 'version'):
                if optional not in d:
                    optional_missing.add(optional)
        report.check('每个域具备 key/table/columns/pk/readOnly 核心字段', not bad_fields,
                     f'异常域: {bad_fields}' if bad_fields else f'{len(domains)}/{len(domains)}')
        if optional_missing:
            report.concern('契约可选字段在实现中缺失',
                           f'缺 {sorted(optional_missing)}（契约 domains 声明 primaryKey/rowCount/version）')

        status, payload, raw = call('GET', '/api/admin/config/versions')
        v_body = data_of(payload) or {}
        versions = v_body.get('versions') if isinstance(v_body, dict) else None
        report.check('GET /config/versions 200 + 版本字典',
                     status == 200 and isinstance(versions, dict) and len(versions) > 0,
                     f'HTTP {status} 版本域数={len(versions) if isinstance(versions, dict) else None}')

        # ---------------- 3. 逐域 GET ----------------
        print('\n--- 3. 逐域 GET 行列表 ---', flush=True)
        row_counts = {}
        failed_domains = []
        for d in domains:
            key = d.get('key')
            st, pl, rw = call('GET', f'/api/admin/config/{key}')
            body = data_of(pl) or {}
            rows = body.get('rows') if isinstance(body, dict) else None
            if st == 200 and isinstance(rows, list):
                row_counts[key] = len(rows)
            else:
                reason = 'HTTP %s, rows 字段=%s' % (st, '缺失' if rows is None else type(rows).__name__)
                failed_domains.append((key, st, reason))
        report.check(f'逐域 GET /config/:domain 全部返回 rows 列表（{len(domains)} 域）',
                     not failed_domains,
                     f'失败 {failed_domains}' if failed_domains else
                     f'行数示例: ' + ', '.join(f'{k}={v}' for k, v in list(row_counts.items())[:8]))
        if any(k == 'runtime' for k, _s, _r in failed_domains):
            report.concern('虚拟域 runtime 被静态路由 /config/runtime 遮蔽（真实缺陷）',
                           'GET /api/admin/config/runtime 命中 listRuntimeConfig()，返回 '
                           '{note,items,versions,versionDomains}，没有 columns/rows/version；'
                           'GM 台 loadRows() 读不到 rows，点击「运行时参数」会显示空表。'
                           '建议该静态路由补齐 rows/columns/readOnly，或让虚拟域走通用 /config/:domain 形态')
        report.info(f'各域行数: {row_counts}')

        # ---------------- 4. 玩家数据基线 ----------------
        print('\n--- 4. 基线快照（验证 CRUD 不影响玩家存档） ---', flush=True)
        st, pl, rw = http(args.base, 'GET', '/api/health')
        health = data_of(pl) or {}
        players_before = (health.get('database') or {}).get('players') if isinstance(health, dict) else None
        st2, pl2, rw2 = http(args.base, 'GET', '/api/catalog')
        catalog_before = data_of(pl2) or {}
        cat_counts_before = {k: len(catalog_before.get(k) or []) for k in EXPECTED_CATALOG} \
            if isinstance(catalog_before, dict) else {}
        report.check('health / catalog 基线可取', players_before is not None and bool(cat_counts_before),
                     f'players={players_before} catalog={cat_counts_before}')

        # ---------------- 5. 清理历史 QA 残留 ----------------
        print('\n--- 5. 清理历史 qa-v22-* 残留 ---', flush=True)
        leftovers = cleanup_rows(args.base, token, report)
        if leftovers:
            report.info(f'未能清理的历史行: {leftovers}')
        else:
            report.info('无历史残留')

        # ---------------- 6. CRUD 全链路 ----------------
        print('\n--- 6. CRUD 全链路（vfx 域，临时主键） ---', flush=True)
        st, pl, rw = call('GET', '/api/admin/config/vfx')
        v0 = (data_of(pl) or {}).get('version') if isinstance(data_of(pl), dict) else None
        vfx_domain = next((d for d in domains if d.get('key') == 'vfx'), {}) or {}
        vkey = vfx_domain.get('versionDomain') or 'vfx'

        create_body = dict(VFX_ROW, **{'id': crud_id})
        st, pl, rw = call('POST', '/api/admin/config/vfx', create_body)
        created = data_of(pl) or {}
        ok_create = st in (200, 201) and isinstance(created, dict) \
            and (created.get('row') or {}).get('id') == crud_id
        report.check('POST 新建配置行（201）', ok_create, brief(st, pl, rw, 260))
        temp_rows.append(('vfx', crud_id))
        v1 = created.get('version') if isinstance(created, dict) else None
        report.check('POST 返回 version 且自增',
                     isinstance(v1, int) and isinstance(v0, int) and v1 > v0,
                     f'versionBefore={created.get("versionBefore") if isinstance(created, dict) else None} '
                     f'v0={v0} -> v1={v1}')

        def find_row(domain, rid):
            s, p, r = call('GET', f'/api/admin/config/{domain}')
            b = data_of(p) or {}
            rows = b.get('rows') if isinstance(b, dict) else []
            return next((x for x in (rows or []) if str(x.get('id', '')) == rid), None), s

        # 契约里的单行 GET 可能未实现：404 时降级到列表内按主键查
        st, pl, rw = call('GET', f'/api/admin/config/vfx/{crud_id}')
        if st == 404:
            report.concern('契约 GET /config/:domain/:id 未实现',
                           '实际 admin.routes.ts 只有域列表；改用列表按主键校验')
        else:
            row = (data_of(pl) or {}).get('row') if isinstance(data_of(pl), dict) else None
            report.check('GET 单行返回 row', st == 200 and isinstance(row, dict)
                         and row.get('id') == crud_id, brief(st, pl, rw))
        row_now, _ = find_row('vfx', crud_id)
        report.check('新建后可按主键查到该行', row_now is not None,
                     f'name={row_now.get("name") if row_now else None}')

        # 契约 PATCH、实现 PUT：先试 PUT，404/405 回退 PATCH
        update_body = {'name': 'QA v22 edited', 'duration_ms': 321}
        st, pl, rw = call('PUT', f'/api/admin/config/vfx/{crud_id}', update_body)
        method_used = 'PUT'
        if st in (404, 405):
            method_used = 'PATCH'
            st, pl, rw = call('PATCH', f'/api/admin/config/vfx/{crud_id}', update_body)
        if method_used == 'PUT' and st not in (200, 201):
            st_p, pl_p, rw_p = call('PATCH', f'/api/admin/config/vfx/{crud_id}', update_body)
            if st_p in (200, 201):
                method_used, st, pl, rw = 'PATCH', st_p, pl_p, rw_p
        updated = data_of(pl) or {}
        report.check(f'编辑保存成功（{method_used}）', st in (200, 201), brief(st, pl, rw, 260))
        v2 = updated.get('version') if isinstance(updated, dict) else None
        report.check('PATCH/PUT 后 version 再次自增',
                     isinstance(v2, int) and isinstance(v1, int) and v2 > v1, f'v1={v1} -> v2={v2}')
        row_now, _ = find_row('vfx', crud_id)
        report.check('GET 校验编辑后的值',
                     row_now is not None and row_now.get('name') == 'QA v22 edited'
                     and row_now.get('duration_ms') == 321,
                     f'row={row_now}' if row_now else '未查到该行')

        st, pl, rw = call('DELETE', f'/api/admin/config/vfx/{crud_id}')
        deleted = data_of(pl) or {}
        report.check('DELETE 删除临时行', st == 200 and deleted.get('deleted') is True,
                     brief(st, pl, rw, 260))
        v3 = deleted.get('version') if isinstance(deleted, dict) else None
        report.check('DELETE 后 version 再次自增',
                     isinstance(v3, int) and isinstance(v2, int) and v3 > v2, f'v2={v2} -> v3={v3}')
        row_now, _ = find_row('vfx', crud_id)
        report.check('删除后列表不再包含该行', row_now is None, f'row={row_now}')

        st, pl, rw = call('GET', '/api/admin/config/versions')
        versions_after = (data_of(pl) or {}).get('versions') if isinstance(data_of(pl), dict) else {}
        report.check('版本自增反映到 /config/versions',
                     isinstance(versions_after, dict) and versions_after.get(vkey, -1) == v3,
                     f'{vkey}={versions_after.get(vkey) if isinstance(versions_after, dict) else None} 期望 {v3}')

        # ---------------- 7. 外键引用保护 ----------------
        print('\n--- 7. 删除被外键引用的行应被拒 ---', flush=True)
        st, pl, rw = call('POST', '/api/admin/config/vfx', dict(VFX_ROW, **{'id': fk_vfx_id}))
        ok_fk_create = st in (200, 201)
        temp_rows.append(('vfx', fk_vfx_id))
        skill_body = {
            'id': fk_skill_id, 'name': 'QA fk skill', 'kind': 'attack',
            'target_type': 'enemy', 'coefficient_bp': 10000, 'cooldown': 0,
            'vfx_id': fk_vfx_id, 'detail': 'qa',
        }
        st2, pl2, rw2 = call('POST', '/api/admin/config/skills', skill_body)
        ok_skill_create = st2 in (200, 201)
        temp_rows.append(('skills', fk_skill_id))
        report.check('构造外键引用场景（临时 vfx + 引用它的 skill）',
                     ok_fk_create and ok_skill_create,
                     f'vfx HTTP {st}; skill HTTP {st2} body={rw2[:160]}')

        st, pl, rw = call('DELETE', f'/api/admin/config/vfx/{fk_vfx_id}')
        reason = err_text(pl, rw)
        rejected = st in (400, 409) and ('引用' in reason or '无法删除' in reason
                                        or 'REFERENCE' in reason.upper())
        report.check('删除被引用配置行被拒且返回明确原因', rejected,
                     f'HTTP {st} reason={reason[:200]}')
        row_still, _ = find_row('vfx', fk_vfx_id)
        report.check('被引用行未被误删', row_still is not None, f'row={row_still}')

        st, pl, rw = call('DELETE', f'/api/admin/config/skills/{fk_skill_id}')
        report.check('先删引用方成功', st == 200, brief(st, pl, rw))
        st, pl, rw = call('DELETE', f'/api/admin/config/vfx/{fk_vfx_id}')
        report.check('解除引用后删除被引用方成功', st == 200, brief(st, pl, rw))

        # ---------------- 8. 只读域 / 非法列 写入防护 ----------------
        print('\n--- 8. 只读域 / 非法列 写入防护 ---', flush=True)
        st, pl, rw = call('POST', '/api/admin/config/catalog_versions',
                          {'domain': 'qa-v22-rogue', 'version': 1})
        reason = err_text(pl, rw)
        report.check('POST 只读域 catalog_versions 被拒（400 且含原因）',
                     st in (400, 403) and ('只读' in reason or 'read' in reason.lower()),
                     f'HTTP {st} reason={reason[:200]}')
        st2, pl2, rw2 = call('POST', '/api/admin/config/migrations', {'version': 999, 'name': 'qa'})
        reason2 = err_text(pl2, rw2)
        report.check('POST 只读域 migrations 被拒（400 且含原因）',
                     st2 in (400, 403) and ('只读' in reason2 or 'read' in reason2.lower()),
                     f'HTTP {st2} reason={reason2[:200]}')
        st3, pl3, rw3 = call('GET', '/api/admin/config/catalog_versions')
        ro_rows = (data_of(pl3) or {}).get('rows') if isinstance(data_of(pl3), dict) else []
        if ro_rows:
            ro_id = str(ro_rows[0].get('domain'))
            st4, pl4, rw4 = call('DELETE', f'/api/admin/config/catalog_versions/{ro_id}')
            reason4 = err_text(pl4, rw4)
            report.check('DELETE 只读域被拒（400 且含原因）',
                         st4 in (400, 403) and ('只读' in reason4 or 'read' in reason4.lower()),
                         f'HTTP {st4} reason={reason4[:200]}')

        rogue_body = dict(VFX_ROW, **{'id': rogue_id, '__qa_undeclared__': 'rogue'})
        st, pl, rw = call('POST', '/api/admin/config/vfx', rogue_body)
        if st in (400, 422):
            report.check('POST 传未声明列被拒', True, f'HTTP {st} {err_text(pl, rw)[:160]}')
        elif st in (200, 201):
            temp_rows.append(('vfx', rogue_id))
            report.concern('传未声明列未被拒绝（实现静默忽略）',
                           'configBodySchema 为 z.record，buildInsertValues 只遍历白名单列，'
                           f'多余字段被丢弃；HTTP {st}，返回行不含该列。按契约为 Minor 缺陷')
        else:
            report.check('POST 传未声明列被拒', False, brief(st, pl, rw))

        # ---------------- 9. 审计日志 ----------------
        print('\n--- 9. 审计日志 ---', flush=True)
        st, pl, rw = call('GET', '/api/admin/audit-logs?action=edit_config&limit=200')
        a_body = data_of(pl) or {}
        logs = a_body.get('logs') if isinstance(a_body, dict) else None
        if not isinstance(logs, list):
            report.check('GET /api/admin/audit-logs 200 + logs', False, brief(st, pl, rw))
        else:
            report.check('GET /api/admin/audit-logs 200 + logs', st == 200, f'共 {len(logs)} 条')
            text = json.dumps(logs, ensure_ascii=False)
            hits = text.count(crud_id)
            report.check('edit_config 审计含本次 CRUD 目标（>=3 条：create/update/delete）',
                         hits >= 3, f'targetId 命中 {hits} 次；action=edit_config 记录 '
                         f'{sum(1 for l in logs if str(l.get("action")) == "edit_config")} 条')

        # ---------------- 10. 玩家数据 / 目录无回归 ----------------
        print('\n--- 10. 玩家存档与目录无回归 ---', flush=True)
        st, pl, rw = http(args.base, 'GET', '/api/health')
        health_after = data_of(pl) or {}
        players_after = (health_after.get('database') or {}).get('players') \
            if isinstance(health_after, dict) else None
        report.check('players 数量未变（配置 CRUD 不影响玩家存档）',
                     players_before is not None and players_after == players_before,
                     f'{players_before} -> {players_after}')
        st2, pl2, rw2 = http(args.base, 'GET', '/api/catalog')
        catalog_after = data_of(pl2) or {}
        cat_counts_after = {k: len(catalog_after.get(k) or []) for k in EXPECTED_CATALOG} \
            if isinstance(catalog_after, dict) else {}
        report.check('catalog 四大域体量未变且符合基线',
                     cat_counts_after == cat_counts_before == EXPECTED_CATALOG,
                     f'before={cat_counts_before} after={cat_counts_after}')

    except StopSmoke:
        pass
    finally:
        print('\n--- CLEANUP: 删除本次及历史 qa-v22-* 临时行 ---', flush=True)
        if token:
            try:
                remaining = cleanup_rows(args.base, token, report, temp_rows)
                report.check('临时配置行清理完成', not remaining,
                             f'残留 {remaining}' if remaining else '0 残留')
            except Exception as error:  # noqa: BLE001
                report.check('临时配置行清理完成', False, str(error))
        else:
            report.info('无 GM 会话，跳过 API 清理（本次未写入任何配置行）')
        if bootstrap is not None:
            bootstrap.restore()

    return report.summary()


if __name__ == '__main__':
    try:
        sys.exit(main())
    except Exception as error:  # noqa: BLE001
        import traceback
        traceback.print_exc()
        print(f'RESULT: FAIL（脚本异常: {error}）', flush=True)
        sys.exit(2)
