// Đăng nhập, đăng xuất, xóa tài khoản. Dữ liệu trên máy luôn được giữ: đăng nhập lần đầu thì đẩy hết lên server
// (docs/spec.md, "Người dùng chưa đăng nhập"), đăng xuất hay xóa tài khoản không xóa dữ liệu trên máy.
import { api, authed, unwrap, type Schemas } from '@/api/client';
import { clearSession, getRefreshToken, setTokens } from '@/api/session';
import { markAllDirty } from '@/data/actions';
import { writeSyncMeta } from '@/data/store';
import { DEFAULT_SYNC_META } from '@/data/types';

import { syncNow } from './engine';

async function afterSignIn(res: Schemas['AuthResponse']): Promise<void> {
  await setTokens(res, res.user);
  // Tài khoản có thể khác lần trước: kéo lại từ đầu và gửi toàn bộ dữ liệu trên máy (gộp theo id, bản mới nhất thắng)
  writeSyncMeta({ ...DEFAULT_SYNC_META });
  markAllDirty();
  await syncNow({ pickJob: true });
}

/** Đăng nhập bằng tên, chỉ có ở server ngoài production (bản dev). */
export async function signInDev(name: string): Promise<void> {
  await afterSignIn(unwrap(await api.POST('/v1/auth/dev-login', { body: { name: name.trim() } })));
}

/** Đăng nhập bằng id token Apple hoặc Google lấy từ SDK của nhà cung cấp (cần development build). */
export async function signInWithIdToken(provider: 'apple' | 'google', idToken: string, name?: string): Promise<void> {
  const path = provider === 'apple' ? '/v1/auth/apple' : '/v1/auth/google';
  await afterSignIn(unwrap(await api.POST(path, { body: { idToken, ...(name ? { name } : {}) } })));
}

export async function signOut(): Promise<void> {
  const refreshToken = getRefreshToken();
  // Đồng bộ nốt những gì chưa gửi; lỗi mạng thì vẫn đăng xuất
  await syncNow().catch(() => {});
  if (refreshToken) await api.POST('/v1/auth/logout', { body: { refreshToken } }).catch(() => {});
  await clearSession();
  writeSyncMeta({ ...DEFAULT_SYNC_META });
}

/** Xóa tài khoản và toàn bộ dữ liệu trên server. Dữ liệu trên máy vẫn giữ. */
export async function deleteAccount(): Promise<void> {
  await authed(() => api.DELETE('/v1/me'));
  await clearSession();
  writeSyncMeta({ ...DEFAULT_SYNC_META });
}
