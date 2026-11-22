import { SymbolView, type SFSymbol } from 'expo-symbols';
import type { ComponentProps } from 'react';
import type { StyleProp, ViewStyle } from 'react-native';

type AndroidSymbol = Exclude<Extract<ComponentProps<typeof SymbolView>['name'], object>['android'], undefined>;

/** Một icon, tên SF Symbol cho iOS và Material Symbol cho Android, web. */
const ICONS = {
  calendar: { ios: 'calendar', android: 'calendar_month' },
  calendarAdd: { ios: 'calendar.badge.plus', android: 'calendar_add_on' },
  settings: { ios: 'gearshape.fill', android: 'settings' },
  prev: { ios: 'chevron.left', android: 'chevron_left' },
  next: { ios: 'chevron.right', android: 'chevron_right' },
  bell: { ios: 'bell.fill', android: 'notifications' },
  close: { ios: 'xmark', android: 'close' },
  plus: { ios: 'plus', android: 'add' },
  minus: { ios: 'minus', android: 'remove' },
} satisfies Record<string, { ios: SFSymbol; android: AndroidSymbol }>;

export type IconName = keyof typeof ICONS;

export function Icon({
  name,
  size = 22,
  color,
  style,
}: {
  name: IconName;
  size?: number;
  color: string;
  style?: StyleProp<ViewStyle>;
}) {
  const { ios, android } = ICONS[name];
  return <SymbolView name={{ ios, android, web: android }} size={size} tintColor={color} style={style} />;
}
