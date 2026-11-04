import { test, expect, type Page } from '@playwright/test';

const screens = [
  ['01', '美食大乱斗'], ['02', '选择服务器'], ['03', '开服公告'], ['04', '初识灵界'],
  ['05', '命运的指引'], ['06', '契约特惠'], ['07', '等级礼包'], ['08', '首充赠礼'],
  ['09', '每日充值'], ['10', '七日之约'], ['11', '灵界信使'], ['12', '旅者信箱'],
  ['13', '旅途委托'], ['14', '战斗回放'], ['15', '同行伙伴'], ['16', '主角养成'],
  ['17', '灵界庄园'], ['18', '食灵协会'], ['19', '灵界远征'],
  ['20', '研制坊'], ['21', '时光屋'], ['22', '集市'], ['23', '占星'], ['24', '世界树'], ['25', '活动中心'],
  ['26', '交易坊'], ['27', '街巷食神记'], ['28', '灵晶商城'], ['29', '升星豪礼'], ['30', '开服活动'],
];

for (const [id, name] of screens) {
  test(`Screen ${id}: ${name} renders without errors`, async ({ page }) => {
    const errors: string[] = [];
    const failedAssets: string[] = [];
    page.on('pageerror', error => errors.push(error.message));
    page.on('response', response => {
      if (response.status() >= 400 && /\.(?:woff2?|jpg|png|svg)$/.test(new URL(response.url()).pathname)) failedAssets.push(response.url());
    });
    await page.goto(`/?view=${id}`);
    if (id === '01') {
      await expect(page.getByRole('heading', { name })).toBeVisible();
      await expect(page.getByRole('dialog')).toHaveCount(0);
    } else {
      await expect(page.getByRole('dialog', { name, exact: true })).toBeVisible();
      await expect(page.getByRole('dialog')).toHaveCount(1);
    }
    await page.evaluate(() => document.fonts.ready);
    await expect.poll(() => page.evaluate(() => Array.from(document.images).every(img => img.complete && img.naturalWidth > 0))).toBe(true);
    const sizes = await page.evaluate(() => ({ viewport: window.innerWidth, document: document.documentElement.scrollWidth, loaded: Array.from(document.images).every(img => img.complete && img.naturalWidth > 0) }));
    expect(sizes.document).toBeLessThanOrEqual(sizes.viewport);
    expect(sizes.loaded).toBe(true);
    expect(errors).toEqual([]);
    expect(failedAssets).toEqual([]);
    if (id !== '01') {
      await page.getByRole('button', { name: '关闭弹窗', exact: true }).click();
      await expect(page.getByRole('dialog')).toHaveCount(0);
    }
  });
}

async function createTraveler(page: Page) {
  await page.goto('/');
  await page.getByRole('button', { name: /开始游戏/ }).click();
  await expect(page.getByRole('alert')).toContainText('请先阅读');
  await page.locator('#agreement').check();
  await page.getByRole('button', { name: /开始游戏/ }).click();
  await page.getByRole('textbox', { name: '你的名字' }).fill('星野旅人');
  await page.getByRole('button', { name: /少女/ }).click();
  await page.getByRole('button', { name: '开启我的故事' }).click();
  await expect(page.getByRole('dialog', { name: '命运的指引' })).toBeVisible();
}

test('Account creation, tutorial, summon and persistence', async ({ page }) => {
  await createTraveler(page);
  await page.getByRole('button', { name: '继续聆听' }).click();
  await page.getByRole('button', { name: '继续聆听' }).click();
  await page.getByRole('button', { name: '前往召唤', exact: true }).click();
  await page.getByRole('button', { name: /十次召唤/ }).click();
  await expect(page.locator('.summon-character')).toHaveCount(10);
  await expect(page.getByRole('button', { name: /十次召唤/ })).toBeDisabled();
  const save = await page.evaluate(() => JSON.parse(localStorage.getItem('food-fantasy.save.v1')!));
  expect(save.profile.name).toBe('星野旅人');
  expect(save.profile.gender).toBe('female');
  expect(save.books).toBe(0);
  expect(save.guideCompleted).toBe(true);
  await page.reload();
  // 刷新后应直接回到主城，无需重新同意协议。
  await expect(page.locator('.traveler-profile')).toContainText('星野旅人');
  await expect(page.getByRole('dialog')).toHaveCount(0);
});

