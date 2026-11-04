/** 领域错误：路由层统一翻译成 HTTP 响应，避免把内部堆栈暴露给客户端。 */
export class ApiError extends Error {
  readonly status: number;
  readonly code: string;
  readonly details?: unknown;

  constructor(status: number, code: string, message: string, details?: unknown) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

export const badRequest = (message: string, details?: unknown) =>
  new ApiError(400, 'BAD_REQUEST', message, details);

export const unauthorized = (message = '未登录或登录已过期') =>
  new ApiError(401, 'UNAUTHORIZED', message);

export const forbidden = (message = '无权访问该资源') =>
  new ApiError(403, 'FORBIDDEN', message);

export const notFound = (message = '资源不存在') =>
  new ApiError(404, 'NOT_FOUND', message);

export const conflict = (message: string, details?: unknown) =>
  new ApiError(409, 'CONFLICT', message, details);

export const unprocessable = (message: string, details?: unknown) =>
  new ApiError(422, 'UNPROCESSABLE', message, details);

export const tooManyRequests = (message = '请求过于频繁，请稍后再试', details?: unknown) =>
  new ApiError(429, 'RATE_LIMITED', message, details);
