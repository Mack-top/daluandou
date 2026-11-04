import { test, expect, type Page } from '@playwright/test';
import { createFreshSave } from '../src/game-clock';

const saveKey = 'food-fantasy.save.v1';
async function seedTraveler(page: Page, view = '15') {
  await page.goto('/');
  await page.evaluate(({ key, fresh }) => {
    localStorage.setItem(key, JSON.stringify({ ...fresh, profile: { name: '月下拾味', gender: 'female', createdAt: new Date().toISOString() }, guideCompleted: true }));
    localStorage.setItem('food-fantasy.session.v1', JSON.stringify({ screen: 'lobby' }));
  }, { key: saveKey, fresh: createFreshSave() });
  await page.goto(`/?view=${view}`);
}

async function chooseRecipient(page: Page, id: string, name: string) {
  const select = page.getByRole('combobox', { name: '私聊对象' });
  if (await select.isVisible()) await select.selectOption(id);
  else await page.locator('.social-chat-contacts').getByRole('button', { name: new RegExp(name) }).click();
}

async function joinGuild(page: Page, name = '桂花小筑') {
  await page.locator('.social-guild-list > li', { hasText: name }).getByRole('button', { name: '申请加入', exact: true }).click();
  await page.getByRole('button', { name: '模拟审批通过', exact: true }).click();
  await expect(page.locator('.social-guild-banner h3')).toHaveText(name);
}

test('friend search, invitation acceptance and explicit approval lead to the correct private chat', async ({ page }) => {
  await seedTraveler(page);
  await page.getByRole('tab', { name: /申请/ }).click();
  await page.getByRole('button', { name: '接受申请', exact: true }).click();
  await page.getByRole('tab', { name: /结识旅人/ }).click();
  await page.getByRole('textbox', { name: '搜索旅人' }).fill('10017');
  await expect(page.locator('.social-contact-list > li')).toHaveCount(1);
  await page.getByRole('button', { name: '申请结识', exact: true }).click();
  await page.reload();
  await page.getByRole('tab', { name: /申请/ }).click();
  await expect(page.locator('[data-request=moon]')).toContainText('尚未通过');
  await page.getByRole('button', { name: '模拟对方同意', exact: true }).click();
  await page.getByRole('tab', { name: /我的好友/ }).click();
  await expect(page.locator('.social-contact-list > li')).toHaveCount(3);
  await page.locator('[data-contact=moon]').getByRole('button', { name: '私聊', exact: true }).click();
  await expect(page.locator('.social-thread-heading h3')).toHaveText('月下拾味人');
  await page.getByRole('textbox', { name: '聊天内容' }).fill('一起去月桥看看。');
  await page.getByRole('button', { name: '保存发言', exact: true }).click();
  const save = await page.evaluate(key => JSON.parse(localStorage.getItem(key)!), saveKey);
  expect(save.social.friends).toEqual(['qing', 'tea', 'moon']);
  expect(save.social.messages[0].thread).toBe('dm:moon');
  expect(save.social.messages[0].text).toBe('一起去月桥看看。');
});

test('withdraw, decline and confirmed removal persist without resurrecting requests', async ({ page }) => {
  await seedTraveler(page);
  await page.getByRole('tab', { name: /结识旅人/ }).click();
  await page.locator('[data-contact=moon]').getByRole('button', { name: '申请结识', exact: true }).click();
  await page.getByRole('tab', { name: /申请/ }).click();
  await page.getByRole('button', { name: '撤回申请', exact: true }).click();
  await page.getByRole('button', { name: '婉拒', exact: true }).click();
  await page.getByRole('tab', { name: /我的好友/ }).click();
  await page.getByRole('button', { name: '移除青团', exact: true }).click();
  await page.getByRole('button', { name: '保留好友', exact: true }).click();
  await expect(page.locator('[data-contact=qing]')).toBeVisible();
  await page.getByRole('button', { name: '移除青团', exact: true }).click();
  await page.getByRole('button', { name: '确认移除', exact: true }).click();
  await page.reload();
  await expect(page.getByRole('heading', { name: '还没有同行的伙伴' })).toBeVisible();
  const save = await page.evaluate(key => JSON.parse(localStorage.getItem(key)!), saveKey);
  expect(save.social.friends).toEqual([]);
  expect(save.social.incomingRequests).toEqual([]);
  expect(save.social.sentRequests).toEqual([]);
});

