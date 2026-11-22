/**
 * Màu sáng/tối của app, lấy theo prototype "Lịch Lương Hàn Quốc".
 * Giữ các khóa cũ (text, background, backgroundElement…) vì component dùng chung đang đọc chúng.
 */

import '@/global.css';

import { Platform } from 'react-native';

import type { HourKey } from '@/payroll/index.ts';

export const Colors = {
  light: {
    text: '#121826',
    textSecondary: '#5B6475',
    /** Nền ngoài cùng */
    background: '#F3F5FA',
    /** Nền thẻ, bảng trượt */
    surface: '#FFFFFF',
    backgroundElement: '#F6F8FC',
    backgroundSelected: '#E3E7EF',
    line: '#E3E7EF',
    /** Màu header xanh và tab đang chọn */
    primary: '#2457D6',
    primarySoft: '#E6EEFF',
    onPrimary: '#FFFFFF',
    money: '#11823B',
    /** Cuối tuần, ngày lễ */
    offBg: '#FDE8EA',
    offText: '#C8283C',
    warnBg: '#FFF2D6',
    warnText: '#9A5A00',
    scrim: 'rgba(10,15,30,0.45)',
  },
  dark: {
    text: '#ECEFF6',
    textSecondary: '#9AA3B8',
    background: '#0E1220',
    surface: '#171C2C',
    backgroundElement: '#1E2436',
    backgroundSelected: '#2A3147',
    line: '#2A3147',
    primary: '#5B8CFF',
    primarySoft: '#1C2A4D',
    onPrimary: '#FFFFFF',
    money: '#4CD07D',
    offBg: '#3A1C25',
    offText: '#FF7D8E',
    warnBg: '#3A2D12',
    warnText: '#FFC766',
    scrim: 'rgba(0,0,0,0.6)',
  },
} as const;

export type ThemeColor = keyof typeof Colors.light & keyof typeof Colors.dark;

/** Màu từng loại giờ: chữ (fg) và nền (bg). */
export const HourColors: Record<'light' | 'dark', Record<HourKey, { fg: string; bg: string }>> = {
  light: {
    x1: { fg: '#2457D6', bg: '#DCE7FF' },
    x1_5: { fg: '#D9730D', bg: '#FFE9CF' },
    x2: { fg: '#7B3FD1', bg: '#EEE0FF' },
    x2_5: { fg: '#14874A', bg: '#D9F3E2' },
    x3: { fg: '#CF2B2B', bg: '#FFDDDD' },
  },
  dark: {
    x1: { fg: '#8DB0FF', bg: '#1E2F5C' },
    x1_5: { fg: '#FFB25C', bg: '#43301A' },
    x2: { fg: '#C49BFF', bg: '#33244F' },
    x2_5: { fg: '#5FD892', bg: '#173A28' },
    x3: { fg: '#FF8080', bg: '#4A1F23' },
  },
};

/** Nhãn hiển thị của hệ số: x1 → "1", x1_5 → "1.5" */
export const HourLabel: Record<HourKey, string> = {
  x1: '1',
  x1_5: '1.5',
  x2: '2',
  x2_5: '2.5',
  x3: '3',
};

export const HourName: Record<HourKey, string> = {
  x1: 'Giờ cơ bản',
  x1_5: 'Tăng ca',
  x2: 'Tăng ca',
  x2_5: 'Tăng ca',
  x3: 'Tăng ca',
};

export const Fonts = Platform.select({
  ios: {
    /** iOS `UIFontDescriptorSystemDesignDefault` */
    sans: 'system-ui',
    /** iOS `UIFontDescriptorSystemDesignSerif` */
    serif: 'ui-serif',
    /** iOS `UIFontDescriptorSystemDesignRounded` */
    rounded: 'ui-rounded',
    /** iOS `UIFontDescriptorSystemDesignMonospaced` */
    mono: 'ui-monospace',
  },
  default: {
    sans: 'normal',
    serif: 'serif',
    rounded: 'normal',
    mono: 'monospace',
  },
  web: {
    sans: 'var(--font-display)',
    serif: 'var(--font-serif)',
    rounded: 'var(--font-rounded)',
    mono: 'var(--font-mono)',
  },
});

export const Spacing = {
  half: 2,
  one: 4,
  two: 8,
  three: 16,
  four: 24,
  five: 32,
  six: 64,
} as const;

/** Chiều cao thanh tab (nội dung nằm dưới thanh tab nên phải chừa chỗ). */
export const BottomTabInset = Platform.select({ ios: 50, android: 80, web: 76 }) ?? 0;
export const MaxContentWidth = 520;
