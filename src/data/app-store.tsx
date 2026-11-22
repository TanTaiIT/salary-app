import { randomUUID } from 'expo-crypto';
import { createContext, use, useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';

import { setThemePreference } from '@/hooks/theme-preference';
import { dayOfWeek, emptyHours, type Hours } from '@/payroll/index.ts';
import { WorkDayInput } from '@/schemas/index.ts';

import { daysOfMonth, monthOf, todayKst, weekSunday } from './month';
import { fetchRules, rulesFor, type Rules } from './rules';
import { storage } from './storage';
import { DEFAULT_SETTINGS, type Job, type Settings, type Snapshot, type WeeklyPayRecord, type WorkDayRecord } from './types';

interface State {
  jobs: Job[];
  workDays: WorkDayRecord[];
  weeklyPays: WeeklyPayRecord[];
  settings: Settings;
  rulesCache: Record<string, Rules>;
}

export interface DayInput {
  hours: Hours;
  allowance: number;
}

type Result = { ok: true } | { ok: false; message: string };

interface AppContextValue {
  ready: boolean;
  /** Nơi làm việc đang chọn */
  job: Job | null;
  /** Ngày công chưa xóa của nơi làm đang chọn */
  workDays: WorkDayRecord[];
  /** 주휴수당 chưa xóa của nơi làm đang chọn (kể cả bản amount = 0 là đã bỏ) */
  weeklyPays: WeeklyPayRecord[];
  settings: Settings;
  rules: (year: string) => Rules;

  /** Tháng đang xem "YYYY-MM", dùng chung cho mọi tab */
  month: string;
  setMonth: (month: string) => void;

  saveDay: (date: string, input: DayInput) => Result;
  deleteDay: (date: string) => void;
  /** amount = 0 là bỏ, không gợi ý lại tuần này */
  setWeeklyPay: (weekStart: string, amount: number) => void;
  updateJob: (patch: Partial<Pick<Job, 'name' | 'hourlyWage' | 'companySize'>>) => void;
  updateSettings: (patch: Partial<Settings>) => void;
  clearMonth: (month: string) => void;
  loadDemo: (month: string) => void;

  /** Ngày đang mở trong bảng chấm công, null khi đóng */
  editingDate: string | null;
  openDay: (date: string) => void;
  closeDay: () => void;

  toastMessage: string | null;
  toast: (message: string) => void;
}

const AppContext = createContext<AppContextValue | null>(null);

export function useApp(): AppContextValue {
  const ctx = use(AppContext);
  if (!ctx) throw new Error('useApp phải nằm trong <AppProvider>');
  return ctx;
}

const nowIso = () => new Date().toISOString();
const alive = <T extends { deletedAt: string | null }>(r: T) => r.deletedAt === null;

function parseKv<T>(kv: Record<string, string>, key: string): T | undefined {
  try {
    return kv[key] ? (JSON.parse(kv[key]) as T) : undefined;
  } catch {
    return undefined;
  }
}

function stateFromSnapshot(s: Snapshot): State {
  const rulesCache: Record<string, Rules> = {};
  for (const key of Object.keys(s.kv)) {
    if (key.startsWith('rules:')) {
      const r = parseKv<Rules>(s.kv, key);
      if (r) rulesCache[key.slice(6)] = r;
    }
  }
  return {
    jobs: s.jobs,
    workDays: s.workDays,
    weeklyPays: s.weeklyPays,
    settings: { ...DEFAULT_SETTINGS, ...parseKv<Partial<Settings>>(s.kv, 'settings') },
    rulesCache,
  };
}

export function AppProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<State | null>(null);
  const stateRef = useRef<State | null>(null);
  const [month, setMonth] = useState(() => monthOf(todayKst()));
  const [editingDate, setEditingDate] = useState<string | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const fetchedYears = useRef(new Set<string>());

  const toast = useCallback((message: string) => {
    setToastMessage(message);
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToastMessage(null), 1800);
  }, []);

  /** Cập nhật state ngay (giao diện phản hồi tức thì), ghi xuống máy sau. */
  const commit = useCallback(
    (next: State, persist: () => Promise<unknown>) => {
      stateRef.current = next;
      setState(next);
      persist().catch(() => toast('Không lưu được vào máy, hãy thử lại'));
    },
    [toast],
  );

  // Nạp dữ liệu; lần đầu mở app thì tạo nơi làm mặc định.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      let s: State;
      try {
        s = stateFromSnapshot(await storage.load());
      } catch {
        s = stateFromSnapshot({ jobs: [], workDays: [], weeklyPays: [], kv: {} });
      }
      const writes: Promise<unknown>[] = [];

      let job = s.jobs.find((j) => alive(j) && j.id === s.settings.activeJobId) ?? s.jobs.find(alive);
      if (!job) {
        const year = todayKst().slice(0, 4);
        job = {
          id: randomUUID(),
          name: 'Nơi làm chính',
          hourlyWage: rulesFor(year, s.rulesCache).minimumWage,
          companySize: '5plus',
          updatedAt: nowIso(),
          deletedAt: null,
          dirty: true,
        };
        s = { ...s, jobs: [...s.jobs, job] };
        writes.push(storage.putJobs([job]));
      }
      if (s.settings.activeJobId !== job.id || !s.settings.firstOpenAt) {
        s = { ...s, settings: { ...s.settings, activeJobId: job.id, firstOpenAt: s.settings.firstOpenAt ?? nowIso() } };
        writes.push(storage.putKv('settings', JSON.stringify(s.settings)));
      }
      await Promise.allSettled(writes);
      if (cancelled) return;
      setThemePreference(s.settings.theme);
      stateRef.current = s;
      setState(s);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // Tải quy định của năm đang xem (lương tối thiểu, ngày lễ, điều kiện 주휴수당), lưu đệm trên máy.
  const year = month.slice(0, 4);
  const ready = state !== null;
  useEffect(() => {
    if (!ready || fetchedYears.current.has(year)) return;
    fetchedYears.current.add(year);
    fetchRules(year).then((rules) => {
      const s = stateRef.current;
      if (!rules || !s) return;
      commit({ ...s, rulesCache: { ...s.rulesCache, [year]: rules } }, () =>
        storage.putKv(`rules:${year}`, JSON.stringify(rules)),
      );
    });
  }, [ready, year, commit]);

  const value = useMemo<AppContextValue>(() => {
    const s = state;
    const job = s?.jobs.find((j) => j.id === s.settings.activeJobId) ?? null;
    const jobId = job?.id ?? '';
    const workDays = s?.workDays.filter((d) => alive(d) && d.jobId === jobId) ?? [];
    const weeklyPays = s?.weeklyPays.filter((w) => alive(w) && w.jobId === jobId) ?? [];
    const rules = (y: string) => rulesFor(y, s?.rulesCache ?? {});

    const current = () => stateRef.current!;

    function upsertDays(rows: WorkDayRecord[]) {
      const cur = current();
      const ids = new Set(rows.map((r) => r.id));
      commit({ ...cur, workDays: [...cur.workDays.filter((d) => !ids.has(d.id)), ...rows] }, () =>
        storage.putWorkDays(rows),
      );
    }

    function upsertWeekly(rows: WeeklyPayRecord[]) {
      const cur = current();
      const ids = new Set(rows.map((r) => r.id));
      commit({ ...cur, weeklyPays: [...cur.weeklyPays.filter((w) => !ids.has(w.id)), ...rows] }, () =>
        storage.putWeeklyPays(rows),
      );
    }

    const findDay = (date: string) => current().workDays.find((d) => alive(d) && d.jobId === jobId && d.date === date);

    /** Xóa mềm ngày công và 주휴수당 (tuần có CN trong tháng) của nơi làm đang chọn. */
    function clearMonth(m: string) {
      const now = nowIso();
      const cur = current();
      const days = cur.workDays
        .filter((d) => alive(d) && d.jobId === jobId && monthOf(d.date) === m)
        .map((d) => ({ ...d, deletedAt: now, updatedAt: now, dirty: true }));
      const weekly = cur.weeklyPays
        .filter((w) => alive(w) && w.jobId === jobId && monthOf(weekSunday(w.weekStart)) === m)
        .map((w) => ({ ...w, deletedAt: now, updatedAt: now, dirty: true }));
      const dayIds = new Set(days.map((d) => d.id));
      const weekIds = new Set(weekly.map((w) => w.id));
      commit(
        {
          ...cur,
          workDays: [...cur.workDays.filter((d) => !dayIds.has(d.id)), ...days],
          weeklyPays: [...cur.weeklyPays.filter((w) => !weekIds.has(w.id)), ...weekly],
        },
        () => Promise.all([storage.putWorkDays(days), storage.putWeeklyPays(weekly)]),
      );
    }

    return {
      ready: s !== null,
      job,
      workDays,
      weeklyPays,
      settings: s?.settings ?? DEFAULT_SETTINGS,
      rules,
      month,
      setMonth,

      saveDay(date, { hours, allowance }) {
        if (!job) return { ok: false, message: 'Chưa có nơi làm việc' };
        const existing = findDay(date);
        const now = nowIso();
        const empty = Object.values(hours).every((h) => h === 0) && allowance === 0;
        if (empty) {
          if (existing) upsertDays([{ ...existing, deletedAt: now, updatedAt: now, dirty: true }]);
          return { ok: true };
        }
        const record: WorkDayRecord = existing
          ? { ...existing, hours, allowance, updatedAt: now, dirty: true }
          : {
              id: randomUUID(),
              jobId,
              date,
              hours,
              allowance,
              wageSnapshot: job.hourlyWage,
              updatedAt: now,
              deletedAt: null,
              dirty: true,
            };
        // Cùng luật kiểm tra với server, để bản lưu trên máy luôn đồng bộ lên được.
        const check = WorkDayInput.safeParse(record);
        if (!check.success) return { ok: false, message: check.error.issues[0]?.message ?? 'Dữ liệu không hợp lệ' };
        upsertDays([record]);
        return { ok: true };
      },

      deleteDay(date) {
        const existing = findDay(date);
        const now = nowIso();
        if (existing) upsertDays([{ ...existing, deletedAt: now, updatedAt: now, dirty: true }]);
      },

      setWeeklyPay(weekStart, amount) {
        const now = nowIso();
        const existing = current().weeklyPays.find((w) => alive(w) && w.jobId === jobId && w.weekStart === weekStart);
        upsertWeekly([
          existing
            ? { ...existing, amount, updatedAt: now, dirty: true }
            : { id: randomUUID(), jobId, weekStart, amount, updatedAt: now, deletedAt: null, dirty: true },
        ]);
      },

      updateJob(patch) {
        if (!job) return;
        const next: Job = { ...job, ...patch, updatedAt: nowIso(), dirty: true };
        const cur = current();
        commit({ ...cur, jobs: cur.jobs.map((j) => (j.id === job.id ? next : j)) }, () => storage.putJobs([next]));
      },

      updateSettings(patch) {
        const cur = current();
        const settings = { ...cur.settings, ...patch };
        if (patch.theme) setThemePreference(patch.theme);
        commit({ ...cur, settings }, () => storage.putKv('settings', JSON.stringify(settings)));
      },

      clearMonth,

      loadDemo(m) {
        if (!job) return;
        clearMonth(m);
        const now = nowIso();
        const rows: WorkDayRecord[] = [];
        for (const date of daysOfMonth(m)) {
          const d = Number(date.slice(8));
          const dow = dayOfWeek(date);
          if (rows.length >= 16 || dow === 0 || dow === 4 || d < 8) continue;
          const hours = emptyHours();
          let allowance = 0;
          if (dow === 2) {
            hours.x1 = 6;
            hours.x1_5 = 2;
            allowance = 10_000;
          } else if (dow === 5 && d % 2 === 1) {
            hours.x1 = 4;
            hours.x2 = 1;
            allowance = 20_000;
          } else {
            hours.x1 = 8;
          }
          rows.push({
            id: randomUUID(),
            jobId,
            date,
            hours,
            allowance,
            wageSnapshot: job.hourlyWage,
            updatedAt: now,
            deletedAt: null,
            dirty: true,
          });
        }
        upsertDays(rows);
      },

      editingDate,
      openDay: setEditingDate,
      closeDay: () => setEditingDate(null),
      toastMessage,
      toast,
    };
  }, [state, month, editingDate, toastMessage, commit, toast]);

  return <AppContext value={value}>{children}</AppContext>;
}
