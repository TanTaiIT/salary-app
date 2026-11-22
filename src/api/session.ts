// Phiên đăng nhập: người dùng, refresh token (lưu bền), access token (chỉ trong bộ nhớ).
// Đăng nhập là không bắt buộc (docs/spec.md); chưa đăng nhập thì app vẫn dùng đầy đủ, chỉ không đồng bộ.
import { create } from 'zustand';

import { readSecret, writeSecret } from './token-storage';

export interface SessionUser {
  id: string;
  name: string;
}

interface Stored {
  user: SessionUser;
  refreshToken: string;
}

interface SessionState {
  status: 'loading' | 'signedOut' | 'signedIn';
  user: SessionUser | null;
}

export const useSession = create<SessionState>(() => ({ status: 'loading', user: null }));

let refreshToken: string | null = null;
let accessToken: string | null = null;
/** Mốc hết hạn của access token (ms), đã trừ 30 giây dự phòng */
let accessExpiresAt = 0;

export const getRefreshToken = () => refreshToken;

/** Access token còn hạn, hoặc null nếu cần refresh */
export const getAccessToken = () => (accessToken && Date.now() < accessExpiresAt ? accessToken : null);

export async function loadSession(): Promise<void> {
  try {
    const raw = await readSecret();
    const stored = raw ? (JSON.parse(raw) as Stored) : null;
    if (stored?.refreshToken && stored.user?.id) {
      refreshToken = stored.refreshToken;
      useSession.setState({ status: 'signedIn', user: stored.user });
      return;
    }
  } catch {
    // Dữ liệu hỏng: coi như chưa đăng nhập
  }
  useSession.setState({ status: 'signedOut', user: null });
}

/** Lưu cặp token mới. Refresh token xoay vòng: luôn lưu bản mới sau mỗi lần refresh. */
export async function setTokens(tokens: { accessToken: string; refreshToken: string; expiresIn: number }, user?: SessionUser) {
  accessToken = tokens.accessToken;
  accessExpiresAt = Date.now() + Math.max(0, tokens.expiresIn - 30) * 1000;
  refreshToken = tokens.refreshToken;
  const nextUser = user ?? useSession.getState().user;
  if (!nextUser) return;
  await writeSecret(JSON.stringify({ user: nextUser, refreshToken: tokens.refreshToken } satisfies Stored));
  useSession.setState({ status: 'signedIn', user: nextUser });
}

export async function clearSession(): Promise<void> {
  accessToken = null;
  accessExpiresAt = 0;
  refreshToken = null;
  await writeSecret(null);
  useSession.setState({ status: 'signedOut', user: null });
}
