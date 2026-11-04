import { test, expect, type Page } from '@playwright/test';
import { createFreshSave } from '../src/game-clock';
import { equipmentCatalogue, type EquipmentInstance } from '../src/equipment';

const key = 'food-fantasy.save.v1';
async function seed(page: Page, equipment: EquipmentInstance[] = [], extra = {}) {
  await page.goto('/');
  await page.evaluate(({ key, fresh, equipment, extra }) => {
    localStorage.setItem(key, JSON.stringify({ ...fresh, profile: { name: '月下拾味', gender: 'female', createdAt: new Date().toISOString() }, guideCompleted: true, equipment, ...extra }));
    localStorage.setItem('food-fantasy.session.v1', JSON.stringify({ screen: 'lobby' }));
  }, { key, fresh: createFreshSave(), equipment, extra });
  await page.goto('/?view=16');
}

function item(id: string, templateId = 'weapon-rare', level = 0): EquipmentInstance {
  return { id, templateId, level, acquiredAt: new Date().toISOString() };
}

test('free starter chest to full equipment works without any simulated purchases', async ({ page }) => {
  await seed(page);
  await expect(page.locator('.hero-slot')).toHaveCount(6);
  await expect(page.getByTestId('hero-power')).toHaveText('9,000');
  await page.getByRole('button', { name: '领取免费启程行装' }).click();
  await expect(page.getByRole('tab', { name: /宝箱/ })).toHaveAttribute('aria-selected', 'true');
  await page.getByRole('button', { name: '领取启程行装', exact: true }).click();
  await expect(page.getByRole('button', { name: '开启五只' })).toBeEnabled();
  await page.getByRole('button', { name: '开启五只' }).click();
  await expect(page.getByRole('region', { name: '宝箱开启结果' })).toBeVisible();
  await expect(page.locator('.chest-drops .gear-tile')).toHaveCount(5);
  await page.getByRole('button', { name: '开启一只' }).click();
  await expect(page.locator('.chest-drops .gear-tile')).toHaveCount(1);
  await expect(page.getByRole('button', { name: '开启一只' })).toBeDisabled();
  await page.getByRole('button', { name: '前往整理装备' }).click();
  await expect(page.locator('.equipment-grid .gear-tile')).toHaveCount(6);
  await page.getByRole('button', { name: '一键最优穿戴' }).click();
  await expect(page.locator('.equipment-grid .gear-worn')).toHaveCount(6);
  await page.getByRole('button', { name: '查看旅者装备' }).click();
  await expect(page.locator('.hero-slot.vacant')).toHaveCount(0);
  await expect(page.getByTestId('hero-power')).not.toHaveText('9,000');
  const save = await page.evaluate(key => JSON.parse(localStorage.getItem(key)!), key);
  expect(save.equipment).toHaveLength(6);
  expect(Object.keys(save.equipped)).toHaveLength(6);
  expect(save.chests).toBe(0);
  expect(save.dailyPaid).toBe(0);
  await page.reload();
  await expect(page.locator('.hero-slot.vacant')).toHaveCount(0);
  await page.getByRole('button', { name: '关闭弹窗', exact: true }).click();
  await page.getByRole('navigation', { name: '主导航' }).getByRole('button', { name: '战斗', exact: true }).click();
  await page.getByRole('button', { name: '开始远征', exact: true }).click();
  const pending = await page.evaluate(key => JSON.parse(localStorage.getItem(key)!).pendingBattle, key);
  expect(pending.power).toBeGreaterThan(9000);
  expect(pending.units[0].maxHp).toBeGreaterThan(2250);
  expect(pending.units[0].defense).toBeGreaterThan(0);
});

test('equipment filter, comparison, replacement and removal retain owned items', async ({ page }) => {
  await seed(page, [item('blade'), item('epic', 'weapon-epic'), item('robe', 'armor-rare')], { equipped: { weapon: 'blade' } });
  await page.getByRole('button', { name: /武器，青芽短刃/ }).click();
  await page.getByRole('button', { name: '更换 / 强化', exact: true }).click();
  await expect(page.getByRole('combobox', { name: '装备部位筛选' })).toHaveValue('weapon');
  await expect(page.locator('.equipment-grid .gear-tile')).toHaveCount(2);
  await page.getByRole('button', { name: '查看月华长刃', exact: true }).click();
  await expect(page.locator('.gear-comparison .gain')).toBeVisible();
  await page.getByRole('button', { name: '替换已装备', exact: true }).click();
  await expect(page.getByRole('button', { name: '卸下装备', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: '卸下后可分解' })).toBeDisabled();
  await page.getByRole('button', { name: '卸下装备', exact: true }).click();
  await expect(page.getByRole('button', { name: '穿戴装备', exact: true })).toBeVisible();
  const save = await page.evaluate(key => JSON.parse(localStorage.getItem(key)!), key);
  expect(save.equipment).toHaveLength(3);
  expect(save.equipped).toEqual({});
  await page.getByRole('combobox', { name: '装备部位筛选' }).selectOption('all');
  await expect(page.locator('.equipment-grid .gear-tile')).toHaveCount(3);
  await page.getByRole('combobox', { name: '装备排序' }).selectOption('newest');
  await expect(page.getByRole('combobox', { name: '装备排序' })).toHaveValue('newest');
});

