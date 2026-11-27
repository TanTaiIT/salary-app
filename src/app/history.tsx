import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Screen } from '@/components/screen';
import { HourLabel } from '@/constants/theme';
import { useApp } from '@/data/app-store';
import { DOW_LABELS, dayCellTotal, hasWork } from '@/data/month';
import { useMonth } from '@/hooks/use-month';
import { useTheme } from '@/hooks/use-theme';
import { formatHours, formatK, formatWon } from '@/lib/format';
import { HOUR_KEYS, dayOfWeek, totalHours } from '@/payroll/index.ts';

export default function HistoryScreen() {
  const theme = useTheme();
  const { openDay } = useApp();
  const { data } = useMonth();

  // Ngày có ngày công, 주휴수당 hoặc ghi chú, mới nhất lên đầu.
  const dates = [...new Set([...data.days.keys(), ...data.weeklyBySunday.keys()])]
    .filter((d) => hasWork(data.days.get(d)) || data.weeklyBySunday.has(d) || !!data.days.get(d)?.note)
    .sort()
    .reverse();

  return (
    <Screen showAddButton>
      {dates.length === 0 ? (
        <Text style={[styles.empty, { color: theme.textSecondary }]}>
          Tháng này chưa có ngày công nào.{'\n'}Bấm “Thêm ngày công” để bắt đầu.
        </Text>
      ) : (
        <View>
          {dates.map((date) => {
            const day = data.days.get(date);
            const weekly = data.weeklyBySunday.get(date);
            const parts = day ? HOUR_KEYS.filter((k) => day.hours[k] > 0).map((k) => `${formatHours(day.hours[k])} x${HourLabel[k]}`) : [];
            if (day && day.allowance > 0) parts.push(`trợ cấp ${formatK(day.allowance)}`);
            if (weekly) parts.push(`nghỉ tuần ${formatK(weekly.amount)}`);
            const total = dayCellTotal(data, date);
            const noteOnly = !hasWork(day) && !weekly;
            return (
              <Pressable
                key={date}
                onPress={() => openDay(date)}
                accessibilityRole="button"
                style={({ pressed }) => [styles.item, { borderColor: theme.line }, pressed && styles.pressed]}>
                <View style={styles.date}>
                  <Text style={[styles.dateNum, { color: theme.text }]}>{Number(date.slice(8))}</Text>
                  <Text style={[styles.dow, { color: theme.textSecondary }]}>{DOW_LABELS[dayOfWeek(date)]}</Text>
                </View>
                <View style={styles.info}>
                  <Text style={[styles.infoTitle, { color: theme.text }]}>
                    {noteOnly ? 'Không có giờ làm' : `${formatHours(day ? totalHours(day.hours) : 0)} làm việc`}
                  </Text>
                  {parts.length > 0 ? (
                    <Text style={[styles.infoParts, { color: theme.textSecondary }]}>{parts.join(', ')}</Text>
                  ) : null}
                  {day?.note ? (
                    <Text numberOfLines={2} style={[styles.note, { color: theme.text }]}>
                      “{day.note}”
                    </Text>
                  ) : null}
                </View>
                {total > 0 ? <Text style={[styles.value, { color: theme.money }]}>{formatWon(total)}</Text> : null}
              </Pressable>
            );
          })}
        </View>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  empty: { textAlign: 'center', paddingVertical: 30, paddingHorizontal: 10, fontSize: 15, lineHeight: 22 },
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderBottomWidth: 1,
    paddingVertical: 12,
    paddingHorizontal: 2,
  },
  pressed: { opacity: 0.6 },
  date: { width: 46, alignItems: 'center' },
  dateNum: { fontSize: 19, fontWeight: 700, lineHeight: 22 },
  dow: { fontSize: 11.5 },
  info: { flex: 1 },
  infoTitle: { fontSize: 14, fontWeight: 600 },
  infoParts: { fontSize: 13 },
  note: { fontSize: 13, fontStyle: 'italic', marginTop: 2 },
  value: { fontWeight: 800, fontSize: 14 },
});