test('Server selection, settings, themes and accessible dialog close', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: /选择服务器，当前/ }).click();
  await page.getByRole('button', { name: /美食 18 服/ }).click();
  await expect(page.locator('.realm-select')).toContainText('美食 18 服');
  await page.getByRole('button', { name: '设置', exact: true }).click();
  await page.getByRole('button', { name: '翡翠绿', exact: true }).click();
  await expect(page.locator('.game-app')).toHaveAttribute('data-theme', 'jade');
  await page.getByRole('switch', { name: '灵光粒子' }).click();
  await expect(page.locator('.particles')).toHaveCount(0);
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await page.reload();
  await expect(page.locator('.game-app')).toHaveAttribute('data-theme', 'jade');
  await expect(page.locator('.realm-select')).toContainText('美食 18 服');
  await page.getByRole('button', { name: '排行榜', exact: true }).click();
  // v16：榜单页签与后端真实指标对齐（战力/胜场/世界树），原「图鉴榜」无服务端指标
  await page.getByRole('tab', { name: '胜场榜' }).click();
  await expect(page.getByRole('tab', { name: '胜场榜' })).toHaveAttribute('aria-selected', 'true');
  await page.getByRole('button', { name: '关闭弹窗' }).click();
  await page.getByRole('button', { name: /界面预览/ }).click();
  await expect(page.locator('.preview-grid > button')).toHaveCount(30);
});

test('Simulated offers and daily rewards cannot be claimed twice', async ({ page }) => {
  await createTraveler(page);
  await page.getByRole('button', { name: '跳过引导' }).click();
  await page.getByRole('button', { name: /契约特惠/ }).click();
  await page.getByRole('button', { name: /解锁礼遇/ }).click();
  await expect(page.getByRole('dialog', { name: '确认演示充值' })).toBeVisible();
  await expect(page.getByRole('heading', { name: '这不是一次真实支付' })).toBeVisible();
  await page.getByRole('button', { name: '确认模拟充值 ¥ 18' }).click();
  await expect(page.getByRole('button', { name: '已领取礼遇' })).toBeDisabled();
  await page.getByRole('tab', { name: '等级礼包' }).click();
  await expect(page.getByRole('dialog', { name: '等级礼包' })).toBeVisible();
  await page.getByRole('button', { name: '关闭弹窗' }).click();
  await page.getByRole('button', { name: /每日充值/ }).click();
  await page.getByRole('button', { name: '领取今日奖励' }).click();
  await expect(page.getByRole('button', { name: '本档奖励已领取' })).toBeDisabled();
  await page.getByRole('button', { name: '下一档奖励' }).click();
  await expect(page.locator('.tier-picker')).toContainText('30 元档位奖励');
  await page.getByRole('button', { name: '关闭弹窗' }).click();
  await page.getByRole('button', { name: /七日之约/ }).click();
  await page.getByRole('button', { name: '领取登录赠礼' }).click();
  await expect(page.getByRole('button', { name: '本日奖励已领取' })).toBeDisabled();
  await page.getByRole('button', { name: '第2天奖励' }).click();
  await expect(page.getByRole('button', { name: '即将解锁' })).toBeDisabled();
  await page.getByRole('tab', { name: '限时追加' }).click();
  await page.getByRole('button', { name: '领取追加礼遇' }).click();
  await expect(page.getByRole('button', { name: '追加礼遇已领取' })).toBeDisabled();
  const save = await page.evaluate(() => JSON.parse(localStorage.getItem('food-fantasy.save.v1')!));
  expect(save.books).toBe(39);
  expect(save.gems).toBe(610);
  expect(save.coins).toBe(550000);
  expect(save.dailyPaid).toBe(18);
  expect(save.sevenClaimed).toEqual([1]);
});

