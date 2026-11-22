import { useSyncExternalStore } from 'react';
import { useColorScheme as useRNColorScheme } from 'react-native';

import { useThemePreference } from './theme-preference';

const subscribe = () => () => {};

/**
 * To support static rendering, this value needs to be re-calculated on the client side for web.
 * Khi render tĩnh (server) trả 'light'; trên trình duyệt trả theo Cài đặt hoặc theo hệ thống.
 */
export function useColorScheme(): 'light' | 'dark' {
  const hasHydrated = useSyncExternalStore(
    subscribe,
    () => true,
    () => false,
  );
  const pref = useThemePreference();
  const system = useRNColorScheme();

  if (!hasHydrated) return 'light';
  if (pref !== 'auto') return pref;
  return system === 'dark' ? 'dark' : 'light';
}
