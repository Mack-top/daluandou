/**
 * v22 GM 台「配置管理」页签 UI 回归。
 *
 * 注意：admin.html 由后端 Express 在 8787 提供（/admin/），不是 Vite 的 5173，
 * 因此用绝对地址跳转。GM IP 白名单默认只放 127.0.0.1，本机浏览器可直连。
 *
 * 凭据：GM_USERNAME / GM_PASSWORD（或 GM_SEED_PASSWORD）。未提供时 CRUD 用例
 * 会明确 skip 并打印原因，绝不伪造登录；页面结构用例无需凭据、始终执行。
 *
 * 数据安全：只用 qa-v22-<ts>-* 临时主键写入 vfx / skills 两个静态定义域，
 * afterAll 无条件经 API 清理（skills 先于 vfx），不触碰玩家数据表。
 */
import { test, expect, request } from '@playwright/test';

const BASE = process.env.QA_ADMIN_BASE ?? 'http://127.0.0.1:8787';
const GM_USER = process.env.GM_USERNAME ?? 'gm-admin';
const GM_PASS = process.env.GM_PASSWORD ?? process.env.GM_SEED_PASSWORD ?? '';
const STAMP = `qa-v22-ui-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
const CRUD_ID = `${STAMP}-crud`;
const FK_VFX_ID = `${STAMP}-fkv`;
const FK_SKILL_ID = `${STAMP}-fks`;

let token = '';

type Headers = Record<string, string>;
const auth = (): Headers => ({ Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' });

const VFX_BODY = (id: string) => ({
  id,
  name: 'QA v22 UI temp',
  type: 'ui',
  asset_path: 'qa://inline',
  duration_ms: 0,
  sort_index: 999999,
});

test('GM 台结构：5 个页签、登录表单与配置管理区块存在', async ({ page }) => {
  const response = await page.goto(`${BASE}/admin/`);
  expect(response?.status(), '/admin/ 应返回 200').toBe(200);
  await expect(page.locator('#login-view')).toBeVisible();
  await expect(page.locator('#login-username')).toBeVisible();
  await expect(page.locator('#login-password')).toBeVisible();
  expect(await page.locator('.nav-item').count(), 'GM 台应有 5 个页签').toBe(5);
  await expect(page.locator('.nav-item[data-tab="config"]')).toHaveText('配置管理');
  expect(await page.locator('#tab-config h2').textContent()).toBe('配置管理');
  await expect(page.locator('#cfg-feedback')).toBeHidden();
});

test.describe('配置管理 CRUD 交互', () => {
  test.describe.configure({ mode: 'serial' });
  test.skip(!GM_PASS, '未提供 GM_PASSWORD / GM_SEED_PASSWORD，GM 台 CRUD 用例跳过（不伪造登录）');

  test('登录 → 切域 → 查看 → 新建/编辑/保存反馈 → 二次确认删除 → 拒绝原因 → 只读域 → 版本提示', async ({ page }) => {
    test.skip(test.info().project.name !== 'desktop', 'CRUD 仅在 desktop 运行，避免双工程并发写同一 DB');

    await test.step('GM 登录并进入配置管理页签', async () => {
      await page.goto(`${BASE}/admin/`);
      await page.locator('#login-username').fill(GM_USER);
      await page.locator('#login-password').fill(GM_PASS);
      await page.locator('#login-form button[type="submit"]').click();
      await expect(page.locator('#main-view')).toBeVisible();
      token = (await page.evaluate(() => sessionStorage.getItem('gm-admin-token'))) ?? '';
      expect(token, '登录应拿到 GM 会话令牌').toBeTruthy();
      await page.locator('.nav-item[data-tab="config"]').click();
      await expect(page.locator('#tab-config')).toBeVisible();
      await expect(page.locator('#cfg-domain-list .cfg-domain-item').first()).toBeVisible();
      expect(await page.locator('#cfg-domain-list .cfg-domain-item').count(),
        '配置域数量应覆盖 23+ 静态表与只读域').toBeGreaterThanOrEqual(23);
      await expect(page.locator('#cfg-feedback')).toContainText('已加载');
    });

    await test.step('切换到 vfx 域并查看列/行/版本', async () => {
      await page.locator('[data-cfg-domain="vfx"]').click();
      await expect(page.locator('#cfg-current-name')).toHaveText('特效定义');
      await expect(page.locator('#cfg-table-head th').first()).toBeVisible();
      await expect(page.locator('#cfg-row-count')).toContainText('行');
      await expect(page.locator('#cfg-current-version')).toContainText('v');
      await expect(page.locator('#cfg-version-total')).toContainText('共');
    });

    const v0 = Number((await page.locator('#cfg-current-version').textContent())?.replace(/\D/g, '') || '0');

    await test.step('新建一行并看到「已新建并生效」+ 版本自增', async () => {
      await page.locator('#cfg-create').click();
      await expect(page.locator('#cfg-form-card')).toBeVisible();
      const field = (col: string) => page.locator(`[data-cfg-col="${col}"] [data-cfg-input]`);
      await field('id').fill(CRUD_ID);
      await field('name').fill('QA v22 UI temp');
      await field('type').fill('ui');
      await field('asset_path').fill('qa://inline');
      await field('duration_ms').fill('0');
      await field('sort_index').fill('999999');
      await page.locator('#cfg-save').click();
      await expect(page.locator('#cfg-feedback')).toContainText('已新建并生效');
      const v1 = Number((await page.locator('#cfg-current-version').textContent())?.replace(/\D/g, '') || '0');
      expect(v1, '新建后版本应自增').toBeGreaterThan(v0);
      await page.locator('#cfg-search').fill(CRUD_ID);
      await expect(page.locator('#cfg-table-body tr').filter({ hasText: CRUD_ID })).toHaveCount(1);
    });

    await test.step('编辑保存并看到「已保存并生效」与值回显', async () => {
      await page.locator('#cfg-search').fill(CRUD_ID);
      await page.locator('#cfg-table-body tr').filter({ hasText: CRUD_ID })
        .locator('[data-cfg-act="edit"]').click();
      await expect(page.locator('#cfg-form-title')).toHaveText('编辑配置行');
      await page.locator('[data-cfg-col="name"] [data-cfg-input]').fill('QA v22 UI edited');
      await page.locator('#cfg-save').click();
      await expect(page.locator('#cfg-feedback')).toContainText('已保存并生效');
      await page.locator('#cfg-search').fill(CRUD_ID);
      await expect(page.locator('#cfg-table-body tr').filter({ hasText: 'QA v22 UI edited' })).toHaveCount(1);
    });

    await test.step('删除被外键引用的行：展示明确拒绝原因且行未被删', async () => {
      const createdVfx = await page.request.post(`${BASE}/api/admin/config/vfx`,
        { headers: auth(), data: VFX_BODY(FK_VFX_ID) });
      expect(createdVfx.status(), '构造引用场景：临时 vfx 应创建成功').toBe(201);
      const createdSkill = await page.request.post(`${BASE}/api/admin/config/skills`, {
        headers: auth(),
        data: {
          id: FK_SKILL_ID, name: 'QA fk skill', kind: 'attack', target_type: 'enemy',
          coefficient_bp: 10000, cooldown: 0, vfx_id: FK_VFX_ID, detail: 'qa',
        },
      });
      expect(createdSkill.status(), '构造引用场景：引用它的 skill 应创建成功').toBe(201);

      await page.locator('#cfg-refresh').click();
      await page.locator('#cfg-search').fill(FK_VFX_ID);
      await expect(page.locator('#cfg-table-body tr').filter({ hasText: FK_VFX_ID })).toHaveCount(1);
      page.once('dialog', dialog => dialog.accept());
      await page.locator('#cfg-table-body tr').filter({ hasText: FK_VFX_ID })
        .locator('[data-cfg-act="delete"]').click();
      await expect(page.locator('#cfg-feedback')).toContainText(/引用|未删除|无法删除/);
      expect(await page.locator('#cfg-table-body tr').filter({ hasText: FK_VFX_ID }).count(),
        '被拒绝的删除不应移除该行').toBeGreaterThan(0);
    });

    await test.step('二次确认后删除临时行，反馈「已删除」且列表不再包含', async () => {
      await page.locator('#cfg-search').fill(CRUD_ID);
      let dialogText = '';
      page.once('dialog', async dialog => {
        dialogText = dialog.message();
        await dialog.accept();
      });
      await page.locator('#cfg-table-body tr').filter({ hasText: CRUD_ID })
        .locator('[data-cfg-act="delete"]').click();
      expect(dialogText, '删除应有二次确认对话框').toContain('确认删除配置行');
      await expect(page.locator('#cfg-feedback')).toContainText('已删除');
      await page.locator('#cfg-search').fill(CRUD_ID);
      await expect(page.locator('#cfg-table-body tr').filter({ hasText: CRUD_ID })).toHaveCount(0);
    });

    await test.step('只读域：新建按钮禁用且展示只读原因；版本提示可见', async () => {
      await page.locator('#cfg-search').fill('');
      await page.locator('[data-cfg-domain="catalog_versions"]').click();
      await expect(page.locator('#cfg-readonly-note')).toBeVisible();
      await expect(page.locator('#cfg-readonly-note')).toContainText('只读');
      await expect(page.locator('#cfg-create')).toBeDisabled();
      expect(await page.locator('#cfg-version-list .cfg-version-chip').count(),
        '生效版本提示应覆盖全部配置域').toBeGreaterThanOrEqual(23);
    });
  });

  test.afterAll(async () => {
    if (!token) return;
    const ctx = await request.newContext();
    try {
      // skills 先删（skill_defs.vfx_id 引用 vfx_defs.id），否则外键保护会拦截
      for (const [domain, id] of [
        ['skills', FK_SKILL_ID],
        ['vfx', FK_VFX_ID],
        ['vfx', CRUD_ID],
      ] as const) {
        await ctx.delete(`${BASE}/api/admin/config/${domain}/${encodeURIComponent(id)}`, { headers: auth() });
      }
    } finally {
      await ctx.dispose();
    }
  });
});