test('Invalid role names, focus trap and policy text are handled', async ({ page }) => {
  await page.goto('/?view=create');
  await page.getByRole('button', { name: '开启我的故事' }).click();
  await expect(page.locator('#name-hint')).toContainText('请输入');
  await page.getByRole('button', { name: '随机名字' }).click();
  await expect(page.getByRole('textbox', { name: '你的名字' })).not.toHaveValue('');
  for (let index = 0; index < 12; index++) {
    await page.keyboard.press('Tab');
    expect(await page.evaluate(() => !!document.activeElement?.closest('[role="dialog"]'))).toBe(true);
  }
  await page.getByRole('button', { name: '关闭弹窗' }).click();
  await page.getByRole('button', { name: '返回启动页', exact: true }).click();
  await page.getByRole('button', { name: '《隐私保护指引》' }).click();
  await expect(page.getByRole('dialog', { name: '隐私保护指引' })).toBeVisible();
  await expect(page.locator('.policy-content')).toContainText('localStorage');
});

test('First purchase unlocks correctly and next-day rewards persist', async ({ page }) => {
  await createTraveler(page);
  await page.getByRole('button', { name: '跳过引导' }).click();
  await page.getByRole('button', { name: /首充赠礼/ }).click();
  await page.getByRole('button', { name: /解锁首充礼遇/ }).click();
  await page.getByRole('button', { name: '确认模拟充值 ¥ 6' }).click();
  await expect(page.getByRole('button', { name: '今日赠礼已领取' })).toBeDisabled();
  await page.getByRole('tab', { name: '第 2 天领取' }).click();
  await expect(page.getByRole('button', { name: '即将解锁' })).toBeDisabled();
  await page.evaluate(() => {
    const save = JSON.parse(localStorage.getItem('food-fantasy.save.v1')!);
    const previousDay = new Date();
    previousDay.setDate(previousDay.getDate() - 1);
    save.firstPurchasedAt = previousDay.toISOString();
    save.profile.createdAt = previousDay.toISOString();
    localStorage.setItem('food-fantasy.save.v1', JSON.stringify(save));
  });
  await page.goto('/?view=08');
  await page.getByRole('tab', { name: '第 2 天领取' }).click();
  await page.getByRole('button', { name: '领取今日赠礼' }).click();
  await expect(page.getByRole('button', { name: '今日赠礼已领取' })).toBeDisabled();
  await page.goto('/?view=10');
  await page.getByRole('button', { name: '领取登录赠礼' }).click();
  const save = await page.evaluate(() => JSON.parse(localStorage.getItem('food-fantasy.save.v1')!));
  expect(save.firstClaimed).toEqual([1, 2]);
  expect(save.characters).toContain('蓝纹奶酪');
  expect(save.characters).toContain('冬阴功');
  expect(save.chests).toBe(1);
  expect(save.gems).toBe(250);
  await page.getByRole('button', { name: '关闭弹窗' }).click();
  await page.locator('.traveler-profile').click();
  await page.getByRole('button', { name: '清除本地演示进度' }).click();
  await page.getByRole('button', { name: '确认清除' }).click();
  await expect(page.getByRole('heading', { name: '美食大乱斗' })).toBeVisible();
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('food-fantasy.save.v1')!).profile)).toBeNull();
});

