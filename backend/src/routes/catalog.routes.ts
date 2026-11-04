import { Router } from 'express';
import { z } from 'zod';
import { ok } from '../lib/http.js';
import { getCatalog, getCatalogDelta, getTodayMarket } from '../services/catalog.service.js';
import { listEnemyDefs } from '../repositories/enemy.repository.js';
import { listVfxDefs } from '../repositories/vfx.repository.js';
import { listSceneDefs } from '../repositories/scene.repository.js';

const router = Router();

const ENEMY_KINDS = ['normal', 'elite', 'boss'] as const;
const VFX_TYPES = ['hit', 'skill', 'buff', 'ui'] as const;

/** 全量静态配置，客户端启动时拉取一次；支持 ?since={"domain":version} 增量协议（§5.2） */
router.get('/', (req, res) => {
  const raw = req.query.since;
  let since: Record<string, number> | undefined;
  if (typeof raw === 'string' && raw.trim()) {
    // v22：since 由客户端带上一次拉取的版本映射；非法 JSON 只当「无 since」处理，
    // 不能让它把公开 catalog 端点打成 500（离线兜底依赖该端点始终可用）。
    let parsedJson: unknown;
    try {
      parsedJson = JSON.parse(raw);
    } catch {
      parsedJson = undefined;
    }
    const parsed = z.record(z.string(), z.number().int()).safeParse(parsedJson);
    since = parsed.success ? parsed.data : undefined;
  }
  ok(res, { ...getCatalog(), ...getCatalogDelta(since) });
});

/** 今日集市货架（按服务器日期轮换） */
router.get('/market', (_req, res) => {
  ok(res, getTodayMarket());
});

/** 怪物 / Boss 定义（公开配置，无需鉴权；Boss 不单独建表，kind 判别） */
router.get('/enemies', (req, res) => {
  const kind = z.enum(ENEMY_KINDS).safeParse(req.query.kind);
  ok(res, { enemies: listEnemyDefs(kind.success ? kind.data : undefined) });
});

router.get('/enemies/:kind', (req, res) => {
  const kind = z.enum(ENEMY_KINDS).parse(req.params.kind);
  ok(res, { enemies: listEnemyDefs(kind) });
});

/** 特效定义（客户端表现资产登记表，随 catalog 下发） */
router.get('/vfx', (req, res) => {
  const type = z.enum(VFX_TYPES).safeParse(req.query.type);
  ok(res, { vfx: listVfxDefs(type.success ? type.data : undefined) });
});

/** 场景定义（客户端 UI 导航单位） */
router.get('/scenes', (_req, res) => {
  ok(res, { scenes: listSceneDefs() });
});

export default router;
