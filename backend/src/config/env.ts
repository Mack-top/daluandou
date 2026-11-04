import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { isSea } from 'node:sea';

/**
 * backend/ 目录的绝对路径，用于把 .env 里的相对路径解析到工程根。
 * SEA 单文件模式（打包 exe）下没有真实模块文件，一切以可执行文件所在目录为根：
 * .env / data/ / webapp/ 都与 exe 同级，便于绿色分发。
 */
export const backendRoot = isSea()
  ? path.dirname(process.execPath)
  : path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');

const envFile = path.join(backendRoot, '.env');
if (existsSync(envFile)) {
  // Node 20.12+ 内置 .env 解析，无需 dotenv 依赖
  process.loadEnvFile(envFile);
}

function readInt(name: string, fallback: number): number {
  const raw = process.env[name];
  if (!raw) return fallback;
  const value = Number(raw);
  if (!Number.isFinite(value)) throw new Error(`环境变量 ${name} 必须是数字，当前值：${raw}`);
  return value;
}

function readList(name: string, fallback: string[]): string[] {
  const raw = process.env[name];
  if (!raw) return fallback;
  const list = raw.split(',').map(item => item.trim()).filter(Boolean);
  return list.length ? list : fallback;
}

function paymentSecret(): string {
  const secret = process.env.PAYMENT_SECRET;
  if (process.env.NODE_ENV === 'production' && (!secret || secret.length < 32 || secret === 'dev-only-payment-secret')) {
    throw new Error('生产环境必须配置至少 32 字符的 PAYMENT_SECRET');
  }
  return secret ?? 'dev-only-payment-secret';
}

export const env = {
  nodeEnv: process.env.NODE_ENV ?? 'development',
  get isProduction(): boolean {
    return this.nodeEnv === 'production';
  },
  port: readInt('PORT', 8787),
  host: process.env.HOST ?? '127.0.0.1',
  /** 数据库文件绝对路径；DATABASE_PATH 支持相对 backend/ 的相对写法。 */
  databasePath: path.resolve(backendRoot, process.env.DATABASE_PATH ?? './data/game.db'),
  corsOrigins: readList('CORS_ORIGIN', ['http://127.0.0.1:5173', 'http://localhost:5173']),
  sessionTtlHours: readInt('SESSION_TTL_HOURS', 720),
  /** 支付回调 HMAC 签名密钥；生产环境必须显式配置。 */
  paymentSecret: paymentSecret(),
  /* ------------------------- GM 后台（v11） ------------------------- */
  /** GM 管理端点允许的来源 IP 白名单（Express req.ip 口径，::ffff: 前缀自动归一）。 */
  gmIpAllowlist: readList('GM_IP_ALLOWLIST', ['127.0.0.1', '::1']),
  /** GM 会话时长（小时），独立于玩家会话。 */
  gmSessionTtlHours: readInt('GM_SESSION_TTL_HOURS', 8),
  /** 登录失败上限：窗口内连续失败次数达到即锁定该账号名。 */
  gmLoginMaxFailures: readInt('GM_LOGIN_MAX_FAILURES', 5),
  /** GM 登录失败锁定窗口（分钟）。 */
  gmLoginLockMinutes: readInt('GM_LOGIN_LOCK_MINUTES', 15),
  /**
   * 种子 GM 账号初始口令：只从环境变量读取，绝不硬编码进代码。
   * 未配置时 seed 跳过默认账号创建（本地开发请自行 POST /api/admin/login 创建？——
   * 不：seed 会跳过，运维需配置 GM_SEED_PASSWORD 后重跑 npm run db:seed）。
   */
  gmSeedUsername: process.env.GM_SEED_USERNAME ?? 'gm-admin',
  gmSeedPassword: process.env.GM_SEED_PASSWORD,
  /* ------------------------- 分服状态（v16 按服隔离配套） ------------------------- */
  /** 处于维护中的服务器编号（CSV，如 "8,9"）；来源：运维配置，前端据此禁用入口。 */
  serversMaintenance: readList('SERVERS_MAINTENANCE', ['8']),
  /** 分服热度阈值：该服玩家数达到该值即标记为「热闹」。 */
  serverBusyThreshold: readInt('SERVER_BUSY_THRESHOLD', 50),
  /* ------------------------- 开服时间（v21 副本/功能按开服天数解锁） ------------------------- */
  /**
   * 开服日期（ISO 日期 YYYY-MM-DD）。副本与限时活动的「开服第 N 天」= 今天 − 开服日期 + 1。
   * 未配置时回落到 catalog_meta 持久化的首次启动日期（见 catalog.service resolveServerOpenDate），
   * 保证零配置可跑；生产环境建议在 .env 显式配置，避免本地启动日期污染。
   */
  serverOpenDate: process.env.SERVER_OPEN_DATE,
} as const;

export type Env = typeof env;
