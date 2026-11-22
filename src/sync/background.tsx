// Việc chạy nền gắn với vòng đời app: nạp phiên đăng nhập, tải quy định năm đang xem,
// và đồng bộ khi mở app, khi quay lại app, và vài giây sau khi người dùng sửa dữ liệu.
import { focusManager } from '@tanstack/react-query';
import { useEffect } from 'react';
import { AppState, Platform } from 'react-native';

import { useRulesQuery } from '@/api/queries';
import { loadSession, useSession } from '@/api/session';
import { onLocalChange, useDataStore } from '@/data/store';
import { monthOf, todayKst } from '@/data/month';
import { useUiStore } from '@/data/ui-store';

import { syncNow } from './engine';

const DEBOUNCE_MS = 2_000;
const FOREGROUND_MIN_GAP_MS = 30_000;

const quietSync = () => syncNow().catch(() => {});

export function BackgroundTasks() {
  const viewYear = useUiStore((s) => s.month.slice(0, 4));
  const thisYear = monthOf(todayKst()).slice(0, 4);
  // Năm đang xem và năm nay (lương tối thiểu cho nơi làm mới)
  useRulesQuery(viewYear);
  useRulesQuery(thisYear);

  const ready = useDataStore((s) => s.ready);
  const status = useSession((s) => s.status);

  useEffect(() => {
    loadSession();
  }, []);

  // Mở app (dữ liệu trên máy đã nạp và đã đăng nhập): đồng bộ một lần
  useEffect(() => {
    if (ready && status === 'signedIn') quietSync();
  }, [ready, status]);

  // Sau khi sửa dữ liệu: gom các thay đổi liên tiếp rồi đồng bộ
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | null = null;
    const off = onLocalChange(() => {
      if (timer) clearTimeout(timer);
      timer = setTimeout(quietSync, DEBOUNCE_MS);
    });
    return () => {
      off();
      if (timer) clearTimeout(timer);
    };
  }, []);

  // Quay lại app: báo cho TanStack Query (tải lại dữ liệu cũ) và đồng bộ, tối đa mỗi 30 giây
  useEffect(() => {
    if (Platform.OS === 'web') return;
    let last = 0;
    const sub = AppState.addEventListener('change', (state) => {
      const active = state === 'active';
      focusManager.setFocused(active);
      if (active && Date.now() - last > FOREGROUND_MIN_GAP_MS) {
        last = Date.now();
        quietSync();
      }
    });
    return () => sub.remove();
  }, []);

  return null;
}
