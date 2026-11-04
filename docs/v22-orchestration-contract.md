# v22 编排契约基准（主理人汇编用）

> 用途：跨成员一致性检查的单一事实源。本文件由主理人维护，记录用户已拍板的决策、
> 下发给各成员的 API 契约、文件域边界与质量门标准。**不是**任何成员的专业产出，
> 成员实现与本文件冲突时以本文件为准，并须回传主理人裁决。

## 1. 阶段诊断（Phase 0）

用户当前处于 **Phase 5/6（制作收尾 + 打磨）**，非新建项目，无需走概念/GDD 全流程。

### 资源链路现状（实测）
- 前端 `vite-plugin-singlefile`：JS/CSS 内联进 `frontend/dist/index.html`（627,056 B），
  但图片/字体/favicon 仍为**外链相对路径**，运行时动态拼接：
  - `frontend/src/fonts.ts` → `new URL(path, document.baseURI)`
  - `frontend/src/game-data.ts` / `social.ts` → 字符串常量 `images/*.jpg`
  - `frontend/index.html` → og:image / icon / 2 个 preload
  - `backend/src/db/seed.ts` → scene/character/enemy/vfx 表内也存 `images/*.jpg`
- 云端 `webapp/`：11 jpg（4.5 MB，被引用）+ 11 webp（3.4 MB，**零引用**）+ 3 woff2（370 KB）
  + 2 个 OFL txt（不加载）+ favicon.svg + index.html
- 冗余：`backup-20261104-1220/`（3.2 MB）、`backup-20261104-1347/`（2.0 MB）
- 后端 `backend/public/admin.html` 现有 4 个页签（玩家/邮件/审计/排行榜），**无配置管理**

### 根因
单文件构建只内联了 JS/CSS，静态资源仍需服务器另存一份目录，
故云端必须保留 `images/` `fonts/` `favicon.svg` 才能正常显示图片。

## 2. 用户已拍板决策（2026-11-04）

| # | 决策 | 选择 |
|---|------|------|
| A | 资源承载策略 | **复用现有 11 张 webp 内联**（不新增画质损失）+ 3 woff2 + favicon，单文件约 5 MB；构建产物不再输出 images/ fonts/ favicon.svg |
| B | 云端清理范围 | **清静态资源 + 历史备份**；删除前打包备份到 `/home/ubuntu/meishi/backup-final/`，可回滚 |
| C | 配置删除语义 | **物理删除 + 外键保护**（被引用则拒绝并给出明确原因） |

## 3. 统一 API 契约（跨成员共享）

```
GET    /api/admin/config/domains       → { domains: [{key,label,table,primaryKey,columns,readOnly,rowCount,version}] }
                                          columns: [{name,label,type,nullable,editable}]
                                          type: string|text|int|number|boolean|json|datetime
GET    /api/admin/config/versions      → { versions: {domain:number} }
GET    /api/admin/config/:domain       → { domain,label,columns,rows,version,readOnly }
GET    /api/admin/config/:domain/:id   → { row,version }
POST   /api/admin/config/:domain       → { row,version }
PATCH  /api/admin/config/:domain/:id   → { row,version }
DELETE /api/admin/config/:domain/:id   → { deleted:true,version,id }
```

- 统一包装 `{ok:true,data}` / `{ok:false,error:{message}}`；401 回登录页。
- GET → `requireGmSession`；写 → `requireGm('edit_config')`。
- 写操作事务内：改表 + `bumpCatalogVersion(domain)` + `insertGmAuditLog`
  （`action:'edit_config'`, `targetType:'config'`, `targetId:'<domain>:<id>'`）。
- 只碰静态定义表，**绝不碰 `player_*` 动态表**；只读域禁止写入。
- 路由顺序：`/domains`、`/versions` 必须注册在 `/:domain` 之前。
- 保留现有 `GET/PATCH /api/admin/features` 两个端点（v21 向后兼容）。

### 配置域覆盖范围（2026-11-04 主理人复核 schema.sql 后修正）

**21 张静态定义表**（可读写）：level_exp_defs、level_stats_defs、class_defs、
character_defs、equipment_defs、dungeon_defs、stage_defs、feature_toggles、quest_defs、
mail_defs、shop_pack_defs、trade_rate_defs、market_offer_defs、astrology_node_defs、
vfx_defs、skill_defs、enemy_defs、scene_defs、item_defs、activity_defs、leaderboard_defs。

**1 张半静态表（可写）**：guilds（种子写入的协会定义表）。
**3 张只读表**：catalog_meta（domain 主键，版本戳）、schema_migrations（version 主键，迁移记录）、
battle_passes（**玩家动态存档表**：player_id/day_key/used/purchased，复合主键，
`player_id REFERENCES players(id) ON DELETE CASCADE` —— 不得开放写入，仅只读展示，
防止篡改玩家战令进度）。
**1 个只读运行时域**：runtime（env 参数虚拟域，table 为空，只展示，附「需改 .env 并重启」说明）。

