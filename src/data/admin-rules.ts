// Logic thuần của trang quản trị quy định năm: bản nháp của form, kiểm tra trước khi gửi, tóm tắt nhật ký thay đổi.
// Không import gì của React Native để test được bằng node --test.
import { z } from 'zod';

import { formatDayMonth, formatDecimal, formatNumber, parseWon } from '@/lib/format';
import { DEFAULT_WEEKLY_RULE, isValidDate } from '@/payroll/index.ts';
import { RuleSetInput } from '@/schemas/index.ts';

import type { Holiday, Rules } from './rules';

/** Bản nháp của form: số giữ dạng chữ để gõ dở ("7,") không bị mất. */
export interface RulesDraft {
  minimumWage: string;
  minHours: string;
  maxHours: string;
  paidHours: string;
  holidays: Holiday[];
}

export type DraftErrors = Partial<Record<'minimumWage' | 'minHours' | 'maxHours' | 'paidHours' | 'holidays', string>>;

export function draftFromRules(r: Rules): RulesDraft {
  return {
    minimumWage: formatNumber(r.minimumWage),
    minHours: formatDecimal(r.weeklyHoliday.minHours),
    maxHours: formatDecimal(r.weeklyHoliday.maxHours),
    paidHours: formatDecimal(r.weeklyHoliday.paidHours),
    holidays: sortHolidays(r.holidays),
  };
}

/** Năm mới: chép lương tối thiểu và điều kiện 주휴수당 của năm gần nhất (admin sửa lại), ngày lễ để trống. */
export function draftForNewYear(previous: Rules | undefined): RulesDraft {
  return draftFromRules({
    minimumWage: previous?.minimumWage ?? 0,
    weeklyHoliday: previous?.weeklyHoliday ?? DEFAULT_WEEKLY_RULE,
    holidays: [],
  });
}

/** Năm gợi ý để tạo mới: sau năm lớn nhất đã có, hoặc năm hiện tại nếu chưa có năm nào. */
export function nextYear(existing: readonly number[], currentYear: number): number {
  return existing.length ? Math.max(...existing) + 1 : currentYear;
}

/** "7,5" hoặc "7.5" → 7.5; trống hoặc sai → NaN */
export function parseDecimal(text: string): number {
  const t = text.trim().replace(',', '.');
  return /^\d+(\.\d+)?$/.test(t) ? Number(t) : NaN;
}

/** "1/1", "01/01", "1-1", "1.1" (ngày/tháng) của năm `year` → "YYYY-MM-DD"; sai thì null */
export function parseDayMonth(text: string, year: number): string | null {
  const m = /^\s*(\d{1,2})\s*[/.-]\s*(\d{1,2})\s*$/.exec(text);
  if (!m) return null;
  const date = `${year}-${m[2]!.padStart(2, '0')}-${m[1]!.padStart(2, '0')}`;
  return isValidDate(date) ? date : null;
}

export function sortHolidays(list: readonly Holiday[]): Holiday[] {
  return [...list].sort((a, b) => a.date.localeCompare(b.date));
}

/** Thêm một ngày lễ (ngày dạng ngày/tháng). Trả danh sách mới đã sắp xếp, hoặc lỗi để hiện cho admin. */
export function addHoliday(
  list: readonly Holiday[],
  dayMonth: string,
  name: string,
  year: number,
): { ok: true; holidays: Holiday[] } | { ok: false; error: string } {
  const date = parseDayMonth(dayMonth, year);
  if (!date) return { ok: false, error: 'Ngày phải có dạng ngày/tháng hợp lệ, ví dụ 25/12' };
  const trimmed = name.trim();
  if (!trimmed) return { ok: false, error: 'Nhập tên ngày lễ' };
  if (trimmed.length > 60) return { ok: false, error: 'Tên ngày lễ tối đa 60 ký tự' };
  if (list.some((h) => h.date === date)) return { ok: false, error: `Ngày ${formatDayMonth(date)} đã có trong danh sách` };
  return { ok: true, holidays: sortHolidays([...list, { date, name: trimmed }]) };
}

/**
 * Kiểm tra bản nháp bằng đúng schema server dùng (RuleSetInput), cộng luật ngày lễ phải thuộc năm đó
 * (server cũng kiểm tra) và không trùng ngày.
 */
