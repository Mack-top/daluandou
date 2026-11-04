import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import App from "./App";
import { registerFonts } from "./fonts";
import { ensureIdentity } from "./api/identity";
import { refreshCatalog } from "./api/catalog";
import { readStoredServer } from "./use-game";

registerFonts();

// v22 配置生效链路：GM 后台保存配置会 bump catalog_meta 版本，客户端在页面
// 重新可见时带上次版本戳重拉 catalog 即生效。30s 节流避免频繁切页造成请求风暴；
// 失败时 applyCatalog 不会被调用，本地兜底数据保持原样（离线可用）。
let lastCatalogRefreshAt = 0;
document.addEventListener("visibilitychange", () => {
  if (document.visibilityState !== "visible") return;
  const now = Date.now();
  if (now - lastCatalogRefreshAt < 30_000) return;
  lastCatalogRefreshAt = now;
  void refreshCatalog();
});

// 静默建立账号身份：无注册/登录界面，打开页面即自动获得独立账号。
// v16 按服隔离：建号时携带上次选择的服务器（账号属于该服，之后不可改）。
// 不阻塞首屏渲染；后端不可用时游戏继续以本地模式运行。
void ensureIdentity(readStoredServer())
  .then(identity => {
    if (identity) console.info("[identity] 当前账号", identity.accountId);
  })
  .catch(() => undefined);

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>
);
