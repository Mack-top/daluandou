import type { PlayerRow, GmAccountRow } from '../domain/types.js';

declare global {
  namespace Express {
    interface Request {
      /** 由 requireAuth 中间件注入；未经过鉴权的路由为 undefined */
      player?: PlayerRow;
      sessionId?: string;
      /** 会话令牌来源轨道：cookie（浏览器主轨道）或 bearer（脚本/测试兼容轨道） */
      authVia?: 'cookie' | 'bearer';
      /** 由 requireGmSession 中间件注入；GM 管理端点专用，与玩家鉴权完全独立 */
      gm?: GmAccountRow;
    }
  }
}

export {};
