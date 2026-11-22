// Ngày công luôn là chuỗi "YYYY-MM-DD" theo giờ Hàn Quốc.
// Mọi phép tính ngày dùng UTC để không bị lệch múi giờ của máy chạy code.

const DATE_RE = /^(\d{4})-(\d{2})-(\d{2})$/;

export function isValidDate(value: string): boolean {
  const m = DATE_RE.exec(value);
  if (!m) return false;
  const [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])];
  const dt = new Date(Date.UTC(y, mo - 1, d));
  return dt.getUTCFullYear() === y && dt.getUTCMonth() === mo - 1 && dt.getUTCDate() === d;
}

function toUtc(date: string): Date {
  if (!isValidDate(date)) throw new RangeError(`Ngày không hợp lệ: ${date}`);
  const [y, m, d] = date.split('-').map(Number) as [number, number, number];
  return new Date(Date.UTC(y, m - 1, d));
}

function fromUtc(dt: Date): string {
  return dt.toISOString().slice(0, 10);
}

export function addDays(date: string, days: number): string {
  const dt = toUtc(date);
  dt.setUTCDate(dt.getUTCDate() + days);
  return fromUtc(dt);
}

/** 0 = Chủ nhật … 6 = Thứ bảy */
export function dayOfWeek(date: string): number {
  return toUtc(date).getUTCDay();
}

/** Thứ Hai của tuần chứa ngày này (tuần tính từ T2 đến CN). */
export function weekStart(date: string): string {
  const dow = dayOfWeek(date);
  return addDays(date, dow === 0 ? -6 : 1 - dow);
}

/** "2026-11" → { from: "2026-11-01", to: "2026-11-30" } */
export function monthRange(month: string): { from: string; to: string } {
  if (!/^\d{4}-\d{2}$/.test(month)) throw new RangeError(`Tháng không hợp lệ: ${month}`);
  const [y, m] = month.split('-').map(Number) as [number, number];
  if (m < 1 || m > 12) throw new RangeError(`Tháng không hợp lệ: ${month}`);
  const last = new Date(Date.UTC(y, m, 0)).getUTCDate();
  return { from: `${month}-01`, to: `${month}-${String(last).padStart(2, '0')}` };
}
