// Số liệu cho màn Thống kê và lương thực nhận. App và server dùng chung để ra cùng một con số.
import { addDays, dayOfWeek, monthRange } from './date.ts';
import { dayPay, type WorkDay } from './pay.ts';
import type { MonthSummary, WeeklyPayRecord } from './summary.ts';

export interface WeekTotal {
  /** Ngày đầu đoạn tuần (T2, hoặc ngày 1 của tháng) */
  from: string;
  /** Ngày cuối đoạn tuần (CN, hoặc ngày cuối tháng) */
  to: string;
  /** Tiền công + trợ cấp của các ngày trong đoạn, cộng 주휴수당 của tuần có CN nằm trong đoạn */
  total: number;
}

/**
 * Chia tháng thành các đoạn tuần T2–CN, cắt ở đầu và cuối tháng, rồi cộng tiền từng đoạn.
 * Ngày công ngoài tháng bị bỏ qua; 주휴수당 tính vào đoạn chứa ngày CN của tuần đó.
 */
export function weeklyTotals(
  month: string,
  days: readonly WorkDay[],
  weekly: readonly WeeklyPayRecord[] = [],
): WeekTotal[] {
  const { from, to } = monthRange(month);
  const byDate = new Map<string, number>();
  for (const d of days) {
    if (d.date >= from && d.date <= to) byDate.set(d.date, (byDate.get(d.date) ?? 0) + dayPay(d).total);
  }
  for (const w of weekly) {
    const sunday = addDays(w.weekStart, 6);
    if (sunday >= from && sunday <= to) byDate.set(sunday, (byDate.get(sunday) ?? 0) + w.amount);
  }

  const weeks: WeekTotal[] = [];
  for (let d = from; d <= to; d = addDays(d, 1)) {
    const last = weeks.at(-1);
    if (!last || dayOfWeek(d) === 1) weeks.push({ from: d, to: d, total: byDate.get(d) ?? 0 });
    else {
      last.to = d;
      last.total += byDate.get(d) ?? 0;
    }
  }
  return weeks;
}

/** Tiền trung bình mỗi ngày làm (tiền công + trợ cấp, không tính 주휴수당), bỏ phần lẻ. 0 khi chưa có ngày làm. */
export function averageDayPay(summary: Pick<MonthSummary, 'workPay' | 'allowance' | 'workDays'>): number {
  return summary.workDays > 0 ? Math.floor((summary.workPay + summary.allowance) / summary.workDays) : 0;
}

/**
 * Tiền khấu trừ ước tính theo tỉ lệ phần trăm người dùng chọn (ví dụ 3,3 hoặc 9,4), bỏ phần lẻ dưới 1 won.
 * Tỉ lệ làm tròn tới 0,1% và tính theo phần nghìn để tránh sai số dấu phẩy động (3,3 × x).
 */
export function deductionAmount(total: number, ratePercent: number): number {
  if (!(ratePercent > 0) || total <= 0) return 0;
  const perMille = Math.round(Math.min(ratePercent, 100) * 10);
  return Math.floor((total * perMille) / 1000);
}
