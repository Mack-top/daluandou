import { createHash, randomBytes, randomUUID } from 'node:crypto';

/** 业务主键：UUID v4，应用侧生成，便于幂等与后续分库。 */
export function newId(): string {
  return randomUUID();
}

/** 会话令牌明文只返回一次，库中仅存摘要。 */
export function newSessionToken(): { token: string; tokenHash: string } {
  const token = randomBytes(32).toString('base64url');
  return { token, tokenHash: hashToken(token) };
}

export function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

/** 游客昵称：旅人 + 6 位数字，共 8 字符，恰好满足 2-8 位昵称规则；碰撞时由调用方重试。 */
export function guestNickname(): string {
  const digits = String(Math.floor(Math.random() * 1_000_000)).padStart(6, '0');
  return `旅人${digits}`;
}

/** 战斗种子：32 位无符号整数，落库后可完整复现战斗过程。 */
export function newSeed(): number {
  return randomBytes(4).readUInt32BE(0);
}
