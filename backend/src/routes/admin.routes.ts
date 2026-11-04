import { Router, type Request, type Response } from 'express';
import { z } from 'zod';
import { ok, parseBody } from '../lib/http.js';
import { requireGm, requireGmIp, requireGmSession, currentGm, normalizeIp } from '../middleware/gm-auth.js';
import {
  createConfigRow,
  deleteConfigRow,
  getConfigRow,
  listConfigDomains,
  listConfigRows,
  listConfigVersions,
  listRuntimeConfig,
  publishAllConfigs,
  updateConfigRow,
} from '../services/admin-config.service.js';
import {
  gmBanPlayer,
  gmGrantResource,
  gmListAuditLogs,
  gmListFeatureToggles,
  gmListPlayers,
  gmLogin,
  gmLogout,
  gmPlayerInfo,
  gmSendCompensation,
  gmSendMail,
  gmUnbanPlayer,
  gmUpdateFeatureToggle,
} from '../services/gm.service.js';

/**
 * GM 管理端点（v11）：独立 /admin 前缀 + IP 白名单 + 独立会话，
 * 与玩家 requireAuth/requireCsrf 轨道完全隔离。
 * 所有业务操作写 gm_audit_logs（含 denied 越权尝试，由 requireGm 中间件统一落）。
 */
const router = Router();

router.use(requireGmIp);

const attachmentSchema = z.object({
  kind: z.string().min(1),
  amount: z.number().int().positive(),
  itemId: z.string().min(1).optional(),
  label: z.string().optional(),
});

router.post('/login', (req, res) => {
  const input = parseBody(z.object({ username: z.string().min(1), password: z.string().min(1) }), req.body);
  const result = gmLogin(input.username, input.password, normalizeIp(req.ip));
  ok(res, result);
});

router.post('/logout', requireGmSession, (req, res) => {
  const header = req.header('authorization') ?? '';
  const token = header.slice(header.toLowerCase().startsWith('bearer ') ? 7 : 0).trim();
  gmLogout(token, currentGm(req), normalizeIp(req.ip));
  ok(res, { loggedOut: true });
});

router.post('/mail', requireGm('send_mail'), (req, res) => {
  const gm = currentGm(req);
  const input = parseBody(
    z.object({
      playerIds: z.array(z.string().min(1)).min(1),
      title: z.string().min(1).max(60),
      body: z.string().max(500).default(''),
      attachments: z.array(attachmentSchema).min(1),
      expireDays: z.number().int().min(0).max(30).default(7),
    }),
    req.body,
  );
  const result = gmSendMail({ gm, ...input, ip: normalizeIp(req.ip) });
  ok(res, result);
});

router.post('/compensation', requireGm('send_compensation'), (req, res) => {
  const gm = currentGm(req);
  const input = parseBody(
    z.object({
      playerIds: z.array(z.string().min(1)).min(1),
      reason: z.string().min(1).max(200),
      attachments: z.array(attachmentSchema).min(1),
      expireDays: z.number().int().min(0).max(30).default(0),
    }),
    req.body,
  );
  const result = gmSendCompensation({ gm, ...input, ip: normalizeIp(req.ip) });
  ok(res, result);
});

router.post('/players/:playerId/grant', requireGm('grant_resource'), (req, res) => {
  const gm = currentGm(req);
  const input = parseBody(
    z.object({ currency: z.string().min(1), amount: z.number().int() }),
    req.body,
  );
  gmGrantResource({ gm, playerId: String(req.params.playerId), currency: input.currency, amount: input.amount, ip: normalizeIp(req.ip) });
  ok(res, { granted: true });
});

router.post('/players/:playerId/ban', requireGm('ban'), (req, res) => {
  const gm = currentGm(req);
  const input = parseBody(
    z.object({
      reason: z.string().min(1).max(200),
      days: z.number().int().min(1).max(3650).optional(),
    }),
    req.body,
  );
  const result = gmBanPlayer({ gm, playerId: String(req.params.playerId), ...input, ip: normalizeIp(req.ip) });
  ok(res, result);
});

router.post('/players/:playerId/unban', requireGm('ban'), (req, res) => {
  const gm = currentGm(req);
  const result = gmUnbanPlayer({ gm, playerId: String(req.params.playerId), ip: normalizeIp(req.ip) });
  ok(res, result);
});

/** 玩家检索（v16 按服隔离配套）：?server=N&keyword=昵称或ID&limit=N，只读。 */
router.get('/players', requireGmSession, (req, res) => {
  const query = z.object({
    server: z.coerce.number().int().min(1).max(99).optional(),
    keyword: z.string().trim().max(64).optional(),
    limit: z.coerce.number().int().min(1).max(200).default(50),
  }).safeParse(req.query);
  const filter = query.success ? query.data : {};
  ok(res, { players: gmListPlayers(filter) });
});