test('enhancement spends resources once, survives reload, and improves displayed power', async ({ page }) => {
  await seed(page, [item('blade')], { equipped: { weapon: 'blade' }, coins: 100000, leaves: 1000 });
  const before = await page.getByTestId('hero-power').innerText();
  await page.getByRole('button', { name: '更换 / 强化', exact: true }).click();
  await page.getByRole('button', { name: '强化装备', exact: true }).click();
  await expect(page.locator('.gear-detail > h3')).toContainText('+1');
  await page.getByRole('button', { name: '查看旅者装备' }).click();
  await expect(page.getByTestId('hero-power')).not.toHaveText(before);
  const save = await page.evaluate(key => JSON.parse(localStorage.getItem(key)!), key);
  expect(save.equipment[0].level).toBe(1);
  expect(save.coins).toBe(97000);
  expect(save.leaves).toBe(990);
  await page.reload();
  await expect(page.locator('.hero-slot[aria-label*=武器]')).toContainText('+1');
});

test('salvage requires confirmation, blocks worn gear and returns currency exactly once', async ({ page }) => {
  await seed(page, [item('blade')], { equipped: { weapon: 'blade' } });
  await page.getByRole('button', { name: '更换 / 强化', exact: true }).click();
  await expect(page.getByRole('button', { name: '卸下后可分解' })).toBeDisabled();
  await page.getByRole('button', { name: '卸下装备', exact: true }).click();
  await page.getByRole('button', { name: /分解返还/ }).click();
  await expect(page.getByRole('button', { name: '确认分解', exact: true })).toBeVisible();
  await page.getByRole('button', { name: '保留装备', exact: true }).click();
  await expect(page.locator('.equipment-grid .gear-tile')).toHaveCount(1);
  await page.getByRole('button', { name: /分解返还/ }).click();
  await page.getByRole('button', { name: '确认分解', exact: true }).click();
  await expect(page.locator('.equipment-empty')).toBeVisible();
  const save = await page.evaluate(key => JSON.parse(localStorage.getItem(key)!), key);
  expect(save.equipment).toEqual([]);
  expect(save.coins).toBe(52000);
});

test('equipment dialogs fit 320 pixel screens and empty filters remain usable', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 740 });
  const gear = equipmentCatalogue.filter(entry => entry.rarity === 'epic').map((entry, index) => item(`narrow-${index}`, entry.id));
  await seed(page, gear);
  await page.getByRole('button', { name: '一键最优穿戴' }).click();
  await page.getByRole('button', { name: '更换 / 强化', exact: true }).click();
  await page.getByRole('combobox', { name: '装备部位筛选' }).selectOption('all');
  for (const selector of ['.equipment-toolbar', '.equipment-grid', '.gear-detail']) {
    const bounds = await page.locator(selector).boundingBox();
    expect(bounds!.x).toBeGreaterThanOrEqual(0);
    expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(320);
  }
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(320);
  await page.getByRole('combobox', { name: '装备部位筛选' }).selectOption('weapon');
  await expect(page.locator('.equipment-grid .gear-tile')).toHaveCount(1);
  await page.getByRole('tab', { name: /宝箱/ }).click();
  await expect(page.getByRole('button', { name: '开启一只' })).toBeDisabled();
});

test('keyboard focus stays in the equipment dialog and the starter gift is not repeated', async ({ page }) => {
  await seed(page);
  await page.getByRole('button', { name: '领取免费启程行装' }).click();
  await page.getByRole('button', { name: '领取启程行装', exact: true }).click();
  await page.getByRole('button', { name: '开启五只' }).click();
  await page.getByRole('button', { name: '前往整理装备' }).click();
  for (let index = 0; index < 18; index++) {
    await page.keyboard.press('Tab');
    expect(await page.evaluate(() => !!document.activeElement?.closest('[role=dialog]'))).toBe(true);
  }
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await page.goto('/?view=16');
  await page.getByRole('button', { name: '前往行囊开启宝箱' }).click();
  await expect(page.getByRole('button', { name: '领取启程行装', exact: true })).toHaveCount(0);
  const saved = await page.evaluate(key => JSON.parse(localStorage.getItem(key)!), key);
  expect(saved.chests).toBe(1);
  expect(saved.equipment).toHaveLength(5);
});