import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Icon } from '@/components/icon';
import { MonthCalendar } from '@/components/month-calendar';
import { Screen } from '@/components/screen';
import { SummaryStrip } from '@/components/summary-strip';
import { Card } from '@/components/ui';
import { HourLabel } from '@/constants/theme';
import { useApp } from '@/data/app-store';
import { deduction } from '@/data/deduction';
import { useMonth } from '@/hooks/use-month';
import { useHourColors, useTheme } from '@/hooks/use-theme';
import { formatDayMonth, formatHours, formatWon } from '@/lib/format';
import { HOUR_KEYS } from '@/payroll/index.ts';

export default function HomeScreen() {
  const theme = useTheme();
  const { ready, settings, setWeeklyPay, toast } = useApp();
  const { data, holidays, suggestion } = useMonth();
  const { summary } = data;
  const ded = deduction(summary.total, settings.deductRate);

  return (
    <Screen showAddButton>
      <SummaryStrip
        items={[
          { label: 'Tổng lương tháng (dự kiến)', value: formatWon(summary.total) },
          { label: 'Giờ cơ bản', value: formatHours(summary.baseHours) },
          { label: 'Giờ tăng ca', value: formatHours(summary.overtimeHours), accent: 'overtime' },
        ]}
      />

      {ready ? <MonthCalendar data={data} holidays={holidays} /> : null}

      {suggestion ? (
        <Pressable
          accessibilityRole="button"
          onPress={() => {
            setWeeklyPay(suggestion.weekStart, suggestion.amount);
            toast('Đã thêm lương ngày nghỉ tuần');
          }}
          style={({ pressed }) => [styles.banner, { backgroundColor: theme.warnBg }, pressed && styles.pressed]}>
          <Icon name="bell" size={28} color={theme.warnText} />
          <View style={styles.bannerText}>
            <Text style={[styles.bannerTitle, { color: theme.warnText }]}>
              Tuần {formatDayMonth(suggestion.weekStart)}–{formatDayMonth(suggestion.sunday)} bạn đã làm{' '}
              {formatHours(suggestion.baseHours)} cơ bản ({suggestion.workDays} ngày).
            </Text>
            <Text style={[styles.bannerBody, { color: theme.warnText }]}>
              Theo luật Hàn Quốc (주휴수당), bạn có thể được hưởng lương ngày nghỉ tuần khoảng{' '}
              {formatWon(suggestion.amount)}. Bấm để thêm vào CN {formatDayMonth(suggestion.sunday)}.
            </Text>
          </View>
          <Icon name="next" size={20} color={theme.warnText} />
        </Pressable>
      ) : null}

      <Legend />

      <Card title="Tổng quan tháng">
        <View style={styles.overview}>
          <View style={styles.overviewCol}>
            <Text style={[styles.small, { color: theme.textSecondary }]}>Tổng tiền trợ cấp</Text>
            <Text style={[styles.big, { color: theme.money }]}>
              {formatWon(summary.allowance + summary.weeklyHolidayPay)}
            </Text>
          </View>
          <View style={[styles.overviewCol, styles.divider, { borderColor: theme.line }]}>
            <Text style={[styles.small, { color: theme.textSecondary }]}>Tổng lương tháng</Text>
            <Text style={[styles.big, { color: theme.primary }]}>{formatWon(summary.total)}</Text>
          </View>
        </View>
        {ded ? (
          <Text style={[styles.net, { color: theme.textSecondary }]}>
            {ded.label}: −{formatWon(ded.amount)} · Thực nhận:{' '}
            <Text style={{ color: theme.text, fontWeight: 700 }}>{formatWon(summary.total - ded.amount)}</Text>
          </Text>
        ) : null}
      </Card>
    </Screen>
  );
}

function Legend() {
  const theme = useTheme();
  const colors = useHourColors();
  const items = [
    ...HOUR_KEYS.map((k) => ({ color: colors[k].fg, label: k === 'x1' ? 'Giờ cơ bản' : `Tăng ca ${HourLabel[k]}` })),
    { color: theme.offText, label: 'Cuối tuần / Ngày lễ', faded: true },
  ];
  return (
    <View style={[styles.legend, { backgroundColor: theme.backgroundElement }]}>
      {items.map((i) => (
        <View key={i.label} style={styles.legendItem}>
          <View style={[styles.dot, { backgroundColor: i.color, opacity: 'faded' in i ? 0.35 : 1 }]} />
          <Text style={[styles.legendText, { color: theme.textSecondary }]}>{i.label}</Text>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderRadius: 16,
    paddingVertical: 12,
    paddingHorizontal: 14,
  },
  bannerText: { flex: 1, gap: 2 },
  bannerTitle: { fontSize: 14, fontWeight: 700 },
  bannerBody: { fontSize: 13 },
  pressed: { opacity: 0.8 },
  legend: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    columnGap: 14,
    rowGap: 6,
    borderRadius: 14,
    paddingVertical: 10,
    paddingHorizontal: 14,
  },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  dot: { width: 10, height: 10, borderRadius: 5 },
  legendText: { fontSize: 12.5 },
  overview: { flexDirection: 'row' },
  overviewCol: { flex: 1 },
  divider: { borderLeftWidth: 1, paddingLeft: 14 },
  small: { fontSize: 12.5 },
  big: { fontSize: 20, fontWeight: 800, letterSpacing: -0.3 },
  net: { marginTop: 10, fontSize: 13 },
});
