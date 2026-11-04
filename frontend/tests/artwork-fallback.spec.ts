import { test, expect } from '@playwright/test';
import { artwork } from '../src/game-data';

/**
 * v22 资源内联（T-ASSET）后的口径更新：
 * 旧用例按「public/images 物理文件 + webp 404 时回退 jpg」的布局断言，
 * 并用 page.request.get(data:) 拉取资源 —— 资源内联后 artwork.* 已是 data URI，
 * 会抛 `Protocol "data:" not supported`。
 * 现改为断言「单文件自承载」：全部位图/字体来自 data URI，运行期不发起任何
 * 图片 / 字体网络请求（因此子路径、WebView、离线部署行为完全一致）。
 */

/** 运行期不允许出现的资源网络请求（data URI 不会触发网络，故无需过滤） */
const EXTERNAL_ASSET = /\.(?:jpe?g|jpeg|png|webp|woff2?|svg)$/i;

test('Single-file build inlines every artwork and font, no asset network request is made', async ({ page }) => {
  const assetRequests: string[] = [];
  await page.route(
    url => url.protocol.startsWith('http') && EXTERNAL_ASSET.test(url.pathname),
    route => {
      assetRequests.push(route.request().url());
      return route.abort();
    },
  );

  for (const view of ['01', '05', '06', '08', '11', '15', '18', '19', '22', '27', '28', '29', '30']) {
    await page.goto(`/?view=${view}`, { waitUntil: 'networkidle' });
    const state = await page.evaluate(() => {
      const images = [...document.images].filter(image => image.loading !== 'lazy' || image.getBoundingClientRect().top < innerHeight);
      const scene = document.querySelector('.scene-background') as HTMLElement | null;
      return {
        total: images.length,
        ready: images.every(image => image.complete && image.naturalWidth > 0),
        allDataUri: images.every(image => image.currentSrc.startsWith('data:')),
        sceneBackground: scene ? getComputedStyle(scene).backgroundImage : null,
        fontsLoaded: [...document.fonts].filter(face => face.family.includes('Realm Serif')).map(face => face.status),
      };
    });
    expect(state.ready, `view ${view} 内联图片应全部解码成功`).toBe(true);
    expect(state.allDataUri, `view ${view} 图片 src 应全部为 data URI`).toBe(true);
    if (state.sceneBackground && state.sceneBackground !== 'none') {
      // .scene-background 的主视觉是内部 <img>（data URI 已由上方 allDataUri 覆盖）；
      // 其 CSS background-image 是设计好的渐变兜底，也可能是内联 data URI —— 唯一
      // 不允许出现的是指向外部文件（images/、fonts/ 等）的 url(...)。
      const isInlineOrGradient = /^url\("?data:image\//.test(state.sceneBackground) || state.sceneBackground.includes('gradient(');
      expect(isInlineOrGradient, `view ${view} 场景背景应为内联 data URI 或设计渐变兜底`).toBe(true);
    }
    if (state.fontsLoaded.length) {
      expect(state.fontsLoaded.every(status => status === 'loaded'), `view ${view} Realm Serif 应已加载`).toBe(true);
    }
    expect(state.total, `view ${view} 应仍有位图可渲染`).toBeGreaterThan(0);
  }

  expect(assetRequests, '资源内联后不应再发起任何图片/字体网络请求').toEqual([]);

  // 11 张背景图 + 字体在源码模块层就是 data URI（键仍是 images/*.jpg，指向 webp 字节）
  for (const [key, uri] of Object.entries(artwork)) {
    expect(uri.startsWith('data:image/webp;base64,'), `artwork.${key} 应为内联 webp data URI`).toBe(true);
  }
});

test('every screen remains designed when external raster artwork is unavailable', async ({ page }) => {
  const pageErrors: string[] = [];
  // data URI 不走网络，这里的外链拦截只对「未来可能加回的外链资源」生效；
  // 保留它以维持「即使位图不可用，界面仍完整」的原始验收意图。
  await page.route(
    url => url.protocol.startsWith('http') && /\.(?:jpe?g|jpeg|png|webp)$/i.test(url.pathname),
    route => route.abort(),
  );
  page.on('pageerror', error => pageErrors.push(error.message));

  const scenes: [string, string][] = [
    ['01', '启动页'],
    ['06', '契约特惠'],
    ['11', '灵界信使'],
    ['16', '主角养成'],
    ['18', '食灵协会'],
    ['19', '灵界远征'],
    ['27', '街巷食神记'],
    ['29', '升星豪礼'],
    ['30', '开服活动'],
  ];

  for (const [view, name] of scenes) {
    await page.goto(`/?view=${view}`, { waitUntil: 'networkidle' });
    await page.evaluate(() => document.fonts.ready);

    const state = await page.evaluate(() => {
      const gradientOn = (selector: string) => {
        const node = document.querySelector(selector) as HTMLElement | null;
        if (!node) return null;
        return getComputedStyle(node).backgroundImage !== 'none';
      };
      const dataUriArtwork = (selector: string) => {
        const node = document.querySelector(selector) as HTMLElement | null;
        if (!node) return null;
        const image = /url\("?(data:image\/(?:webp|jpeg|png)[^)"]*)"?/.exec(getComputedStyle(node).backgroundImage ?? '');
        return image ? image[1].startsWith('data:image/') : null;
      };
      return {
        title: document.querySelector('h1, .game-dialog h2, .offer-content h2')?.textContent?.trim() ?? '',
        dialogVisible: !!document.querySelector('[role="dialog"]'),
        sceneGradient: gradientOn('.scene-background'),
        sceneInline: dataUriArtwork('.scene-background'),
        offerGradient: gradientOn('.offer-art'),
        bannerGradient: gradientOn('.expedition-banner'),
        guildGradient: gradientOn('.social-guild-banner'),
        wardrobeGradient: gradientOn('.wardrobe-portrait'),
        createGradient: gradientOn('.create-illustration'),
        guideGradient: gradientOn('.guide-avatar'),
        brokenImages: [...document.images].filter(image => image.complete && image.naturalWidth === 0).length,
        brokenHidden: [...document.images].filter(image => image.complete && image.naturalWidth === 0 && getComputedStyle(image).visibility === 'hidden').length,
        hiddenImages: [...document.images].filter(image => getComputedStyle(image).visibility === 'hidden').length,
        buttonsVisible: [...document.querySelectorAll('button')].some(button => {
          const rect = button.getBoundingClientRect();
          return rect.width > 0 && rect.height > 0 && getComputedStyle(button).visibility !== 'hidden';
        }),
      };
    });

    expect(state.title, `${name} should keep its title`).not.toBe('');
    expect(state.buttonsVisible, `${name} should keep visible actions`).toBe(true);
    expect(state.brokenHidden, `${name} should hide broken images rather than showing placeholders`).toBe(state.brokenImages);
    expect(state.hiddenImages, `${name} should hide each failed image exactly once`).toBe(state.brokenImages);
    const fallbacks = [state.sceneGradient, state.offerGradient, state.bannerGradient, state.guildGradient, state.wardrobeGradient, state.createGradient, state.guideGradient].filter(value => value !== null);
    expect(fallbacks.every(Boolean), `${name} should keep a designed gradient fallback`).toBe(true);
    // v22：主视觉已内联为 data URI，不再依赖任何外部图片文件
    if (state.sceneInline !== null) {
      expect(state.sceneInline, `${name} 场景主视觉应为内联 data URI`).toBe(true);
    }
  }

  expect(pageErrors).toEqual([]);
});

