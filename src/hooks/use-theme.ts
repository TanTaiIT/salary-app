/**
 * Learn more about light and dark modes:
 * https://docs.expo.dev/guides/color-schemes/
 */

import { Colors, HourColors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';

export function useTheme() {
  return Colors[useColorScheme()];
}

/** Màu chữ/nền của từng loại giờ x1…x3 */
export function useHourColors() {
  return HourColors[useColorScheme()];
}
