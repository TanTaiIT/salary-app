// Hàm thuần cho đồng bộ: dựng gói gửi lên, áp kết quả server, gộp dữ liệu kéo về theo nguyên tắc
// "bản sửa mới nhất thắng" (docs/spec.md, Đồng bộ offline). Không import gì ngoài kiểu, để test bằng node --test.
import type { components } from '../api/schema';
import type { Job, Settings, SyncRejection, WeeklyPayRecord, WorkDayRecord } from '../data/types';

type S = components['schemas'];
type SyncRequest = S['SyncRequest'];
type SyncResponse = S['SyncResponse'];

/** Server nhận tối đa 500 bản mỗi loại trong một gói */
export const BATCH = 500;

interface Syncable {
  id: string;
  updatedAt: string;
  deletedAt: string | null;
  dirty: boolean;
}

// ---------- Đổi kiểu giữa máy và API ----------

export const jobToChange = (j: Job): NonNullable<SyncRequest['jobs']>[number] => ({
  id: j.id,
  data: { name: j.name, hourlyWage: j.hourlyWage, companySize: j.companySize, updatedAt: j.updatedAt },
  deletedAt: j.deletedAt,
});

export const workDayToChange = (d: WorkDayRecord): SyncRequest['workDays'][number] => ({
  id: d.id,
  data: {
    jobId: d.jobId,
    date: d.date,
    hours: d.hours,
    allowance: d.allowance,
    wageSnapshot: d.wageSnapshot,
    updatedAt: d.updatedAt,
  },
  deletedAt: d.deletedAt,
});

export const weeklyToChange = (w: WeeklyPayRecord): NonNullable<SyncRequest['weeklyHolidayPays']>[number] => ({
  id: w.id,
  data: { jobId: w.jobId, weekStart: w.weekStart, amount: w.amount, updatedAt: w.updatedAt },
  deletedAt: w.deletedAt,
});

export const jobFromApi = (j: SyncResponse['jobs'][number]): Job => ({
  id: j.id,
  name: j.name,
  hourlyWage: j.hourlyWage,
  companySize: j.companySize,
  updatedAt: j.updatedAt,
  deletedAt: j.deletedAt,
  dirty: false,
});

export const workDayFromApi = (d: SyncResponse['workDays'][number]): WorkDayRecord => ({
  id: d.id,
  jobId: d.jobId,
  date: d.date,
  hours: d.hours,
  allowance: d.allowance,
  wageSnapshot: d.wageSnapshot,
  updatedAt: d.updatedAt,
  deletedAt: d.deletedAt,
  dirty: false,
});

export const weeklyFromApi = (w: SyncResponse['weeklyHolidayPays'][number]): WeeklyPayRecord => ({
  id: w.id,
  jobId: w.jobId,
  weekStart: w.weekStart,
  amount: w.amount,
  updatedAt: w.updatedAt,
  deletedAt: w.deletedAt,
  dirty: false,
});

// ---------- Gửi lên ----------

/** Các bản chưa đồng bộ, tối đa BATCH, bỏ qua những id đã bị từ chối trong lần chạy này. */
export function pickDirty<T extends Syncable>(rows: readonly T[], skip: ReadonlySet<string> = new Set()): T[] {
  return rows.filter((r) => r.dirty && !skip.has(r.id)).slice(0, BATCH);
}

// ---------- Kết quả server ----------

export interface ApplyResultsOutput<T> {
  /** Bản cần ghi lại (đã bỏ dấu chưa đồng bộ) */
  clean: T[];
  rejections: SyncRejection[];
}

/**
 * applied/stale: server đã có bản này hoặc bản mới hơn → bỏ dấu chưa đồng bộ, nhưng chỉ khi người dùng
 * chưa sửa tiếp trong lúc chờ (updatedAt vẫn bằng bản đã gửi). rejected: giữ nguyên, ghi lại lý do.
 */
