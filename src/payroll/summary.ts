import { HOUR_KEYS, MULTIPLIER, dayPay, emptyHours, type HourKey, type Hours, type WorkDay } from './pay.ts';

export interface WeeklyPayRecord {
  weekStart: string;
  amount: number;
}

export interface MonthSummary {
  total: number;
  workPay: number;
  allowance: number;
  weeklyHolidayPay: number;
  baseHours: number;
  overtimeHours: number;
  hoursByType: Hours;
  /**
   * Tiền công theo từng loại giờ cả tháng, mỗi loại chỉ bỏ phần lẻ một lần ở cuối.
   * Chỉ để hiển thị chi tiết: tổng các loại có thể lệch workPay vài won,
   * vì workPay bỏ phần lẻ theo từng ngày còn đây bỏ phần lẻ theo từng loại.
   */
  payByType: Record<HourKey, number>;
  workDays: number;
}

export function monthSummary(days: readonly WorkDay[], weekly: readonly WeeklyPayRecord[] = []): MonthSummary {
  const hoursByType = emptyHours();
  const quarterWonByType = emptyHours();
  let workPay = 0;
  let allowance = 0;
  let workDays = 0;

  for (const day of days) {
    const pay = dayPay(day);
    workPay += pay.work;
    allowance += pay.allowance;
    let any = false;
    for (const k of HOUR_KEYS) {
      hoursByType[k] += day.hours[k];
      // Giờ và hệ số nhân đôi để tính bằng số nguyên, như dayPay
      quarterWonByType[k] += Math.round(day.hours[k] * 2) * Math.round(MULTIPLIER[k] * 2) * day.wage;
      if (day.hours[k] > 0) any = true;
    }
    if (any) workDays++;
  }

  const payByType = emptyHours();
  for (const k of HOUR_KEYS) payByType[k] = Math.floor(quarterWonByType[k] / 4);

  const weeklyHolidayPay = weekly.reduce((s, w) => s + w.amount, 0);
  const overtimeHours = hoursByType.x1_5 + hoursByType.x2 + hoursByType.x2_5 + hoursByType.x3;

  return {
    total: workPay + allowance + weeklyHolidayPay,
    workPay,
    allowance,
    weeklyHolidayPay,
    baseHours: hoursByType.x1,
    overtimeHours,
    hoursByType,
    payByType,
    workDays,
  };
}
