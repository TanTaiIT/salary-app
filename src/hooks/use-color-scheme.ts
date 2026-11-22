import { useColorScheme as useRNColorScheme } from 'react-native';

import { useThemePreference } from './theme-preference';

/** Chế độ màu đang dùng: theo Cài đặt, hoặc theo máy khi chọn "Theo máy". */
export function useColorScheme(): 'light' | 'dark' {
  const pref = useThemePreference();
  const system = useRNColorScheme();
  if (pref !== 'auto') return pref;
  return system === 'dark' ? 'dark' : 'light';
}
