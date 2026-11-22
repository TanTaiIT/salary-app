import { useState } from 'react';
import {
  KeyboardAvoidingView,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import Animated, { SlideInDown } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Icon } from '@/components/icon';
import { Field } from '@/components/ui';
import { HourLabel, HourName, MaxContentWidth } from '@/constants/theme';
import { useApp } from '@/data/app-store';
import { DOW_LABELS, isWeekend } from '@/data/month';
import { useHourColors, useTheme } from '@/hooks/use-theme';
import { confirmAsync } from '@/lib/confirm';
import { formatDayMonth, formatDecimal, formatNumber, formatWon, parseWon } from '@/lib/format';
import {
  HOUR_KEYS,
  dayOfWeek,
  dayPay,
  emptyHours,
  totalHours,
  weekStart,
  type HourKey,
  type Hours,
} from '@/payroll/index.ts';

const MAX_DAY_HOURS = 24;

/** Bảng chấm công trượt từ dưới lên, mở cho ngày `editingDate` trong store. */
export function DaySheet() {
  const { editingDate, closeDay } = useApp();
  const theme = useTheme();

  return (
    <Modal visible={!!editingDate} transparent animationType="fade" onRequestClose={closeDay} statusBarTranslucent>
      {/* Android chạy edge-to-edge: cửa sổ không tự co khi bàn phím mở, nên cả hai nền tảng đều đẩy bằng padding */}
      <KeyboardAvoidingView behavior="padding" style={styles.fill}>
        <Pressable
          style={[StyleSheet.absoluteFill, { backgroundColor: theme.scrim }]}
          onPress={closeDay}
          accessibilityLabel="Đóng bảng chấm công"
        />
        {editingDate ? <SheetBody key={editingDate} date={editingDate} /> : null}
      </KeyboardAvoidingView>
    </Modal>
  );
}

