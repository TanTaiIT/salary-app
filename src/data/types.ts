import type { Hours } from '@/payroll/index.ts';

/**
 * Bản ghi trên máy, khớp collection của server (docs/spec.md, Mô hình dữ liệu).
 * `updatedAt` là giờ máy lúc sửa; `deletedAt` khác null là đã xóa mềm;
 * `dirty` = chưa đồng bộ lên server.
 */
interface Syncable {
  id: string;
  updatedAt: string;
  deletedAt: string | null;
  dirty: boolean;
}

export type CompanySize = 'under5' | '5plus';

export interface Job extends Syncable {
  name: string;
  hourlyWage: number;
  companySize: CompanySize;
}

export interface WorkDayRecord extends Syncable {
  jobId: string;
  /** "YYYY-MM-DD" giờ Hàn Quốc */
  date: string;
  hours: Hours;
  allowance: number;
  /** Lương giờ lúc ghi ngày công; đổi lương giờ không làm đổi ngày cũ */
  wageSnapshot: number;
}

/** 주휴수당 đã xác nhận cho một tuần. amount = 0 nghĩa là người dùng đã bỏ, không gợi ý lại. */
export interface WeeklyPayRecord extends Syncable {
  jobId: string;
  /** Thứ Hai của tuần */
  weekStart: string;
  amount: number;
}

export type ThemePreference = 'auto' | 'light' | 'dark';

export interface Settings {
  activeJobId: string | null;
  /** Tỉ lệ khấu trừ để ước tính lương thực nhận, phần trăm (0 = không khấu trừ) */
  deductRate: number;
  /** Lúc đổi deductRate trên máy (ISO); null là chưa đổi lần nào. Đồng bộ theo bản sửa mới nhất thắng. */
  deductRateUpdatedAt: string | null;
  /** deductRate đã đổi mà chưa đồng bộ */
  settingsDirty: boolean;
  theme: ThemePreference;
  /** Lần mở app đầu tiên (ISO), dùng cho cấp quảng cáo và đồng bộ */
  firstOpenAt: string | null;
}

export const DEFAULT_SETTINGS: Settings = {
  activeJobId: null,
  deductRate: 0,
  deductRateUpdatedAt: null,
  settingsDirty: false,
  theme: 'auto',
  firstOpenAt: null,
};

/** Bản ghi server từ chối khi đồng bộ (trùng ngày, trùng tuần, nơi làm không tồn tại…), giữ lại để người dùng xử lý. */
export interface SyncRejection {
  kind: 'job' | 'workDay' | 'weeklyPay';
  id: string;
  code: string;
}

/** Trạng thái đồng bộ lưu trên máy */
export interface SyncMeta {
  /** serverTime lần đồng bộ trước; null là chưa đồng bộ (gửi toàn bộ) */
  since: string | null;
  lastSyncedAt: string | null;
  rejections: SyncRejection[];
}

export const DEFAULT_SYNC_META: SyncMeta = { since: null, lastSyncedAt: null, rejections: [] };

/** Toàn bộ dữ liệu trên máy, nạp một lần khi mở app. */
export interface Snapshot {
  jobs: Job[];
  workDays: WorkDayRecord[];
  weeklyPays: WeeklyPayRecord[];
  /** Giá trị đã JSON.stringify, theo khóa */
  kv: Record<string, string>;
}

export interface LocalStorage {
  load(): Promise<Snapshot>;
  putJobs(rows: Job[]): Promise<void>;
  putWorkDays(rows: WorkDayRecord[]): Promise<void>;
  putWeeklyPays(rows: WeeklyPayRecord[]): Promise<void>;
  putKv(key: string, value: string): Promise<void>;
}
