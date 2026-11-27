// Trang quản trị: đọc, sửa quy định từng năm và xem nhật ký thay đổi (route /v1/admin/*).
// Quyền admin do server kiểm tra ở mỗi lệnh gọi; app chỉ dùng `role` để quyết định có hiện trang hay không.
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import type { RuleSetInput } from '@/schemas/index.ts';

import { api, authed } from './client';
import { queryKeys, useMeQuery } from './queries';

export const adminKeys = {
  rules: ['admin', 'rules'] as const,
  audit: (target: string) => ['admin', 'audit', target] as const,
};

/** true khi tài khoản đang đăng nhập có quyền admin (theo GET /v1/me). */
export function useIsAdmin(): boolean {
  return useMeQuery().data?.role === 'admin';
}

/** Mọi năm đã có quy định, năm mới nhất trước. */
export function useAdminRulesQuery() {
  return useQuery({
    queryKey: adminKeys.rules,
    // Admin cần thấy bản mới nhất, không dùng lưu đệm 5 phút mặc định
    staleTime: 0,
    queryFn: async () => (await authed(() => api.GET('/v1/admin/rules'))).items,
  });
}

/** Nhật ký thay đổi quy định của một năm, mới nhất trước. */
export function useAuditLogsQuery(year: number) {
  const target = `ruleSets/${year}`;
  return useQuery({
    queryKey: adminKeys.audit(target),
    staleTime: 0,
    queryFn: async () =>
      (await authed(() => api.GET('/v1/admin/audit-logs', { params: { query: { target, limit: 100 } } }))).items,
  });
}

/** Tạo hoặc thay quy định một năm. Xong thì tải lại danh sách, nhật ký, và quy định mà màn chấm công đang dùng. */
export function useSaveRulesMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ year, input }: { year: number; input: RuleSetInput }) =>
      authed(() => api.PUT('/v1/admin/rules/{year}', { params: { path: { year: String(year) } }, body: input })),
    onSuccess: (_data, { year }) => {
      void queryClient.invalidateQueries({ queryKey: adminKeys.rules });
      void queryClient.invalidateQueries({ queryKey: adminKeys.audit(`ruleSets/${year}`) });
      void queryClient.invalidateQueries({ queryKey: queryKeys.rules(String(year)) });
    },
  });
}
