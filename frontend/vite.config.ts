import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import type { Plugin } from "vite";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";
import { viteSingleFile } from "vite-plugin-singlefile";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * 资源迁移（v22）后的单文件自承载插件：
 *  把 favicon.svg 内联成 data URI，注入 index.html 的 icon 与 og:image 占位符。
 *
 * 刻意「不」往 dist/ 复制任何东西：GM 管理台 admin.html 的单一权威副本在
 * backend/public/admin.html，由 scripts/build-exe.mjs 单独复制进 release/webapp/。
 * 这样 vite build 之后 frontend/dist/ 有且只有 index.html。
 */
function inlineHtmlAssets(): Plugin {
  const faviconSvg = readFileSync(path.resolve(__dirname, "public", "favicon.svg"), "utf8").trim();
  const faviconUri = "data:image/svg+xml," + encodeURIComponent(faviconSvg);
  return {
    name: "meishi-inline-html-assets",
    enforce: "pre",
    transformIndexHtml: {
      order: "pre",
      handler(html: string) {
        // 用函数式替换，避免 data URI 里的 $ 被当作替换模式解释；g 标志覆盖两处占位符。
        return html.replace(/__INLINE_FAVICON__/g, () => faviconUri);
      },
    },
  };
}

// https://vite.dev/config/
export default defineConfig({
  // 图片 / 字体 / favicon 已由 scripts/inline-assets.mjs 内联为 data URI，
  // public/ 只作为「源文件」目录保留，不再整体复制进 dist/。
  // 构建产物因此只剩 index.html；残留目录由 inline-assets.mjs 收尾清理。
  publicDir: false,
  plugins: [inlineHtmlAssets(), react(), tailwindcss(), viteSingleFile()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "src"),
    },
  },
  server: {
    // 固定监听地址与端口：避免 npm 多层脚本吞掉 --host/--port 参数导致绑定到 ::1
    host: "127.0.0.1",
    port: 5173,
    // 前后端分离：开发期由 Vite 代理转发，前端只认同源 /api
    proxy: {
      "/api": {
        target: process.env.VITE_API_TARGET ?? "http://127.0.0.1:8787",
        changeOrigin: true,
      },
    },
  },
});
