// Cấu hình quảng cáo và hàm chọn cấp. Chỉ import zod, app React Native chép nguyên file này.
import { z } from 'zod';

export const AD_PLACEMENTS = [
  'stats_bottom',
  'history_bottom',
  'settings_bottom',
  'home_overview',
  'history_native',
  'rewarded_unlock',
  'stats_interstitial',
] as const;

export const AdPlacement = z.enum(AD_PLACEMENTS);
export type AdPlacement = z.infer<typeof AdPlacement>;

export const AdTierConfig = z.object({
  tier: z.number().int().min(1).max(10),
  /** Số ngày kể từ lần mở app đầu tiên */
  minDays: z.number().int().min(0),
  /** Số ngày khác nhau đã ghi ngày công */
  minActiveDays: z.number().int().min(0),
  placements: z.array(AdPlacement),
  /** false = tắt riêng cấp này */
  enabled: z.boolean().default(true),
});
export type AdTierConfig = z.infer<typeof AdTierConfig>;

export const AdConfig = z.object({
  /** false = tắt toàn bộ quảng cáo */
  enabled: z.boolean(),
  tiers: z.array(AdTierConfig).min(1),
  caps: z.object({
    interstitialPerDay: z.number().int().min(0),
    nativeEvery: z.number().int().min(1),
  }),
});
export type AdConfig = z.infer<typeof AdConfig>;

export const AppConfig = z.object({
  ads: AdConfig,
  minAppVersion: z.string().regex(/^\d+\.\d+\.\d+$/, 'Phiên bản phải có dạng 1.2.3'),
});
export type AppConfig = z.infer<typeof AppConfig>;

/** Cấu hình dùng khi server chưa có bản ghi appConfig. */
export const DEFAULT_AD_CONFIG: AdConfig = {
  enabled: true,
  tiers: [
    { tier: 1, minDays: 0, minActiveDays: 0, placements: ['stats_bottom', 'history_bottom', 'settings_bottom'], enabled: true },
    { tier: 2, minDays: 90, minActiveDays: 30, placements: ['home_overview', 'history_native', 'rewarded_unlock'], enabled: true },
    { tier: 3, minDays: 180, minActiveDays: 60, placements: ['stats_interstitial'], enabled: false },
  ],
  caps: { interstitialPerDay: 1, nativeEvery: 10 },
};

export interface AdStats {
  /** Số ngày từ lần mở app đầu tiên */
  daysSinceFirstOpen: number;
  /** Số ngày khác nhau đã ghi ngày công */
  activeDays: number;
}

export interface AdTierResult {
  /** 0 khi quảng cáo bị tắt hoặc chưa đạt cấp nào */
  tier: number;
  /** Các vị trí được bật, cộng dồn từ mọi cấp đang bật tới cấp hiện tại */
  placements: AdPlacement[];
}

/**
 * Cấp hiện tại là cấp đang bật cao nhất mà người dùng đạt cả hai ngưỡng (ngày sử dụng và ngày có chấm công).
 * Vị trí cộng dồn: cấp 2 có cả vị trí của cấp 1.
 */
export function adTier(stats: AdStats, config: AdConfig): AdTierResult {
  if (!config.enabled) return { tier: 0, placements: [] };

  const tiers = config.tiers.filter((t) => t.enabled).sort((a, b) => a.tier - b.tier);
  const reached = tiers.filter((t) => stats.daysSinceFirstOpen >= t.minDays && stats.activeDays >= t.minActiveDays);
  const current = reached.at(-1);
  if (!current) return { tier: 0, placements: [] };

  const placements = new Set<AdPlacement>();
  for (const t of tiers) {
    if (t.tier <= current.tier) for (const p of t.placements) placements.add(p);
  }
  return { tier: current.tier, placements: [...placements] };
}
