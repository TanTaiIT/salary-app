// Thao tác của người dùng trên dữ liệu trên máy. Mỗi thao tác đánh dấu bản ghi "chưa đồng bộ" (dirty)
// với updatedAt là giờ máy, rồi báo cho bộ đồng bộ (notifyLocalChange).
import { randomUUID } from 'expo-crypto';

import { setThemePreference } from '@/hooks/theme-preference';
import { dayOfWeek, emptyHours, type Hours } from '@/payroll/index.ts';
import { JobInput, WorkDayInput } from '@/schemas/index.ts';

import { daysOfMonth, monthOf, todayKst, weekSunday } from './month';
import { rulesFor } from './rules';
import {
  alive,
  getData,
  loadSnapshot,
  notifyLocalChange,
  useDataStore,
  writeJobs,
  writeSettings,
  writeSyncMeta,
  writeWeeklyPays,
  writeWorkDays,
} from './store';
import type { CompanySize, Job, Settings, WorkDayRecord } from './types';

export interface DayInput {
  hours: Hours;
  allowance: number;
}

export type Result = { ok: true } | { ok: false; message: string };

const nowIso = () => new Date().toISOString();

export const activeJob = (): Job | null => {
  const { jobs, settings } = getData();
  return jobs.find((j) => alive(j) && j.id === settings.activeJobId) ?? null;
};

const findDay = (jobId: string, date: string) =>
  getData().workDays.find((d) => alive(d) && d.jobId === jobId && d.date === date);

const tombstone = <T extends { deletedAt: string | null; updatedAt: string; dirty: boolean }>(r: T, now: string): T => ({
  ...r,
  deletedAt: now,
  updatedAt: now,
  dirty: true,
});

function newJob(name: string, hourlyWage: number, companySize: CompanySize): Job {
  return { id: randomUUID(), name, hourlyWage, companySize, updatedAt: nowIso(), deletedAt: null, dirty: true };
}

/** Nạp dữ liệu khi mở app; lần đầu thì tạo nơi làm mặc định với lương tối thiểu. */
export async function initData(): Promise<void> {
  const s = await loadSnapshot();
  useDataStore.setState({ ...s, ready: false });

  let job = s.jobs.find((j) => alive(j) && j.id === s.settings.activeJobId) ?? s.jobs.find(alive);
  if (!job) {
    job = newJob('Nơi làm chính', rulesFor(todayKst().slice(0, 4), s.rulesCache).minimumWage, '5plus');
    writeJobs([job]);
  }
  if (s.settings.activeJobId !== job.id || !s.settings.firstOpenAt) {
    writeSettings({ activeJobId: job.id, firstOpenAt: s.settings.firstOpenAt ?? nowIso() });
  }
  setThemePreference(getData().settings.theme);
  useDataStore.setState({ ready: true });
}

// ---------- Ngày công ----------

