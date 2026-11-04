import { test, expect } from '@playwright/test';
import { readdir, stat } from 'node:fs/promises';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { artwork, previewScreens, featureScreens } from '../src/game-data';
import { socialContacts, socialGuilds } from '../src/social';

const views = [...previewScreens, ...featureScreens].map(item => ({ id: item.id, name: item.name }));

type Violation = { view: string; node: string; reason: string };

function collectInPage() {
  const visible = (element: Element) => {
    const style = window.getComputedStyle(element);
    const rect = element.getBoundingClientRect();
    return style.visibility !== 'hidden' && style.display !== 'none' && rect.width > 0 && rect.height > 0;
  };
  const textOf = (element: Element | null) => (element?.textContent ?? '').replace(/\s+/g, ' ').trim();
  const labelOf = (element: Element) => {
    const aria = element.getAttribute('aria-label');
    if (aria?.trim()) return aria.trim();
    const labelledby = element.getAttribute('aria-labelledby');
    if (labelledby) {
      const text = labelledby.split(/\s+/).map(id => textOf(document.getElementById(id))).join(' ').trim();
      if (text) return text;
    }
    const title = element.getAttribute('title');
    if (title?.trim()) return title.trim();
    return textOf(element);
  };
  const violations: { node: string; reason: string }[] = [];
  const describe = (element: Element) => `${element.tagName.toLowerCase()}${element.className ? `.${String(element.className).split(' ').filter(Boolean).slice(0, 2).join('.')}` : ''}`;

  document.querySelectorAll('button, a[href], [role="button"]').forEach(element => {
    if (!visible(element)) return;
    if (!labelOf(element)) violations.push({ node: describe(element), reason: 'interactive element has no accessible name' });
  });
  document.querySelectorAll('img').forEach(image => {
    if (!image.hasAttribute('alt')) violations.push({ node: describe(image), reason: 'image is missing an alt attribute' });
  });
  document.querySelectorAll('[role="dialog"]').forEach(dialog => {
    if (!labelOf(dialog)) violations.push({ node: describe(dialog), reason: 'dialog has no accessible name' });
  });
  document.querySelectorAll('input:not([type="hidden"]), select, textarea').forEach(input => {
    if (!visible(input)) return;
    const id = input.getAttribute('id');
    const labelled = input.getAttribute('aria-label') || input.getAttribute('aria-labelledby')
      || (id && document.querySelector(`label[for="${CSS.escape(id)}"]`))
      || input.closest('label');
    if (!labelled) violations.push({ node: describe(input), reason: 'form control has no label' });
  });
  const ids = new Map<string, number>();
  document.querySelectorAll('[id]').forEach(element => ids.set(element.id, (ids.get(element.id) ?? 0) + 1));
  ids.forEach((count, id) => { if (count > 1) violations.push({ node: `#${id}`, reason: 'duplicate id' }); });
  document.querySelectorAll('[tabindex]').forEach(element => {
    if (Number(element.getAttribute('tabindex')) > 0) violations.push({ node: describe(element), reason: 'positive tabindex' });
  });
  return violations;
}

test('Every screen exposes accessible names, labels and unique ids', async ({ page }) => {
  const violations: Violation[] = [];
  for (const view of views) {
    await page.goto(`/?view=${view.id}`, { waitUntil: 'domcontentloaded' });
    await page.evaluate(() => document.fonts.ready);
    const found = await page.evaluate(collectInPage);
    found.forEach(item => violations.push({ view: `${view.id} ${view.name}`, ...item }));
  }
  expect(violations, violations.map(item => `${item.view} · ${item.node} · ${item.reason}`).join('\n')).toEqual([]);
});

test('Login title stays centered on desktop and wide desktop screens', async ({ page }) => {
  test.skip(test.info().project.name !== 'desktop', 'wide viewport geometry is checked once');
  for (const width of [1440, 1920]) {
    await page.setViewportSize({ width, height: 1000 });
    await page.goto('/?view=01');
    const layout = await page.evaluate(() => {
      const main = document.querySelector('.login-main')!.getBoundingClientRect();
      const brand = document.querySelector('.brand-composition')!.getBoundingClientRect();
      return { main: main.left + main.width / 2, brand: brand.left + brand.width / 2 };
    });
    expect(Math.abs(layout.brand - layout.main), `brand should be centered at ${width}px`).toBeLessThan(1.5);
  }
});

