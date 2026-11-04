// 食灵月城 · Windows 单文件 exe 打包脚本
// 产物：release/MeiShiServer.exe（Node SEA：后端 API + 内嵌 schema + 自动开浏览器）
//       release/webapp/（仅 index.html + admin.html；图片/字体/favicon 全部内联进 index.html）
// 首次运行自动在 release/data/ 建库、迁移、灌种子；双击 exe 即玩，浏览器自动打开。
import { execSync, spawnSync, execFileSync } from 'node:child_process';
import { mkdirSync, rmSync, copyFileSync, existsSync, renameSync, statSync, readdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import esbuild from 'esbuild';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const buildDir = path.join(root, 'build', 'exe');
const releaseDir = path.join(root, 'release');
const exePath = path.join(releaseDir, 'MeiShiServer.exe');
const SEA_FUSE = 'NODE_SEA_FUSE_fce680ab2cc467b6e072b8b5df1996b2';

const step = message => console.log(`\n========== ${message} ==========`);

function run(command, options = {}) {
  const result = spawnSync(command, { shell: true, stdio: 'inherit', cwd: root, ...options });
  if (result.status !== 0) throw new Error(`命令失败（退出码 ${result.status}）：${command}`);
}

/* ---------------- 1. 前端构建（vite-plugin-singlefile：JS/CSS/图片/字体全内联进 index.html） ---------------- */
step('1/5 前端构建（vite build）');
run('npm --workspace frontend run build');

/* ---------------- 2. 后端 esbuild 打包为单文件 CJS（schema.sql 内联为文本模块） ---------------- */
step('2/5 后端 esbuild 打包');
rmSync(buildDir, { recursive: true, force: true });
mkdirSync(buildDir, { recursive: true });
await esbuild.build({
  entryPoints: [path.join(root, 'backend', 'src', 'server.ts')],
  outfile: path.join(buildDir, 'server.cjs'),
  bundle: true,
  platform: 'node',
  format: 'cjs',
  target: 'node22',
  charset: 'utf8',
  sourcemap: false,
  minify: false,
  logLevel: 'warning',
  loader: { '.sql': 'text' },
  banner: {
    // import.meta.url shim：CJS 输出中 import.meta 为空对象，这里在产物顶部
    // 预定义真实模块 URL，供下方 define 替换所有 import.meta.url 引用。
    js: "const __moduleUrl = require('node:url').pathToFileURL(__filename).href;",
  },
  define: {
    'process.env.NODE_ENV': '"production"',
    'import.meta.url': '__moduleUrl',
  },
});

/* ---------------- 3. Node SEA：生成注入 blob ---------------- */
step('3/5 生成 SEA blob');
const seaConfig = {
  main: 'server.cjs',
  output: 'sea-prep.blob',
  disableExperimentalSEAWarning: true,
  useSnapshot: false,
  useCodeCache: true,
  assets: { 'schema.sql': path.join(root, 'backend', 'src', 'db', 'schema.sql') },
};
writeFileSync(path.join(buildDir, 'sea-config.json'), JSON.stringify(seaConfig, null, 2));
execFileSync(process.execPath, ['--experimental-sea-config', 'sea-config.json'], { cwd: buildDir });

/* ---------------- 4. 复制 node.exe 并注入 blob ---------------- */
step('4/5 注入生成 MeiShiServer.exe');
mkdirSync(releaseDir, { recursive: true });
// 旧 exe 可能正被运行中的进程映射（无法删除但允许改名）：改为时间戳腾位，永不覆盖冲突
if (existsSync(exePath)) {
  try {
    renameSync(exePath, `${exePath}.${Date.now()}.old`);
  } catch { /* 改名失败（极端锁场景）时退化为直接覆盖 */ }
}
copyFileSync(process.execPath, exePath);
execSync(`npx --no-install postject "${exePath}" NODE_SEA_BLOB sea-prep.blob --sentinel-fuse ${SEA_FUSE}`, {
  cwd: buildDir,
  stdio: 'inherit',
});

/* ---------------- 5. 组装 release（webapp 只放 index.html + admin.html） ---------------- */
step('5/5 组装 release 目录');
const webappDir = path.join(releaseDir, 'webapp');
rmSync(webappDir, { recursive: true, force: true });
mkdirSync(webappDir, { recursive: true });
// 显式逐个复制：前端 dist 里只有 index.html，GM 台取 backend/public 的单一权威副本。
// 不再整目录 cpSync，避免把历史残留的 images/ fonts/ favicon.svg 带进发布产物。
copyFileSync(path.join(root, 'frontend', 'dist', 'index.html'), path.join(webappDir, 'index.html'));
copyFileSync(path.join(root, 'backend', 'public', 'admin.html'), path.join(webappDir, 'admin.html'));
copyFileSync(path.join(root, 'backend', '.env.example'), path.join(releaseDir, '配置示例.env.example'));
writeFileSync(
  path.join(releaseDir, '游戏说明.txt'),
  [
    '食灵月城 · 单文件服（MeiShiServer.exe）',
    '',
    '【启动】双击 MeiShiServer.exe，浏览器会自动打开游戏（http://127.0.0.1:8787/）。',
    '【数据】首次运行自动在 data/ 目录创建数据库并写入配置；删除 data/ 即完全重置。',
    '【端口】如 8787 被占用，把 配置示例.env.example 复制为 .env 并修改 PORT 后重启。',
    '【GM 台】浏览器访问 http://127.0.0.1:8787/admin/（默认仅本机可访问；',
    '  首次使用需配置 GM_SEED_PASSWORD 后重启一次以创建 GM 账号，见配置示例）。',
    '【端口暴露】默认只监听 127.0.0.1，仅本机可玩；局域网联机需改 HOST=0.0.0.0 并自行注意安全。',
    '',
    '目录结构：MeiShiServer.exe + webapp/（index.html + admin.html，资源已内联）+ data/（存档数据库）。',
    '说明：游戏所需的图片、字体、图标均已内联进 index.html，webapp/ 下无需任何额外静态资源目录。',
  ].join('\n'),
  'utf8',
);

/** 目录体积：递归累加文件大小（statSync 对目录本身返回的是目录项大小，不能直接当体积用）。 */
function dirSize(dir) {
  return readdirSync(dir, { withFileTypes: true }).reduce((sum, entry) => {
    const full = path.join(dir, entry.name);
    return sum + (entry.isDirectory() ? dirSize(full) : statSync(full).size);
  }, 0);
}
const sizeOf = file => `${(statSync(file).size / 1024 / 1024).toFixed(1)} MB`;
console.log('\n打包完成 ✅');
console.log(`  ${exePath}  (${sizeOf(exePath)})`);
console.log(`  ${webappDir}  (${(dirSize(webappDir) / 1024 / 1024).toFixed(1)} MB，仅 index.html + admin.html)`);
console.log('  双击 MeiShiServer.exe 即可开服并自动打开游戏。');
