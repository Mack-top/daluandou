# 食灵月城 · 灵界幻想（前后端分离版）

幻想题材游戏项目，采用 **frontend / backend 双目录分离** 的 monorepo 结构：

- **frontend**：React 19 + TypeScript + Vite 7 + Tailwind CSS 4，含 30 个可直达界面与本地战斗回放
- **backend**：Express 5 + TypeScript，四层架构（路由 → 服务 → 仓储 → 数据库），服务端权威计算
- **database**：SQLite（Node.js 内置 `node:sqlite` 驱动），声明式表结构 + 版本化迁移 + 种子数据

## 目录结构

```
.
├── frontend/                 # 前端工程（原项目代码整体迁入）
│   ├── index.html
│   ├── src/                  # 界面、游戏逻辑、样式
│   ├── public/               # 插画、字体、图标
│   ├── tests/                # Playwright 端到端测试（11 个用例）
│   ├── vite.config.ts        # 含 /api 代理到后端
│   └── README.md             # 前端原有的设计说明
├── backend/                  # 后端服务
│   ├── src/
│   │   ├── config/env.ts     # 配置加载（.env、端口、CORS、库路径）
│   │   ├── db/               # 连接、schema.sql、迁移、种子、重置
│   │   ├── repositories/     # 仓储层：唯一出现 SQL 的地方
│   │   ├── services/         # 业务逻辑层：规则、事务、数值计算
│   │   ├── routes/           # 路由层：仅做参数校验与编排
│   │   ├── middleware/       # 鉴权、错误处理
│   │   ├── domain/           # 领域类型与数值公式
│   │   ├── app.ts            # Express 应用装配
│   │   └── server.ts         # 启动入口（含优雅关闭）
│   ├── scripts/smoke.ts      # 端到端冒烟测试（50 项断言）
│   ├── tests/                # 单元测试（node:test）
│   └── data/game.db          # SQLite 数据文件（不入库）
└── package.json              # 工作区根配置与统一脚本
```

## 快速开始

```bash
# 1. 安装全部依赖（npm workspaces 统一安装）
npm install

# 2. 初始化数据库（删除旧库 → 迁移 → 种子数据）
npm run db:reset

# 3. 同时启动前后端
npm run dev
#    前端 http://127.0.0.1:5173
#    后端 http://127.0.0.1:8787/api

# 4. 验证
npm run smoke    # 端到端：真实 HTTP 调用 + 回查数据库对账
npm test         # 单元测试：战斗确定性、账本不变式
```

## 脚本一览

| 命令 | 作用 |
| --- | --- |
| `npm run dev` | 并行启动后端（tsx watch）与前端（vite） |
| `npm run dev:api` / `npm run dev:web` | 单独启动后端 / 前端 |
| `npm run build` | 先编译后端到 `dist`，再构建前端 |
| `npm start` | 运行编译后的后端 |
| `npm run db:migrate` | 执行增量迁移（幂等） |
| `npm run db:seed` | 写入静态配置数据（可重复执行） |
| `npm run db:reset` | 重建数据库（仅开发环境） |
| `npm run smoke` | 端到端冒烟测试（服务自启动，50 项断言） |
| `npm run live-check` | 跨服务联调（需前后端已运行，39 项断言，经 Vite 代理） |
| `npm test` | 后端单元测试（战斗、数据库 CRUD、装备链路） |
| `npm run typecheck` | 前后端类型检查 |

## 后端分层约定

| 层 | 目录 | 职责 | 禁止 |
| --- | --- | --- | --- |
| 路由 | `routes/` | 解析请求、校验参数、调用服务、包装响应 | 写 SQL、写业务规则 |
| 服务 | `services/` | 业务规则、事务边界、数值计算 | 写 SQL |
| 仓储 | `repositories/` | 数据读写、行 ↔ 领域对象映射 | 做业务判断 |
| 数据库 | `db/` | 连接、PRAGMA、迁移、事务封装 | 承载业务语义 |

三条硬性约束：

1. **所有资源增减必须走 `applyResourceDelta`** —— 校验余额、更新余额、写流水在同一个事务内完成，杜绝"扣了钱没记账"。
2. **事务写在服务层** —— 一次业务操作（如兑换）涉及多处写入时，在服务层用 `transaction()` 包裹，仓储层保持无状态。
3. **服务端权威** —— 战力、奖励、任务进度全部由服务端计算，客户端只负责展示，不信任前端上报的数值。

