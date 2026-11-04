/**
 * 账号密码注册 / 登录：游客身份设密码（注册）→ 登出 → 跨设备登录找回。
 * 覆盖：强度校验、重复注册 409、统一错误口径（防账号枚举）、登录会话可用。
 */
import { after, before, test } from 'node:test';
import assert from 'node:assert/strict';
import { rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import type { AddressInfo } from 'node:net';
import { closeDatabase, connectDatabase } from '../src/db/index.js';
import { runMigrations } from '../src/db/migrate.js';
import { seedCatalog } from '../src/db/seed.js';
import { createGuest } from '../src/services/auth.service.js';
import { createApp } from '../src/app.js';

const databaseFile = path.join(tmpdir(), `food-fantasy-password-${process.pid}.db`);
let base = '';
let server: ReturnType<ReturnType<typeof createApp>['listen']>;

before(async () => {
  connectDatabase(databaseFile);
  runMigrations();
  seedCatalog();
  server = createApp().listen(0, '127.0.0.1');
  await new Promise<void>(resolve => server.once('listening', resolve));
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});

after(() => {
  server.close();
  closeDatabase();
  for (const suffix of ['', '-wal', '-shm']) rmSync(`${databaseFile}${suffix}`, { force: true });
});

/** 走 Bearer 轨道的轻量请求助手。 */
async function api(path: string, init: { method?: string; token?: string; body?: unknown } = {}) {
  const response = await fetch(`${base}/api/auth${path}`, {
    method: init.method ?? 'GET',
    headers: {
      'content-type': 'application/json',
      ...(init.token ? { authorization: `Bearer ${init.token}` } : {}),
    },
    body: init.body === undefined ? undefined : JSON.stringify(init.body),
  });
  return { status: response.status, body: await response.json() as Record<string, unknown> };
}

test('注册：强度校验拒绝弱密码，成功返回 accountId 且 /me 会话可用', async () => {
  const guest = createGuest({ nickname: '密码甲乙', gender: 'male' });

  for (const weak of ['short1', '12345678', 'abcdefgh', 'a'.repeat(65)]) {
    const weakResult = await api('/register', { method: 'POST', token: guest.token, body: { password: weak } });
    assert.equal(weakResult.status, 400, `弱密码应被拒：${weak}`);
  }

  const okResult = await api('/register', { method: 'POST', token: guest.token, body: { password: 'tasty2026' } });
  assert.equal(okResult.status, 201);
  assert.equal((okResult.body?.data as { accountId: string })?.accountId, guest.player.id);

  // 未认证注册 → 401（requireAuth 在 CSRF 校验之前）
  const anon = await api('/register', { method: 'POST', body: { password: 'tasty2026' } });
  assert.equal(anon.status, 401);
});

test('重复注册返回 409；登录成功签发新会话并可访问 /me', async () => {
  const guest = createGuest({ nickname: '密码丙丁', gender: 'female' });
  const first = await api('/register', { method: 'POST', token: guest.token, body: { password: 'tasty2026' } });
  assert.equal(first.status, 201);
  const again = await api('/register', { method: 'POST', token: guest.token, body: { password: 'tasty2026' } });
  assert.equal(again.status, 409);

  const wrong = await api('/login', { method: 'POST', body: { accountId: guest.player.id, password: 'wrongpass1' } });
  assert.equal(wrong.status, 401);

  const login = await api('/login', { method: 'POST', body: { accountId: guest.player.id, password: 'tasty2026' } });
  assert.equal(login.status, 200);
  const data = login.body?.data as { token: string; player: { id: string; nickname: string } };
  assert.equal(data.player.id, guest.player.id);
  assert.equal(data.player.nickname, '密码丙丁');
  assert.ok(data.token);

  const me = await api('/me', { token: data.token });
  assert.equal(me.status, 200);
  assert.equal((me.body?.data as { player: { id: string } })?.player?.id, guest.player.id);
  // 登录应携带完整存档（跨设备找回）
  assert.ok((me.body?.data as { save: unknown })?.save);
});

test('统一错误口径：未知账号 / 未设密码 / 错密码一律 401 同文案（防账号枚举）', async () => {
  const guest = createGuest({ nickname: '密码戊己', gender: 'male' });
  const cases = [
    { accountId: 'no-such-account', password: 'tasty2026' },
    { accountId: guest.player.id, password: 'tasty2026' }, // 未设密码
    { accountId: guest.player.id, password: 'wrongpass1' },
  ];
  const messages: string[] = [];
  for (const body of cases) {
    const result = await api('/login', { method: 'POST', body });
    assert.equal(result.status, 401);
    messages.push((result.body?.error as { message?: string })?.message ?? '');
  }
  assert.ok(messages.every(message => message === messages[0]), `错误文案应一致：${JSON.stringify(messages)}`);
});
