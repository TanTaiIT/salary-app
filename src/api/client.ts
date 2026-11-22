// Client gọi API có kiểu, sinh từ OpenAPI của server (src/api/schema.d.ts, chạy `pnpm gen:api` khi server đổi API).
// - Gắn access token cho route cần đăng nhập.
// - Access token hết hạn hoặc bị 401: đổi refresh token lấy cặp mới (chỉ một lệnh refresh chạy tại một thời điểm),
//   rồi gọi lại một lần. Refresh bị từ chối thì đăng xuất trên máy, dữ liệu trên máy vẫn giữ.
import createClient, { type Middleware } from 'openapi-fetch';

import { API_URL } from '@/config/env';

import type { components, paths } from './schema';
import { clearSession, getAccessToken, getRefreshToken, setTokens } from './session';

export type Schemas = components['schemas'];

const TIMEOUT_MS = 15_000;

/** Lỗi API theo định dạng chung của server: { error: { code, message, details }, requestId } */
export class ApiError extends Error {
  readonly status: number;
  readonly code: string;
  readonly details: unknown;

  constructor(status: number, code: string, message: string, details?: unknown) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

export const isNetworkError = (err: unknown) => err instanceof ApiError && err.code === 'network';

function timeoutFetch(request: Request): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  return fetch(request, { signal: controller.signal })
    .catch((err: unknown) => {
      throw new ApiError(0, 'network', 'Không kết nối được máy chủ. Kiểm tra mạng rồi thử lại.', err);
    })
    .finally(() => clearTimeout(timer));
}

/** Route không cần đăng nhập: không gửi token */
const PUBLIC_PATHS = new Set(['/health', '/v1/config', '/v1/rules/{year}', '/v1/auth/dev-login', '/v1/auth/apple', '/v1/auth/google', '/v1/auth/refresh', '/v1/auth/logout']);

const authMiddleware: Middleware = {
  onRequest({ request, schemaPath }) {
    const token = getAccessToken();
    if (token && !PUBLIC_PATHS.has(schemaPath)) request.headers.set('authorization', `Bearer ${token}`);
    return request;
  },
};

export const api = createClient<paths>({ baseUrl: API_URL, fetch: timeoutFetch });
api.use(authMiddleware);

type ApiResult<T> = { data?: T; error?: unknown; response: Response };

/** Lấy data, hoặc ném ApiError với code và message tiếng Việt của server. */
export function unwrap<T>(res: ApiResult<T>): T {
  if (res.response.ok) return res.data as T;
  const body = res.error as Partial<Schemas['ErrorResponse']> | undefined;
  throw new ApiError(
    res.response.status,
    body?.error?.code ?? `http_${res.response.status}`,
    body?.error?.message ?? `Máy chủ trả lỗi ${res.response.status}`,
    body?.error?.details,
  );
}

// ---------- Refresh token ----------

let refreshing: Promise<void> | null = null;

async function doRefresh(): Promise<void> {
  const refreshToken = getRefreshToken();
  if (!refreshToken) throw new ApiError(401, 'signed_out', 'Chưa đăng nhập');
  const res = await api.POST('/v1/auth/refresh', { body: { refreshToken } });
  if (res.response.status === 401) {
    // Phiên đã bị thu hồi hoặc hết hạn 30 ngày
    await clearSession();
    throw new ApiError(401, 'session_expired', 'Phiên đăng nhập đã hết hạn, hãy đăng nhập lại');
  }
  await setTokens(unwrap(res));
}

/** Đổi refresh token lấy cặp mới; các lệnh gọi cùng lúc dùng chung một lần refresh. */
export function refreshNow(): Promise<void> {
  refreshing ??= doRefresh().finally(() => {
    refreshing = null;
  });
  return refreshing;
}

/**
 * Gọi route cần đăng nhập: refresh trước nếu access token hết hạn, và gọi lại một lần nếu server trả 401.
 * `call` phải tạo request mới mỗi lần gọi.
 */
export async function authed<T>(call: () => Promise<ApiResult<T>>): Promise<T> {
  if (!getAccessToken()) await refreshNow();
  let res = await call();
  if (res.response.status === 401) {
    await refreshNow();
    res = await call();
  }
  return unwrap(res);
}
