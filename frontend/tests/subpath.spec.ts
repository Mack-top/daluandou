import { test, expect } from '@playwright/test';
import { createServer } from 'node:http';
import { execSync } from 'node:child_process';
import { readFile, readdir, stat } from 'node:fs/promises';
import path from 'node:path';
import type { AddressInfo } from 'node:net';

const PREFIX = '/xiaoyouxi_A/';

/**
 * v22 资源内联（T-ASSET）后的口径更新：
 * 构建产物 dist/ 只剩 index.html（图片 / 字体 / favicon 全部内联为 data URI），
 * 不再存在 /images/*.jpg 等物理文件，旧断言「JPG 回退到子路径下解析」必然失败。
 * 现改为验证「单文件在子路径部署下自承载」：
 *  1) 构建产物中没有任何 images/ fonts/ favicon.svg 外链（src/href/url/preload）；
 *  2) 从带前缀的静态服务器加载时，图片全部来自 data URI 且解码成功、字体可加载；
 *  3) 部署前缀下没有任何 >= 400 的资源请求。
 */
test('Built single-file site is self-contained under a subdirectory deployment', async ({ page }) => {
  test.skip(test.info().project.name !== 'desktop', 'deployment build is verified once');
  test.setTimeout(120_000);

  execSync('npm run build', { stdio: 'ignore' });
  const root = path.resolve('dist');

  // 产物结构检查：dist 只允许 index.html，且内容零外链资源引用
  const distEntries = (await readdir(root)).sort();
  expect(distEntries, 'dist/ 应只包含 index.html（资源全部内联，无 images/ fonts/ favicon.svg）').toEqual(['index.html']);
  const html = await readFile(path.join(root, 'index.html'), 'utf8');
  const externalPatterns: [string, RegExp][] = [
    ['src="images/…', /src="images\//],
    ['href="images/…', /href="images\//],
    ['url(images/…)', /url\(\s*['"]?images\//],
    ['src="fonts/…', /src="fonts\//],
    ['href="fonts/…', /href="fonts\//],
    ['url(fonts/…)', /url\(\s*['"]?fonts\//],
    ['href="favicon.svg"', /href="favicon\.svg"/],
    ['<link rel="preload">', /<link[^>]*rel="preload"/],
    ['根绝对路径图片', /src="\/[^"]*\.jpe?g"/],
    ['根绝对路径字体', /href="\/[^"]*\.woff2"/],
  ];
  const leaks = externalPatterns
    .filter(([, pattern]) => pattern.test(html))
    .map(([label]) => label);
  expect(leaks, '构建产物不得包含任何外链资源引用').toEqual([]);
  expect((html.match(/data:image\/webp;base64,/g) ?? []).length, '11 张背景图应内联进 index.html').toBe(11);
  expect((html.match(/data:font\/woff2;base64,/g) ?? []).length, '3 个字体应内联进 index.html').toBe(3);

  const server = createServer(async (request, response) => {
    const url = new URL(request.url ?? '/', 'http://127.0.0.1');
    if (url.pathname === PREFIX.slice(0, -1)) {
      response.writeHead(301, { location: PREFIX + url.search }).end();
      return;
    }
    if (!url.pathname.startsWith(PREFIX)) {
      response.writeHead(404).end('outside deployment prefix');
      return;
    }
    const relative = decodeURIComponent(url.pathname.slice(PREFIX.length)) || 'index.html';
    const file = path.join(root, relative);
    if (!file.startsWith(root)) { response.writeHead(403).end(); return; }
    try {
      const info = await stat(file);
      const target = info.isDirectory() ? path.join(file, 'index.html') : file;
      const body = await readFile(target);
      response.writeHead(200, { 'content-type': 'text/html; charset=utf-8' }).end(body);
    } catch {
      response.writeHead(404).end('not found');
    }
  });
  await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
  const { port } = server.address() as AddressInfo;

  try {
    const failed: string[] = [];
    page.on('response', response => {
      const url = new URL(response.url());
      if (url.pathname.startsWith(PREFIX) && response.status() >= 400) failed.push(`${response.status()} ${url.pathname}`);
    });

    for (const view of ['01', '06', '11', '15', '18', '19']) {
      await page.goto(`http://127.0.0.1:${port}${PREFIX}?view=${view}`, { waitUntil: 'networkidle' });
      await page.evaluate(() => document.fonts.ready);
      const state = await page.evaluate(async () => {
        const images = Array.from(document.images);
        const serif = await document.fonts.load('700 24px "Realm Serif"', '食灵月城');
        return {
          broken: images.filter(image => image.complete && image.naturalWidth === 0).map(image => image.currentSrc),
          nonDataUri: images.filter(image => !image.currentSrc.startsWith('data:')).map(image => image.currentSrc),
          font: serif.map(face => face.status),
          count: images.length,
        };
      });
      expect(state.broken, `broken images on view ${view}`).toEqual([]);
      expect(state.nonDataUri, `view ${view} 图片应全部来自 data URI，而非部署前缀下的物理文件`).toEqual([]);
      expect(state.font).toEqual(['loaded']);
      expect(state.count).toBeGreaterThan(0);
    }

    expect(failed, 'requests under the deployment prefix must succeed').toEqual([]);
  } finally {
    if (!page.isClosed()) await page.goto('about:blank').catch(() => undefined);
    await new Promise<void>((resolve, reject) => {
      server.close(error => error ? reject(error) : resolve());
      server.closeAllConnections();
    });
  }
});
