// Cửa ngõ cho màn hình: useApp() gom dữ liệu (Zustand, src/data/store.ts), trạng thái giao diện
// (src/data/ui-store.ts) và các thao tác (src/data/actions.ts). Giữ nguyên API cũ để màn hình không phải đổi.
import { useEffect, useMemo, type ReactNode } from 'react';
import { useShallow } from 'zustand/react/shallow';

import * as actions from './actions';
import { rulesFor, type Rules } from './rules';
import { alive, setPersistErrorHandler, useDataStore } from './store';
import type { Job, Settings, SyncMeta, WeeklyPayRecord, WorkDayRecord } from './types';
import { closeDay, openDay, setMonth, toast, useUiStore } from './ui-store';

export type { DayInput, Result } from './actions';

export interface AppValue {
  ready: boolean;
  /** Nơi làm việc đang chọn */
  job: Job | null;
  /** Mọi nơi làm việc chưa xóa */
  jobs: Job[];
  /** Ngày công chưa xóa của nơi làm đang chọn */
  workDays: WorkDayRecord[];
  /** 주휴수당 chưa xóa của nơi làm đang chọn (kể cả bản amount = 0 là đã bỏ) */
  weeklyPays: WeeklyPayRecord[];
  settings: Settings;
  sync: SyncMeta;
  rules: (year: string) => Rules;

  /** Tháng đang xem "YYYY-MM", dùng chung cho mọi tab */
  month: string;
  setMonth: typeof setMonth;

  saveDay: typeof actions.saveDay;
  deleteDay: typeof actions.deleteDay;
  setWeeklyPay: typeof actions.setWeeklyPay;
  updateJob: typeof actions.updateJob;
  addJob: typeof actions.addJob;
  selectJob: typeof actions.selectJob;
  deleteJob: typeof actions.deleteJob;
  updateSettings: typeof actions.updateSettings;
  clearMonth: typeof actions.clearMonth;
  loadDemo: typeof actions.loadDemo;

  editingDate: string | null;
  openDay: typeof openDay;
  closeDay: typeof closeDay;
  toastMessage: string | null;
  toast: typeof toast;
}

const STABLE = {
  setMonth,
  saveDay: actions.saveDay,
  deleteDay: actions.deleteDay,
  setWeeklyPay: actions.setWeeklyPay,
  updateJob: actions.updateJob,
  addJob: actions.addJob,
  selectJob: actions.selectJob,
  deleteJob: actions.deleteJob,
  updateSettings: actions.updateSettings,
  clearMonth: actions.clearMonth,
  loadDemo: actions.loadDemo,
  openDay,
  closeDay,
  toast,
};

export function useApp(): AppValue {
  const data = useDataStore(
    useShallow((s) => ({
      ready: s.ready,
      jobs: s.jobs,
      workDays: s.workDays,
      weeklyPays: s.weeklyPays,
      settings: s.settings,
      sync: s.sync,
      rulesCache: s.rulesCache,
    })),
  );
  const ui = useUiStore(useShallow((s) => ({ month: s.month, editingDate: s.editingDate, toastMessage: s.toastMessage })));

  const derived = useMemo(() => {
    const jobs = data.jobs.filter(alive);
    const job = jobs.find((j) => j.id === data.settings.activeJobId) ?? null;
    const jobId = job?.id ?? '';
    return {
      jobs,
      job,
      workDays: data.workDays.filter((d) => alive(d) && d.jobId === jobId),
      weeklyPays: data.weeklyPays.filter((w) => alive(w) && w.jobId === jobId),
      rules: (y: string) => rulesFor(y, data.rulesCache),
    };
  }, [data.jobs, data.workDays, data.weeklyPays, data.settings.activeJobId, data.rulesCache]);

  return {
    ...STABLE,
    ...derived,
    ready: data.ready,
    settings: data.settings,
    sync: data.sync,
    ...ui,
  };
}

/** Nạp dữ liệu trên máy khi mở app. */
export function AppProvider({ children }: { children: ReactNode }) {
  useEffect(() => {
    setPersistErrorHandler(() => toast('Không lưu được vào máy, hãy thử lại'));
    actions.initData();
  }, []);
  return children;
}
