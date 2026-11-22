import { DEFAULT_WEEKLY_RULE, type WeeklyHolidayRule } from '@/payroll/index.ts';

export interface Holiday {
  date: string;
  name: string;
}

export interface Rules {
  minimumWage: number;
  holidays: Holiday[];
  weeklyHoliday: WeeklyHolidayRule;
}

/**
 * Bản dự phòng khi chưa tải được từ server (mở app lần đầu không có mạng).
 * Khớp scripts/seed-rules.ts của server; server (GET /v1/rules/:year) vẫn là nguồn chính.
 */
const BUNDLED: Record<string, Rules> = {
  '2026': {
    minimumWage: 10_320,
    weeklyHoliday: DEFAULT_WEEKLY_RULE,
    holidays: [
      { date: '2026-01-01', name: 'Năm mới' },
      { date: '2026-02-16', name: 'Seollal' },
      { date: '2026-02-17', name: 'Seollal' },
      { date: '2026-02-18', name: 'Seollal' },
      { date: '2026-03-01', name: 'Ngày độc lập' },
      { date: '2026-03-02', name: 'Nghỉ bù' },
      { date: '2026-05-05', name: 'Ngày thiếu nhi' },
      { date: '2026-05-24', name: 'Phật đản' },
      { date: '2026-05-25', name: 'Nghỉ bù' },
      { date: '2026-06-03', name: 'Bầu cử địa phương' },
      { date: '2026-06-06', name: 'Ngày tưởng niệm' },
      { date: '2026-08-15', name: 'Ngày giải phóng' },
      { date: '2026-08-17', name: 'Nghỉ bù' },
      { date: '2026-09-24', name: 'Chuseok' },
      { date: '2026-09-25', name: 'Chuseok' },
      { date: '2026-09-26', name: 'Chuseok' },
      { date: '2026-10-03', name: 'Ngày lập quốc' },
      { date: '2026-10-05', name: 'Nghỉ bù' },
      { date: '2026-10-09', name: 'Ngày Hangul' },
      { date: '2026-12-25', name: 'Giáng sinh' },
    ],
  },
};

const LATEST_BUNDLED = BUNDLED['2026']!;

/** Quy định của một năm: bản đã tải (cache) → bản dựng sẵn → lương tối thiểu mới nhất, không có ngày lễ. */
export function rulesFor(year: string, cache: Record<string, Rules>): Rules {
  return cache[year] ?? BUNDLED[year] ?? { ...LATEST_BUNDLED, holidays: [] };
}