> 最终实现口径：**26 个域 = 22 可写 + 4 只读**（2026-11-04 质量门复核确认，
> 以 `backend/src/config/config-domains.ts` 注册表为准，列名逐表经 pragma_table_info 对账）。
> `gm_accounts`、`account_credentials` 等敏感/凭据表不开放。

### 主键与列结构要点（抄列名时勿凭印象）
- 非 `id` 主键：level_exp_defs / level_stats_defs → `level`；feature_toggles → `key`；
  catalog_meta → `domain`；schema_migrations → `version`。
- `equipment_defs.required_level` 带跨行 `CHECK (...) REFERENCES level_exp_defs(level)`，
  正则抽取时易把 `REFERENCES` 误当列名；真实为 12 列。
- 含 `updated_at` 的表：vfx_defs / skill_defs / enemy_defs / scene_defs / item_defs /
  activity_defs / leaderboard_defs —— 该列写入时应由服务端统一刷新，不作为可编辑列。
- JSON 列：stage_defs.reward_json、quest_defs.reward_json、mail_defs.reward_json、
  enemy_defs.skill_ids / drop_json / phase_json、item_defs.effect_json、
  activity_defs.config_json / reward_json —— 按 `json` 类型校验并格式化展示。

## 4. 文件域边界（防并发冲突）

| 成员 | 独占文件域 |
|------|-----------|
| `engineering-lead` | `backend/src/**`、`backend/tests/**`、`backend/package.json`、`frontend/src/**`、`frontend/index.html`、`frontend/dist/**`、`frontend/package.json`、`frontend/vite.config.ts`、`frontend/scripts/**`、`scripts/build-exe.mjs`、`docs/legacy-fixes-v22.md` |
| `design-strategist` | `backend/public/admin.html`、`docs/admin-config-ux.md` |
| `quality-lead` | `build/verify-v22.py`、`build/verify-admin-config.py`、`frontend/tests/**`、`docs/qa-report-v22.md` |
| `release-ops-lead` | `build/backup-and-clean-cloud.sh`、`build/deploy-v22.sh`、`build/rollback-v22.sh`、`docs/release-notes-v22.md` |

**禁止成员之间直连**，所有产出经主理人 `team-lead` 中转。

## 5. 阶段门控与质量门标准

- Phase 5 → 6：成员产出回传 + 主理人跨成员一致性检查（契约/路径/版本域一致）。
- Phase 6 → 7：**T-QA 质量门 PASS** 后，主理人显式发「放行」消息给 `release-ops-lead`，
  才允许云端删除与部署。未放行前只允许准备脚本。
- 质量门 PASS 标准：
  1. 核心玩法（登录 → 主界面 → 副本 → 装备 → 战斗）无回归；
  2. 配置 CRUD 全链路可用，版本自增 + 审计落库，不影响玩家存档；
  3. 前端资源内联后所有图片/字体正常显示，dev / build / APK WebView / 公网四条路径一致；
  4. 线上首页可访问，且不再依赖 `images/` `fonts/` `favicon.svg` 外链；
  5. 后端测试、smoke、双端 typecheck、前端 build 全部通过。
- 判定：`PASS` / `CONCERNS` / `FAIL`。CONCERNS/FAIL 必须先解决或由用户明确豁免。

## 6. 已知风险与缓解

| 风险 | 缓解 |
|------|------|
| 内联后单文件由 627 KB → 约 5 MB，首屏流量增加 | 用户已确认接受；复用体积更小的 webp（较 jpg 省 24%）；清理 jpg 与冗余备份抵消云端占用 |
| `.jpg` 引用需归一到 webp data URI，可能有漏网引用点 | 统一 `assetUrl()` 解析 + 全量 grep 校验 + Playwright 视觉断言 |
| 配置物理删除可能破坏外键引用 | SQLite 外键保护 + 拒绝原因回显 + 二次确认 + 事务回滚 |
| catalog 域版本与配置表不同步 | 写操作事务内 `bumpCatalogVersion(domain)`，扩展 `CATALOG_DOMAINS` 覆盖全部域 |
| 云端删除不可逆 | 先 `tar czf` 到 `backup-final/` 并校验归档可列出，再删；`rollback-v22.sh` 兜底 |
| 装备穿戴/强化/洗练仍走前端本地存档（历史架构债） | 本批次不接线，如实记录原因（涉及存档迁移，需单独批次），不隐瞒 |
| APK 内资源 | APK 仅为 WebView 壳（加载 https://940608.site/），本批次无需重打包 |
