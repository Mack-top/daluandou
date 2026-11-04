/**
 * Cookie 会话轨道（HttpOnly sid + CSRF 双提交）与 Bearer 双轨兼容验证。
 * 覆盖：Cookie 成对签发/属性、CSRF 缺失与不匹配、Bearer 免 CSRF、优先级、登出清除。
 */
import { after, before, test } from 'node:test';
import assert from 'node:assert/strict';
import { rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import type { AddressInfo } from 'node:net';
import { createApp } from '../src/app.js';
import { closeDatabase, connectDatabase } from '../src/db/index.js';
import { runMigrations } from '../src/db/migrate.js';
import { seedCatalog } from '../src/db/seed.js';
import { clearRateLimits } from '../src/middleware/rate-limit.js';

const databaseFile = path.join(tmpdir(), `food-fantasy-session-cookie-${process.pid}.db`);

before(() => {
  connectDatabase(databaseFile);
  runMigrations();
  seedCatalog();
});

after(() => {
  closeDatabase();
  for (const suffix of ['', '-wal', '-shm']) rmSync(`${databaseFile}${suffix}`, { force: true });
});

test('Cookie 会话轨道：签发/确权/CSRF 校验/登出清除，与 Bearer 双轨兼容', async () => {
  clearRateLimits();
  const server = createApp().listen(0, '127.0.0.1');
  await new Promise<void>(resolve => server.once('listening', () => resolve()));
  const base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;

  const call = async (
    path: string,
    options: { method?: string; token?: string; cookie?: string; csrf?: string; body?: unknown } = {},
  ) => {
    const headers: Record<string, string> = {};
    if (options.body !== undefined) headers['content-type'] = 'application/json';
    if (options.token) headers.authorization = `Bearer ${options.token}`;
    if (options.cookie) headers.cookie = options.cookie;
    if (options.csrf) headers['x-csrf-token'] = options.csrf;
    const response = await fetch(base + path, {
      method: options.method ?? 'GET',
      headers,
      body: options.body === undefined ? undefined : JSON.stringify(options.body),
    });
    return { status: response.status, body: await response.json().catch(() => null), setCookies: response.headers.getSetCookie() };
  };

  try {
    // 1. guest 成对下发 sid（HttpOnly）+ csrf（可读），SameSite=Lax
    const guest = await call('/api/auth/guest', { method: 'POST', body: {} });
    assert.equal(guest.status, 201);
    const sidCookie = guest.setCookies.find(item => item.startsWith('sid='));
    const csrfCookie = guest.setCookies.find(item => item.startsWith('csrf='));
    assert.ok(sidCookie, '应下发 sid Cookie');
    assert.ok(csrfCookie, '应下发 csrf Cookie');
    assert.ok(sidCookie.toLowerCase().includes('httponly'), 'sid 必须 HttpOnly');
    assert.ok(!csrfCookie.toLowerCase().includes('httponly'), 'csrf 必须可读');
    assert.ok(sidCookie.toLowerCase().includes('samesite=lax'), 'SameSite=Lax');
    const sid = sidCookie.split(';')[0];
    const csrfCookiePair = csrfCookie.split(';')[0];
    const csrfValue = csrfCookiePair.slice('csrf='.length);
    // 浏览器会把同源所有 Cookie 一起回传（sid + csrf）
    const browserCookies = `${sid}; ${csrfCookiePair}`;

    // 2. Cookie 轨道确权：返回本人账号
    const me = await call('/api/auth/me', { cookie: sid });
    assert.equal(me.status, 200);
    assert.equal(me.body?.data?.player?.id, guest.body?.data?.player?.id);

    // 3. Cookie 轨道写请求缺 CSRF 头 → 403
    const noCsrf = await call('/api/game/state/document', {
      method: 'PUT', cookie: browserCookies, body: { document: { coins: 1 } },
    });
    assert.equal(noCsrf.status, 403);

    // 4. CSRF 令牌不匹配 → 403
    const badCsrf = await call('/api/game/state/document', {
      method: 'PUT', cookie: browserCookies, csrf: 'a'.repeat(43), body: { document: { coins: 1 } },
    });
    assert.equal(badCsrf.status, 403);

    // 5. CSRF 令牌匹配 → 200
    const good = await call('/api/game/state/document', {
      method: 'PUT', cookie: browserCookies, csrf: csrfValue, body: { document: { coins: 1 } },
    });
    assert.equal(good.status, 200);

    // 6. Bearer 轨道：无 CSRF 头仍可用（跨站无法伪造自定义头，天然免疫 CSRF）
    const token = guest.body?.data?.token as string;
    assert.ok(token);
    const bearerPut = await call('/api/game/state/document', {
      method: 'PUT', token, body: { document: { coins: 2 }, version: 1 },
    });
    assert.equal(bearerPut.status, 200);

    // 7. 双轨并存时 Bearer 优先：sid 是玩家 A、Bearer 是玩家 B → 确权结果为 B
    const guestB = await call('/api/auth/guest', { method: 'POST', body: {} });
    const tokenB = guestB.body?.data?.token as string;
    const meB = await call('/api/auth/me', { token: tokenB, cookie: sid });
    assert.equal(meB.status, 200);
    assert.equal(meB.body?.data?.player?.id, guestB.body?.data?.player?.id);

    // 8. logout：清除成对 Cookie 且会话失效
    const logout = await call('/api/auth/logout', { method: 'POST', cookie: browserCookies, csrf: csrfValue, body: {} });
    assert.equal(logout.status, 200);
    assert.ok(
      logout.setCookies.some(item => item.startsWith('sid=') && /expires=|max-age=0/i.test(item)),
      '登出应清除 sid Cookie',
    );
    const afterLogout = await call('/api/auth/me', { cookie: sid });
    assert.equal(afterLogout.status, 401);
  } finally {
    server.close();
    clearRateLimits();
  }
});