test('Malformed local data recovers and maintenance servers are disabled', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto('/');
  await page.evaluate(() => {
    localStorage.setItem('food-fantasy.save.v1', '{broken JSON');
    localStorage.setItem('food-fantasy.preferences.v1', '{broken JSON');
  });
  await page.reload();
  await expect(page.getByRole('heading', { name: '美食大乱斗' })).toBeVisible();
  await page.getByRole('button', { name: /选择服务器，当前/ }).click();
  await page.getByRole('tab', { name: '美食一区' }).click();
  await expect(page.getByRole('button', { name: /美食 8 服/ })).toBeDisabled();
  expect(errors).toEqual([]);
});
test('Lobby rails expose every estate entry point', async ({ page }) => {
  await createTraveler(page);
  await page.getByRole('button', { name: '跳过引导' }).click();
  await expect(page.locator('.lobby-left-actions .nav-action')).toHaveCount(8);
  await expect(page.locator('.activity-rail > button')).toHaveCount(6);
  await expect(page.locator('.activity-cell')).toHaveCount(8);
  for (const name of ['背包', '研制坊', '时光屋', '集市', '占星', '世界树']) {
    await expect(page.locator('.activity-rail').getByRole('button', { name })).toBeVisible();
  }
  await expect(page.locator('.lobby-footer nav > button')).toHaveCount(6);
  for (const name of ['大厅', '食灵', '主角', '庄园', '协会', '战斗']) {
    await expect(page.getByRole('navigation', { name: '主导航' }).getByRole('button', { name })).toBeVisible();
  }
  await page.getByRole('navigation', { name: '主导航' }).getByRole('button', { name: '战斗' }).click();
  await expect(page.getByRole('dialog', { name: '灵界远征' })).toBeVisible();
  await expect(page.locator('.battle-member')).toHaveCount(1);
  await page.locator('.stage-list button', { hasText: '钟塔回廊' }).click();
  await page.getByRole('button', { name: '开始远征', exact: true }).click();
  await expect(page.getByRole('dialog', { name: '月桥战场' })).toBeVisible();
  await page.getByRole('button', { name: '跳至结算', exact: true }).click();
  await page.getByRole('button', { name: '查看战斗结算', exact: true }).click();
  await expect(page.getByRole('dialog', { name: '远征结算' })).toBeVisible();
  await page.getByRole('button', { name: '收录本次战报', exact: true }).click();
  await page.getByRole('button', { name: '继续远征', exact: true }).click();
  await page.keyboard.press('Escape');
  await page.getByRole('navigation', { name: '主导航' }).getByRole('button', { name: '主角' }).click();
  await expect(page.locator('.hero-stats > div')).toHaveCount(6);
  await expect(page.locator('.hero-slot')).toHaveCount(6);
});

test('Estate previews appear in the interface catalog', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: /界面预览/ }).click();
  await expect(page.locator('.preview-subtitle')).toContainText('主城功能界面');
  await expect(page.locator('.preview-grid > button')).toHaveCount(30);
  await page.locator('.preview-grid > button', { hasText: '灵界远征' }).click();
  await expect(page.getByRole('dialog', { name: '灵界远征' })).toBeVisible();
});


const seedResources = async (page: import('@playwright/test').Page, overrides: Record<string, unknown> = {}) => {
  await page.evaluate(data => {
    const save = JSON.parse(localStorage.getItem('food-fantasy.save.v1')!);
    localStorage.setItem('food-fantasy.save.v1', JSON.stringify({ ...save, ...data }));
  }, overrides);
  await page.reload();
};

test('Quest and mail rewards can only be claimed once', async ({ page }) => {
  await createTraveler(page);
  await page.getByRole('button', { name: '跳过引导' }).click();
  await page.getByRole('button', { name: /七日之约/ }).click();
  await page.getByRole('button', { name: '领取登录赠礼' }).click();
  await expect(page.getByRole('button', { name: '本日奖励已领取' })).toBeDisabled();
  await page.keyboard.press('Escape');

  await page.locator('.lobby-left-actions').getByRole('button', { name: '任务' }).click();
  await expect(page.getByRole('dialog', { name: '旅途委托' })).toBeVisible();
  await page.getByRole('tab', { name: '日常' }).click();
  const quest = page.locator('.quest-list > li', { hasText: '七日之约' });
  await quest.getByRole('button', { name: '领取', exact: true }).click();
  await expect(quest.getByRole('button', { name: '已领取' })).toBeVisible();
  await page.keyboard.press('Escape');

  await page.locator('.lobby-left-actions').getByRole('button', { name: '邮件' }).click();
  await page.getByRole('button', { name: '领取附件' }).click();
  await expect(page.getByRole('button', { name: '附件已领取' })).toBeDisabled();
  await page.keyboard.press('Escape');

  const save = await page.evaluate(() => JSON.parse(localStorage.getItem('food-fantasy.save.v1')!));
  expect(save.claimedQuests).toEqual(['seven-day']);
  expect(save.claimedMail).toEqual(['open']);
});

