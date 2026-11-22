import { useMemo } from 'react';

import { useApp } from '@/data/app-store';
import { buildMonth, weeklySuggestion } from '@/data/month';

/** Dữ liệu của tháng đang xem: ngày công, tổng tháng, ngày lễ, gợi ý 주휴수당. */
export function useMonth() {
  const { month, workDays, weeklyPays, job, rules } = useApp();

  const data = useMemo(() => buildMonth(month, workDays, weeklyPays), [month, workDays, weeklyPays]);

  const year = month.slice(0, 4);
  const holidayList = rules(year).holidays;
  const holidays = useMemo(() => new Map(holidayList.map((h) => [h.date, h.name])), [holidayList]);

  const suggestion = useMemo(
    () =>
      job ? weeklySuggestion(month, workDays, weeklyPays, job.hourlyWage, (y) => rules(y).weeklyHoliday) : null,
    [month, workDays, weeklyPays, job, rules],
  );

  return { month, data, holidays, suggestion };
}