test('drafts and messages stay separate across world, guild and private recipients', async ({ page }) => {
  await seedTraveler(page, '11');
  await page.getByRole('textbox', { name: '聊天内容' }).fill('世界频道的草稿');
  await page.getByRole('tab', { name: '私聊', exact: true }).click();
  await page.getByRole('textbox', { name: '聊天内容' }).fill('青团的草稿');
  await page.getByRole('tab', { name: '世界', exact: true }).click();
  await expect(page.getByRole('textbox', { name: '聊天内容' })).toHaveValue('世界频道的草稿');
  await page.reload();
  await expect(page.getByRole('textbox', { name: '聊天内容' })).toHaveValue('世界频道的草稿');
  await page.getByRole('button', { name: '保存发言', exact: true }).click();
  await page.getByRole('tab', { name: '私聊', exact: true }).click();
  await expect(page.getByRole('textbox', { name: '聊天内容' })).toHaveValue('青团的草稿');
  await expect(page.locator('.social-message.self')).toHaveCount(0);
  await page.getByRole('button', { name: '保存发言', exact: true }).click();
  await page.getByRole('tab', { name: '协会', exact: true }).click();
  await expect(page.getByRole('textbox', { name: '聊天内容' })).toBeDisabled();
  await page.getByRole('button', { name: '前往协会', exact: true }).click();
  await joinGuild(page);
  await page.getByRole('button', { name: '前往协会频道', exact: true }).click();
  await page.getByRole('textbox', { name: '聊天内容' }).fill('协会频道的问候');
  await page.getByRole('button', { name: '保存发言', exact: true }).click();
  await expect(page.locator('.social-message.self')).toHaveCount(1);
  const save = await page.evaluate(key => JSON.parse(localStorage.getItem(key)!), saveKey);
  expect(save.social.messages.map((message: { thread: string }) => message.thread)).toEqual(['world', 'dm:qing', 'guild:osmanthus']);
});

test('switching recipients does not mix private transcripts and clear is scoped to the current channel', async ({ page }) => {
  await seedTraveler(page);
  await page.getByRole('tab', { name: /申请/ }).click();
  await page.getByRole('button', { name: '接受申请', exact: true }).click();
  await page.goto('/?view=11');
  await page.getByRole('tab', { name: '私聊', exact: true }).click();
  await page.getByRole('textbox', { name: '聊天内容' }).fill('只给青团的记录');
  await page.getByRole('button', { name: '保存发言', exact: true }).click();
  await chooseRecipient(page, 'tea', '半盏桂花茶');
  await expect(page.locator('.social-message.self')).toHaveCount(0);
  await page.getByRole('textbox', { name: '聊天内容' }).fill('只给桂花茶的记录');
  await page.getByRole('button', { name: '保存发言', exact: true }).click();
  await page.getByRole('button', { name: '清空本频道记录' }).click();
  await page.getByRole('button', { name: '保留记录', exact: true }).click();
  await expect(page.locator('.social-message.self')).toHaveCount(1);
  await page.getByRole('button', { name: '清空本频道记录' }).click();
  await page.getByRole('button', { name: '确认清空', exact: true }).click();
  await expect(page.locator('.social-message.self')).toHaveCount(0);
  await chooseRecipient(page, 'qing', '青团');
  await expect(page.locator('.social-message.self p')).toHaveText('只给青团的记录');
});

test('guild join, daily rewards, donation and leave are persistent and cannot be reset by switching guilds', async ({ page }) => {
  await seedTraveler(page, '18');
  await page.locator('.social-guild-list > li', { hasText: '桂花小筑' }).getByRole('button', { name: '申请加入', exact: true }).click();
  await page.reload();
  await expect(page.locator('.social-guild-application')).toContainText('桂花小筑');
  await page.getByRole('button', { name: '模拟审批通过', exact: true }).click();
  await page.getByRole('button', { name: '协会签到', exact: true }).click();
  await expect(page.getByRole('button', { name: '协会签到', exact: true })).toBeDisabled();
  await page.getByRole('button', { name: '协会捐献', exact: true }).click();
  await expect(page.locator('.social-guild-contribution')).toContainText('50');
  await page.reload();
  await expect(page.getByRole('button', { name: '协会签到', exact: true })).toBeDisabled();
  await expect(page.getByRole('button', { name: '协会捐献', exact: true })).toBeDisabled();
  await page.getByRole('tab', { name: '成员一览', exact: true }).click();
  await expect(page.locator('.social-guild-self')).toContainText('月下拾味');
  await page.getByRole('tab', { name: '本地日志', exact: true }).click();
  await expect(page.locator('.social-guild-event-log')).toContainText('完成今日签到');
  await page.getByRole('button', { name: '退出本地协会', exact: true }).click();
  await page.getByRole('button', { name: '继续同行', exact: true }).click();
  await expect(page.locator('.social-guild-banner')).toBeVisible();
  await page.getByRole('button', { name: '退出本地协会', exact: true }).click();
  await page.getByRole('button', { name: '确认退出协会', exact: true }).click();
  await joinGuild(page, '星河食盟');
  await expect(page.getByRole('button', { name: '协会签到', exact: true })).toBeDisabled();
  await expect(page.getByRole('button', { name: '协会捐献', exact: true })).toBeDisabled();
  const save = await page.evaluate(key => JSON.parse(localStorage.getItem(key)!), saveKey);
  expect(save.coins).toBe(45000);
  expect(save.social.contribution).toBe(50);
  expect(save.social.guildId).toBe('starlight');
});