function SheetBody({ date }: { date: string }) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const { job, workDays, weeklyPays, rules, saveDay, deleteDay, setWeeklyPay, closeDay, toast } = useApp();

  const existing = workDays.find((d) => d.date === date);
  const wage = existing?.wageSnapshot ?? job?.hourlyWage ?? 0;
  const isSunday = dayOfWeek(date) === 0;
  const weekly = isSunday ? weeklyPays.find((w) => w.weekStart === weekStart(date) && w.amount > 0) : undefined;
  const holiday = rules(date.slice(0, 4)).holidays.find((h) => h.date === date)?.name;

  // Bản nháp: số giờ giữ dạng chữ để gõ được "7," trước khi gõ tiếp.
  const [texts, setTexts] = useState<Record<HourKey, string>>(() => {
    const h = existing?.hours ?? emptyHours();
    return Object.fromEntries(HOUR_KEYS.map((k) => [k, h[k] ? formatDecimal(h[k]) : ''])) as Record<HourKey, string>;
  });
  const [allowance, setAllowance] = useState(existing?.allowance ?? 0);
  const [removeWeekly, setRemoveWeekly] = useState(false);

  const hours: Hours = emptyHours();
  for (const k of HOUR_KEYS) hours[k] = parseHours(texts[k]);
  const weeklyAmount = weekly && !removeWeekly ? weekly.amount : 0;
  const total = dayPay({ date, hours, allowance, wage }).total + weeklyAmount;

  const setHour = (k: HourKey, v: number) => {
    const clamped = Math.max(0, Math.min(MAX_DAY_HOURS, Math.round(v * 2) / 2));
    setTexts((t) => ({ ...t, [k]: clamped ? formatDecimal(clamped) : '' }));
  };

  const onSave = () => {
    if (totalHours(hours) > MAX_DAY_HOURS) {
      toast('Tổng số giờ trong ngày không quá 24');
      return;
    }
    const rounded = emptyHours();
    for (const k of HOUR_KEYS) rounded[k] = Math.round(hours[k] * 2) / 2;
    const result = saveDay(date, { hours: rounded, allowance });
    if (!result.ok) {
      toast(result.message);
      return;
    }
    if (weekly && removeWeekly) setWeeklyPay(weekly.weekStart, 0);
    closeDay();
    toast('Đã lưu ngày công');
  };

  const onDelete = async () => {
    if (!(await confirmAsync('Xóa ngày công?', `Xóa ngày công ${formatDayMonth(date)}.`))) return;
    deleteDay(date);
    closeDay();
    toast('Đã xóa ngày công');
  };

  return (
    <Animated.View
      entering={SlideInDown.duration(260)}
      accessibilityViewIsModal
      style={[styles.sheet, { backgroundColor: theme.surface, paddingBottom: insets.bottom + 8 }]}>
      <ScrollView
        keyboardShouldPersistTaps="handled"
        style={styles.scroll}
        contentContainerStyle={styles.sheetContent}>
        <View style={[styles.grab, { backgroundColor: theme.line }]} />
        <View style={styles.head}>
          <Text style={[styles.title, { color: theme.text }]} accessibilityRole="header">
            Chấm công {DOW_LABELS[dayOfWeek(date)]}, {formatDayMonth(date)}
          </Text>
          {holiday || isWeekend(date) ? (
            <Text style={[styles.tag, { backgroundColor: theme.offBg, color: theme.offText }]}>
              {holiday ?? 'Cuối tuần'}
            </Text>
          ) : null}
          <Pressable
            onPress={closeDay}
            accessibilityRole="button"
            accessibilityLabel="Đóng"
            style={[styles.close, { backgroundColor: theme.backgroundElement }]}>
            <Icon name="close" size={18} color={theme.text} />
          </Pressable>
        </View>

        <View style={[styles.wage, { backgroundColor: theme.backgroundElement }]}>
          <Text style={[styles.small, { color: theme.textSecondary }]}>Mức lương giờ</Text>
          <Text style={[styles.wageValue, { color: theme.text }]}>{formatWon(wage)} / giờ</Text>
          <Text style={[styles.small, { color: theme.textSecondary }]}>
            {existing ? 'Lương giờ lúc ghi ngày công này' : 'Đã lưu mặc định, đổi trong Cài đặt'}
          </Text>
        </View>

        <Text style={[styles.section, { color: theme.text }]}>Các loại giờ làm</Text>
        {HOUR_KEYS.map((k) => (
          <HourRow
            key={k}
            k={k}
            text={texts[k]}
            amount={dayPay({ date, hours: { ...emptyHours(), [k]: hours[k] }, allowance: 0, wage }).work}
            onText={(t) => setTexts((prev) => ({ ...prev, [k]: t.replace(/[^\d.,]/g, '') }))}
            onBlur={() => setHour(k, hours[k])}
            onStep={(delta) => setHour(k, hours[k] + delta)}
          />
        ))}

        <Text style={[styles.section, { color: theme.text }]}>Tiền trợ cấp hôm nay</Text>
        <Field
          label="Tiền trợ cấp"
          keyboardType="number-pad"
          placeholder="0 ₩"
          value={allowance ? formatNumber(allowance) : ''}
          onChangeText={(t) => setAllowance(Math.min(parseWon(t), 100_000_000))}
        />

        {weekly && !removeWeekly ? (
          <View style={[styles.weekly, { backgroundColor: theme.offBg }]}>
            <Text style={[styles.weeklyText, { color: theme.offText }]}>
              Lương ngày nghỉ tuần (주휴): <Text style={styles.bold}>{formatWon(weekly.amount)}</Text>
            </Text>
            <Pressable onPress={() => setRemoveWeekly(true)} accessibilityRole="button" hitSlop={8}>
              <Text style={[styles.weeklyRemove, { color: theme.offText }]}>Bỏ</Text>
            </Pressable>
          </View>
        ) : null}

        <View style={[styles.total, { backgroundColor: theme.backgroundElement }]}>
          <Text style={[styles.small, { color: theme.textSecondary }]}>Tổng lương hôm nay</Text>
          <Text style={[styles.totalValue, { color: theme.money }]}>{formatWon(total)}</Text>
          <Text style={[styles.small, { color: theme.textSecondary }]}>
            Giờ làm + trợ cấp{weeklyAmount > 0 ? ' + nghỉ tuần' : ''}
          </Text>
        </View>
      </ScrollView>

      {/* Chân cố định: nút Lưu luôn thấy được, không phải cuộn (bảng dài hơn màn hình trên máy nhỏ) */}
      <View style={[styles.footer, { borderTopColor: theme.line }]}>
        <Pressable
          onPress={onSave}
          accessibilityRole="button"
          style={({ pressed }) => [styles.btn, { backgroundColor: theme.text }, pressed && styles.pressed]}>
          <Text style={[styles.btnText, { color: theme.surface }]}>Lưu ngày công</Text>
        </Pressable>
        {existing ? (
          <Pressable onPress={onDelete} accessibilityRole="button" style={styles.ghost}>
            <Text style={[styles.ghostText, { color: theme.offText }]}>Xóa ngày công này</Text>
          </Pressable>
        ) : null}
      </View>
    </Animated.View>
  );
}

