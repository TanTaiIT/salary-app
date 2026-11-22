import { useSyncExternalStore } from 'react';
import { Appearance, Platform } from 'react-native';

import type { ThemePreference } from '@/data/types';

// Lựa chọn chế độ màu trong Cài đặt. Giữ ở module để hook useColorScheme đọc được
// mà không cần bọc thêm Provider.
let current: ThemePreference = 'auto';
const listeners = new Set<() => void>();

export function setThemePreference(pref: ThemePreference): void {
  if (pref === current) return;
  current = pref;
  // Trên iOS, Android, ghi đè luôn chế độ màu của app để thanh tab gốc và bàn phím đổi theo.
  if (Platform.OS !== 'web') Appearance.setColorScheme(pref);
  listeners.forEach((l) => l());
}

export function useThemePreference(): ThemePreference {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => current,
    () => current,
  );
}