## 数据库设计

32 张表，按职责分为「静态配置」与「玩家动态」两类：

**账号与资源**
`players`、`player_sessions`（只存令牌 SHA-256 摘要）、`player_resources`、`resource_ledger`（资源流水，可对账）、`player_progress`、`player_daily_state`（按自然日分键）、`player_save_documents`（云端存档文档，乐观锁版本控制）

**养成**
`character_defs`、`player_characters`、`player_formation`、`equipment_defs`、`player_equipment`、`astrology_node_defs`、`player_astrology`

**战斗**
`stage_defs`、`battles`、`battle_turns`（逐回合逐出手落库，支持完整回放）

**经济**
`quest_defs`、`player_quest_claims`、`mail_defs`、`player_mail`、`shop_pack_defs`、`player_purchases`、`trade_rate_defs`、`player_trade_usage`、`market_offer_defs`、`player_market_purchases`

**社交**
`guilds`、`guild_members`、`friendships`、`chat_messages`

设计要点：

- 时间统一为 ISO-8601 UTC 文本；布尔用 `0/1`；金额全整数
- 关键约束落在库上：余额 `CHECK >= 0`、同一槽位只装备一件（部分唯一索引）、同一关卡只允许一场未结算战斗（部分唯一索引）
- 静态配置表用 `ON CONFLICT DO UPDATE` 幂等写入，**不用** `INSERT OR REPLACE`（那是先删后插，会触发外键级联）
- 日活数据按 `day_key` 分表存储，跨日只需写新键，无需批量回写

## 接口一览

基础路径 `/api`，除健康检查与登录外均需 `Authorization: Bearer <token>`。

| 方法 | 路径 | 说明 |
| --- | --- | --- |
| GET | `/health` | 健康检查（含真实数据库查询结果） |
| POST | `/auth/guest` | 游客登录，返回令牌 + 完整存档 |
| GET | `/auth/me` | 当前玩家与存档 |
| POST | `/auth/logout` | 吊销当前会话 |
| GET | `/catalog` | 全量静态配置 |
| GET | `/catalog/market` | 今日集市货架 |
| GET | `/game/state` | 读取存档 |
| GET | `/game/state/document` | 读取云端存档文档（无档返回 version 0） |
| PUT | `/game/state/document` | 上传存档文档（服务端清洗 + 乐观锁，冲突 409） |
| POST | `/game/trade/:rateId` | 资源兑换 |
| POST | `/game/craft` | 炼制经验药剂 |
| POST | `/game/market/buy` | 购买集市商品 |
| POST | `/game/worldtree/upgrade` | 升级世界树 |
| POST | `/game/idle/claim` | 领取离线收益 |
| POST | `/game/shop/purchase` | 购买礼包（演示，无真实支付） |
| POST | `/game/characters/:name/ascend` | 食灵升星 |
| PUT | `/game/formation` | 设置出战阵容 |
| POST | `/game/equipment/starter` | 领取新手装备宝箱 |
| POST | `/game/equipment/chest/open` | 开启宝箱（操作号幂等、种子可复现） |
| POST | `/game/equipment/equip` | 装备 |
| POST | `/game/equipment/unequip` | 卸下指定槽位装备 |
| POST | `/game/astrology/unlock` | 解锁星象 |
| GET | `/game/quests` | 任务列表（含服务端进度） |
| POST | `/game/quests/:questId/claim` | 领取任务奖励 |
| GET | `/game/mail` | 邮件列表 |
| POST | `/game/mail/:mailId/claim` | 领取附件 |
| POST | `/battles` | 开战（服务端生成种子） |
| POST | `/battles/:id/settle` | 结算（种子重算，可复现） |
| GET | `/battles/:id` | 战斗详情与回放 |
| GET | `/social/guilds` | 协会列表 |
| POST | `/social/guilds/:id/join` | 加入协会 |
| POST | `/social/guilds/checkin` | 每日签到 |
| GET/POST/DELETE | `/social/friends*` | 好友申请、接受、删除 |
| GET/POST | `/social/chat` | 世界 / 协会频道 |

写操作统一返回最新 `save`，客户端无需自行推算余额，避免状态漂移。

## 账号身份与数据隔离（无注册/登录界面）

身份是**静默建立**的：打开页面即自动拥有一个独立账号，全程无任何注册或登录操作。

**账号标识如何获取**

