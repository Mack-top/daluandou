import { test, expect } from '@playwright/test';
import { createDefaultSave, previewScreens, featureScreens } from '../src/game-data';

test('Locally hosted title fonts load and preview count matches the catalogue', async ({ page }) => {
  await page.goto('/');
  const loaded = await page.evaluate(async () => {
    const [serif, cinzel] = await Promise.all([
      document.fonts.load('700 24px "Realm Serif"', '美食大乱斗'),
      document.fonts.load('400 16px "Cinzel"', 'FOOD FANTASY'),
    ]);
    return { serif: serif.map(font => font.status), cinzel: cinzel.map(font => font.status) };
  });
  expect(loaded.serif).toEqual(['loaded']);
  expect(loaded.cinzel).toEqual(['loaded']);
  await expect(page.locator('.preview-count')).toHaveText(String(previewScreens.length + featureScreens.length));
});

test.describe('Local calendar rollover', () => {
  test.use({ timezoneId: 'Asia/Shanghai' });

  test('live timers advance and daily resources reset at midnight without a reload', async ({ page }) => {
    await page.clock.install({ time: new Date('2026-10-30T15:59:40Z') });
    const initial = {
      ...createDefaultSave(),
      dailyDate: '2026-10-30', dailyPaid: 18, dailyClaimed: [6],
      marketDate: '2026-10-30', marketBought: ['m1'],
      tradeDate: '2026-10-30', tradeCounts: { t1: 2 },
    };
    await page.addInitScript(save => localStorage.setItem('food-fantasy.save.v1', JSON.stringify(save)), initial);
    await page.goto('/?view=30');
    await expect(page.getByRole('dialog', { name: '开服活动' })).toBeVisible();
    await page.clock.pauseAt(new Date('2026-10-30T15:59:55Z'));

    await expect(page.locator('.events-timer strong')).toHaveText('00:00:05');
    await expect(page.locator('.activity-offer strong')).toHaveText('00:00:05');
    await expect(page.locator('.events-list > li', { hasText: '契约特惠' }).locator('.event-until')).toHaveText('本周 02天00时00分');
    await page.clock.fastForward(10000);

    await expect(page.locator('.events-timer strong')).toHaveText('23:59:55');
    await expect(page.locator('.activity-offer strong')).toHaveText('23:59:55');
    await expect(page.locator('.events-list > li', { hasText: '契约特惠' }).locator('.event-until')).toHaveText('本周 01天23时59分');
    await expect.poll(async () => page.evaluate(() => JSON.parse(localStorage.getItem('food-fantasy.save.v1')!)))
      .toMatchObject({
        dailyDate: '2026-10-31', dailyPaid: 0, dailyClaimed: [],
        marketDate: '2026-10-31', marketBought: [],
        tradeDate: '2026-10-31', tradeCounts: {},
      });
    await expect(page.locator('.estate-copy')).toContainText('不会关闭活动入口');
  });

  test('market and trading dates are restored independently', async ({ page }) => {
    await page.clock.install({ time: new Date('2026-10-31T04:00:00Z') });
    const initial = {
      ...createDefaultSave(),
      dailyDate: '2026-10-31',
      marketDate: '2026-10-31', marketBought: ['m1'],
      tradeDate: '2026-10-30', tradeCounts: { t1: 2 },
    };
    await page.addInitScript(save => localStorage.setItem('food-fantasy.save.v1', JSON.stringify(save)), initial);
    await page.goto('/');
    await expect.poll(async () => page.evaluate(() => JSON.parse(localStorage.getItem('food-fantasy.save.v1')!)))
      .toMatchObject({ marketDate: '2026-10-31', marketBought: ['m1'], tradeDate: '2026-10-31', tradeCounts: {} });
  });
});

test.describe('Daylight saving calendar dates', () => {
  test.use({ timezoneId: 'America/New_York' });

  test('seven-day rewards use local calendar days across a clock change', async ({ page }) => {
    await page.clock.install({ time: new Date('2026-03-09T04:30:00Z') });
    const initial = {
      ...createDefaultSave(),
      profile: { name: '星野旅人', gender: 'female' as const, createdAt: '2026-03-07T17:00:00Z' },
    };
    await page.addInitScript(save => localStorage.setItem('food-fantasy.save.v1', JSON.stringify(save)), initial);
    await page.goto('/?view=10');
    await expect(page.getByRole('button', { name: '第3天奖励' })).toHaveAttribute('aria-pressed', 'true');
    await expect(page.locator('.demo-notice')).toContainText('已登录 3 天');
  });
});
