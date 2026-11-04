/**
 * 字体位于构建期生成的 data URI 资源表（ASSET_DATA_URIS，见 assets.ts）。
 *
 * 迁移前按当前文档路径解析 public/fonts 下的 woff2；迁移后由前端单文件自承载，
 * 不再请求 fonts/ 目录，部署在根目录或 /xiaoyouxi_A/ 子路径下行为完全一致。
 * assetUrl(path) 优先查 ASSET_DATA_URIS（含 .jpg → .webp 归一），未命中才回退
 * new URL(path, document.baseURI).href，保证后台自定义字体路径仍可用。
 */
import { assetUrl } from './assets';
import { ASSET_DATA_URIS } from './generated/assets';

export { assetUrl, ASSET_DATA_URIS };

const fontFiles = [
  { family: 'Realm Serif', file: 'realm-serif.woff2' },
  { family: 'Realm Serif Extension', file: 'realm-serif-extension.woff2' },
  { family: 'Cinzel', file: 'cinzel.woff2' },
] as const;

export function registerFonts(): void {
  if (typeof document === 'undefined' || typeof FontFace === 'undefined' || !document.fonts) return;
  for (const { family, file } of fontFiles) {
    try {
      const face = new FontFace(family, `url("${assetUrl(`fonts/${file}`)}")`, {
        weight: '400 900',
        style: 'normal',
      });
      face.display = 'swap';
      // 先登记再加载：document.fonts.ready 与自动化测试才能观察到该字体。
      document.fonts.add(face);
      void face.load().catch(() => undefined);
    } catch {
      // 字体不可用时自动回退到 CSS 中声明的系统字体。
    }
  }
}