test('Estate facilities craft, trade and grant permanent bonuses', async ({ page }) => {
  await createTraveler(page);
  await page.getByRole('button', { name: '跳过引导' }).click();
  await seedResources(page, { coins: 900000, leaves: 900, gems: 600 });

  await page.locator('.activity-rail').getByRole('button', { name: '研制坊' }).click();
  await expect(page.getByRole('dialog', { name: '研制坊' })).toBeVisible();
  await page.getByRole('button', { name: '炼制五次' }).click();
  await expect(page.locator('.estate-note').first()).toContainText('已炼制 5 次');
  await expect(page.locator('.estate-copy').first()).toContainText('熟练度加成已生效');

  await page.locator('.facility-strip').getByRole('tab', { name: '时光屋' }).click();
  await page.getByRole('button', { name: '领取累积收益' }).click();
  await expect.poll(() => page.evaluate(() => JSON.parse(localStorage.getItem('food-fantasy.save.v1')!).idleClaimAt)).not.toBeNull();
  await seedResources(page, { idleClaimAt: new Date(Date.now() - 3 * 3600000).toISOString() });
  await page.locator('.activity-rail').getByRole('button', { name: '时光屋' }).click();
  await page.getByRole('button', { name: '领取累积收益' }).click();
  await expect.poll(() => page.evaluate(() => JSON.parse(localStorage.getItem('food-fantasy.save.v1')!).idleClaimAt)).not.toBeNull();

  await page.locator('.facility-strip').getByRole('tab', { name: '集市' }).click();
  await page.locator('.market-grid .claim-chip').first().click();
  await expect(page.locator('.market-grid .claim-chip').first()).toContainText('已兑换');

  await page.locator('.facility-strip').getByRole('tab', { name: '占星' }).click();
  await page.getByRole('button', { name: '星图节点 天枢' }).click();
  await expect(page.getByRole('button', { name: '星图节点 天璇' })).toBeEnabled();

  await page.locator('.facility-strip').getByRole('tab', { name: '世界树' }).click();
  await page.getByRole('button', { name: '升级到 Lv.2' }).click();
  await expect(page.locator('.worldtree-visual')).toContainText('+7%'); // 世界树 5% + 占星 2%
  await expect(page.locator('.estate-copy').first()).toContainText('12 小时');

  const save = await page.evaluate(() => JSON.parse(localStorage.getItem('food-fantasy.save.v1')!));
  expect(save.crafted).toBe(5);
  expect(save.worldtree).toBe(2);
  expect(save.astrology).toEqual(['star-1']);
  expect(save.marketBought.length).toBe(1);
  expect(save.potions).toBeGreaterThan(400000);
});

test('Activity centre handles battle pass, fund and card packs', async ({ page }) => {
  await createTraveler(page);
  await page.getByRole('button', { name: '跳过引导' }).click();
  await page.getByRole('button', { name: /七日之约/ }).click();
  await page.getByRole('button', { name: '领取登录赠礼' }).click();
  await page.keyboard.press('Escape');
  await seedResources(page, { coins: 900000, leaves: 900, books: 12, worldtree: 2, crafted: 6 });

  await page.getByRole('navigation', { name: '活动与礼遇' }).getByRole('button', { name: /活动中心/ }).click();
  await expect(page.getByRole('dialog', { name: '活动中心' })).toBeVisible();

  await page.getByRole('tab', { name: '战令' }).click();
  await expect(page.locator('.bp-list > li').first()).toContainText('Lv.1');
  await page.getByRole('button', { name: '领取', exact: true }).first().click();
  await expect(page.locator('.bp-list > li').first()).toContainText('已领取');

  await page.getByRole('tab', { name: '吃货卡包' }).click();
  await page.getByRole('button', { name: '开启 ×1' }).click();
  await expect(page.locator('.pack-balance')).toContainText('已开启 1 次');
  await expect(page.locator('.pack-faces > span.owned')).toHaveCount(2);

  await page.getByRole('tab', { name: '精选特权' }).click();
  await expect(page.locator('.privilege-list > li.active')).toHaveCount(2);
  await expect(page.locator('.privilege-state').first()).toContainText('生效中');

  await page.getByRole('tab', { name: '超值基金' }).click();
  await page.getByRole('button', { name: /激活基金/ }).click();
  await page.getByRole('button', { name: '确认模拟充值 ¥ 30' }).click();
  // 返回活动中心后停在第一个页签，重新进入超值基金查看状态。
  await page.getByRole('tab', { name: '超值基金' }).click();
  await expect(page.locator('.fund-state')).toContainText('基金已激活');
  // 已拥有 2 位食灵，首档里程碑应可领取。
  await page.locator('.fund-list > li').first().getByRole('button', { name: '领取', exact: true }).click();
  await expect(page.locator('.fund-list > li').first().getByRole('button', { name: '已领取' })).toBeDisabled();

  await page.keyboard.press('Escape');
  const save = await page.evaluate(() => JSON.parse(localStorage.getItem('food-fantasy.save.v1')!));
  expect(save.bpClaimed.length).toBeGreaterThan(0);
  expect(save.packsOpened).toBe(1);
  expect(save.fundPurchased).toBe(true);
  expect(save.fundClaimed).toEqual(['fund-2']);
  expect(save.characters.length).toBe(2);
});

