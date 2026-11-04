/**
 * 静默账号身份与数据隔离（浏览器层验证）。
 * 无注册/登录界面：身份在首屏自动建立；
 * 会话令牌存于 HttpOnly Cookie（JS 不可读），CSRF 双提交令牌可读。
 */
import { test, expect, type Page } from '@playwright/test';

type Identity = { accountId: string; nickname: string; createdAt: string };

const IDENTITY_KEY = 'food-fantasy.identity.v1';

async function readIdentity(page: Page): Promise<Identity | null> {
  const raw = await page.evaluate(key => localStorage.getItem(key), IDENTITY_KEY);
  return raw ? (JSON.parse(raw) as Identity) : null;
}

test('首次访问自动建立账号身份：HttpOnly 会话 Cookie + 可读 CSRF 令牌，刷新后保持', async ({ page, context }) => {
  await page.goto('/?identity=1');
  await expect.poll(async () => (await readIdentity(page))?.accountId, { timeout: 20_000 }).toBeTruthy();

  const first = (await readIdentity(page))!;
  expect(first.accountId).toMatch(/^[0-9a-f-]{36}$/);
  // 令牌不再落 localStorage（HttpOnly Cookie 承载，XSS 不可读）
  expect(first).not.toHaveProperty('token');

  const sid = (await context.cookies()).find(cookie => cookie.name === 'sid');
  const csrf = (await context.cookies()).find(cookie => cookie.name === 'csrf');
  expect(sid, '应下发会话 Cookie').toBeTruthy();
  expect(sid?.httpOnly, '会话 Cookie 必须 HttpOnly').toBe(true);
  expect(sid?.sameSite, 'SameSite=Lax').toBe('Lax');
  expect(csrf, '应下发 CSRF 双提交 Cookie').toBeTruthy();
  expect(csrf?.httpOnly, 'CSRF Cookie 须可被前端读取').toBe(false);
  expect(await page.evaluate(() => document.cookie).then(raw => raw.includes('csrf='))).toBe(true);
  expect(await page.evaluate(() => document.cookie).then(raw => raw.includes('sid='))).toBe(false);

  await page.reload();
  const second = (await readIdentity(page))!;
  expect(second.accountId).toBe(first.accountId);
  const sidAfterReload = (await context.cookies()).find(cookie => cookie.name === 'sid');
  expect(sidAfterReload?.value).toBe(sid?.value);
});

test('不同浏览器上下文自动获得不同账号，且服务端凭 Cookie 确权互不串号', async ({ browser }) => {
  const contextA = await browser.newContext();
  const contextB = await browser.newContext();
  const pageA = await contextA.newPage();
  const pageB = await contextB.newPage();

  await pageA.goto('/?identity=1');
  await pageB.goto('/?identity=1');
  await expect.poll(async () => (await readIdentity(pageA))?.accountId).toBeTruthy();
  await expect.poll(async () => (await readIdentity(pageB))?.accountId).toBeTruthy();

  const identityA = (await readIdentity(pageA))!;
  const identityB = (await readIdentity(pageB))!;
  expect(identityA.accountId).not.toBe(identityB.accountId);

  // context.request 与页面共享 Cookie jar：不带任何认证头，服务端从 sid Cookie 确权
  const meA = await contextA.request.get('/api/auth/me');
  const meB = await contextB.request.get('/api/auth/me');
  expect(meA.status()).toBe(200);
  expect(meB.status()).toBe(200);
  const playerA = (await meA.json()).data.player;
  const playerB = (await meB.json()).data.player;
  expect(playerA.id).toBe(identityA.accountId);
  expect(playerB.id).toBe(identityB.accountId);
  expect(playerA.id).not.toBe(playerB.id);

  await contextA.close();
  await contextB.close();
});

test('会话 Cookie 被清除后自动重建身份，不会复用旧账号', async ({ page, context }) => {
  await page.goto('/?identity=1');
  await expect.poll(async () => (await readIdentity(page))?.accountId, { timeout: 20_000 }).toBeTruthy();
  const original = (await readIdentity(page))!;
  const originalSid = (await context.cookies()).find(cookie => cookie.name === 'sid')?.value;

  await context.clearCookies();
  await page.reload();
  await expect.poll(async () => (await readIdentity(page))?.accountId, { timeout: 20_000 }).toBeTruthy();
  const rebuilt = (await readIdentity(page))!;
  expect(rebuilt.accountId).not.toBe(original.accountId);
  const rebuiltSid = (await context.cookies()).find(cookie => cookie.name === 'sid');
  expect(rebuiltSid?.value).toBeTruthy();
  expect(rebuiltSid?.value).not.toBe(originalSid);
});