export function applyResults<T extends Syncable>(
  kind: SyncRejection['kind'],
  current: readonly T[],
  sent: readonly T[],
  results: readonly SyncResponse['results'][number][],
): ApplyResultsOutput<T> {
  const sentAt = new Map(sent.map((r) => [r.id, r.updatedAt]));
  const byId = new Map(current.map((r) => [r.id, r]));
  const clean: T[] = [];
  const rejections: SyncRejection[] = [];
  for (const res of results) {
    if (res.status === 'rejected') {
      rejections.push({ kind, id: res.id, code: res.code ?? 'rejected' });
      continue;
    }
    const local = byId.get(res.id);
    if (local && local.dirty && local.updatedAt === sentAt.get(res.id)) clean.push({ ...local, dirty: false });
  }
  return { clean, rejections };
}

// ---------- Kéo về ----------

/**
 * Gộp bản server vào máy: lấy bản server, trừ khi bản trên máy đang chờ gửi và mới hơn.
 * Trả về những bản cần ghi (bỏ qua bản giống hệt đã có).
 */
export function mergeRemote<T extends Syncable>(current: readonly T[], remote: readonly T[]): T[] {
  const byId = new Map(current.map((r) => [r.id, r]));
  const out: T[] = [];
  for (const r of remote) {
    const local = byId.get(r.id);
    if (local?.dirty && local.updatedAt > r.updatedAt) continue;
    if (local && !local.dirty && sameRecord(local, r)) continue;
    out.push({ ...r, dirty: false });
  }
  return out;
}

function sameRecord(a: object, b: object): boolean {
  const strip = (x: object) => JSON.stringify({ ...x, dirty: undefined });
  return strip(a) === strip(b);
}

// ---------- Cài đặt ----------

/**
 * Cài đặt sau khi đồng bộ. `sentAt` là deductRateUpdatedAt của bản đã gửi (null nếu không gửi).
 * Bản server thắng trừ khi máy có bản mới hơn chưa gửi.
 */
export function mergeSettings(
  local: Settings,
  sentAt: string | null,
  result: SyncResponse['settingsResult'],
  remote: SyncResponse['settings'],
): Partial<Settings> | null {
  let settingsDirty = local.settingsDirty;
  if (result && sentAt && local.deductRateUpdatedAt === sentAt) settingsDirty = false;

  const localAt = local.deductRateUpdatedAt;
  if (remote && (!settingsDirty || !localAt || remote.updatedAt >= localAt)) {
    if (remote.deductRate === local.deductRate && remote.updatedAt === localAt && !local.settingsDirty) return null;
    return { deductRate: remote.deductRate, deductRateUpdatedAt: remote.updatedAt, settingsDirty: false };
  }
  return settingsDirty !== local.settingsDirty ? { settingsDirty } : null;
}

// ---------- Chọn nơi làm sau khi đồng bộ lần đầu ----------

/**
 * Máy mới đăng nhập thường chỉ có nơi làm mặc định rỗng, còn dữ liệu thật ở nơi làm kéo từ server về.
 * Nếu nơi làm đang chọn chưa có ngày công nào thì chuyển sang nơi làm có nhiều ngày công nhất.
 */
export function pickActiveJob(
  activeJobId: string | null,
  jobs: readonly Job[],
  workDays: readonly WorkDayRecord[],
): string | null {
  const aliveJobs = jobs.filter((j) => j.deletedAt === null);
  if (aliveJobs.length === 0) return activeJobId;
  const counts = new Map<string, number>();
  for (const d of workDays) if (d.deletedAt === null) counts.set(d.jobId, (counts.get(d.jobId) ?? 0) + 1);
  const current = aliveJobs.find((j) => j.id === activeJobId);
  if (current && (counts.get(current.id) ?? 0) > 0) return current.id;
  const best = [...aliveJobs].sort((a, b) => (counts.get(b.id) ?? 0) - (counts.get(a.id) ?? 0))[0]!;
  if ((counts.get(best.id) ?? 0) > 0) return best.id;
  return current?.id ?? best.id;
}
