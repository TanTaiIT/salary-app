import { StyleSheet, Text, View } from 'react-native';

import { Screen } from '@/components/screen';
import { SummaryStrip } from '@/components/summary-strip';
import { Card } from '@/components/ui';
import { HourLabel, HourName } from '@/constants/theme';
import { useMonth } from '@/hooks/use-month';
import { useHourColors, useTheme } from '@/hooks/use-theme';
import { formatHours, formatK, formatWon } from '@/lib/format';
import { HOUR_KEYS, averageDayPay, weeklyTotals } from '@/payroll/index.ts';

const BAR_MAX = 120;
const dayNum = (date: string) => Number(date.slice(8));

export default function StatsScreen() {
  const theme = useTheme();
  const hourColors = useHourColors();
  const { data } = useMonth();
  const { summary } = data;

  // Mọi con số tính bằng src/payroll (dùng chung với server)
  const weeks = weeklyTotals(
    data.month,
    [...data.days.values()].map((d) => ({ date: d.date, hours: d.hours, allowance: d.allowance, wage: d.wageSnapshot })),
    [...data.weeklyBySunday.values()].map((w) => ({ weekStart: w.weekStart, amount: w.amount })),
  );
  const max = Math.max(1, ...weeks.map((w) => w.total));

  return (
    <Screen>
      <SummaryStrip
        items={[
          { label: 'Tổng lương tháng', value: formatWon(summary.total) },
          { label: 'Ngày làm', value: String(summary.workDays) },
          { label: 'Trung bình/ngày', value: formatK(averageDayPay(summary)), accent: 'overtime' },
        ]}
      />

      <Card title="Lương theo tuần">
        <View style={styles.bars}>
          {weeks.map((w) => (
            <View
              key={w.from}
              style={styles.bar}
              accessible
              accessibilityLabel={`Ngày ${dayNum(w.from)} đến ${dayNum(w.to)}: ${formatWon(w.total)}`}>
              <Text style={[styles.barValue, { color: theme.text }]}>{formatK(w.total)}</Text>
              <View
                style={[
                  styles.barFill,
                  { backgroundColor: theme.primary, height: Math.max(4, Math.round((w.total / max) * BAR_MAX)) },
                ]}
              />
              <Text style={[styles.barLabel, { color: theme.textSecondary }]}>
                {dayNum(w.from)}–{dayNum(w.to)}
              </Text>
            </View>
          ))}
        </View>
      </Card>

      <Card title="Chi tiết theo loại giờ">
        <View style={styles.table}>
          {HOUR_KEYS.map((k) => (
            <BreakdownRow
              key={k}
              color={hourColors[k].fg}
              label={`${HourName[k]} x${HourLabel[k]}`}
              hours={formatHours(summary.hoursByType[k])}
              amount={formatWon(summary.payByType[k])}
            />
          ))}
          <BreakdownRow color={theme.money} label="Trợ cấp" amount={formatWon(summary.allowance)} />
          <BreakdownRow color={theme.offText} label="Nghỉ tuần (주휴)" amount={formatWon(summary.weeklyHolidayPay)} />
        </View>
      </Card>
    </Screen>
  );
}

function BreakdownRow({ color, label, hours, amount }: { color: string; label: string; hours?: string; amount: string }) {
  const theme = useTheme();
  return (
    <View style={styles.row}>
      <View style={[styles.dot, { backgroundColor: color }]} />
      <Text style={[styles.rowLabel, { color: theme.text }]}>{label}</Text>
      <Text style={[styles.rowHours, { color: theme.text }]}>{hours ?? ''}</Text>
      <Text style={[styles.rowAmount, { color: theme.text }]}>{amount}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  bars: { flexDirection: 'row', alignItems: 'flex-end', gap: 10, height: 170, paddingTop: 10 },
  bar: { flex: 1, alignItems: 'center', justifyContent: 'flex-end', gap: 4, height: '100%' },
  barFill: {
    width: '100%',
    borderTopLeftRadius: 8,
    borderTopRightRadius: 8,
    borderBottomLeftRadius: 4,
    borderBottomRightRadius: 4,
  },
  barValue: { fontSize: 11, fontWeight: 700 },
  barLabel: { fontSize: 11 },
  table: { gap: 8 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  dot: { width: 10, height: 10, borderRadius: 5 },
  rowLabel: { flex: 1, fontSize: 14 },
  rowHours: { fontSize: 14, fontWeight: 700, minWidth: 44, textAlign: 'right' },
  rowAmount: { fontSize: 14, fontWeight: 700, minWidth: 96, textAlign: 'right' },
});
