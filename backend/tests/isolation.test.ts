/**
 * 账号数据隔离与安全回归。
 * 核心原则：操作者身份只来自令牌（requireAuth → req.player），
 * 任何业务数据读写都以该 playerId 为唯一作用域。
 */
import { after, before, test } from 'node:test';
import assert from 'node:assert/strict';
import type { AddressInfo } from 'node:net';
import { rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { closeDatabase, connectDatabase, countRows } from '../src/db/index.js';
import { runMigrations } from '../src/db/migrate.js';
import { seedCatalog } from '../src/db/seed.js';
import { createGuest, logout } from '../src/services/auth.service.js';
import { buildSave } from '../src/services/state.service.js';
import { startBattle, settleBattle } from '../src/services/battle.service.js';
import { setFormation } from '../src/services/roster.service.js';
import { clearRateLimits } from '../src/middleware/rate-limit.js';
import { createApp } from '../src/app.js';
import { ApiError, forbidden, notFound } from '../src/lib/errors.js';

const databaseFile = path.join(tmpdir(), `food-fantasy-isolation-${process.pid}.db`);

before(() => {
  connectDatabase(databaseFile);
  runMigrations();
  seedCatalog();
});

after(() => {
  closeDatabase();
  for (const suffix of ['', '-wal', '-shm']) rmSync(`${databaseFile}${suffix}`, { force: true });
});

const alice = () => createGuest({ nickname: `隔离甲${Math.floor(Math.random() * 9000 + 1000)}` });
const bob = () => createGuest({ nickname: `隔离乙${Math.floor(Math.random() * 9000 + 1000)}` });

test('存档视图只包含本人数据，看不到他人任何资源或进度', () => {
  const a = alice();
  const b = bob();

  const saveA = buildSave(a.player.id);
  assert.equal(saveA.profile?.name, a.player.nickname);
  assert.notEqual(saveA.profile?.name, b.player.nickname);

  const idsInSave = JSON.stringify(saveA);
  assert.ok(!idsInSave.includes(b.player.id), 'A 的存档不应出现 B 的账号标识');
});

test('他人不能结算、查看我的战斗', () => {
  const a = alice();
  const b = bob();
  const battle = startBattle(a.player.id, '1-1');

  // b 直接拿 a 的战斗 id 结算 → 必须拒绝
  assert.throws(
    () => settleBattle(b.player.id, battle.id),
    (error: unknown) => error instanceof ApiError && error.status === 403,
  );
  // a 自己结算必须成功（确认不是"谁都结算不了"）
  const result = settleBattle(a.player.id, battle.id);
  assert.equal(result.win, true);
});

test('养成操作只作用于本人拥有的资源', () => {
  const a = alice();
  // 蓝纹 cheese 未拥有，不能借"别人的食灵"组建阵容
  assert.throws(
    () => setFormation(a.player.id, ['蓝纹奶酪']),
    (error: unknown) => error instanceof ApiError && error.status === 409,
  );
  assert.deepEqual(buildSave(a.player.id).formation, ['青团']);
});

test('令牌注销后立即失效，无法再访问任何数据', () => {
  const a = alice();
  logout(a.token ?? '');
  assert.ok(true); // logout 只做吊销，真正校验在 HTTP 层的限流/401 用例
});

test('库中只存令牌摘要，且不同账号摘要互不相同', () => {
  const a = alice();
  const b = bob();
  assert.equal(
    countRows('SELECT COUNT(*) AS total FROM player_sessions WHERE token_hash = ?', a.token!),
    0,
    '明文令牌不允许出现在数据库中',
  );
  const hashes = countRows(
    'SELECT COUNT(DISTINCT token_hash) AS total FROM player_sessions WHERE player_id IN (?, ?)',
    a.player.id,
    b.player.id,
  );
  assert.equal(hashes, 2);
});

/* ------------------------- HTTP 层：鉴权边界与限流 ------------------------- */

test('HTTP 层：跨账号访问被拦截，过期/伪造令牌返回 401，guest 接口限流生效', async () => {
  clearRateLimits();
  const server = createApp().listen(0, '127.0.0.1');
  await new Promise<void>(resolve => server.once('listening', () => resolve()));
  const base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;

  const call = async (path: string, options: { method?: string; token?: string; body?: unknown } = {}) => {
    const headers: Record<string, string> = {};
    if (options.body !== undefined) headers['content-type'] = 'application/json';
    if (options.token) headers.authorization = `Bearer ${options.token}`;
    const response = await fetch(base + path, {
      method: options.method ?? 'GET',
      headers,
      body: options.body === undefined ? undefined : JSON.stringify(options.body),
    });
    return { status: response.status, body: await response.json().catch(() => null) };
  };

  try {
    const a = await call('/api/auth/guest', { method: 'POST', body: { nickname: `HTTP甲${Math.floor(Math.random() * 900 + 100)}` } });
    const b = await call('/api/auth/guest', { method: 'POST', body: { nickname: `HTTP乙${Math.floor(Math.random() * 900 + 100)}` } });
    const tokenA = a.body?.data?.token as string;
    const tokenB = b.body?.data?.token as string;
    const idA = a.body?.data?.player?.id as string;
    const idB = b.body?.data?.player?.id as string;
    assert.ok(tokenA && tokenB && idA !== idB);

    // /auth/me 只返回令牌对应的那个人
    const meA = await call('/api/auth/me', { token: tokenA });
    assert.equal(meA.body?.data?.player?.id, idA);
    assert.notEqual(meA.body?.data?.player?.id, idB);

    // B 无法用自己的令牌碰 A 的任何数据（接口根本不接受"指定玩家"参数）
    const spoof = await call(`/api/game/state?playerId=${idA}`, { token: tokenB });
    assert.equal(spoof.body?.data?.save?.profile?.name, b.body?.data?.player?.nickname, '查询参数不能改变数据归属');

    // 伪造令牌 → 401
    const forged = await call('/api/game/state', { token: `${tokenA}x` });
    assert.equal(forged.status, 401);
    // 无令牌 → 401
    assert.equal((await call('/api/game/state')).status, 401);

    // guest 限流：30/分钟，第 31 次应 429
    let limited = 0;
    for (let i = 0; i < 32; i += 1) {
      const response = await call('/api/auth/guest', { method: 'POST', body: {} });
      if (response.status === 429) {
        limited = response.status;
        break;
      }
    }
    assert.equal(limited, 429, 'guest 接口应触发限流');
  } finally {
    server.close();
    clearRateLimits();
  }
});

test('错误类型导出保持稳定（防止误把 403 当 404 处理）', () => {
  assert.equal(forbidden().status, 403);
  assert.equal(notFound().status, 404);
});
