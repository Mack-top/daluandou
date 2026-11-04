/**
 * API 基地址统一解析（v23 · 离线打包就绪）。
 * ---------------------------------------------------------------------------
 * 现状：游戏是「后端同源托管 index.html + /api」的前后端一体架构，前端所有接口
 * 都写相对路径 /api/...，依赖页面与后端同源（同源下无 CORS、会话 Cookie 自动携带）。
 *
 * 为什么需要这里：一旦把构建出的单文件 index.html 打进 APK 的 assets/ 并用
 * file:///android_asset/index.html 加载，页面源变成 null，相对 /api 会解析成
 * file:///api 而失效。此时必须把接口基地址改成绝对地址（如 https://940608.site）。
 *
 * 设计：
 *   - 默认 VITE_API_BASE 为空字符串 → apiUrl 原样返回路径，web / 在线壳行为不变；
 *   - 离线打包构建时传入 VITE_API_BASE=https://940608.site → 自动前缀；
 *   - 已是绝对 http(s) 地址的（如 offline.html 里的探测）原样返回，避免被二次拼接。
 *
 * 注意：离线打包还需后端放行 file://(null) 源的 CORS 与会话 Cookie（SameSite=Lax
 * 在跨站下不发送），否则即便接口可达也无法维持登录——当前正式 APK 仍采用在线同源壳。
 */
const RAW = (import.meta.env.VITE_API_BASE ?? '') as unknown as string;
const API_BASE = (RAW ?? '').toString().replace(/\/+$/, '');

/** 给相对接口路径拼接基地址；空基地址或已是绝对地址时原样返回。 */
export function apiUrl(path: string): string {
  if (!API_BASE) return path;
  if (/^https?:\/\//i.test(path)) return path;
  if (path.startsWith('//')) return path;
  return API_BASE + (path.startsWith('/') ? path : '/' + path);
}