test('brand title and actions are centered across short, tablet and wide screens', async ({ page }) => {
  for (const [width, height] of [[320, 568], [360, 640], [375, 667], [390, 844], [1024, 768], [1440, 900], [1920, 1080]]) {
    await page.setViewportSize({ width, height });
    await page.goto('/?view=01', { waitUntil: 'networkidle' });
    const layout = await page.evaluate(() => {
      const box = (selector: string) => document.querySelector(selector)!.getBoundingClientRect();
      const main = box('.login-main');
      const brand = box('.brand-composition');
      const button = box('.start-button');
      return {
        brandCenter: brand.left + brand.width / 2,
        buttonCenter: button.left + button.width / 2,
        mainCenter: main.left + main.width / 2,
        pageWidth: document.documentElement.scrollWidth,
        pageHeight: document.documentElement.scrollHeight,
        viewportWidth: innerWidth,
        viewportHeight: innerHeight,
      };
    });
    expect(Math.abs(layout.brandCenter - layout.mainCenter), `${width}x${height} brand`).toBeLessThan(2);
    expect(Math.abs(layout.buttonCenter - layout.mainCenter), `${width}x${height} CTA`).toBeLessThan(2);
    expect(layout.pageWidth).toBeLessThanOrEqual(layout.viewportWidth);
    if (width <= 700) expect(layout.pageHeight, `${width}x${height} should not scroll`).toBeLessThanOrEqual(layout.viewportHeight);
  }
});