export function validateDraft(
  year: number,
  d: RulesDraft,
): { ok: true; input: RuleSetInput } | { ok: false; errors: DraftErrors } {
  const errors: DraftErrors = {};
  const minimumWage = d.minimumWage.trim() ? parseWon(d.minimumWage) : NaN;
  const candidate = {
    minimumWage,
    holidays: d.holidays,
    weeklyHoliday: { minHours: parseDecimal(d.minHours), maxHours: parseDecimal(d.maxHours), paidHours: parseDecimal(d.paidHours) },
  };

  const parsed = RuleSetInput.safeParse(candidate);
  if (!parsed.success) {
    for (const issue of parsed.error.issues) {
      const key = fieldOf(issue.path);
      errors[key] ??= messageFor(key, issue);
    }
  }
  if (!errors.holidays) {
    const other = d.holidays.find((h) => !h.date.startsWith(`${year}-`));
    if (other) errors.holidays = `Ngày lễ ${other.date} không thuộc năm ${year}`;
    const dates = d.holidays.map((h) => h.date);
    const dup = dates.find((x, i) => dates.indexOf(x) !== i);
    if (dup) errors.holidays = `Ngày ${formatDayMonth(dup)} bị trùng`;
  }

  if (parsed.success && Object.keys(errors).length === 0) return { ok: true, input: parsed.data };
  return { ok: false, errors };
}

function fieldOf(path: readonly PropertyKey[]): keyof DraftErrors {
  if (path[0] === 'weeklyHoliday') {
    const k = path[1];
    return k === 'maxHours' || k === 'paidHours' ? k : 'minHours';
  }
  return path[0] === 'holidays' ? 'holidays' : 'minimumWage';
}

function messageFor(key: keyof DraftErrors, issue: z.core.$ZodIssue): string {
  switch (key) {
    case 'minimumWage':
      return 'Lương tối thiểu là số won từ 1 đến 1.000.000';
    case 'minHours':
      return issue.code === 'custom' ? issue.message : 'Số giờ tối thiểu từ 0 đến 168';
    case 'maxHours':
      return 'Số giờ tối đa lớn hơn 0 và không quá 168';
    case 'paidHours':
      return 'Số giờ được trả lớn hơn 0 và không quá 24';
    case 'holidays':
      return `Ngày lễ: ${issue.message}`;
  }
}

/** Bản nháp đã khác bản đang lưu chưa (để hỏi trước khi đóng). */
export function isDirty(draft: RulesDraft, saved: RulesDraft): boolean {
  return JSON.stringify(draft) !== JSON.stringify(saved);
}

// ---------- Nhật ký thay đổi ----------

/** before/after của nhật ký là bản ghi ruleSets nguyên văn; đọc phòng thủ vì kiểu là unknown */
const LoggedRules = z.object({
  minimumWage: z.number(),
  holidays: z.array(z.object({ date: z.string(), name: z.string() })),
  weeklyHoliday: z.object({ minHours: z.number(), maxHours: z.number(), paidHours: z.number() }),
});

const weeklyText = (w: Rules['weeklyHoliday']) =>
  `từ ${formatDecimal(w.minHours)} giờ, tính tối đa ${formatDecimal(w.maxHours)} giờ, trả ${formatDecimal(w.paidHours)} giờ`;

/** Tóm tắt một lần sửa thành vài dòng dễ đọc. */
export function summarizeChange(before: unknown, after: unknown): string[] {
  const a = LoggedRules.safeParse(after);
  if (!a.success) return ['Không đọc được nội dung thay đổi'];
  const b = LoggedRules.safeParse(before);
  if (!b.success) {
    return [
      `Tạo mới: lương tối thiểu ${formatNumber(a.data.minimumWage)} ₩, ${a.data.holidays.length} ngày lễ`,
      `주휴수당 ${weeklyText(a.data.weeklyHoliday)}`,
    ];
  }

  const lines: string[] = [];
  if (b.data.minimumWage !== a.data.minimumWage) {
    lines.push(`Lương tối thiểu: ${formatNumber(b.data.minimumWage)} → ${formatNumber(a.data.minimumWage)} ₩`);
  }
  const wb = b.data.weeklyHoliday;
  const wa = a.data.weeklyHoliday;
  if (wb.minHours !== wa.minHours || wb.maxHours !== wa.maxHours || wb.paidHours !== wa.paidHours) {
    lines.push(`주휴수당: ${weeklyText(wb)} → ${weeklyText(wa)}`);
  }
  const key = (h: Holiday) => `${h.date}|${h.name}`;
  const beforeKeys = new Set(b.data.holidays.map(key));
  const afterKeys = new Set(a.data.holidays.map(key));
  const added = a.data.holidays.filter((h) => !beforeKeys.has(key(h)));
  const removed = b.data.holidays.filter((h) => !afterKeys.has(key(h)));
  const fmt = (list: Holiday[]) => list.map((h) => `${formatDayMonth(h.date)} ${h.name}`).join(', ');
  if (added.length) lines.push(`Thêm ngày lễ: ${fmt(added)}`);
  if (removed.length) lines.push(`Bỏ ngày lễ: ${fmt(removed)}`);
  return lines.length ? lines : ['Lưu lại, không đổi nội dung'];
}
