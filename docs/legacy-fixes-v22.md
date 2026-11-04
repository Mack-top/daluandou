# v22 遗留问题梳理与修复记录（T-LEGACY / T-ASSET / T-CONFIG-API）

> 批次：v22 配置与资源治理
> 负责：程基岩（技术方向 / 主程序）
> 范围：资源迁移、配置读取与保存、后台展示与交互、构建产物
> 逐项清单：L-01 ~ L-16（16 项修复）+ R-01（1 项保留）
> 硬约束：本批次**不加表、不加迁移**（表数仍 58、迁移版本仍 21）；**不改动**
> `backend/tests/db.test.ts` 与 `backend/scripts/smoke.ts` 的表数 / 版本断言；
> **不碰云端服务器、不 SSH、不 git commit**（云端清理由主理人 / release-ops 另行执行）。

---

## 一、逐项问题清单

### L-01 图片 / 字体 / 图标仍是外链相对路径，单文件构建后 404

- **问题**：`vite-plugin-singlefile` 只内联 JS/CSS，`frontend/dist/index.html` 里图片、
  字体、`favicon.svg` 仍是 `images/*.jpg`、`fonts/*.woff2` 等相对路径；一旦脱离
  `public/` 目录单独部署（单文件 exe / APK WebView / 子路径 / 公网静态托管），
  资源全部加载失败。
- **原因**：资源以「文件路径字符串」形式散落在 `game-data.ts`（11 处）、
  `social.ts`（9 处）、`fonts.ts`（3 个 FontFace）、`index.html`（og:image / icon /
  2 个 preload），运行时统一走 `new URL(path, document.baseURI)`，没有任何内联网关。
- **处理**：新增 `frontend/scripts/inline-assets.mjs`，构建期把 11 张 `.webp`、
  3 个 `.woff2`、`favicon.svg` 读为 base64 data URI，生成
  `frontend/src/generated/assets.ts` 的 `ASSET_DATA_URIS`；统一解析入口
  `frontend/src/assets.ts` 的 `assetUrl()`（别名 `resolveAsset`）优先查表、
  未命中才回退 `document.baseURI`。`game-data.ts` / `social.ts` 的 20 处字面量
  全部改为经 `assetUrl()` 解析，**导出的数据结构与字段名保持不变**。
- **验证**：`npm --workspace frontend run build` 通过；用脚本扫描
  `frontend/dist/index.html`：`data:image/webp;base64` × 11、`data:font/woff2;base64` × 3、
  `src|href="images/` = 0、`src|href="fonts/` = 0、未替换的 `__INLINE_FAVICON__` = 0。

### L-02 jpg / webp 双份冗余，部署产物多带 4.5 MB 无用文件

- **问题**：`frontend/public/images/` 下 11 张 `.jpg`（4.5 MB，被代码引用）与
  11 张同名 `.webp`（3.4 MB，全项目零引用）并存；`fonts/` 下还有 2 个 OFL
  许可证 txt（运行时不加载）。构建会把它们整目录复制进 `dist/` 与 `release/webapp/`。
- **原因**：webp 是早先做体积优化时留下的同名副本，从未接线；`public/` 由 vite
  默认整目录复制。
- **处理**：生成器**只读** `.webp`，把 `.jpg` / `.jpeg` / `.webp` 三个逻辑键都映射到
  同一份 webp 字节（零新增画质损失）；`.jpg` 与 OFL txt 不再进入任何部署产物，
  源文件保留在 `frontend/public/` 供开发。`vite.config.ts` 设 `publicDir: false`，
  `inline-assets.mjs` 收尾 `rmSync` 清理 `dist/images`、`dist/fonts`、`dist/favicon.svg`
  （仅这三个明确路径，无通配递归删除）。
- **验证**：`frontend/dist/` 文件清单只有 `index.html`；`release/webapp` 组装逻辑改为
  显式复制 2 个 HTML，不再整目录 `cpSync`。

### L-03 同一张图的 base64 被写三遍，单文件从 5 MB 膨胀到 14 MB（本批次自纠）

- **问题**：初版生成器为 `.jpg` / `.jpeg` / `.webp` 各写一份 data URI，
  `assets.ts` 达 13.6 MB，会把单文件 `index.html` 撑到约 14 MB。
