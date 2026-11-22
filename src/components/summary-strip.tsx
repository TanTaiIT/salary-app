import { StyleSheet, Text, View } from 'react-native';

import { useHourColors, useTheme } from '@/hooks/use-theme';

interface Item {
  label: string;
  value: string;
  /** 'overtime' tô màu cam như giờ tăng ca */
  accent?: 'overtime';
}

/** Dải tổng quan nhanh màu xanh nhạt: ô đầu rộng hơn, hai ô sau nhỏ hơn. */
export function SummaryStrip({ items }: { items: [Item, Item, Item] }) {
  const theme = useTheme();
  const hourColors = useHourColors();

  return (
    <View accessibilityRole="summary" style={[styles.strip, { backgroundColor: theme.primarySoft }]}>
      {items.map((item, i) => (
        <View
          key={item.label}
          style={[
            styles.col,
            i === 0 ? styles.wide : styles.narrow,
            i > 0 && [styles.divider, { borderColor: theme.line }],
          ]}>
          <Text style={[styles.label, { color: theme.textSecondary }]}>{item.label}</Text>
          <Text
            numberOfLines={1}
            adjustsFontSizeToFit
            style={[
              styles.value,
              i > 0 && styles.valueSmall,
              { color: item.accent === 'overtime' ? hourColors.x1_5.fg : theme.primary },
            ]}>
            {item.value}
          </Text>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  strip: { flexDirection: 'row', borderRadius: 18, paddingVertical: 14, paddingHorizontal: 4 },
  col: { paddingHorizontal: 12, justifyContent: 'space-between' },
  wide: { flex: 1.6 },
  narrow: { flex: 1 },
  divider: { borderLeftWidth: 1 },
  label: { fontSize: 12, fontWeight: 500 },
  value: { fontSize: 22, fontWeight: 800, letterSpacing: -0.4 },
  valueSmall: { fontSize: 20 },
});
