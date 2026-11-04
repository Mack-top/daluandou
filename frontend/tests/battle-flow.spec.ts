import { test, expect, type Page } from '@playwright/test';
import { createFreshSave } from '../src/game-clock';
import { characters } from '../src/game-data';

const saveKey = 'food-fantasy.save.v1';
async function seedTraveler(page: Page, fullTeam = false) {
  await page.goto('/');
  await page.evaluate(({ key, fresh, names, full }) => {
    localStorage.setItem(key, JSON.stringify({ ...fresh, profile: { name: '星野旅人', gender: 'female', createdAt: new Date().toISOString() }, guideCompleted: true, characters: full ? names : ['青团'], formation: full ? names.slice(0, 3) : ['青团'] }));
    localStorage.setItem('food-fantasy.session.v1', JSON.stringify({ screen: 'lobby' }));
  }, { key: saveKey, fresh: createFreshSave(), names: characters.map(character => character.name), full: fullTeam });
  await page.goto('/?view=19');
}

async function finishAnimation(page: Page) {
  await page.getByRole('button', { name: '跳至结算', exact: true }).click();
  await page.getByRole('button', { name: '查看战斗结算', exact: true }).click();
}

test('a full expedition is settled once and stored replay is read-only', async ({ page }) => {
  await seedTraveler(page);
  await page.getByRole('button', { name: '开始远征', exact: true }).click();
  await expect(page.getByRole('dialog', { name: '月桥战场' })).toBeVisible();
  await expect(page.getByRole('button', { name: '查看战斗结算' })).toHaveCount(0);
  await page.getByRole('button', { name: '逐步播放', exact: true }).click();
  await expect(page.locator('.timeline-counter')).not.toContainText('00 /');
  await page.getByRole('button', { name: '播放速度 1 倍' }).click();
  await expect(page.getByRole('button', { name: '播放速度 2 倍' })).toBeVisible();
  await finishAnimation(page);
  await expect(page.getByRole('heading', { name: '远征凯旋' })).toBeVisible();
  await page.getByRole('button', { name: '领取战利品', exact: true }).click();
  await expect(page.getByText('已存入行囊', { exact: true })).toBeVisible();
  const afterClaim = await page.evaluate(key => JSON.parse(localStorage.getItem(key)!), saveKey);
  expect(afterClaim.battleHistory).toHaveLength(1);
  expect(afterClaim.pendingBattle).toBeNull();
  expect(afterClaim.coins).toBe(60000);
  expect(afterClaim.battleWins).toBe(1);
  expect(afterClaim.chroniclePoints).toBe(1);
  await page.getByRole('button', { name: '回看本次战斗', exact: true }).click();
  await expect(page.getByText('回放模式', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: '跳至结算', exact: true }).click();
  await page.getByRole('button', { name: '查看本次战报', exact: true }).click();
  await expect(page.getByRole('button', { name: '领取战利品' })).toHaveCount(0);
  await page.getByRole('button', { name: '返回战报列表', exact: true }).click();
  await expect(page.locator('.record-list > li')).toHaveCount(1);
  await page.reload();
  await page.goto('/?view=14');
  await page.getByRole('button', { name: '回放初春试炼' }).click();
  await page.getByRole('slider', { name: '战斗进度' }).fill('1');
  await expect(page.locator('.timeline-counter')).toContainText('01 /');
  const afterReplay = await page.evaluate(key => JSON.parse(localStorage.getItem(key)!), saveKey);
  expect(afterReplay.coins).toBe(afterClaim.coins);
  expect(afterReplay.books).toBe(afterClaim.books);
  expect(afterReplay.battleWins).toBe(afterClaim.battleWins);
});

test('an interrupted expedition is restored and a new one cannot overwrite it', async ({ page }) => {
  await seedTraveler(page);
  await page.getByRole('button', { name: '开始远征', exact: true }).click();
  const originalId = await page.evaluate(key => JSON.parse(localStorage.getItem(key)!).pendingBattle.id, saveKey);
  await page.getByRole('button', { name: '暂离战场', exact: true }).click();
  await expect(page.getByRole('button', { name: '开始远征', exact: true })).toBeDisabled();
  await expect(page.locator('.pending-battle')).toContainText('尚未结束');
  await page.reload();
  await expect(page.locator('.pending-battle')).toBeVisible();
  await page.getByRole('button', { name: '继续远征', exact: true }).click();
  expect(await page.evaluate(key => JSON.parse(localStorage.getItem(key)!).pendingBattle.id, saveKey)).toBe(originalId);
  await finishAnimation(page);
  await page.reload();
  await page.getByRole('button', { name: '继续远征', exact: true }).click();
  await finishAnimation(page);
  await page.getByRole('button', { name: '领取战利品', exact: true }).click();
  expect(await page.evaluate(key => JSON.parse(localStorage.getItem(key)!).battleHistory.length, saveKey)).toBe(1);
});