- **原因**：别名键直接复制字符串，未复用同一变量。
- **处理**：生成器改为 `IMAGE_URIS` / `FONT_URIS` / `FAVICON_URI` 各存一份字节，
  `ASSET_DATA_URIS` 在运行时用 `key.replace(/\.webp$/i, '.jpg')` 展开别名。
  生成器幂等（内容未变则不重写文件、不触碰 mtime）。
- **验证**：`assets.ts` 5,093,945 B；`frontend/dist/index.html` 5,719,677 B（约 5.5 MB，
  符合「约 5 MB」目标）；连续执行两次生成器输出一致。

### L-04 `og:image` 语义丢失 / preload 指向不存在的文件

- **问题**：上一轮改造直接删掉了 `og:image`，且原 `index.html` 的
  font / image preload 在资源内联后指向 404。
- **原因**：为避免相对路径失效而做「一刀切删除」，未保留 meta 语义。
- **处理**：`og:image` 与 `icon` 都改为内联 data URI（复用 favicon 的 SVG data URI）；
  HTML 注释明确说明「部分社交平台不解析 data URI 预览图，正式对外分享请替换为
  绝对 URL」。preload 全部移除并注明「data URI 不需要预加载」。
- **验证**：扫描构建产物确认 `og:image` 与 `icon` 均为 `data:`，无残留 preload 标签。

### L-05 GM 管理台 admin.html 出现两份副本，dev 与发布取的不是同一个文件

- **问题**：`backend/public/admin.html` 是原始权威副本；上一轮又复制到
  `frontend/public/admin.html`，并让 `app.ts` 在 dev 模式读前端副本、
  `build-exe.mjs` 从 `frontend/dist` 取，两份随时可能分叉。
- **原因**：为了把 admin.html 塞进单文件产物而移动了源文件归属，未同步收敛。
- **处理**：收敛为**唯一权威副本 `backend/public/admin.html`**：
  `backend/src/app.ts` 的 `adminDir` 恢复为「打包模式 webapp/、dev 模式 backend/public」；
  `scripts/build-exe.mjs` 第 5 步显式复制 `backend/public/admin.html` →
  `release/webapp/admin.html`；删除 `frontend/public/admin.html` 副本；
  `vite.config.ts` 不再往 `dist/` 复制 admin.html。
- **验证**：三份文件删除前 `sha256sum` 完全一致（确认是纯副本）；构建后
  `frontend/dist/` 只有 `index.html`；HTTP 集成验证 `GET /admin/features` 200。
- **给 T-ADMIN-UI 的提示**：后台界面请只改 `backend/public/admin.html`。

### L-06 `feature_toggles` 只有 enabled / openDay / closeDay 可改

- **问题**：旧 `PATCH /api/admin/features/:key` 的 zod schema 只允许 3 个字段，
  `name` / `category` / `sortIndex` / `detail` 无法在后台修改。
- **原因**：v21 端点按「开关」最小需求设计，没有通用配置模型。
- **处理**：保留旧两端点向后兼容；新建 `backend/src/config/config-domains.ts`
  把 `feature_toggles` 的 8 个非敏感列全部登记为可编辑（`key` 为只读主键），
  由 `PATCH /api/admin/config/features/:key` 提供完整编辑能力。
- **验证**：HTTP 集成验证 PATCH 同时改 `name` + `detail` + `sort_index` 成功；
  单测覆盖 CRUD 全链路。

### L-07 catalog 域版本只覆盖 7 个域，GM 改其它配置客户端感知不到

- **问题**：`catalog.service.ts` 的 `CATALOG_DOMAINS` 是硬编码的
  enemy/skill/vfx/scene/item/activity/leaderboard 7 个域；改等级表、装备表、
  商店表等不会进入 `getCatalogDelta(since)` 的 `changes`。
- **原因**：v7 增量协议只按当时存在的域手写，后续新增配置表未回填。
- **处理**：`CATALOG_DOMAINS` 改为取自注册表 `CATALOG_VERSION_DOMAINS`（所有可写
  配置域），`listDomainConfigs()` 的 default 分支由注册表兜底回传原始行，
  并在注释写明「原始 snake_case 行 / 未做 camelCase DTO」以及
  「level_exp_defs 150 行这类大表可只消费 `versions` 变化通知」。
  `getCatalogDelta` 增加保护：`known === undefined && current === 0` 的域不进
  `changes`，避免首次带 `since` 就把 150 行大表全量塞回响应；`versions` 始终全量返回。
