export const HOUR_KEYS = ['x1', 'x1_5', 'x2', 'x2_5', 'x3'] as const;
export type HourKey = (typeof HOUR_KEYS)[number];
export type Hours = Record<HourKey, number>;

export const MULTIPLIER: Readonly<Record<HourKey, number>> = {
  x1: 1,
  x1_5: 1.5,
  x2: 2,
  x2_5: 2.5,
  x3: 3,
};

export interface WorkDay {
  date: string;
  hours: Hours;
  /** Tiền trợ cấp trong ngày, số nguyên won */
  allowance: number;
  /** Lương giờ tại thời điểm làm, số nguyên won */
  wage: number;
}

export interface DayPay {
  work: number;
  allowance: number;
  total: number;
}

export interface WeeklyHolidayRule {
  /** Số giờ cơ bản tối thiểu trong tuần để được 주휴수당 */
  minHours: number;
  /** Số giờ tối đa được tính (40 giờ = trả đủ 8 giờ) */
  maxHours: number;
  /** Số giờ được trả khi làm đủ maxHours */
  paidHours: number;
}

export const DEFAULT_WEEKLY_RULE: WeeklyHolidayRule = { minHours: 15, maxHours: 40, paidHours: 8 };

export const emptyHours = (): Hours => ({ x1: 0, x1_5: 0, x2: 0, x2_5: 0, x3: 0 });

export function totalHours(hours: Hours): number {
  return HOUR_KEYS.reduce((sum, k) => sum + hours[k], 0);
}

/**
 * Tiền công một ngày.
 * Giờ và hệ số đều là bội số của 0,5 nên nhân đôi để tính bằng số nguyên,
 * tránh sai số dấu phẩy động. Phần lẻ dưới 1 won bị bỏ (절사).
 */
export function dayPay(day: WorkDay): DayPay {
  let quarterWon = 0;
  for (const k of HOUR_KEYS) {
    const h2 = Math.round(day.hours[k] * 2);
    const m2 = Math.round(MULTIPLIER[k] * 2);
    quarterWon += h2 * m2 * day.wage;
  }
  const work = Math.floor(quarterWon / 4);
  return { work, allowance: day.allowance, total: work + day.allowance };
}

/**
 * Lương ngày nghỉ tuần (주휴수당): min(giờ, 40) ÷ 40 × 8 × lương giờ.
 * Luật còn yêu cầu đi làm đủ các ngày đã thỏa thuận; hàm này không kiểm tra được điều đó.
 */
export function weeklyHolidayPay(
  baseHoursInWeek: number,
  wage: number,
  rule: WeeklyHolidayRule = DEFAULT_WEEKLY_RULE,
): number {
  if (baseHoursInWeek < rule.minHours) return 0;
  const h2 = Math.round(Math.min(baseHoursInWeek, rule.maxHours) * 2);
  return Math.floor((h2 * rule.paidHours * wage) / (rule.maxHours * 2));
}