test('rewards shrink after first clearance and defeat does not grant rewards', async ({ page }) => {
  await seedTraveler(page);
  for (let index = 0; index < 2; index++) {
    await page.getByRole('navigation', { name: '远征关卡' }).getByRole('button', { name: /初春试炼/ }).click();
    await page.getByRole('button', { name: '开始远征', exact: true }).click();
    await finishAnimation(page);
    await page.getByRole('button', { name: '领取战利品', exact: true }).click();
    await page.getByRole('button', { name: '继续远征', exact: true }).click();
  }
  const twoWins = await page.evaluate(key => JSON.parse(localStorage.getItem(key)!), saveKey);
  expect(twoWins.coins).toBe(62000);
  expect(twoWins.firstClears).toEqual(['1-1']);
  await page.getByRole('navigation', { name: '远征关卡' }).getByRole('button', { name: /钟塔回廊/ }).click();
  await page.getByRole('button', { name: '开始远征', exact: true }).click();
  await finishAnimation(page);
  await expect(page.getByRole('heading', { name: '暂别战场' })).toBeVisible();
  await page.getByRole('button', { name: '收录本次战报', exact: true }).click();
  const afterLoss = await page.evaluate(key => JSON.parse(localStorage.getItem(key)!), saveKey);
  expect(afterLoss.coins).toBe(twoWins.coins);
  expect(afterLoss.battleWins).toBe(2);
  expect(afterLoss.battleHistory).toHaveLength(3);
});

test('formation and star upgrades affect power and exclude unowned units', async ({ page }) => {
  await seedTraveler(page, true);
  await expect(page.locator('.formation-spirit[aria-pressed=true]')).toHaveCount(3);
  await expect(page.getByRole('button', { name: /拉菲，选择出战/ })).toBeDisabled();
  await page.getByRole('button', { name: /青团，已出战/ }).click();
  await page.getByRole('button', { name: /拉菲，选择出战/ }).click();
  await expect(page.locator('.formation-spirit[aria-pressed=true]')).toHaveCount(3);
  await page.getByRole('button', { name: '开始远征', exact: true }).click();
  const saved = await page.evaluate(key => JSON.parse(localStorage.getItem(key)!), saveKey);
  expect(saved.formation).not.toContain('青团');
  expect(saved.pendingBattle.units.filter((unit: { side: string }) => unit.side === 'ally')).toHaveLength(3);
});

test('daily market, trade and event claims reset without a page refresh', async ({ page }) => {
  const beforeMidnight = new Date(2026, 7, 18, 23, 59, 50);
  await page.clock.install({ time: beforeMidnight });
  await page.goto('/');
  await page.evaluate(key => {
    const save = JSON.parse(localStorage.getItem(key)!);
    localStorage.setItem(key, JSON.stringify({ ...save, profile: { name: '测试旅人', gender: 'female', createdAt: new Date().toISOString() }, guideCompleted: true, coins: 900000, tradeCounts: { t1: 3 }, marketBought: ['m1'], chroniclePoints: 6, chronicleClaimed: ['c1'], dailyPaid: 30, dailyClaimed: [6, 12, 30], firstClears: ['1-1'] }));
  }, saveKey);
  await page.goto('/?view=26');
  await expect(page.locator('.trade-list > li').first().getByRole('button', { name: '今日已满' })).toBeDisabled();
  await page.clock.fastForward(15000);
  await expect(page.locator('.trade-list > li').first().getByRole('button', { name: '兑换', exact: true })).toBeEnabled();
  const save = await page.evaluate(key => JSON.parse(localStorage.getItem(key)!), saveKey);
  expect(save.tradeCounts).toEqual({});
  expect(save.marketBought).toEqual([]);
  expect(save.chronicleClaimed).toEqual([]);
  expect(save.chroniclePoints).toBe(0);
  expect(save.dailyPaid).toBe(0);
  expect(save.firstClears).toEqual(['1-1']);
});

test('new battle surfaces fit narrow viewports without losing controls', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 740 });
  await seedTraveler(page, true);
  await page.getByRole('button', { name: '开始远征', exact: true }).click();
  for (const selector of ['.combat-heading', '.combat-arena', '.playback-controls', '.combat-bottom']) {
    const bounds = await page.locator(selector).boundingBox();
    expect(bounds!.x).toBeGreaterThanOrEqual(0);
    expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(320);
  }
  await finishAnimation(page);
  await expect(page.getByRole('button', { name: '领取战利品' })).toBeEnabled();
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(320);
});

test('normal playback advances, pauses and resumes without creating a second battle', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await seedTraveler(page);
  await page.getByRole('button', { name: '开始远征', exact: true }).click();
  await expect(page.locator('.timeline-counter')).not.toContainText('00 /');
  await page.getByRole('button', { name: '暂停播放', exact: true }).click();
  const paused = await page.locator('.timeline-counter').innerText();
  // Wait longer than one playback tick to verify that pause cancels the scheduled turn.
  await page.waitForTimeout(1000);
  await expect(page.locator('.timeline-counter')).toHaveText(paused);
  await page.getByRole('button', { name: '播放战斗', exact: true }).click();
  await expect(page.locator('.timeline-counter')).not.toHaveText(paused);
  const saved = await page.evaluate(key => JSON.parse(localStorage.getItem(key)!), saveKey);
  expect(saved.pendingBattle).toBeTruthy();
  expect(saved.battleHistory).toEqual([]);
  expect(saved.coins).toBe(50000);
});