- **验证**：单测「配置写入可通过 delta 的 versions 感知」；`getCatalog()` 15 个既有
  字段全部保留（回归断言）。

### L-08 配置保存后无版本反馈，后台不知道改动是否生效

- **问题**：旧开关端点不返回 catalog 版本号；通用 CRUD 之前也不存在，
  GM 保存后界面无法确认「是否生效 / 版本号是多少」。
- **原因**：写操作没有统一返回契约。
- **处理**：所有写操作返回 `{ row, domain, version, versionBefore }`，删除返回
  `{ deleted:true, id, domain, version, versionBefore }`；`GET /config/versions`
  与 `POST /config/publish` 提供版本查询与一键发布；服务层注释明确
  「配置值写库即生效，客户端下次启动拉取 catalog 即生效」。
- **验证**：单测断言 create/update/delete 版本逐次 +1；HTTP 集成验证 POST 返回 201
  且带 `domain` / `version`；DELETE 带 `deleted:true` / `id`。

### L-09 配置删除无外键保护，可能制造孤儿数据

- **问题**：物理删除被 `character_defs` / `equipment_defs` / `battles` 等引用的
  配置行会破坏现有玩法与玩家资产。
- **原因**：旧后台没有 DELETE 能力，也就没有引用检查。
- **处理**：`admin-config.service.ts` 删除前遍历 `PRAGMA foreign_key_list` 找出所有
  引用表与条数，命中即 400 拒绝并给出「哪张表引用了几条」的可读原因；同时在
  事务内捕获 `SQLITE_CONSTRAINT` / `FOREIGN KEY constraint failed` 作为兜底，
  翻译成中文 400。删除成功也返回明确反馈。
- **验证**：单测覆盖 `class_defs`（被 `character_defs` 引用）与 `level_exp_defs`
  （被 `level_stats_defs` / `equipment_defs` 引用）均被拒绝且版本不变；
  HTTP 集成验证返回 `无法删除：该配置已被 character_defs(1 条) 引用…`；
  未被引用的新建开关可正常删除。

### L-10 未声明列被静默忽略，存在越权改列 / 注入面

- **问题**：初版服务按注册表列遍历 input，多余键直接丢弃，既不报错也难以发现。
- **原因**：只做了「白名单取值」，没做「白名单拒收」。
- **处理**：新增 `rejectUnknownColumns()`，任何未声明列一律 400 并列出列名；
  SQL 的表名 / 列名 / ORDER BY 全部来自注册表常量且二次校验（排序字段必须是
  白名单列），值一律参数绑定；约束错误统一翻译成 400 中文消息，不暴露堆栈。
- **验证**：单测「白名单防注入」断言注入式列名与值都不会破坏 `players` 表；
  HTTP 集成验证 `injected_column` 被 400 拒绝。

### L-11 运行时参数（env）被当作「配置表」，后台无从查看

- **问题**：`serverOpenDate` / `port` / `host` / `serversMaintenance` /
  `serverBusyThreshold` / `sessionTtlHours` 等来自 `backend/src/config/env.ts`，
  不是 DB 配置；旧后台既不展示，也无法说明「为什么改不动」。
- **原因**：配置模型只覆盖 `*_defs` 表，运行时参数没有归属。
- **处理**：注册表新增只读虚拟域 `runtime`（`table: ''`，服务层从 env 组装 11 项），
  描述明确写「只读展示；修改需编辑 .env 并重启服务，不会由后台写库」；
  `GET /api/admin/config/runtime` 与 `GET /api/admin/config/:domain`（domain=runtime）
  均可读，写入返回带 `.env` 提示的 400。
- **验证**：单测「只读域拒绝增改删」；HTTP 集成验证 runtime 只读写入被拒。

### L-12 `battle_passes` 被误列为「静态配置表」

- **问题**：`battle_passes` 主键是 `(player_id, day_key)`，存的是**玩家每日挑战次数**
  （`used` / `purchased`），属于玩家动态数据；若按静态配置开放增删改会绕过服务端
  权威计数。
- **原因**：审计时按 `CREATE TABLE` 行号归堆，未区分表语义。
- **处理**：注册表登记为 `battle_passes` **只读域**（列清单逐字抄自 schema.sql：
  `player_id` / `day_key` / `used` / `purchased`），描述写明「玩家动态数据而非静态
  配置，禁止 GM 直接增改删」；`catalog_meta` 与 `schema_migrations` 同样标只读。
  `gm_accounts` 等敏感表不开放。
