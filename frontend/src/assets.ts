/**
 * 静态资源统一解析入口（v22 · 资源迁移后）。
 *
 * 构建期脚本 scripts/inline-assets.mjs 把 frontend/public 下的 webp 图片 /
 * woff2 字体 / favicon.svg 内联成 base64 data URI，生成
 * src/generated/assets.ts 的 ASSET_DATA_URIS。运行时本模块优先查表，
 * 于是前端单文件 index.html 自承载全部资源：
 *   - 服务器不再需要存放 images/、fonts/、favicon.svg；
 *   - 不再有相对路径解析差异（子路径部署 / WebView / CDN 均一致）；
 *   - 图片、字体加载失败率降为零。
 *
 * 归一化：历史代码与后台配置里写的都是 images/xxx.jpg，而实际内联的是
 * 同名 webp（体积小 24%、画质无损）。生成器同时登记 .jpg / .jpeg / .webp
 * 三个键，这里再做一次运行时兜底归一，保证任何写法都命中。
 *
 * 兜底：未内联的资源（例如 GM 后台自定义的外链/相对路径）仍回退到
 * document.baseURI 解析，保证自定义配置平滑可用、不报错。
 */
import { ASSET_DATA_URIS } from './generated/assets';

export { ASSET_DATA_URIS };

const INLINED: Record<string, string> = ASSET_DATA_URIS;

/** 去掉常见的 './' 与 '/' 前缀，便于与生成表里的相对键对齐。 */
function normalizeKey(assetPath: string): string {
  return assetPath.replace(/^\.\//, '').replace(/^\//, '');
}

/**
 * 统一的资源解析函数。
 * 已是 data:/blob:/http(s)/协议相对 URL 时原样返回，避免被 new URL 破坏。
 */
export function assetUrl(assetPath: string): string {
  if (!assetPath) return assetPath;
  if (/^(data:|blob:|https?:\/\/|\/\/)/i.test(assetPath)) return assetPath;

  const key = normalizeKey(assetPath);
  const direct = INLINED[key] ?? INLINED[assetPath];
  if (direct) return direct;

  // .jpg / .jpeg / .png → 同名 .webp（生成器已登记，这里是防御性二次归一）
  const webpKey = key.replace(/\.(jpe?g|png)$/i, '.webp');
  if (webpKey !== key && INLINED[webpKey]) return INLINED[webpKey];

  // 未内联：回退相对路径（后台配置里的自定义路径仍可用）
  return new URL(assetPath, document.baseURI).href;
}

/** 语义化别名：后台配置下发的 portrait / background / assetPath 也走同一入口。 */
export const resolveAsset = assetUrl;

/** 供诊断/验收使用：返回已内联资源的逻辑路径清单。 */
export function inlinedAssetKeys(): string[] {
  return Object.keys(INLINED);
}
