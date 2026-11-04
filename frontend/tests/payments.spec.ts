/**
 * 商城礼包的服务端订单流（?identity=1 走真实建号 + Cookie 会话）。
 * 覆盖：有身份购买产生服务端订单且资源在服务端发放；无身份（webdriver 默认）购买保持纯本地。
 */
import { test, expect, type Page } from '@playwright/test';

const IDENTITY_KEY = 'food-fantasy.identity.v1';
const SAVE_KEY = 'food-fantasy.save.v1';

type Identity = { accountId: string; nickname: string; createdAt: string };
type Save = { gems: number; shopBought: string[] };

async function readIdentity(page: Page): Promise<Identity | null> {
  const raw = await page.evaluate(key => localStorage.getItem(key), IDENTITY_KEY);
  return raw ? (JSON.parse(raw) as Identity) : null;
}

async function readSave(page: Page): Promise<Save> {
  return page.evaluate(key => JSON.parse(localStorage.getItem(key)!), SAVE_KEY);
}

async function createTravelerWithIdentity(page: Page): Promise<Identity> {
  await page.goto('/?identity=1');
  await expect.poll(async () => (await readIdentity(page))?.accountId, { timeout: 20_000 }).toBeTruthy();
  const identity = (await readIdentity(page))!;
  await page.getByRole('button', { name: /开始游戏/ }).click();
  await page.locator('#agreement').check();
  await page.getByRole('button', { name: /开始游戏/ }).click();
  await page.getByRole('textbox', { name: '你的名字' }).fill('订单旅人');
  await page.getByRole('button', { name: /少女/ }).click();
  await page.getByRole('button', { name: '开启我的故事' }).click();
  await page.getByRole('button', { name: '跳过引导' }).click();
  return identity;
}

test('有身份：购买礼包走服务端订单流，资源在服务端发放并同步本地', async ({ page, context }) => {
  await createTravelerWithIdentity(page);
  const before = await readSave(page);

  await page.getByRole('button', { name: '打开灵晶商城' }).click();
  await expect(page.getByRole('dialog', { name: '灵晶商城' })).toBeVisible();
  await page.getByRole('button', { name: '¥ 6', exact: true }).click();
  await page.getByRole('button', { name: '确认模拟充值 ¥ 6' }).click();
  await expect(page.getByRole('dialog', { name: '灵晶商城' })).toBeVisible();

  // 本地同步入账（+60 灵晶）
  await expect.poll(async () => (await readSave(page)).gems, { timeout: 10_000 }).toBe(before.gems + 60);
  expect((await readSave(page)).shopBought).toContain('gem-6');

  // 服务端权威验证：player_resources 中灵晶 = 初始 100 + 支付发放 60
  const state = await context.request.get('/api/game/state');
  expect(state.status()).toBe(200);
  const serverSave = (await state.json()).data.save;
  expect(serverSave.gems).toBe(160);
});

test('无身份（自动化默认）：购买保持纯本地，不产生任何服务端会话', async ({ page, context }) => {
  await page.goto('/');
  await page.getByRole('button', { name: /开始游戏/ }).click();
  await page.locator('#agreement').check();
  await page.getByRole('button', { name: /开始游戏/ }).click();
  await page.getByRole('textbox', { name: '你的名字' }).fill('本地旅人');
  await page.getByRole('button', { name: /少女/ }).click();
  await page.getByRole('button', { name: '开启我的故事' }).click();
  await page.getByRole('button', { name: '跳过引导' }).click();

  const before = await readSave(page);
  await page.getByRole('button', { name: '打开灵晶商城' }).click();
  await page.getByRole('button', { name: '¥ 6', exact: true }).click();
  await page.getByRole('button', { name: '确认模拟充值 ¥ 6' }).click();
  await expect(page.getByRole('dialog', { name: '灵晶商城' })).toBeVisible();

  await expect.poll(async () => (await readSave(page)).gems, { timeout: 10_000 }).toBe(before.gems + 60);
  expect((await readSave(page)).shopBought).toContain('gem-6');
  // webdriver 无 ?identity=1：从未建号，浏览器无任何会话 Cookie
  expect(await readIdentity(page)).toBeNull();
  expect((await context.cookies()).filter(cookie => cookie.name === 'sid' || cookie.name === 'csrf')).toEqual([]);
});