test('chat stores literal text, handles composition, and keeps keyboard focus within the active dialog', async ({ page }) => {
  await seedTraveler(page, '11');
  const input = page.getByRole('textbox', { name: '聊天内容' });
  await input.fill('   ');
  await expect(page.getByRole('button', { name: '保存发言', exact: true })).toBeDisabled();
  await input.fill('<img src=x onerror=alert(1)>');
  await input.dispatchEvent('keydown', { key: 'Enter', code: 'Enter', isComposing: true });
  await expect(page.locator('.social-message.self')).toHaveCount(0);
  await input.press('Enter');
  await expect(page.locator('.social-message.self p')).toHaveText('<img src=x onerror=alert(1)>');
  await expect(page.locator('.social-message.self p img')).toHaveCount(0);
  for (let i = 0; i < 15; i++) {
    await page.keyboard.press('Tab');
    expect(await page.evaluate(() => !!document.activeElement?.closest('[role=dialog]'))).toBe(true);
  }
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog')).toHaveCount(0);
});

test('social layouts remain usable on 320 pixel screens and guest actions do not mutate state', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 740 });
  await seedTraveler(page);
  await page.getByRole('tab', { name: /结识旅人/ }).click();
  await page.getByRole('textbox', { name: '搜索旅人' }).fill('不存在的旅人');
  await expect(page.getByRole('heading', { name: '没有找到这位旅人' })).toBeVisible();
  await page.getByRole('button', { name: '清除搜索' }).click();
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(320);
  await page.goto('/?view=18');
  await joinGuild(page);
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(320);
  await page.getByRole('button', { name: '前往协会频道', exact: true }).click();
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(320);
  await page.evaluate(key => localStorage.removeItem(key), saveKey);
  await page.goto('/?view=11');
  await expect(page.getByRole('textbox', { name: '聊天内容' })).toBeDisabled();
  await expect(page.getByRole('button', { name: '保存发言', exact: true })).toBeDisabled();
});

test('daily association rewards reset at local midnight without network writes', async ({ page }) => {
  await page.clock.install({ time: new Date(2026, 7, 18, 23, 59, 40) });
  const writes: string[] = [];
  page.on('request', request => { if (!['GET', 'HEAD'].includes(request.method())) writes.push(request.url()); });
  await seedTraveler(page, '18');
  await joinGuild(page);
  await page.getByRole('button', { name: '协会签到', exact: true }).click();
  await page.getByRole('button', { name: '协会捐献', exact: true }).click();
  await expect(page.getByRole('button', { name: '协会签到', exact: true })).toBeDisabled();
  await page.clock.fastForward(30000);
  await expect(page.getByRole('button', { name: '协会签到', exact: true })).toBeEnabled();
  await expect(page.getByRole('button', { name: '协会捐献', exact: true })).toBeEnabled();
  await page.getByRole('button', { name: '协会签到', exact: true }).click();
  const save = await page.evaluate(key => JSON.parse(localStorage.getItem(key)!), saveKey);
  expect(save.social.contribution).toBe(70);
  expect(save.coins).toBe(50000);
  expect(writes).toEqual([]);
});

test('moving between associations retains old history without leaking it into the new channel', async ({ page }) => {
  await seedTraveler(page, '18');
  await joinGuild(page);
  await page.getByRole('button', { name: '前往协会频道', exact: true }).click();
  await page.getByRole('textbox', { name: '聊天内容' }).fill('留在桂花小筑的一页。');
  await page.getByRole('button', { name: '保存发言', exact: true }).click();
  await page.goto('/?view=18');
  await page.getByRole('button', { name: '退出本地协会', exact: true }).click();
  await page.getByRole('button', { name: '确认退出协会', exact: true }).click();
  await joinGuild(page, '星河食盟');
  await page.getByRole('button', { name: '前往协会频道', exact: true }).click();
  await expect(page.locator('.social-thread-heading h3')).toHaveText('星河食盟');
  await expect(page.locator('.social-message.self')).toHaveCount(0);
  const save = await page.evaluate(key => JSON.parse(localStorage.getItem(key)!), saveKey);
  expect(save.social.messages[0].thread).toBe('guild:osmanthus');
  expect(save.social.messages[0].text).toBe('留在桂花小筑的一页。');
});