- **验证**：单测断言 4 个只读域标记正确、敏感表不在 `CONFIG_TABLES` 中；
  逐表用 `pragma_table_info` 对账所有域的列清单（精确相等，防止凭印象写列名）。

### L-13 前端 catalog 只在启动时拉一次，配置变更要刷新页面才生效

- **问题**：`use-game.ts` 启动时 `fetchCatalog()` 一次，GM 保存配置后客户端
  长时间不感知。
- **原因**：没有版本比对与重拉触发点。
- **处理**：`frontend/src/api/catalog.ts` 记录每次响应的 `versions`，新增
  `refreshCatalog()`（带上一次版本戳，走 `/api/catalog?since=`），
  `frontend/src/main.tsx` 在 `visibilitychange` 且页面重新可见时以 30s 节流重拉。
  改动很小：启动拉取与离线兜底路径完全不变，失败时 `applyCatalog` 不执行。
  `backend/src/routes/catalog.routes.ts` 顺带修掉 `JSON.parse(raw)` 未捕获导致
  非法 `since` 把公开 catalog 端点打成 500 的问题。
- **验证**：`npm --workspace frontend run typecheck` / `build` 通过；
  全量后端测试通过。

### L-14 构建脚本残留「含图片」表述与目录体积统计错误

- **问题**：`scripts/build-exe.mjs` 控制台输出 `webapp/ (…/含图片)`，与
  「资源已内联、webapp 只有 2 个 HTML」矛盾；且 `statSync(目录)` 返回的是目录项
  大小，不是目录体积。
- **原因**：历史文案与统计工具未随资源迁移更新。
- **处理**：第 5 步改为显式复制 `index.html` + `admin.html`（不再整目录 `cpSync`）；
  删除「含图片」字样，说明改为「资源已内联」；新增递归 `dirSize()` 正确统计体积；
  `release/游戏说明.txt` 与构建脚本生成的说明同步更新。
- **验证**：`node --check scripts/build-exe.mjs` 语法通过；文案 grep 无「含图片」。

### L-15 后台 catalog 下发的 `images/*.jpg` 字符串与资源内联的关系

- **问题**：`backend/src/db/seed.ts` 的 `scene_defs.background`、
  `character_defs.portrait`、`enemy_defs.portrait`、`vfx_defs.asset_path` 仍存
  `images/*.jpg` 字符串，需确认前端不会因内联而报错。
- **原因**：这些是配置表数据，由 catalog / delta 下发。
- **处理**：**保持原样**（不改 seed、不加迁移，避免动 58 表 / v21 版本断言）。
  全量 grep 前端 `portrait` / `background` / `assetPath` 消费点，确认目前**没有任何
  消费点**（`Battle.tsx` 的 `character.image` 来自 `social.ts`，已走 `assetUrl`）。
  在 `frontend/src/assets.ts` 导出语义化别名 `resolveAsset`，并注明「后台配置下发的
  portrait / background / assetPath 后续若接线，必须走同一入口」；
  `assetUrl` 对 `data:` / `http(s)` / `blob:` 原样返回，对未内联路径回退相对解析，
  因此即使将来下发自定义外链也不会报错。
- **验证**：前端 grep 无 catalog 图片字段消费点；`resolveAsset` 与 `assetUrl` 同函数。

### L-16 后端列 DTO 与 T-ADMIN-UI 界面约定的类型词 / 字段语义不一致（跨成员联调）

- **问题**：后台管理页 `backend/public/admin.html` 的 `renderFields()` / `collectForm()`
  按 `c.type === 'int' | 'number'` 渲染数字输入并做前端整数校验，按 `'text'` 渲染
  textarea；而注册表内部用 `'integer'` / `'string'`，导致整数字段退化成普通文本框。
  另外界面把 `c.editable === false` 解读为「后端生成、可留空」，若把主键标成
  `editable:false`，新建时会跳过主键必填校验，而服务端实际要求主键必填。
- **原因**：注册表内部类型词与界面 DTO 类型词是两套词汇；`editable` 的语义
  （「能否改值」vs「表单是否接受输入」）两侧理解不同。
