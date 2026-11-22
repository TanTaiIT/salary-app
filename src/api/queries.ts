// Dữ liệu đọc từ server qua TanStack Query: quy định năm, cấu hình app, tài khoản.
// Dữ liệu chấm công KHÔNG đi qua đây: nó nằm trên máy (SQLite) và đồng bộ bằng src/sync.
import { QueryClient, useQuery } from '@tanstack/react-query';
import { useEffect } from 'react';

import { writeRules } from '@/data/store';

import { api, ApiError, authed, isNetworkError, unwrap } from './client';
import { useSession } from './session';

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // Lỗi 4xx (dữ liệu sai, không tìm thấy, hết phiên) không thử lại; lỗi mạng, 5xx, 429 (gọi quá nhiều) thử lại 3 lần
      retry: (count, err) =>
        count < 3 &&
        (!(err instanceof ApiError) || isNetworkError(err) || err.status >= 500 || err.status === 429),
      // Chờ 2, 4, 8 giây: đủ để hết giới hạn đăng nhập ngắn hạn của server
      retryDelay: (count) => Math.min(2_000 * 2 ** count, 30_000),
      staleTime: 5 * 60_000,
    },
  },
});

export const queryKeys = {
  rules: (year: string) => ['rules', year] as const,
  config: ['config'] as const,
  me: ['me'] as const,
};

/**
 * Quy định của năm (lương tối thiểu, ngày lễ, điều kiện 주휴수당). Tải xong thì lưu đệm trên máy,
 * nên khi không có mạng app vẫn dùng bản đã lưu (src/data/rules.ts).
 * Server chưa có quy định năm đó (404) thì trả null, app dùng bản dự phòng.
 */
export function useRulesQuery(year: string) {
  const query = useQuery({
    queryKey: queryKeys.rules(year),
    staleTime: 12 * 60 * 60_000,
    queryFn: async () => {
      const res = await api.GET('/v1/rules/{year}', { params: { path: { year } } });
      if (res.response.status === 404) return null;
      const r = unwrap(res);
      return { minimumWage: r.minimumWage, holidays: r.holidays, weeklyHoliday: r.weeklyHoliday };
    },
  });
  useEffect(() => {
    if (query.data) writeRules(year, query.data);
  }, [query.data, year]);
  return query;
}

/** Cấu hình app (quảng cáo, phiên bản tối thiểu), lưu đệm 12 giờ theo docs/spec.md */
export function useAppConfigQuery() {
  return useQuery({
    queryKey: queryKeys.config,
    staleTime: 12 * 60 * 60_000,
    queryFn: async () => unwrap(await api.GET('/v1/config')),
  });
}

/** Tài khoản đang đăng nhập (tên, cách đăng nhập, lần mở app đầu tiên) */
export function useMeQuery() {
  const signedIn = useSession((s) => s.status === 'signedIn');
  return useQuery({
    queryKey: queryKeys.me,
    enabled: signedIn,
    queryFn: () => authed(() => api.GET('/v1/me')),
  });
}

/** So sánh phiên bản "1.2.3": true nếu `current` cũ hơn `min` */
export function isOlderVersion(current: string, min: string): boolean {
  const a = current.split('.').map(Number);
  const b = min.split('.').map(Number);
  for (let i = 0; i < 3; i++) {
    const x = a[i] ?? 0;
    const y = b[i] ?? 0;
    if (x !== y) return x < y;
  }
  return false;
}
