// Dữ liệu trên máy (nơi làm, ngày công, 주휴수당, cài đặt, quy định năm, trạng thái đồng bộ) trong một store Zustand.
// Mọi thay đổi đi qua các hàm write* ở đây: cập nhật store ngay để giao diện phản hồi tức thì, rồi ghi xuống
// SQLite (web: localStorage). Bộ đồng bộ (src/sync) đọc và ghi store từ ngoài React.
import { create } from 'zustand';

import type { Rules } from './rules';
import { storage } from './storage';
import {
  DEFAULT_SETTINGS,
  DEFAULT_SYNC_META,
  type Job,
  type Settings,
  type Snapshot,
  type SyncMeta,
  type WeeklyPayRecord,
  type WorkDayRecord,
} from './types';

export interface DataState {
  ready: boolean;
  jobs: Job[];
  workDays: WorkDayRecord[];
  weeklyPays: WeeklyPayRecord[];
  settings: Settings;
  rulesCache: Record<string, Rules>;
  sync: SyncMeta;
}

export const useDataStore = create<DataState>(() => ({
  ready: false,
  jobs: [],
  workDays: [],
  weeklyPays: [],
  settings: DEFAULT_SETTINGS,
  rulesCache: {},
  sync: DEFAULT_SYNC_META,
}));

export const getData = () => useDataStore.getState();

export const alive = <T extends { deletedAt: string | null }>(r: T) => r.deletedAt === null;

// ---------- Báo thay đổi do người dùng (để bộ đồng bộ hẹn giờ gửi lên) ----------

const changeListeners = new Set<() => void>();
export function onLocalChange(listener: () => void): () => void {
  changeListeners.add(listener);
  return () => changeListeners.delete(listener);
}
export const notifyLocalChange = () => changeListeners.forEach((l) => l());

// ---------- Lỗi ghi xuống máy ----------

let persistErrorHandler: (err: unknown) => void = () => {};
export const setPersistErrorHandler = (fn: (err: unknown) => void) => {
  persistErrorHandler = fn;
};
const persist = (p: Promise<unknown>) => {
  p.catch((err) => {
    console.warn('[storage] ghi xuống máy thất bại', err);
    persistErrorHandler(err);
  });
};

// ---------- Ghi ----------

function upsertById<T extends { id: string }>(list: T[], rows: T[]): T[] {
  if (rows.length === 0) return list;
  const ids = new Set(rows.map((r) => r.id));
  return [...list.filter((x) => !ids.has(x.id)), ...rows];
}

export function writeJobs(rows: Job[]): void {
  if (rows.length === 0) return;
  useDataStore.setState((s) => ({ jobs: upsertById(s.jobs, rows) }));
  persist(storage.putJobs(rows));
}

export function writeWorkDays(rows: WorkDayRecord[]): void {
  if (rows.length === 0) return;
  useDataStore.setState((s) => ({ workDays: upsertById(s.workDays, rows) }));
  persist(storage.putWorkDays(rows));
}

export function writeWeeklyPays(rows: WeeklyPayRecord[]): void {
  if (rows.length === 0) return;
  useDataStore.setState((s) => ({ weeklyPays: upsertById(s.weeklyPays, rows) }));
  persist(storage.putWeeklyPays(rows));
}

export function writeSettings(patch: Partial<Settings>): Settings {
  const settings = { ...getData().settings, ...patch };
  useDataStore.setState({ settings });
  persist(storage.putKv('settings', JSON.stringify(settings)));
  return settings;
}

export function writeSyncMeta(patch: Partial<SyncMeta>): void {
  const sync = { ...getData().sync, ...patch };
  useDataStore.setState({ sync });
  persist(storage.putKv('sync', JSON.stringify(sync)));
}

export function writeRules(year: string, rules: Rules): void {
  useDataStore.setState((s) => ({ rulesCache: { ...s.rulesCache, [year]: rules } }));
  persist(storage.putKv(`rules:${year}`, JSON.stringify(rules)));
}

// ---------- Nạp ----------

function parseKv<T>(kv: Record<string, string>, key: string): T | undefined {
  try {
    return kv[key] ? (JSON.parse(kv[key]) as T) : undefined;
  } catch {
    return undefined;
  }
}

export async function loadSnapshot(): Promise<Omit<DataState, 'ready'>> {
  let s: Snapshot;
  try {
    s = await storage.load();
  } catch (err) {
    console.warn('[storage] nạp dữ liệu trên máy thất bại', err);
    s = { jobs: [], workDays: [], weeklyPays: [], kv: {} };
  }
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
    sync: { ...DEFAULT_SYNC_META, ...parseKv<Partial<SyncMeta>>(s.kv, 'sync') },
  };
}
