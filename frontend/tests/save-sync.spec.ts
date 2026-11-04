/**
 * 存档云同步与账号级隔离（浏览器层验证）。
 * 覆盖：本地存档自动上云（迁移）、云端权威覆盖本地脏数据、双账号存档互不可见。
 * 入口统一带 ?identity=1：绕过 webdriver 防刷号保护，走真实建号流程。
 */
import { test, expect, type BrowserContext, type Page } from '@playwright/test';

type Identity = { accountId: string; nickname: string; createdAt: string };

const IDENTITY_KEY = 'food-fantasy.identity.v1';
const SAVE_KEY = 'food-fantasy.save.v1';

async function readIdentity(page: Page): Promise<Identity | null> {
  const raw = await page.evaluate(key => localStorage.getItem(key), IDENTITY_KEY);
  return raw ? (JSON.parse(raw) as Identity) : null;
}

/** 从上下文 Cookie 取 CSRF 双提交令牌（写请求必须放进 x-csrf-token 头）。 */
async function csrfToken(context: BrowserContext): Promise<string> {
  const csrf = (await context.cookies()).find(cookie => cookie.name === 'csrf');
  return csrf?.value ?? '';
}

async function readLocalCoins(page: Page): Promise<number | null> {
  return page.evaluate(key => {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    const save = JSON.parse(raw);
    return typeof save.coins === 'number' ? save.coins : null;
  }, SAVE_KEY);
}

/** 等待云端出现该账号的存档文档（本地存档迁移完成）。 */
async function waitCloudDocument(page: Page) {
  await expect.poll(async () => {
    const response = await page.request.get('/api/game/state/document');
    if (!response.ok()) return 0;
    const body = await response.json();
    return body?.data?.version ?? 0;
  }, { timeout: 15000 }).toBeGreaterThan(0);
}

test('建号后本地存档自动迁移到云端', async ({ page }) => {
  await page.goto('/?identity=1');
  await expect.poll(async () => (await readIdentity(page))?.accountId, { timeout: 20_000 }).toBeTruthy();

  await waitCloudDocument(page);

  const response = await page.request.get('/api/game/state/document');
  const body = await response.json();
  expect(body.data.version).toBeGreaterThanOrEqual(1);
  expect(body.data.document).toBeTruthy();
  expect(typeof body.data.document.coins).toBe('number');
});

test('云端存档权威：本地被篡改的数据在重新载入后被云端覆盖', async ({ page }) => {
  await page.goto('/?identity=1');
  await expect.poll(async () => (await readIdentity(page))?.accountId, { timeout: 20_000 }).toBeTruthy();
  await waitCloudDocument(page);

  const cloudBefore = await (await page.request.get('/api/game/state/document')).json();
  const cloudCoins = cloudBefore.data.document.coins as number;

  // 绕过游戏逻辑直接改本地存档（模拟本地脏数据/篡改）
  await page.evaluate(key => {
    const save = JSON.parse(localStorage.getItem(key)!);
    save.coins = 999999;
    localStorage.setItem(key, JSON.stringify(save));
  }, SAVE_KEY);
  expect(await readLocalCoins(page)).toBe(999999);

  // 重新载入：身份恢复 → 首轮同步拉回云端文档 → 本地脏数据被覆盖
  await page.reload();
  await expect.poll(async () => (await readIdentity(page))?.accountId, { timeout: 20_000 }).toBeTruthy();
  await expect.poll(async () => await readLocalCoins(page), { timeout: 15000 }).toBe(cloudCoins);
});

test('两个账号的云端存档互不可见、互不影响', async ({ browser }) => {
  const contextA = await browser.newContext();
  const contextB = await browser.newContext();
  const pageA = await contextA.newPage();
  const pageB = await contextB.newPage();

  try {
    await pageA.goto('/?identity=1');
    await pageB.goto('/?identity=1');
    await expect.poll(async () => (await readIdentity(pageA))?.accountId).toBeTruthy();
    await expect.poll(async () => (await readIdentity(pageB))?.accountId).toBeTruthy();
    const identityA = (await readIdentity(pageA))!;
    const identityB = (await readIdentity(pageB))!;
    expect(identityA.accountId).not.toBe(identityB.accountId);

    await waitCloudDocument(pageA);
    await waitCloudDocument(pageB);

    // A 的云端存档写入一个标记值
    const docA = await (await pageA.request.get('/api/game/state/document')).json();
    const marked = { ...docA.data.document, coins: 424242 };
    const putA = await pageA.request.put('/api/game/state/document', {
      headers: { 'content-type': 'application/json', 'x-csrf-token': await csrfToken(contextA) },
      data: { document: marked, version: docA.data.version },
    });
    expect(putA.status()).toBe(200);

    // B 的存档不受影响：只能读到自己的文档
    const docB = await (await pageB.request.get('/api/game/state/document')).json();
    expect(docB.data.document.coins).not.toBe(424242);

    // B 的会话无法触达 A 的文档（接口不提供"指定账号"的入口，读到的永远是 B 自己）
    const view = await pageB.request.get('/api/game/state/document');
    expect(JSON.stringify((await view.json()).data)).not.toContain('424242');

    // A 重新载入页面：拉回云端，本地 coins 应变为 424242（多端同步生效）
    await pageA.reload();
    await expect.poll(async () => await readLocalCoins(pageA), { timeout: 15000 }).toBe(424242);
  } finally {
    await contextA.close();
    await contextB.close();
  }
});
