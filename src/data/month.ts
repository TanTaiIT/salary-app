// Các phép tính theo tháng dùng chung cho Trang chủ, Thống kê, Lịch sử.
// Ngày là chuỗi "YYYY-MM-DD" theo giờ Hàn Quốc; mọi phép cộng ngày đi qua src/payroll/date.ts.
import {
  HOUR_KEYS,
  addDays,
  dayOfWeek,
  dayPay,
  monthRange,
  monthSummary,
  totalHours,
  weekStart,
  weeklyHolidayPay,
  type HourKey,
  type MonthSummary,
  type WeeklyHolidayRule,
} from '@/payroll/index.ts';

import type { WeeklyPayRecord, WorkDayRecord } from './types';

const KST_OFFSET_MS = 9 * 60 * 60 * 1000;

/** Ngày hôm nay theo giờ Hàn Quốc, không phụ thuộc múi giờ của máy. */
export function todayKst(): string {
  return new Date(Date.now() + KST_OFFSET_MS).toISOString().slice(0, 10);
}

export function monthOf(date: string): string {
  return date.slice(0, 7);
}

/** "2026-11" + 1 → "2026-12" */
export function shiftMonth(month: string, delta: number): string {
  const [y, m] = month.split('-').map(Number) as [number, number];
  const idx = y * 12 + (m - 1) + delta;
  return `${Math.floor(idx / 12)}-${String((idx % 12) + 1).padStart(2, '0')}`;
}

export function monthLabel(month: string): string {
  const [y, m] = month.split('-').map(Number);
  return `Tháng ${m} năm ${y}`;
}

/** Mọi ngày trong tháng, theo thứ tự. */
export function daysOfMonth(month: string): string[] {
  const { from, to } = monthRange(month);
  const out: string[] = [];
  for (let d = from; d <= to; d = addDays(d, 1)) out.push(d);
  return out;
}

export const DOW_LABELS = ['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7'] as const;

export const isWeekend = (date: string) => {
  const dow = dayOfWeek(date);
  return dow === 0 || dow === 6;
};

/** Ngày công đã lưu thì dùng lương giờ lúc lưu, không dùng lương giờ hiện tại. */
export const workDayTotal = (d: WorkDayRecord) =>
  dayPay({ date: d.date, hours: d.hours, allowance: d.allowance, wage: d.wageSnapshot }).total;

/** Loại giờ nhiều nhất trong ngày (để tô màu chip trên lịch). */
export function dominantHourKey(d: WorkDayRecord): HourKey | null {
  let best: HourKey | null = null;
  let bestHours = 0;
  for (const k of HOUR_KEYS) {
    if (d.hours[k] > bestHours) {
      bestHours = d.hours[k];
      best = k;
    }
  }
  return best;
}

export const hasWork = (d: WorkDayRecord | undefined) => !!d && (totalHours(d.hours) > 0 || d.allowance > 0);

/** Ngày CN được ghi 주휴수당 của tuần bắt đầu từ weekStart (T2). */
export const weekSunday = (weekStartDate: string) => addDays(weekStartDate, 6);

export interface MonthData {
  month: string;
  /** Ngày công đang dùng của tháng, theo ngày */
  days: Map<string, WorkDayRecord>;
  /** 주휴수당 > 0 của những tuần có CN nằm trong tháng, theo ngày CN */
  weeklyBySunday: Map<string, WeeklyPayRecord>;
  summary: MonthSummary;
}

export function buildMonth(
  month: string,
  workDays: readonly WorkDayRecord[],
  weeklyPays: readonly WeeklyPayRecord[],
): MonthData {
  const days = new Map<string, WorkDayRecord>();
  for (const d of workDays) if (monthOf(d.date) === month) days.set(d.date, d);

  const weeklyBySunday = new Map<string, WeeklyPayRecord>();
  for (const w of weeklyPays) {
    const sun = weekSunday(w.weekStart);
    if (w.amount > 0 && monthOf(sun) === month) weeklyBySunday.set(sun, w);
  }

  const summary = monthSummary(
    [...days.values()].map((d) => ({ date: d.date, hours: d.hours, allowance: d.allowance, wage: d.wageSnapshot })),
    [...weeklyBySunday.values()].map((w) => ({ weekStart: w.weekStart, amount: w.amount })),
  );
  return { month, days, weeklyBySunday, summary };
}

/** Tổng tiền hiển thị trong ô ngày: tiền công + trợ cấp + 주휴수당 (nếu là CN). */
export function dayCellTotal(data: MonthData, date: string): number {
  const d = data.days.get(date);
  return (d ? workDayTotal(d) : 0) + (data.weeklyBySunday.get(date)?.amount ?? 0);
}

export interface WeeklySuggestion {
  weekStart: string;
  sunday: string;
  baseHours: number;
  workDays: number;
  amount: number;
}

/**
 * Tuần đầu tiên trong tháng (tính theo ngày CN) đủ điều kiện 주휴수당 mà người dùng chưa xác nhận hay bỏ.
 * Tuần tính từ T2 đến CN; giờ cơ bản lấy cả những ngày nằm ở tháng trước.
 */
export function weeklySuggestion(
  month: string,
  jobWorkDays: readonly WorkDayRecord[],
  jobWeeklyPays: readonly WeeklyPayRecord[],
  wage: number,
  rule: (year: string) => WeeklyHolidayRule,
): WeeklySuggestion | null {
  const byDate = new Map(jobWorkDays.map((d) => [d.date, d]));
  const decided = new Set(jobWeeklyPays.map((w) => w.weekStart));
  const today = todayKst();

  for (const sunday of daysOfMonth(month)) {
    if (dayOfWeek(sunday) !== 0) continue;
    const start = weekStart(sunday);
    if (decided.has(start) || start > today) continue;

    let baseHours = 0;
    let workDays = 0;
    for (let i = 0; i < 7; i++) {
      const h = byDate.get(addDays(start, i))?.hours.x1 ?? 0;
      if (h > 0) {
        baseHours += h;
        workDays++;
      }
    }
    const amount = weeklyHolidayPay(baseHours, wage, rule(sunday.slice(0, 4)));
    if (amount > 0) return { weekStart: start, sunday, baseHours, workDays, amount };
  }
  return null;
}