export function saveDay(date: string, { hours, allowance }: DayInput): Result {
  const job = activeJob();
  if (!job) return { ok: false, message: 'Chưa có nơi làm việc' };
  const existing = findDay(job.id, date);
  const now = nowIso();
  const empty = Object.values(hours).every((h) => h === 0) && allowance === 0;
  if (empty) {
    if (existing) {
      writeWorkDays([tombstone(existing, now)]);
      notifyLocalChange();
    }
    return { ok: true };
  }
  const record: WorkDayRecord = existing
    ? { ...existing, hours, allowance, updatedAt: now, dirty: true }
    : {
        id: randomUUID(),
        jobId: job.id,
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
  writeWorkDays([record]);
  notifyLocalChange();
  return { ok: true };
}

export function deleteDay(date: string): void {
  const job = activeJob();
  const existing = job && findDay(job.id, date);
  if (!existing) return;
  writeWorkDays([tombstone(existing, nowIso())]);
  notifyLocalChange();
}

/** amount = 0 là bỏ, không gợi ý lại tuần này */
export function setWeeklyPay(weekStart: string, amount: number): void {
  const job = activeJob();
  if (!job) return;
  const now = nowIso();
  const existing = getData().weeklyPays.find((w) => alive(w) && w.jobId === job.id && w.weekStart === weekStart);
  writeWeeklyPays([
    existing
      ? { ...existing, amount, updatedAt: now, dirty: true }
      : { id: randomUUID(), jobId: job.id, weekStart, amount, updatedAt: now, deletedAt: null, dirty: true },
  ]);
  notifyLocalChange();
}

/** Xóa mềm ngày công và 주휴수당 (tuần có CN trong tháng) của nơi làm đang chọn. */
export function clearMonth(month: string): void {
  const job = activeJob();
  if (!job) return;
  const now = nowIso();
  const { workDays, weeklyPays } = getData();
  writeWorkDays(workDays.filter((d) => alive(d) && d.jobId === job.id && monthOf(d.date) === month).map((d) => tombstone(d, now)));
  writeWeeklyPays(
    weeklyPays
      .filter((w) => alive(w) && w.jobId === job.id && monthOf(weekSunday(w.weekStart)) === month)
      .map((w) => tombstone(w, now)),
  );
  notifyLocalChange();
}

/** Dữ liệu mẫu (chỉ bản dev): thay ngày công của tháng bằng lịch làm giống ảnh prototype. */
export function loadDemo(month: string): void {
  const job = activeJob();
  if (!job) return;
  clearMonth(month);
  const now = nowIso();
  const rows: WorkDayRecord[] = [];
  for (const date of daysOfMonth(month)) {
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
    rows.push({ id: randomUUID(), jobId: job.id, date, hours, allowance, wageSnapshot: job.hourlyWage, updatedAt: now, deletedAt: null, dirty: true });
  }
  writeWorkDays(rows);
  notifyLocalChange();
}

// ---------- Nơi làm việc ----------

export function updateJob(patch: Partial<Pick<Job, 'name' | 'hourlyWage' | 'companySize'>>): Result {
  const job = activeJob();
  if (!job) return { ok: false, message: 'Chưa có nơi làm việc' };
  const next: Job = { ...job, ...patch, updatedAt: nowIso(), dirty: true };
  const check = JobInput.safeParse(next);
  if (!check.success) return { ok: false, message: check.error.issues[0]?.message ?? 'Dữ liệu không hợp lệ' };
  writeJobs([next]);
  notifyLocalChange();
  return { ok: true };
}

export function addJob(name: string, hourlyWage: number, companySize: CompanySize = '5plus'): Result {
  const job = newJob(name.trim(), hourlyWage, companySize);
  const check = JobInput.safeParse(job);
  if (!check.success) return { ok: false, message: check.error.issues[0]?.message ?? 'Dữ liệu không hợp lệ' };
  writeJobs([job]);
  writeSettings({ activeJobId: job.id });
  notifyLocalChange();
  return { ok: true };
}

export function selectJob(jobId: string): void {
  if (getData().jobs.some((j) => alive(j) && j.id === jobId)) writeSettings({ activeJobId: jobId });
}

/**
 * Xóa nơi làm cùng mọi ngày công và 주휴수당 của nó (docs/spec.md: app chịu trách nhiệm xóa kèm).
 * Không xóa được nơi làm cuối cùng.
 */
export function deleteJob(jobId: string): Result {
  const { jobs, workDays, weeklyPays } = getData();
  const remaining = jobs.filter((j) => alive(j) && j.id !== jobId);
  const job = jobs.find((j) => j.id === jobId && alive(j));
  if (!job) return { ok: false, message: 'Không tìm thấy nơi làm việc' };
  if (remaining.length === 0) return { ok: false, message: 'Cần giữ ít nhất một nơi làm việc' };
  const now = nowIso();
  writeWorkDays(workDays.filter((d) => alive(d) && d.jobId === jobId).map((d) => tombstone(d, now)));
  writeWeeklyPays(weeklyPays.filter((w) => alive(w) && w.jobId === jobId).map((w) => tombstone(w, now)));
  writeJobs([tombstone(job, now)]);
  if (getData().settings.activeJobId === jobId) writeSettings({ activeJobId: remaining[0]!.id });
  notifyLocalChange();
  return { ok: true };
}

// ---------- Cài đặt ----------

export function updateSettings(patch: Partial<Pick<Settings, 'deductRate' | 'theme'>>): void {
  const extra: Partial<Settings> = {};
  // Chỉ mức khấu trừ được đồng bộ; chế độ màu là lựa chọn của từng máy
  if (patch.deductRate !== undefined && patch.deductRate !== getData().settings.deductRate) {
    extra.deductRateUpdatedAt = nowIso();
    extra.settingsDirty = true;
  }
  writeSettings({ ...patch, ...extra });
  if (patch.theme) setThemePreference(patch.theme);
  if (extra.settingsDirty) notifyLocalChange();
}

// ---------- Dùng cho bộ đồng bộ ----------

/**
 * Đánh dấu chưa đồng bộ mọi bản ghi CÒN DÙNG (khi đăng nhập: dữ liệu trên máy được đẩy lên lần đầu).
 * Bản đã xóa và đã đồng bộ thì không gửi lại: cùng tài khoản thì server đã có việc xóa, tài khoản khác thì không
 * cần; gửi lại bản đã bỏ vì server từ chối (unknown_job) sẽ bị từ chối lần nữa. Bản xóa chưa gửi vẫn giữ dirty.
 */
export function markAllDirty(): void {
  const { jobs, workDays, weeklyPays, settings } = getData();
  const pending = <T extends { dirty: boolean; deletedAt: string | null }>(r: T) => !r.dirty && alive(r);
  writeJobs(jobs.filter(pending).map((r) => ({ ...r, dirty: true })));
  writeWorkDays(workDays.filter(pending).map((r) => ({ ...r, dirty: true })));
  writeWeeklyPays(weeklyPays.filter(pending).map((r) => ({ ...r, dirty: true })));
  if (settings.deductRateUpdatedAt && !settings.settingsDirty) writeSettings({ settingsDirty: true });
}

/**
 * Bỏ các bản server đã từ chối (trùng ngày, trùng tuần, nơi làm không tồn tại), giữ bản trên server.
 * Bản bị từ chối chưa từng được server nhận, nên chỉ xóa trên máy và KHÔNG gửi lên (gửi việc xóa của bản
 * unknown_job cũng bị từ chối, người dùng sẽ kẹt mãi). Sau đó kéo lại toàn bộ: nếu server có bản cùng id
 * (bản sửa bị từ chối của một bản đã có), bản server sẽ ghi đè lại.
 */
export function discardRejected(): void {
  const { sync, jobs, workDays, weeklyPays } = getData();
  const ids = new Set(sync.rejections.map((r) => r.id));
  const now = nowIso();
  const drop = <T extends { deletedAt: string | null; dirty: boolean }>(r: T): T => ({
    ...r,
    deletedAt: r.deletedAt ?? now,
    dirty: false,
  });
  writeJobs(jobs.filter((j) => ids.has(j.id)).map(drop));
  writeWorkDays(workDays.filter((d) => ids.has(d.id)).map(drop));
  writeWeeklyPays(weeklyPays.filter((w) => ids.has(w.id)).map(drop));
  writeSyncMeta({ since: null, rejections: [] });
  notifyLocalChange();
}
