import { Pressable, StyleSheet, Text, View } from 'react-native';

import { useApp } from '@/data/app-store';
import {
  DOW_LABELS,
  daysOfMonth,
  dayCellTotal,
  dominantHourKey,
  hasWork,
  isWeekend,
  todayKst,
  type MonthData,
} from '@/data/month';
import { useHourColors, useTheme } from '@/hooks/use-theme';
import { formatHours, formatK, formatWon } from '@/lib/format';
import { dayOfWeek, totalHours } from '@/payroll/index.ts';

const CELL = `${100 / 7}%` as const;

/** Lịch tháng bắt đầu từ CN; mỗi ô hiện số giờ (màu theo loại giờ nhiều nhất) và tiền ngày "103k". */
export function MonthCalendar({ data, holidays }: { data: MonthData; holidays: ReadonlyMap<string, string> }) {
  const theme = useTheme();
  const { openDay } = useApp();
  const days = daysOfMonth(data.month);
  const leading = dayOfWeek(days[0]!);
  const today = todayKst();

  return (
    <View style={styles.grid}>
      {DOW_LABELS.map((d, i) => (
        <View key={d} style={styles.cellWrap}>
          <View
            style={[
              styles.dow,
              i === 0
                ? { backgroundColor: theme.offBg, borderColor: 'transparent' }
                : { borderColor: theme.line },
            ]}>
            <Text style={[styles.dowText, { color: i === 0 ? theme.offText : theme.textSecondary }]}>{d}</Text>
          </View>
        </View>
      ))}
      {Array.from({ length: leading }, (_, i) => (
        <View key={`e${i}`} style={styles.cellWrap} />
      ))}
      {days.map((date) => (
        <View key={date} style={styles.cellWrap}>
          <DayCell
            date={date}
            data={data}
            holiday={holidays.get(date)}
            isToday={date === today}
            onPress={() => openDay(date)}
          />
        </View>
      ))}
    </View>
  );
}

function DayCell({
  date,
  data,
  holiday,
  isToday,
  onPress,
}: {
  date: string;
  data: MonthData;
  holiday: string | undefined;
  isToday: boolean;
  onPress: () => void;
}) {
  const theme = useTheme();
  const hourColors = useHourColors();
  const day = data.days.get(date);
  const weekly = data.weeklyBySunday.get(date);
  const total = dayCellTotal(data, date);
  const hasData = hasWork(day) || !!weekly;
  const off = isWeekend(date) || !!holiday;
  const hours = day ? totalHours(day.hours) : 0;
  const dom = day ? dominantHourKey(day) : null;
  const dayNum = Number(date.slice(8));

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`Ngày ${dayNum}${holiday ? `, ${holiday}` : ''}${hasData ? `, ${formatWon(total)}` : ''}`}
      style={({ pressed }) => [
        styles.day,
        off
          ? { backgroundColor: theme.offBg, borderColor: 'transparent' }
          : { backgroundColor: theme.surface, borderColor: theme.line },
        isToday && { borderColor: theme.primary, borderWidth: 2 },
        pressed && styles.pressed,
      ]}>
      <Text style={[styles.dayNum, { color: off ? theme.offText : theme.text }]}>{dayNum}</Text>
      {holiday && !hasData ? (
        <Text numberOfLines={1} style={[styles.holiday, { color: theme.offText }]}>
          {holiday}
        </Text>
      ) : null}
      {hasData ? (
        <>
          {hours > 0 && dom ? (
            <Text style={[styles.chip, { backgroundColor: hourColors[dom].bg, color: hourColors[dom].fg }]}>
              {formatHours(hours)}
            </Text>
          ) : (
            <Text style={[styles.chip, styles.chipSmall, { backgroundColor: theme.surface, color: theme.offText }]}>
              {weekly ? 'Nghỉ tuần' : 'Trợ cấp'}
            </Text>
          )}
          <Text numberOfLines={1} style={[styles.amount, { color: theme.money }]}>
            {formatK(total)}
          </Text>
        </>
      ) : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  grid: { flexDirection: 'row', flexWrap: 'wrap', marginHorizontal: -2.5 },
  cellWrap: { width: CELL, padding: 2.5 },
  dow: { borderWidth: 1, borderRadius: 10, paddingVertical: 6, alignItems: 'center' },
  dowText: { fontSize: 12.5, fontWeight: 700 },
  day: {
    minHeight: 74,
    borderWidth: 1,
    borderRadius: 12,
    paddingTop: 5,
    paddingHorizontal: 4,
    paddingBottom: 4,
    gap: 3,
  },
  pressed: { transform: [{ scale: 0.96 }] },
  dayNum: { fontSize: 13, fontWeight: 700, paddingLeft: 3 },
  holiday: { fontSize: 9.5, lineHeight: 11, paddingLeft: 3 },
  chip: {
    fontSize: 11.5,
    fontWeight: 700,
    textAlign: 'center',
    borderRadius: 999,
    overflow: 'hidden',
    paddingVertical: 1,
  },
  chipSmall: { fontSize: 9.5, fontWeight: 600 },
  amount: { fontSize: 12, fontWeight: 800, textAlign: 'center', letterSpacing: -0.2 },
});