test('Trade post exchanges resources within daily limits', async ({ page }) => {
  await createTraveler(page);
  await page.getByRole('button', { name: '跳过引导' }).click();
  await seedResources(page, { coins: 900000, leaves: 900, gems: 600 });
  await page.locator('.activity-cell', { hasText: '交易坊' }).click();
  await expect(page.getByRole('dialog', { name: '交易坊' })).toBeVisible();
  const first = page.locator('.trade-list > li').first();
  // 限额内按钮保持可用，直到今日次数用完。
  await first.getByRole('button', { name: '兑换', exact: true }).click();
  await expect(first.locator('.trade-limit')).toContainText('2/3');
  for (let i = 0; i < 2; i++) await first.getByRole('button', { name: '兑换', exact: true }).click();
  await expect(first.getByRole('button', { name: '今日已满' })).toBeDisabled();
  await page.keyboard.press('Escape');
  const save = await page.evaluate(() => JSON.parse(localStorage.getItem('food-fantasy.save.v1')!));
  expect(save.tradeCounts).toEqual({ t1: 3 });
  expect(save.books).toBe(13); // 10 份初始契约 + 3 次兑换
});

test('Chronicle milestones unlock from expedition wins', async ({ page }) => {
  await createTraveler(page);
  await page.getByRole('button', { name: '跳过引导' }).click();
  await seedResources(page, { coins: 900000, chroniclePoints: 2 });
  await page.locator('.activity-cell', { hasText: '街巷食神记' }).click();
  await expect(page.getByRole('dialog', { name: '街巷食神记' })).toBeVisible();
  await expect(page.locator('.chronicle-timer')).toContainText(/\d{2}:\d{2}:\d{2}/);
  await page.locator('.milestone-list > li', { hasText: '击败 2 名街头食客' }).getByRole('button', { name: '领取', exact: true }).click();
  await expect(page.locator('.milestone-list > li', { hasText: '击败 2 名街头食客' }).getByRole('button', { name: '已领取' })).toBeDisabled();
  await page.getByRole('button', { name: '前往灵界远征' }).click();
  await expect(page.getByRole('dialog', { name: '灵界远征' })).toBeVisible();
  await page.keyboard.press('Escape');
  const save = await page.evaluate(() => JSON.parse(localStorage.getItem('food-fantasy.save.v1')!));
  expect(save.chronicleClaimed).toEqual(['c2']);
});

