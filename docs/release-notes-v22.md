# 食灵月城 · v22 发布说明与上线清单

> 状态：**准备阶段（Pre-deploy）** —— 本文档在质量门 PASS / 主理人放行前不定稿。
> 负责人：路远行（release-ops-lead）· 最后更新：2026-11-04 16:38 CST（数据为实测）

---

## 一、v22 变更内容（面向内部的变更日志）

### 1. 前端资源自包含（单文件）
- 11 张场景图（优先取 `.webp` 优化版）、5 个字体文件、`favicon.svg` 全部在构建期
  由 `frontend/scripts/gen-assets.mjs` 内联为 data URI，随 `vite-plugin-singlefile`
  打进单个 `index.html`（实测约 **5.7 MB**）。
- `frontend/dist/` 构建后只剩 `index.html`（+ GM 台 `admin.html`，由 vite 插件复制），
  不再输出 `images/`、`fonts/`、`favicon.svg`。
- `release/webapp/` 同步收敛为 `index.html + admin.html` 两个文件（由
  `scripts/build-exe.mjs` 第 5 步先清空再复制）。

### 2. 云端资源清理（已获用户批准，删除前先打包备份）
- 删除：`webapp/images/`（22 文件）、`webapp/fonts/`（5 文件）、`webapp/favicon.svg`、
  两个历史备份 `backup-20261104-1220/`（3.2M）、`backup-20261104-1347/`（2.0M）。
- 删除前打包至 `/home/ubuntu/meishi/backup-final/pre-v22-<ts>.tar.gz`，
  **tar 非空且 `tar tzf` 可列条目校验通过才允许删除**。
- 保留：`webapp/index.html`、`backend/public/admin.html`（并新增 `webapp/admin.html`，见风险 R3）、
  `backend/dist/server.cjs`、`backend/dist/schema.sql`、`data/game.db`（存档，绝不触碰）。

### 3. 后台全配置通用 CRUD（工程侧交付）
- GM 台新增「配置管理」页：对全部配置域提供查看 / 新增 / 修改 / 删除。
- 配置删除语义：**物理删除 + 外键保护**（被引用的配置拒绝删除，由工程侧实现）。
- 后端测试基线：182/182 通过（quality-lead 复核中）。

### 4. 遗留修复
- BUG-02（runtime 域路由遮蔽，Major）：工程侧修复中，落地后此处补充修复描述与回归结论。
- 其余遗留修复项：待 quality-lead 回归报告定稿后补录。

