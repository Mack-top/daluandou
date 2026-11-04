/**
 * v22 · T-ASSET 构建期资源内联生成器（幂等，可重复调用）
 * -----------------------------------------------------------------------------
 * 把 frontend/public 下的 11 张 .webp 图片、3 个 .woff2 字体、favicon.svg
 * 读成 base64 data URI，生成 frontend/src/generated/assets.ts：
 *
 *   export const ASSET_DATA_URIS: Record<string, string> = { ... }
 *
 * 键登记规则（同时兼容「旧相对路径」与「新资源路径」）：
 *   images/<name>.webp   → 该 webp 的 data URI
 *   images/<name>.jpg    → 同一个 webp 的 data URI（.jpg → .webp 归一，零画质损失）
 *   images/<name>.jpeg   → 同上（兼容 .jpeg 写法）
 *   fonts/<name>.woff2   → 该 woff2 的 data URI
 *   favicon.svg          → 该 svg 的 data URI
 *
 * 性能约定：每张图的 base64 字节只写一次，.jpg / .jpeg 别名在运行时由同一变量
 * 展开（否则同一串 base64 写三遍，单文件会从约 5 MB 膨胀到约 14 MB）。
 *
 * 明确不进入产物：
 *   - 11 张 .jpg（与 webp 同名同图，全项目零引用，体积大 24%）
 *   - fonts/OFL-*.txt（许可证文本，运行时不加载）
 *   - frontend/public/admin.html（GM 台单一副本在 backend/public）
 *
 * 收尾还会清理 dist/ 中残留的 images/ fonts/ favicon.svg —— 只删这三个
 * 明确目录/文件，绝不做通配递归删除其它内容。
 *
 * 产物 frontend/dist/ 最终只剩 index.html（vite 配置 publicDir:false，
 * 且不再由插件往 dist 复制 admin.html）。
 */
import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const frontendRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const publicDir = path.join(frontendRoot, 'public');
const imageDir = path.join(publicDir, 'images');
const fontDir = path.join(publicDir, 'fonts');
const generatedDir = path.join(frontendRoot, 'src', 'generated');
const outFile = path.join(generatedDir, 'assets.ts');
const legacyJson = path.join(frontendRoot, 'src', 'assets.generated.json');
const distDir = path.join(frontendRoot, 'dist');

const MIME = {
  '.webp': 'image/webp',
  '.woff2': 'font/woff2',
  '.svg': 'image/svg+xml',
};

function dataUri(file, mime) {
  return `data:${mime};base64,${readFileSync(file).toString('base64')}`;
}

/* ---------- 输入完整性校验：缺文件立即失败，不静默产出半套资源 ---------- */
for (const dir of [imageDir, fontDir]) {
  if (!existsSync(dir)) throw new Error(`[assets] 缺少资源目录：${dir}`);
}
const faviconPath = path.join(publicDir, 'favicon.svg');
if (!existsSync(faviconPath)) throw new Error(`[assets] 缺少站点图标：${faviconPath}`);

const webps = readdirSync(imageDir).filter(file => /\.webp$/i.test(file)).sort();
const fonts = readdirSync(fontDir).filter(file => /\.woff2$/i.test(file)).sort();
if (webps.length === 0) throw new Error('[assets] images/ 下没有 .webp 图片');
if (fonts.length === 0) throw new Error('[assets] fonts/ 下没有 .woff2 字体');

/* ---------- 每张资源只读一次，字节只落盘一次 ---------- */
const imageUris = {};
for (const name of webps) imageUris[`images/${name}`] = dataUri(path.join(imageDir, name), MIME['.webp']);
const fontUris = {};
for (const name of fonts) fontUris[`fonts/${name}`] = dataUri(path.join(fontDir, name), MIME['.woff2']);
const faviconUri = dataUri(faviconPath, MIME['.svg']);

/* ---------- 生成 TypeScript 模块 ---------- */
const header = `/**
 * 本文件由 scripts/inline-assets.mjs 自动生成，请勿手工编辑。
 * 每次 npm run dev / build / typecheck 前都会重新生成（幂等）。
 *
 * 所有静态资源已内联为 base64 data URI，单文件 index.html 自承载：
 * 服务器不再需要 images/、fonts/、favicon.svg，也没有相对路径解析差异。
 *
 * 键 images/<name>.jpg / .jpeg 在运行时指向同名 webp 的字节
 * （.jpg → .webp 归一，画质无损）；base64 只存一份，避免产物膨胀。
 */
`;
const content = `${header}
const IMAGE_URIS: Record<string, string> = ${JSON.stringify(imageUris, null, 2)};
const FONT_URIS: Record<string, string> = ${JSON.stringify(fontUris, null, 2)};
const FAVICON_URI: string = ${JSON.stringify(faviconUri)};

/** 统一资源表：键为项目内使用的相对路径，值为 data URI。 */
export const ASSET_DATA_URIS: Record<string, string> = (() => {
  const out: Record<string, string> = {};
  for (const [key, uri] of Object.entries(IMAGE_URIS)) {
    out[key] = uri;
    out[key.replace(/\\.webp$/i, '.jpg')] = uri;
    out[key.replace(/\\.webp$/i, '.jpeg')] = uri;
  }
  for (const [key, uri] of Object.entries(FONT_URIS)) out[key] = uri;
  out['favicon.svg'] = FAVICON_URI;
  return out;
})();
`;
mkdirSync(generatedDir, { recursive: true });
// 幂等：内容未变则不触碰文件（保持 mtime，避免无谓的重新编译）
if (!existsSync(outFile) || readFileSync(outFile, 'utf8') !== content) {
  writeFileSync(outFile, content, 'utf8');
}

/* ---------- 清理上一轮遗留的 JSON 生成物（改用 TS 模块后不再需要） ---------- */
if (existsSync(legacyJson)) rmSync(legacyJson, { force: true });

/* ---------- 清理 dist 残留：仅这三个明确目录/文件 ---------- */
for (const entry of ['images', 'fonts', 'favicon.svg']) {
  const target = path.join(distDir, entry);
  if (existsSync(target)) {
    rmSync(target, { recursive: true, force: true });
    console.log(`[assets] removed dist/${entry}`);
  }
}

const keyCount = webps.length * 3 + fonts.length + 1;
const distFiles = existsSync(distDir) ? readdirSync(distDir).sort() : [];
console.log(
  `[assets] inlined ${webps.length} webp + ${fonts.length} woff2 + favicon.svg → ` +
  `src/generated/assets.ts (${keyCount} keys, ${(Buffer.byteLength(content) / 1024 / 1024).toFixed(2)} MB)`,
);
console.log(`[assets] dist contents: ${distFiles.join(', ') || '(empty)'}`);