test('Badges mark claimable rewards across lobby rails', async ({ page }) => {
  await createTraveler(page);
  await page.getByRole('button', { name: '跳过引导' }).click();
  // 邮件、任务、七日之约、世界树（时光屋）都应有红点。
  await expect(page.locator('.lobby-left-actions .nav-action', { hasText: '邮件' }).locator('.badge-dot')).toHaveText('4');
  // v14 主线链后，新掌灶人出生即有 3 个可领新手任务（点火的人 / 夜市初行 / 听见声音）。
  await expect(page.locator('.lobby-left-actions .nav-action', { hasText: '任务' }).locator('.badge-dot')).toHaveText('3');
  await page.getByRole('button', { name: /七日之约/ }).click();
  await page.getByRole('button', { name: '领取登录赠礼' }).click();
  await page.keyboard.press('Escape');
  await expect(page.locator('.activity-feature').locator('.badge-dot')).toHaveCount(0);
  // 领取登录赠礼后，「七日之约」委托达成，任务红点 +1。
  await expect(page.locator('.lobby-left-actions .nav-action', { hasText: '任务' }).locator('.badge-dot')).toHaveText('4');
  await page.locator('.lobby-left-actions').getByRole('button', { name: '邮件' }).click();
  await page.getByRole('button', { name: '领取附件' }).click();
  await page.keyboard.press('Escape');
  // 邮件需逐封领取，红点数量随之递减。
  await expect(page.locator('.lobby-left-actions .nav-action', { hasText: '邮件' }).locator('.badge-dot')).toHaveText('3');
});

test('Crystal shop grants gems without a real charge', async ({ page }) => {
  await createTraveler(page);
  await page.getByRole('button', { name: '跳过引导' }).click();
  await page.getByRole('button', { name: '打开灵晶商城' }).click();
  await expect(page.getByRole('dialog', { name: '灵晶商城' })).toBeVisible();
  await page.getByRole('button', { name: '¥ 6', exact: true }).click();
  await expect(page.getByRole('heading', { name: '这不是一次真实支付' })).toBeVisible();
  await page.getByRole('button', { name: '确认模拟充值 ¥ 6' }).click();
  await expect(page.getByRole('dialog', { name: '灵晶商城' })).toBeVisible();
  const save = await page.evaluate(() => JSON.parse(localStorage.getItem('food-fantasy.save.v1')!));
  expect(save.gems).toBe(160);
  expect(save.shopBought).toEqual(['gem-6']);
  expect(save.dailyPaid).toBe(6);
});

test('Ascending a spirit spends potions and grants the three-star medal', async ({ page }) => {
  await createTraveler(page);
  await page.getByRole('button', { name: '跳过引导' }).click();
  await seedResources(page, { potions: 200000, leaves: 200 });
  await page.goto('/?view=29');
  await page.locator('.ascend-list > li', { hasText: '青团' }).getByRole('button', { name: '升星' }).click();
  await expect(page.locator('.ascend-list > li', { hasText: '青团' }).locator('.ascend-stars')).toHaveAttribute('aria-label', '2 星');
  await page.locator('.ascend-list > li', { hasText: '青团' }).getByRole('button', { name: '升星' }).click();
  const save = await page.evaluate(() => JSON.parse(localStorage.getItem('food-fantasy.save.v1')!));
  expect(save.stars['青团']).toBe(3);
  expect(save.medals).toBe(1);
  expect(save.potions).toBeLessThan(200000);
});

test('Launch events hub links to each running activity', async ({ page }) => {
  await createTraveler(page);
  await page.getByRole('button', { name: '跳过引导' }).click();
  await page.locator('.activity-cell', { hasText: '开服活动' }).click();
  await expect(page.getByRole('dialog', { name: '开服活动' })).toBeVisible();
  await expect(page.locator('.events-list > li')).toHaveCount(6);
  await expect(page.locator('.events-timer')).toContainText(/\d{2}:\d{2}:\d{2}/);
  await page.locator('.events-list > li', { hasText: '街巷食神记' }).getByRole('button', { name: '前往' }).click();
  await expect(page.getByRole('dialog', { name: '街巷食神记' })).toBeVisible();
  await page.keyboard.press('Escape');
  await page.locator('.activity-cell', { hasText: '开服活动' }).click();
  await page.locator('.events-list > li', { hasText: '灵晶商城' }).getByRole('button', { name: '前往' }).click();
  await expect(page.getByRole('dialog', { name: '灵晶商城' })).toBeVisible();
});