router.get('/players/:playerId', requireGmSession, (req, res) => {
  ok(res, gmPlayerInfo(String(req.params.playerId)));
});

router.get('/audit-logs', requireGm('edit_config'), (req, res) => {
  const query = z.object({ gmId: z.string().optional(), action: z.string().optional(), limit: z.coerce.number().int().min(1).max(500).optional() })
    .safeParse(req.query);
  const filter = query.success ? query.data : {};
  ok(res, { logs: gmListAuditLogs(filter) });
});

/* ------------------------------ v21：功能与活动开关 ------------------------------ */

/** 开关列表（只读）。 */
router.get('/features', requireGmSession, (_req, res) => {
  ok(res, { features: gmListFeatureToggles() });
});

/** 修改开关（edit_config 权限）：enabled/openDay/closeDay，事务内 bump feature 版本动态生效。 */
router.patch('/features/:key', requireGm('edit_config'), (req, res) => {
  const body = parseBody(z.object({
    enabled: z.boolean().optional(),
    openDay: z.number().int().min(1).nullable().optional(),
    closeDay: z.number().int().min(1).nullable().optional(),
  }), req.body);
  const gm = currentGm(req);
  const result = gmUpdateFeatureToggle({ gm, key: String(req.params.key), ...body, ip: normalizeIp(req.ip) });
  ok(res, result);
});

/* ------------------------------ v22：全配置项后台管理（CRUD / 发布生效） ------------------------------ */
/* 注意：静态路径 /domains、/versions、/runtime、/publish 必须注册在 /:domain 之前，
   否则会被参数路由吞掉（Express 按注册顺序匹配）。                                    */
/* 契约：GET 用 requireGmSession；POST / PATCH / PUT / DELETE 用 requireGm('edit_config')。 */

const configBodySchema = z.record(z.string(), z.unknown());

/** 域清单（含列定义、行数、版本，前端据此自动生成表格与表单）。 */
router.get('/config/domains', requireGmSession, (_req, res) => {
  ok(res, { domains: listConfigDomains() });
});

/** 运行时只读参数（.env / 进程环境）+ 全部配置域版本戳。 */
router.get('/config/runtime', requireGmSession, (_req, res) => {
  ok(res, listRuntimeConfig());
});

router.get('/config/versions', requireGmSession, (_req, res) => {
  ok(res, { versions: listConfigVersions() });
});

/** 一键发布：全部可写配置域版本 +1，强制客户端下次拉目录重新读取。 */
router.post('/config/publish', requireGm('edit_config'), (req, res) => {
  const gm = currentGm(req);
  ok(res, publishAllConfigs({ gm, ip: normalizeIp(req.ip) }));
});

/** 域列表：{ domain, label, columns, rows, version, readOnly }（另附 domainInfo 兼容形态）。 */
router.get('/config/:domain', requireGmSession, (req, res) => {
  const { domain, rows, columns, version } = listConfigRows(String(req.params.domain));
  ok(res, {
    domain: domain.key,
    label: domain.label,
    columns,
    rows,
    version,
    readOnly: Boolean(domain.readOnly),
    domainInfo: {
      key: domain.key, label: domain.label, pk: domain.pk, primaryKey: domain.pk,
      readOnly: Boolean(domain.readOnly), group: domain.group, description: domain.description,
    },
  });
});

/** 单行详情：{ row, version, domain }。 */
router.get('/config/:domain/:id', requireGmSession, (req, res) => {
  const result = getConfigRow(String(req.params.domain), String(req.params.id));
  ok(res, result);
});

router.post('/config/:domain', requireGm('edit_config'), (req, res) => {
  const input = parseBody(configBodySchema, req.body);
  const gm = currentGm(req);
  ok(res, createConfigRow(String(req.params.domain), input, { gm, ip: normalizeIp(req.ip) }), 201);
});

/** 契约用 PATCH；同时保留 PUT 作为等价别名，避免旧界面 404。 */
const updateConfigHandler = (req: Request, res: Response): void => {
  const patch = parseBody(configBodySchema, req.body);
  const gm = currentGm(req);
  ok(res, updateConfigRow(String(req.params.domain), String(req.params.id), patch, { gm, ip: normalizeIp(req.ip) }));
};
router.patch('/config/:domain/:id', requireGm('edit_config'), updateConfigHandler);
router.put('/config/:domain/:id', requireGm('edit_config'), updateConfigHandler);

router.delete('/config/:domain/:id', requireGm('edit_config'), (req, res) => {
  const gm = currentGm(req);
  ok(res, deleteConfigRow(String(req.params.domain), String(req.params.id), { gm, ip: normalizeIp(req.ip) }));
});

export default router;