function HourRow({
  k,
  text,
  amount,
  onText,
  onBlur,
  onStep,
}: {
  k: HourKey;
  text: string;
  amount: number;
  onText: (t: string) => void;
  onBlur: () => void;
  onStep: (delta: number) => void;
}) {
  const theme = useTheme();
  const colors = useHourColors()[k];
  const name = `${HourName[k]} x${HourLabel[k]}`;

  return (
    <View style={[styles.row, { backgroundColor: colors.bg }]}>
      <View style={styles.rowTop}>
        <Text style={[styles.rowName, { color: colors.fg }]}>{name}</Text>
        <Text style={[styles.rowCoef, { color: colors.fg }]}>Hệ số x{HourLabel[k]}</Text>
      </View>
      <View style={styles.rowBottom}>
        <View style={[styles.step, { backgroundColor: theme.surface }]}>
          <Pressable onPress={() => onStep(-0.5)} accessibilityRole="button" accessibilityLabel={`Giảm ${name}`} style={styles.stepBtn}>
            <Icon name="minus" size={18} color={theme.text} />
          </Pressable>
          <TextInput
            value={text}
            onChangeText={onText}
            onBlur={onBlur}
            keyboardType="decimal-pad"
            placeholder="0"
            placeholderTextColor={theme.textSecondary}
            accessibilityLabel={`Số giờ ${name}`}
            style={[styles.stepInput, { color: theme.text }]}
          />
          <Text style={[styles.stepUnit, { color: theme.textSecondary }]}>giờ</Text>
          <Pressable onPress={() => onStep(0.5)} accessibilityRole="button" accessibilityLabel={`Tăng ${name}`} style={styles.stepBtn}>
            <Icon name="plus" size={18} color={theme.text} />
          </Pressable>
        </View>
        <Text style={[styles.rowAmount, { color: colors.fg }]}>{formatWon(amount)}</Text>
      </View>
    </View>
  );
}

/** "7,5" → 7.5; giới hạn 0–24 */
function parseHours(text: string): number {
  const v = parseFloat(text.replace(',', '.'));
  return Number.isFinite(v) ? Math.max(0, Math.min(MAX_DAY_HOURS, v)) : 0;
}

const styles = StyleSheet.create({
  fill: { flex: 1, justifyContent: 'flex-end' },
  sheet: {
    width: '100%',
    maxWidth: MaxContentWidth,
    alignSelf: 'center',
    maxHeight: '92%',
    borderTopLeftRadius: 22,
    borderTopRightRadius: 22,
  },
  scroll: { flexShrink: 1 },
  sheetContent: { paddingHorizontal: 16, paddingTop: 10 },
  footer: { paddingHorizontal: 16, paddingTop: 10, borderTopWidth: StyleSheet.hairlineWidth },
  grab: { width: 40, height: 5, borderRadius: 9, alignSelf: 'center', marginBottom: 10 },
  head: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  title: { fontSize: 18, fontWeight: 800, flexShrink: 1 },
  tag: { fontSize: 12, fontWeight: 600, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 2, overflow: 'hidden' },
  close: { marginLeft: 'auto', width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  wage: { borderRadius: 14, paddingVertical: 10, paddingHorizontal: 14, marginVertical: 12 },
  wageValue: { fontSize: 20, fontWeight: 800 },
  small: { fontSize: 12 },
  section: { fontSize: 14, fontWeight: 700, marginTop: 14, marginBottom: 8 },
  row: { borderRadius: 14, paddingVertical: 10, paddingHorizontal: 12, marginBottom: 8, gap: 6 },
  rowTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  rowName: { fontSize: 15, fontWeight: 700 },
  rowCoef: { fontSize: 12, opacity: 0.85 },
  rowBottom: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 10 },
  rowAmount: { fontSize: 18, fontWeight: 800, letterSpacing: -0.3, flexShrink: 1, textAlign: 'right' },
  step: { flexDirection: 'row', alignItems: 'center', borderRadius: 10, overflow: 'hidden' },
  stepBtn: { width: 36, height: 38, alignItems: 'center', justifyContent: 'center' },
  stepInput: { width: 52, height: 38, textAlign: 'center', fontWeight: 700, fontSize: 16, padding: 0 },
  stepUnit: { fontSize: 13, paddingRight: 4 },
  weekly: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 8,
    borderRadius: 12,
    paddingVertical: 8,
    paddingHorizontal: 12,
  },
  weeklyText: { fontSize: 13.5, flexShrink: 1 },
  weeklyRemove: { fontSize: 13, textDecorationLine: 'underline' },
  bold: { fontWeight: 700 },
  total: { borderRadius: 14, paddingVertical: 12, paddingHorizontal: 14, marginVertical: 14 },
  totalValue: { fontSize: 28, fontWeight: 800, letterSpacing: -0.5 },
  btn: { borderRadius: 999, paddingVertical: 14, alignItems: 'center' },
  btnText: { fontSize: 16, fontWeight: 700 },
  pressed: { opacity: 0.8 },
  ghost: { paddingVertical: 10, alignItems: 'center' },
  ghostText: { fontSize: 14, fontWeight: 600 },
});