### 5. 本地打包产物
- `release/MeiShiServer.exe`（Node SEA 单文件服，含内嵌 schema.sql，双击即玩）。
- `release/webapp/`：`index.html + admin.html`（旧版残留的 images/fonts/favicon
  会在重建时被 `build-exe.mjs` 自动清空，**不得直接上传当前本地 release/**）。

---

## 二、版本号（已拍板）

**定稿：v22 批次 · 对外版本 `v1.1.0`**（主理人已采纳建议）。
- **不改** `package.json` / 代码内版本常量（避免无谓 diff）；`游戏说明.txt` 如有版本字样只改文档性文字。
- 语义：`v1.1.0 = 资源自包含 + 全配置 CRUD`，回滚即回 v1.0.0 态；APK 壳不改包（仍为 v1.0.0 文件名，仅 WebView 壳，可接受）。

---

## 三、部署前基线（2026-11-04 16:20~16:35 CST 实测，只读 SSH 采集）

### 服务器状态
| 项目 | 实测值 |
|---|---|
| 主机 | `VM-0-2-ubuntu`（193.112.28.143），node v22.23.3 |
| 服务 | `systemctl is-active meishi` → **active (running)**，pid 815490，13:48:28 CST 启动 |
| 健康检查 | `{"ok":true,...,"database":{"connected":true,...,"tables":58,"migrations":21,"players":6}}` |
| 总占用 | `/home/ubuntu/meishi` → **17M** |

### 目录占用
| 目录 | 大小 |
|---|---|
| backend/dist | 1.4M |
| backend/public | 32K |
| webapp | 8.9M |
| data（存档） | 736K |
| backup-20261104-1220 | 3.2M |
| backup-20261104-1347 | 2.0M |

### 关键文件（含 md5，供部署后比对；v22 重建后新增行加粗）
| 文件 | 大小 | md5 |
|---|---|---|
| backend/dist/server.cjs（v21，与本地 build/exe/server.cjs **完全一致**） | 1,367,282 B | `4bb97fa98a97524b548dd7c70aae0e67` |
| backend/dist/schema.sql（与本地 backend/dist/db/schema.sql **完全一致**） | 43,789 B | `c8878bbc8bb0bb67b3baefb4e642254a` |
| backend/public/admin.html（云端，旧版 GM 台） | 26,351 B | `3a31670a05f1803126347f72443e141d` |
| webapp/index.html（v21） | 627,056 B | `83e47a6efa72549ce9e8587bc48cf2c6` |
| **本地 build/exe/server.cjs（v22，待部署）** | **1,408,972 B** | **`4aa7854f87e4b5e83fdb94e78b279f04`** |
| **本地 frontend/dist/index.html（v22，待部署）** | **5,720,168 B** | 见部署后远端 stat 比对 |
| **本地 backend/public/admin.html（v22，待部署）** | **57,064 B** | 见部署后远端 stat 比对 |
| **release/MeiShiServer.exe（v22）** | **88,930,816 B** | —（SEA 产物，仅本地分发用，不上云） |

> 注：本地 `backend/public/admin.html` 已更新为 **57,064 B**（新版含配置管理页），
> 与云端不同属预期；部署后以本地构建产物为准。

### webapp 文件清单（清理前，29 个文件）
- `index.html`（627,056 B）、`favicon.svg`
- `fonts/`：cinzel.woff2、realm-serif.woff2、realm-serif-extension.woff2、OFL-Cinzel.txt、OFL-NotoSerifSC.txt
- `images/`：11 组 jpg + webp（azure-witch / crimson-feast / food-god-chronicle / golden-contract /
  moonbridge-battle / moonlit-sanctuary(-mobile) / night-market / royal-curry / star-ascension / verdant-realm）

### 服务行为实测（v21 现状）
- `/` → 200（627,056 B）；`/admin/` → 200（26,351 B，来自 `backend/public/`）
- `/favicon.svg`、`/images/night-market.webp` → 200（清理后将由 index.html 内联，404 属预期）
- 经 nginx（https，Host: 940608.site）健康检查与首页均正常

### ⚠️ 公网可达性异常（重要发现）
实测公网访问 `https://940608.site/` 当前被 **腾讯云 ICP 备案拦截页** 接管：
- `http://940608.site/api/health` → 302 → `https://dnspod.qcloud.com/static/webblock.html?d=940608.site`
- `https://940608.site/` → TLS 握手失败（schannel: failed to receive handshake）
- **绕过 DNS 直连 IP（193.112.28.143）+ Host 头同样 302 到拦截页** → 拦截发生在腾讯云
  网络/备案系统侧，不是本机 DNS 或代理问题。
- 服务器本身健康：SSH 内 `curl 127.0.0.1:8787` 全部正常。

> 影响：**域名侧公网验收在备案解除前无法完成**，与本批次部署无关，但会阻塞
> 「公网验收 34/34」这一质量门条件。建议：① 立即在腾讯云控制台核实备案状态并提交/续展备案；
> ② 云端验收改经 SSH 在服务器本机（127.0.0.1 / 内网）完成，公网项标记为「待备案解除后补测」。
> 此问题需主理人上报用户决策。

---

## 四、上线执行清单（checklist）

### 阶段 A · 放行前（本轮，✅ 已完成/待完成标注）
- [x] 三个脚本就位并通过 `bash -n`：`build/backup-and-clean-cloud.sh`、`build/deploy-v22.sh`、`build/rollback-v22.sh`
- [x] 部署脚本 `--dry-run` 通过（本地产物校验 + SSH 连通）
- [x] 部署前基线实测并记录（本文件第三节）
- [x] APK 结论确认（见第五节，无需重打包）
- [ ] 工程侧 BUG-02 修复落地（等待主理人通知）
- [ ] 质量门 PASS（quality-lead 升级 CONCERNS → PASS）
- [ ] 主理人明确「放行部署」消息

### 阶段 B · 本地重建（✅ 已完成，2026-11-04 16:48 CST）
- [x] `npm run build`（root）→ 退出码 0；frontend/dist 仅 index.html，**5,720,168 B**
- [x] `node scripts/build-exe.mjs` → 退出码 0；`Injection done!` 出现
      （`The signature seems corrupted!` 警告出现，非阻断）
- [x] `frontend/dist/` 只有 `index.html`（5,720,168 B，含内联资源）
- [x] `release/webapp/` 只剩 2 文件：`index.html` 5,720,168 B + `admin.html` 57,064 B（新版 GM 台）
- [x] `build/exe/server.cjs` 重新生成：1,408,972 B，md5 `4aa7854f87e4b5e83fdb94e78b279f04`
      （≠ v21 的 `4bb97f...`，含 BUG-02/03 修复）；schema.sql 未变（`c8878b...`）
- [x] `release/MeiShiServer.exe` = **88,930,816 B（84.8 MB）**；游戏说明.txt 已更新（含资源内联说明）
- [x] 部署工件冒烟（云端同构布局：server.cjs + schema.sql 平铺并排，独立端口 8790 + 临时库）：
      boot 正常、health ok、tables=58、migrations=21；临时文件已清理，未触碰任何现有存档
- [x] 版本号 v1.1.0 标注确认（仅文档）；db 快照步骤确认已在 backup-and-clean-cloud.sh

> ⚠ 重建期发现（部署工件耦合）：`server.cjs` 非 SEA 模式从**包同目录**读取 `schema.sql`
> （SEA 模式则读内嵌 asset）。云端平铺布局（backend/dist/ 下两者并排）天然满足，
> deploy-v22.sh 的 schema.sql 目标路径（backend/dist/schema.sql）正确，请勿改为 db/ 子目录。

### 阶段 C · 云端清理（✅ 已完成，2026-11-04 16:53 CST，退出码 0）
- [x] `backup-and-clean-cloud.sh` 执行成功（时间戳 20261104-165312）
- [x] tar 备份校验通过：`backup-final/pre-v22-20261104-165312.tar.gz`，**40 个条目 / 9.6M**
- [x] db 快照校验通过：`backup-final/game-db-pre-v22-20261104-165312.db`，**704,512 字节，quick_check=ok**
- [x] 5 个路径全部删除成功（webapp/images、webapp/fonts、webapp/favicon.svg、两个历史 backup）
- [x] 核对：`find webapp -type f` 只剩 `index.html`；`du -sh` **13M**（含新增 backup-final ≈10.3M，与 17M − 资源/旧备份 + 新备份吻合）

### 阶段 D · 云端部署（✅ 已完成，2026-11-04 16:53 CST，退出码 0）
- [x] `deploy-v22.sh` 执行成功（部署备份目录 `backup-v22-20261104-165321`：v21 四文件已留存）
- [x] scp×5 上传后远端字节数全部正确；md5 比对：server.cjs `4aa7854f...`、schema.sql `c8878b...`、admin.html 双份均 `e11c627...`（与本地一致）
- [x] restart 后第 1 次轮询 health 即通过；`systemctl is-active meishi` → **active**
- [x] 双口径验收（16:55 CST 实测）：直连 Node（/ 与 /admin/ 均 200，5,720,168 B / 57,064 B，health ok players=6）；nginx 回环 https 同结果
- [x] 新配置路由挂载证明：`/api/admin/config/domains`、`/api/admin/config/versions` 未认证均返回 **401**
- [x] 数据库存档完好：players=6、tables=58、migrations=21；journal 启动日志无错误

### 阶段 E · 验收与收尾
- [ ] quality-lead 云端验收 34/34（**经服务器本机双口径**，阶段 D 实测已预录全部 PASS；公网项按下条单独记账）
- [ ] 公网可达性 → **EXTERNAL-BLOCKED**（不算 FAIL 不算 PASS；部署后 16:55 复测：http 层间歇 200/302 不稳定，https 握手仍失败 → 维持风险 8 口径，
      等用户解除 ICP 备案拦截后由 QA 补测）
- [ ] 用户确认上线效果
- [ ] 观察期：部署后 24h 内关注 `journalctl -u meishi` 错误日志

---

## 五、APK 结论：无需重新打包

`release/食灵月城-v1.0.0.apk` 是纯 WebView 壳：
- `MainActivity.java`：`START_URL = "https://940608.site/"`，直接加载线上站，
  页面资源与 `/api` 全同源；无 `android_asset` 游戏资源、无 `file:///` 业务引用
  （仅 `offline.html` 离线兜底页，检查其内嵌逻辑无本地资源依赖需变更）。
- 本批次前端改为资源内联，只改变**服务端 index.html 的体积与结构**，
  APK 加载的 URL 与渲染方式完全不变 → **APK 不需要重打包，也不需要重签名**。
- 如发现 APK 内有本地资源引用需变更（本轮未发现），已记录流程：改 `android/` 源码
  → 走 T-RELEASE 追加任务 → 单独审批打包，不在本批次顺手改。

---

## 六、回滚步骤（两级，均脚本化）

### 级别 1 · 部署回滚（server.cjs / schema.sql / index.html / admin.html 恢复到部署前）
```bash
# 在本地仓库根执行；自动选用最新 backup-v22-<ts> 目录
ssh -o BatchMode=yes ubuntu@193.112.28.143 'bash -s' -- < build/rollback-v22.sh
```

### 级别 2 · 资源回滚（把被清理的 images/fonts/favicon 与历史备份解回）
```bash
# 指定清理时生成的 tar（backup-final/pre-v22-<ts>.tar.gz）
ssh -o BatchMode=yes ubuntu@193.112.28.143 'bash -s' -- < build/rollback-v22.sh "" /home/ubuntu/meishi/backup-final/pre-v22-<ts>.tar.gz
```

要点：
- 回滚脚本自动重启 `meishi` 并做健康轮询（30×2s），失败即报 `ABORT` 并提示看日志。
- 静态资源解包使用 `--skip-old-files`，不覆盖现存文件，幂等可重复执行。
- `data/game.db` 在任何脚本中均不在删除/覆盖路径上（脚本白名单硬编码保护）。
- 极端情况手动回滚（不经脚本）：
  ```bash
  tar xzf /home/ubuntu/meishi/backup-final/pre-v22-<ts>.tar.gz -C /home/ubuntu/meishi
  cp -a /home/ubuntu/meishi/backup-v22-<ts>/server.cjs /home/ubuntu/meishi/backend/dist/server.cjs
  sudo systemctl restart meishi
  ```

---

## 七、已知风险与缓解

> 编号按主理人批复调整：公网 ICP 拦截列为**风险 8**，口径为 EXTERNAL-BLOCKED。

| # | 风险 | 等级 | 缓解 |
|---|---|---|---|
| R2 | v22 单文件 index.html ≈5.7MB，首屏加载比 v21（627KB+异步资源）慢，弱网首开可能 >10s | 中 | gzip/ brotli 由 nginx 压缩（data URI 内联后压缩率有限）；验收时实测首开时长；后续可考虑 CDN 或拆分关键路径 |
| R3 | **admin.html 双位置**（已确认接受）：v22 server.cjs 的 `/admin` 改由 `webapp/admin.html` 提供（webappReady 时 adminDir=webappDir，与 v21 的 backend/public 不同源路径），故部署脚本上传两份；若只更新 backend/public 一份，GM 台会是旧版 | 中 | deploy-v22.sh 已内置双上传；验收项 `/admin/` 字节数 = 57,064 核对 |
| R4 | SSH 间歇性失败（kex 阶段被关，疑似 sshd 限流/安全组拦截沙箱出口；已确认接受重试方案） | 中 | deploy 脚本内置 3 次重试；执行时若连续失败，等待 1 分钟后重试；避免并行开多条 SSH |
| R5 | 清理脚本误删（人为改动目标清单） | 低 | 待删清单硬编码为 5 个显式路径，无通配；白名单守卫双保险（data/、backend/dist/、backend/public/、webapp/index.html）；删除前 tar 校验 + db 快照校验必须全部通过 |
| R6 | exe 注入警告 `The signature seems corrupted!` | 低 | 非阻断（postject 已知告警），只要输出 `Injection done!` 且 exe 可运行即通过；本地冒烟兜底 |
| R7 | 健康检查通过但玩家侧异常（灰度盲区） | 低 | 上线后 24h 观察期；回滚脚本随叫随到；部署前 db 在线快照（backup-final/game-db-pre-v22-<ts>.db）可应急恢复（须人工审批） |
| R8 | **公网 ICP 备案拦截**（实测 http 302 → dnspod webblock、https 握手失败；直连 IP + Host 头同样被拦，拦截在腾讯云侧；主理人已独立复核并向用户报备） | 高（外部） | **口径：EXTERNAL-BLOCKED** —— 不算 FAIL 不算 PASS；云端验收改走服务器本机双口径（直连 Node + nginx 回环）；恢复条件：用户完成/解除 ICP 备案拦截后，由 QA 对 `https://940608.site/` 补测公网项；与本批次部署无关，不阻塞部署 |

---

## 八、待用户/主理人审批项
1. ~~版本号定稿~~ → **已拍板：v1.1.0**（仅文档标注，不改代码）。
2. ~~db 快照~~ → **已拍板：加**（backup-and-clean-cloud.sh 内置 python3 sqlite3 backup API 在线快照 + quick_check 校验）。
3. ICP 备案问题处理（风险 8）——用户侧事项，已由主理人报备；公网项按 EXTERNAL-BLOCKED 记账。
4. 放行部署的明确指令（等待消息，未获指令前不执行任何云端写操作）。
