// Trên web, expo-sqlite cần header COOP/COEP (SharedArrayBuffer). Bản web chỉ để xem thử giao diện,
// nên lưu vào localStorage với cùng giao diện LocalStorage như bản SQLite.
import type { LocalStorage, Snapshot } from './types';

const KEY = 'llhq-v2';

const empty = (): Snapshot => ({ jobs: [], workDays: [], weeklyPays: [], kv: {} });

function read(): Snapshot {
  try {
    const raw = globalThis.localStorage?.getItem(KEY);
    if (!raw) return empty();
    const s = { ...empty(), ...(JSON.parse(raw) as Partial<Snapshot>) };
    // Dữ liệu lưu trước khi có ghi chú không có trường note
    return { ...s, workDays: s.workDays.map((d) => ({ ...d, note: d.note ?? '' })) };
  } catch {
    return empty();
  }
}

function write(s: Snapshot): void {
  try {
    globalThis.localStorage?.setItem(KEY, JSON.stringify(s));
  } catch {
    // Trình duyệt chặn lưu (chế độ riêng tư): dữ liệu chỉ còn trong phiên này.
  }
}

function upsert<T extends { id: string }>(list: T[], rows: T[]): T[] {
  const byId = new Map(list.map((r) => [r.id, r]));
  for (const r of rows) byId.set(r.id, r);
  return [...byId.values()];
}

export const storage: LocalStorage = {
  async load() {
    return read();
  },
  async putJobs(rows) {
    const s = read();
    write({ ...s, jobs: upsert(s.jobs, rows) });
  },
  async putWorkDays(rows) {
    const s = read();
    write({ ...s, workDays: upsert(s.workDays, rows) });
  },
  async putWeeklyPays(rows) {
    const s = read();
    write({ ...s, weeklyPays: upsert(s.weeklyPays, rows) });
  },
  async putKv(key, value) {
    const s = read();
    write({ ...s, kv: { ...s.kv, [key]: value } });
  },
};
