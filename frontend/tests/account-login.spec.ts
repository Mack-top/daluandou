/**
 * 正式账号密码：游客身份设置密码（注册）→ 登出清身份 → 跨设备登录找回存档。
 * UI 入口：旅者账户面板的「正式账号」区。
 */
import { test, expect, type Page } from '@playwright/test';

const IDENTITY_KEY = 'food-fantasy.identity.v1';

async function openAccount(page: Page) {
  // 启动页的「旅者账户」入口
  await page.getByRole('button', { name: /旅者账户/ }).click();
  const section = page.locator('.account-credentials');
  await expect(section).toBeVisible();
  return section;
}

test('游客身份设置密码后可跨设备登录找回同一存档', async ({ page, context }) => {
  await page.goto('/?identity=1');
  await expect.poll(async () => page.evaluate(key => localStorage.getItem(key), IDENTITY_KEY), { timeout: 20_000 }).toBeTruthy();
  const accountId = ((await page.evaluate(key => localStorage.getItem(key), IDENTITY_KEY))! as string);
  const originalId = (JSON.parse(accountId) as { accountId: string }).accountId;

  // 注册：设置密码
  const section = await openAccount(page);
  await expect(section.locator('code')).toHaveText(originalId);
  await section.getByLabel('设置密码').fill('tasty2026');
  await section.getByRole('button', { name: '设置密码' }).click();
  await expect(section.locator('.credentials-message.ok')).toContainText('密码已设置');

  // 重复设置 → 409 提示已设置过
  await section.getByLabel('设置密码').fill('tasty2026');
  await section.getByRole('button', { name: '设置密码' }).click();
  await expect(section.locator('.credentials-message.error')).toContainText('已设置密码');

  // 登出并清空本机身份 + Cookie —— 模拟「换了台设备」；重进时不带 identity=1（自动化环境不自动建号）
  await page.getByRole('button', { name: /返回启动页/ }).click();
  await context.clearCookies();
  await page.evaluate(key => localStorage.removeItem(key), IDENTITY_KEY);
  await page.goto('/');
  await expect.poll(async () => page.evaluate(key => localStorage.getItem(key), IDENTITY_KEY)).toBe(null);

  // 无身份：账户面板显示登录表单（弱密码直接被前端拦截不了，由服务端 401 文案兜底）
  const loginSection = await openAccount(page);
  await expect(loginSection.getByLabel('账号 ID')).toBeVisible();
  await loginSection.getByLabel('账号 ID').fill(originalId);
  await loginSection.getByLabel('密码').fill('wrongpass9');
  await loginSection.getByRole('button', { name: '登录', exact: true }).click();
  await expect(loginSection.locator('.credentials-message.error')).toContainText('账号 ID 或密码不正确');

  // 正确密码：找回成功——面板自动关闭，本机身份切回原账号
  await loginSection.getByLabel('密码').fill('tasty2026');
  await loginSection.getByRole('button', { name: '登录', exact: true }).click();
  await expect(page.locator('.account-credentials')).toBeHidden({ timeout: 10_000 });
  await expect.poll(async () => {
    const raw = await page.evaluate(key => localStorage.getItem(key), IDENTITY_KEY);
    return raw ? (JSON.parse(raw) as { accountId: string }).accountId : null;
  }).toBe(originalId);
});