1. 首次访问时，前端调用 `POST /api/auth/guest`，服务端创建游客账号（`players.id`，UUID）并签发随机会话令牌；
2. 前端把 `{accountId, token}` 存入 localStorage（`food-fantasy.identity.v1`），此后每次访问自动复用，用户无感知；
3. 令牌过期或被吊销时，前端自动丢弃旧身份并重建新账号；后端不可用时静默降级，游戏继续本地运行。

**账号标识如何使用**

- `accountId` 是服务端一切数据的归属键；`token` 是访问凭据，数据库只保存其 SHA-256 摘要（`player_sessions.token_hash`），明文令牌不落库；
- 所有业务接口都要求 `Authorization: Bearer <token>`，服务端通过 `requireAuth` 中间件从令牌解析出操作者（`req.player`）；
- **请求参数无法指定"以谁的身份"操作**——路由层审计确认 `playerId` 只出现在好友申请/接受两处，且语义是"目标玩家"，操作者一律取自令牌。

**隔离如何保证**

- 存储：玩家数据全部挂 `player_id` 外键（资源、进度、装备、战斗、任务、社交…），删除账号级联清理；
- 读取：存档视图 `buildSave(playerId)` 只聚合本人数据；战斗结算/回放校验归属，他人访问返回 403；
- 写入：资源变更走 `applyResourceDelta`（带账本流水），养成操作校验"是否拥有"（不能借别人的食灵组阵容）；
- 防护：游客接口限流（30 次/分钟）、令牌过期清理、登录时清理过期会话、昵称冲突 409；
- 以上边界由 `backend/tests/isolation.test.ts`（跨账号 403、参数伪装无效、401、限流 429）与 `frontend/tests/identity.spec.ts`（不同浏览器上下文不同账号、刷新身份稳定、令牌篡改自动重建）持续验证。

## 配置

复制 `backend/.env.example` 为 `backend/.env`（仓库已自带一份开发配置）：

| 变量 | 默认值 | 说明 |
| --- | --- | --- |
| `PORT` | `8787` | 后端端口 |
| `HOST` | `127.0.0.1` | 监听地址 |
| `DATABASE_PATH` | `./data/game.db` | SQLite 文件路径，相对 `backend/` |
| `CORS_ORIGIN` | `http://127.0.0.1:5173,...` | 允许的来源，逗号分隔 |
| `SESSION_TTL_HOURS` | `720` | 令牌有效期 |

前端通过 Vite 代理访问后端（`frontend/vite.config.ts` 的 `server.proxy`），前端代码里只写同源 `/api/...` 即可；需要指向其他后端地址时设置环境变量 `VITE_API_TARGET`。

## 云端存档同步（多端一致）

存档文档整体存于 `player_save_documents`（`player_id` 主键 + 版本号乐观锁）：

- **迁移**：身份就绪后首轮同步，云端无档则上传本地存档（版本从 1 开始），有档则拉回覆盖本地；
- **回写**：本地每次变更防抖 1.5s 携带版本号 PUT；冲突（409，另一台设备先写入）时放弃本地、采用云端文档；
- **清洗**：服务端白名单校验（`domain/save-document.ts`），未知字段丢弃、非法引用（装备模板/食灵/星级越界）剔除，单文档上限 128KB；
- **降级**：无身份（离线/自动化测试环境）时完全不启动同步，保持纯 localStorage 行为；
- 浏览器层验证见 `frontend/tests/save-sync.spec.ts`（自动迁移、云端权威覆盖本地篡改、双账号互不可见）。

## 后续可继续的方向

- 礼包购买接入真实支付：改为「下单 → 支付回调验签 → 发放」的异步流程
- 数据量增长后，仓储层可平移至 PostgreSQL（SQL 已集中在仓储层，改动面可控）
- 战斗公式目前为服务端简化推演，若要与前端逐帧一致，可将前端 `battle-engine.ts` 的胜负规则移植到 `services/battle.service.ts`

### 支付上线注意事项

当前支付网关仍是模拟实现：生产环境禁用模拟支付和直接发放付费礼包，真实支付功能必须先接入并验证网关。生产启动要求 `PAYMENT_SECRET` 为至少 32 字符的随机密钥，且不能使用示例值。

限购礼包的待支付订单会持续占用名额（包括跨日），支付失败后释放。当前没有自动关闭网关订单的实现；**不要仅凭本地超时释放名额**。接入真实网关时，应先确认订单已关闭且不会再产生付款，再原子地将订单置为关闭状态并释放名额，并处理迟到回调及退款对账。
