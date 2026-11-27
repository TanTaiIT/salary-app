// Schema kiểm tra dữ liệu đầu vào của API. App React Native có thể chép file này
// (cùng thư mục src/payroll) để dùng chung một luật kiểm tra.
import { z } from 'zod';
import { dayOfWeek, isValidDate, totalHours } from '../payroll/index.ts';

export const DateString = z
  .string()
  .refine(isValidDate, { message: 'Ngày phải có dạng YYYY-MM-DD hợp lệ' });

export const MonthString = z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/, 'Tháng phải có dạng YYYY-MM');

const HalfHours = z.number().min(0).max(24).multipleOf(0.5, 'Số giờ phải là bội số của 0,5');

export const HoursSchema = z.object({
  x1: HalfHours,
  x1_5: HalfHours,
  x2: HalfHours,
  x2_5: HalfHours,
  x3: HalfHours,
});

const Won = z.number().int().min(0).max(100_000_000);

export const Id = z.uuid();

/** Độ dài tối đa của ghi chú một ngày công (ký tự) */
export const NOTE_MAX = 200;

/** Số thay đổi tối đa mỗi loại trong một gói /v1/sync; app gửi theo lô đúng bằng số này */
export const SYNC_BATCH_MAX = 250;

/** Ngày công app gửi lên. updatedAt là thời điểm sửa trên máy người dùng. */
export const WorkDayInput = z
  .object({
    jobId: z.string().min(1).max(64),
    date: DateString,
    hours: HoursSchema,
    allowance: Won,
    wageSnapshot: z.number().int().min(1).max(1_000_000),
    /** Ghi chú của người dùng; app cũ không gửi trường này thì coi là không có ghi chú */
    note: z.string().trim().max(NOTE_MAX, `Ghi chú tối đa ${NOTE_MAX} ký tự`).default(''),
    updatedAt: z.iso.datetime(),
  })
  .refine((v) => totalHours(v.hours) <= 24, {
    message: 'Tổng số giờ trong ngày không được quá 24',
    path: ['hours'],
  });
export type WorkDayInput = z.infer<typeof WorkDayInput>;

/** Một thay đổi trong gói đồng bộ: tạo/sửa (deletedAt = null) hoặc xóa (deletedAt có giá trị). */
export const WorkDayChange = z.object({
  id: Id,
  data: WorkDayInput,
  deletedAt: z.iso.datetime().nullable(),
});
export type WorkDayChange = z.infer<typeof WorkDayChange>;

/** Nơi làm việc người dùng nhập. */
export const JobInput = z.object({
  name: z.string().trim().min(1).max(60),
  hourlyWage: z.number().int().min(1).max(1_000_000),
  companySize: z.enum(['under5', '5plus']),
});
export type JobInput = z.infer<typeof JobInput>;

/** Một thay đổi nơi làm việc trong gói đồng bộ; id là UUID do app tạo. */
export const JobChange = z.object({
  id: Id,
  data: JobInput.extend({ updatedAt: z.iso.datetime() }),
  deletedAt: z.iso.datetime().nullable(),
});
export type JobChange = z.infer<typeof JobChange>;

/** Khoản 주휴수당 người dùng đã xác nhận cho một tuần (T2 đến CN) của một nơi làm. */
export const WeeklyHolidayPayInput = z.object({
  jobId: z.string().min(1).max(64),
  // isValidDate đứng trước vì zod vẫn chạy refine này khi DateString đã báo lỗi
  weekStart: DateString.refine((d) => isValidDate(d) && dayOfWeek(d) === 1, { message: 'weekStart phải là thứ Hai' }),
  amount: Won,
  updatedAt: z.iso.datetime(),
});
export type WeeklyHolidayPayInput = z.infer<typeof WeeklyHolidayPayInput>;

/** Một thay đổi 주휴수당 trong gói đồng bộ; id là UUID do app tạo. */
export const WeeklyHolidayPayChange = z.object({
  id: Id,
  data: WeeklyHolidayPayInput,
  deletedAt: z.iso.datetime().nullable(),
});
export type WeeklyHolidayPayChange = z.infer<typeof WeeklyHolidayPayChange>;

/**
 * Cài đặt của người dùng được giữ trên server để đổi máy không mất.
 * Chế độ màu, nơi làm đang chọn là lựa chọn riêng từng máy nên không đồng bộ.
 */
export const UserSettingsInput = z.object({
  /** Tỉ lệ khấu trừ để ước tính lương thực nhận, phần trăm, bước 0,1 (0 = không khấu trừ) */
  deductRate: z.number().min(0).max(100).multipleOf(0.1, 'Tỉ lệ khấu trừ chỉ có một chữ số thập phân'),
  /** Thời điểm sửa trên máy; bản sửa mới nhất thắng */
  updatedAt: z.iso.datetime(),
});
export type UserSettingsInput = z.infer<typeof UserSettingsInput>;

export const SyncRequest = z.object({
  /** serverTime nhận được ở lần đồng bộ trước; null ở lần đầu */
  since: z.iso.datetime().nullable(),
  /** Xử lý trước workDays để server kiểm tra được jobId */
  jobs: z.array(JobChange).max(SYNC_BATCH_MAX).default([]),
  workDays: z.array(WorkDayChange).max(SYNC_BATCH_MAX),
  /** Xử lý sau workDays */
  weeklyHolidayPays: z.array(WeeklyHolidayPayChange).max(SYNC_BATCH_MAX).default([]),
  /** Lần mở app đầu tiên trên máy; server giữ giá trị sớm nhất */
  firstOpenAt: z.iso.datetime().optional(),
  /** Cài đặt đã sửa trên máy từ lần đồng bộ trước; không gửi nếu không đổi */
  settings: UserSettingsInput.optional(),
});
export type SyncRequest = z.infer<typeof SyncRequest>;

export const RefreshRequest = z.object({ refreshToken: z.string().min(10) });

/** Đăng xuất: thu hồi phiên của refresh token này. */
export const LogoutRequest = RefreshRequest;

export const DevLoginRequest = z.object({ name: z.string().min(1).max(60) });

/** Đăng nhập Apple, Google: id token lấy từ SDK của nhà cung cấp. Apple chỉ trả tên ở lần đầu, nên app gửi kèm. */
export const SocialLoginRequest = z.object({
  idToken: z.string().min(20).max(10_000),
  name: z.string().trim().min(1).max(60).optional(),
});

/** Quy định một năm, admin gửi lên. */
export const RuleSetInput = z.object({
  minimumWage: z.number().int().min(1).max(1_000_000),
  holidays: z.array(z.object({ date: DateString, name: z.string().trim().min(1).max(60) })).max(100),
  weeklyHoliday: z
    .object({
      minHours: z.number().min(0).max(168),
      maxHours: z.number().positive().max(168),
      paidHours: z.number().positive().max(24),
    })
    .refine((w) => w.minHours <= w.maxHours, { message: 'minHours không được lớn hơn maxHours', path: ['minHours'] }),
});
export type RuleSetInput = z.infer<typeof RuleSetInput>;

export * from './ads.ts';