- **处理**：在 `columnDto()` 增加 `uiColumnType()` 映射（`integer → int`），DTO 用
  `type` 表达界面词汇、另加 `storageType` 保留 zod 校验口径；`editable` 明确定义为
  「表单是否接受用户输入」——只有 `autoNow` 自动时间戳为 false，主键在新建时
  为 true（编辑时由界面按 `isPk` 自行锁定）。同时把 `runtime` 域的 `group` 改为
  「运行时参数」，使界面的 `readOnlyReason()` 能给出针对性提示。
  **未改动 T-ADMIN-UI 成员的 `backend/public/admin.html`**，全部在后端 DTO 层对齐。
- **验证**：`npm --workspace backend run typecheck` / 182 项测试通过；抽样输出
  `features` 域列 DTO：`open_day → type=int / storageType=integer / nullable=true / editable=true`，
  主键 `key → editable=true`；界面 `api()` 解包 `{ok:true,data}` 与
  `{ok:false,error:{message}}` 的口径、PATCH/POST/DELETE 方法、`data.columns/rows/version/label/readOnly`、
  `meta.primaryKey` 全部与后端一致。

---

## 二、明确保留、不在本批次处理的历史债

### R-01 装备穿戴 / 强化 / 洗练动作仍走前端本地存档口径

- **现状**：`frontend/src/equipment.ts` 等处的穿戴、强化、洗练仍以本地存档为准；
  服务端权威接口（`player_equipment` 表、`substat_key` / `substat_value` /
  `wash_count` 列、`save-sync` 服务）已备好但未接线。
- **结论**：**保留，不改动。**
- **原因**：涉及存档迁移与前后端口径切换（历史存档中装备实例 id、强化等级、
  洗练次数、乐观锁版本的对齐与回滚方案），风险高于本批次范围，需单独批次
  立项：先定义迁移与灰度策略、再补端到端回归用例、最后切流。
- **本批次动作**：仅在本文如实标注，**没有偷偷改任何装备链路代码**；
  也未改动 `backend/tests/equipment.test.ts`、`save-sync.test.ts` 等既有测试。

---

## 三、验证记录

| 命令 | 结果 |
| --- | --- |
| `npm --workspace backend run typecheck` | 通过 |
| `npm --workspace frontend run typecheck` | 通过 |
| `npm --workspace frontend run build` | 通过；`dist/index.html` 5,719,677 B |
| `frontend/dist/` 文件清单 | 仅 `index.html`（无 images/ fonts/ favicon.svg / admin.html） |
| `node frontend/scripts/inline-assets.mjs` × 2 | 幂等，两次输出一致，37 个键 / 4.86 MB |
| `npm --workspace backend run test` | **182 / 182 通过**（含新增 11 条 `admin-config.test.ts`） |
| `npm --workspace backend run smoke` | 74 项断言全部通过（表数 58 / 迁移 v21 断言保持） |
| 配置 API HTTP 集成验证（临时脚本，已删除） | 18 项契约检查全部 PASS：7 个端点、PATCH/PUT、只读拒绝、白名单、外键保护、旧 features 端点兼容 |
| `backend/tests/db.test.ts` / `backend/scripts/smoke.ts` | **未改动** |

---

## 四、已知风险与待主理人决策

1. **og:image 使用 data URI**：部分社交平台不解析内联预览图。若项目需要对外分享
   卡片，请在部署时替换为可公开访问的绝对 URL（已在 `frontend/index.html` 注释说明）。
2. **`getCatalog()` 仍是全量下发**：`?since=` 目前只在响应里附带 `changes`，
   不减少全量 payload。大表（如 `level_exp_defs` 150 行）建议客户端只消费
   `versions` 变化通知。是否改为真正按需分片下发，属于后续优化。
3. **旧 `PATCH /api/admin/features/:key` 仍只支持 3 个字段**：为向后兼容保留；
   新后台界面应统一使用 `/api/admin/config/features/:key`。
4. **`runtime` 为只读虚拟域**：`GET /config/:domain/:id` 对 runtime 以 `key` 定位，
   与物理表域以主键定位的语义略有差异，已在域描述中说明。
5. **云端 `webapp/` 历史 images/ fonts/ 与两份 backup 目录**：本批次按分工**未触碰**，
   由主理人 / release-ops 在产物重建后执行清理。
6. **`frontend/public/` 下 11 张 jpg 与 2 个 OFL txt 仍保留为开发源文件**：
   不会被复制进 dist / release；若要彻底瘦身仓库，可另行批次删除。