async function walk(directory: string): Promise<string[]> {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = await Promise.all(entries.map(entry => entry.isDirectory() ? walk(path.join(directory, entry.name)) : [path.join(directory, entry.name)]));
  return files.flat();
}

test('Illustrations are referenced and stay inside the asset budget', async () => {
  const files = (await walk('public/images')).filter(file => /\.(?:webp|jpe?g|png|svg)$/.test(file));
  const sources = (await walk('src')).map(file => readFileSync(file, 'utf8')).join('\n') + readFileSync('index.html', 'utf8');
  const unreferenced: string[] = [];
  const sizeByVariant = { webp: 0, jpeg: 0 };
  for (const file of files) {
    const name = path.basename(file);
    const size = (await stat(file)).size;
    const ext = path.extname(name);
    if (ext === '.webp') sizeByVariant.webp += size;
    else sizeByVariant.jpeg += size;
    const base = name.slice(0, -ext.length);
    if (!sources.includes(name) && !sources.includes(`${base}.jpg`)) unreferenced.push(name);
    expect(size, `${name} is too heavy`).toBeLessThan(540_000);
  }
  expect(unreferenced, 'illustrations not referenced by the UI').toEqual([]);
  expect(sizeByVariant.webp, 'optimized artwork budget').toBeLessThan(4_200_000);
  expect(sizeByVariant.jpeg, 'fallback artwork budget').toBeLessThan(5_500_000);

  /**
   * v22 资源内联（T-ASSET）：`artwork` / 社交头像的值已是 data URI，
   * 不能再当作 public/ 下的文件路径去 stat（旧写法把 400KB base64 当文件名 → ENAMETOOLONG）。
   * 改为按「内联是否生效」断言；若未来某个资源回退为相对路径，仍按文件存在性校验。
   */
  const requiredArt = new Set([
    ...Object.values(artwork),
    ...socialContacts.map(contact => contact.image),
    ...socialGuilds.map(guild => guild.image),
  ]);
  for (const src of requiredArt) {
    if (src.startsWith('data:image/webp;base64,')) continue; // 已内联，无需物理文件
    const original = path.join('public', src);
    const optimized = original.replace(/\.jpe?g$/i, '.webp');
    expect((await stat(original)).size, `${original} must be present`).toBeGreaterThan(0);
    expect((await stat(optimized)).size, `${optimized} must be present`).toBeGreaterThan(0);
  }

  const fontFiles = (await walk('public/fonts')).filter(file => file.endsWith('.woff2'));
  expect(fontFiles.length, 'font subsets must be shipped with the app').toBeGreaterThanOrEqual(3);
  let fontBytes = 0;
  for (const file of fontFiles) fontBytes += (await stat(file)).size;
  expect(fontBytes, 'total font weight').toBeLessThan(600_000);
  const loader = readFileSync('src/fonts.ts', 'utf8');
  for (const file of fontFiles) expect(loader, `${path.basename(file)} must be registered`).toContain(path.basename(file));

  const absolute = [...(await walk('src')), 'index.html']
    .filter(file => /\.(?:tsx?|css)$/.test(file) || file === 'index.html')
    .flatMap(file => {
      const text = readFileSync(file, 'utf8');
      return [...text.matchAll(/["']\/(?:images|fonts)\/[^"']+/g)].map(match => `${file}: ${match[0]}`);
    });
  expect(absolute, 'root-absolute asset paths break subdirectory deployments').toEqual([]);
});

test('Static assets are inlined into the single-file bundle (v22 T-ASSET)', async () => {
  // 生成器产物存在且 11 张 webp / 3 个 woff2 全部内联 —— 这是「构建产物只剩 index.html」的前提
  const generated = readFileSync(path.join('src', 'generated', 'assets.ts'), 'utf8');
  expect((generated.match(/data:image\/webp;base64,/g) ?? []).length, '11 张背景图应全部内联为 webp data URI').toBe(11);
  expect((generated.match(/data:font\/woff2;base64,/g) ?? []).length, '3 个字体应全部内联为 woff2 data URI').toBe(3);
  expect(generated, '应同时登记 .jpg 逻辑键（历史引用零改动）').toContain('"images/');
  expect(generated, 'favicon 应内联').toContain('"data:image/svg+xml;base64,');
  // 统一解析入口必须查内联表，未命中才回退相对路径
  const resolver = readFileSync(path.join('src', 'assets.ts'), 'utf8');
  expect(resolver).toContain('ASSET_DATA_URIS');
  expect(resolver).toContain('document.baseURI');
});

test('Short mobile screens keep login consent and game navigation on screen', async ({ page }) => {
  test.skip(test.info().project.name !== 'desktop', 'compact phone geometry is measured once');
  await page.setViewportSize({ width: 320, height: 568 });
  await page.goto('/');

  const login = await page.evaluate(() => {
    const box = (selector: string) => {
      const element = document.querySelector(selector);
      if (!element) return null;
      const rect = element.getBoundingClientRect();
      return { top: rect.top, bottom: rect.bottom };
    };
    return {
      width: document.documentElement.scrollWidth,
      height: document.documentElement.scrollHeight,
      viewport: innerHeight,
      start: box('.start-button'),
      consent: box('.consent-row'),
      preview: box('.preview-link'),
    };
  });
  expect(login.width).toBe(320);
  expect(login.height).toBe(568);
  for (const [name, bounds] of Object.entries({ start: login.start, consent: login.consent, preview: login.preview })) {
    expect(bounds, `${name} should remain reachable without a page scroll`).not.toBeNull();
    expect(bounds!.top).toBeGreaterThanOrEqual(0);
    expect(bounds!.bottom).toBeLessThanOrEqual(login.viewport);
  }

  await page.getByRole('button', { name: /开始游戏/ }).click();
  await page.locator('#agreement').check();
  await page.getByRole('button', { name: /开始游戏/ }).click();
  await page.getByRole('textbox', { name: '你的名字' }).fill('短屏旅者');
  await page.getByRole('button', { name: '开启我的故事' }).click();
  await page.getByRole('button', { name: '跳过引导' }).click();
  const lobby = await page.evaluate(() => {
    const element = document.querySelector('.lobby-footer nav');
    const rect = element?.getBoundingClientRect();
    return {
      width: document.documentElement.scrollWidth,
      height: document.documentElement.scrollHeight,
      viewport: innerHeight,
      bottom: rect?.bottom ?? null,
    };
  });
  expect(lobby.width).toBe(320);
  expect(lobby.height).toBe(568);
  expect(lobby.bottom).not.toBeNull();
  expect(lobby.bottom!).toBeLessThanOrEqual(lobby.viewport);
});

test('All dialogs stay inside the viewport at 320x568 and keep the close control reachable', async ({ page }) => {
  test.skip(test.info().project.name !== 'desktop', 'compact dialog geometry is measured once');
  await page.setViewportSize({ width: 320, height: 568 });
  const issues: string[] = [];

  for (const view of views.filter(item => item.id !== '01')) {
    await page.goto(`/?view=${view.id}`);
    const state = await page.evaluate(() => {
      const dialog = document.querySelector('.game-dialog');
      const close = dialog?.querySelector('.dialog-close');
      const dialogRect = dialog?.getBoundingClientRect();
      const closeRect = close?.getBoundingClientRect();
      return {
        width: document.documentElement.scrollWidth,
        dialog: dialogRect ? { top: dialogRect.top, bottom: dialogRect.bottom } : null,
        close: closeRect ? { top: closeRect.top, bottom: closeRect.bottom } : null,
      };
    });
    if (state.width !== 320) issues.push(`${view.id} ${view.name}: horizontal overflow (${state.width}px)`);
    if (!state.dialog) issues.push(`${view.id} ${view.name}: dialog not mounted`);
    else if (state.dialog.top < 0 || state.dialog.bottom > 568) issues.push(`${view.id} ${view.name}: dialog escapes viewport`);
    if (!state.close || state.close.top < 0 || state.close.bottom > 568) issues.push(`${view.id} ${view.name}: close button outside viewport`);
  }

  expect(issues).toEqual([]);
});
