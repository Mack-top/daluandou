/** 统一时间口径：存储 UTC ISO 字符串，业务日按服务器本地日期切分。 */

export function nowIso(): string {
  return new Date().toISOString();
}

export function addHoursIso(hours: number, from: Date = new Date()): string {
  return new Date(from.getTime() + hours * 3600_000).toISOString();
}

/** 本地自然日键，格式 YYYY-MM-DD，与前端 localDateKey 一致。 */
export function dayKey(date: Date = new Date()): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

export function isExpired(isoTimestamp: string, now: Date = new Date()): boolean {
  const value = Date.parse(isoTimestamp);
  return !Number.isFinite(value) || value <= now.getTime();
}

/** 两时间之间的整日差，用于离线收益等累计计算。 */
export function daysBetween(fromIso: string | null, now: Date = new Date()): number {
  if (!fromIso) return 1;
  const from = Date.parse(fromIso);
  if (!Number.isFinite(from)) return 1;
  return Math.max(1, Math.floor((now.getTime() - from) / 86_400_000) + 1);
}
