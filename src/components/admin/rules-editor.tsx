import { useEffect, useState, type RefObject } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { ApiError } from '@/api/client';
import { useSaveRulesMutation } from '@/api/admin';
import { Icon } from '@/components/icon';
import { Button, Card, Field, Hint } from '@/components/ui';
import {
  addHoliday,
  isDirty,
  validateDraft,
  type DraftErrors,
  type RulesDraft,
} from '@/data/admin-rules';
import { DOW_LABELS } from '@/data/month';
import { useTheme } from '@/hooks/use-theme';
import { confirmAsync } from '@/lib/confirm';
import { formatDayMonth, formatNumber, parseWon } from '@/lib/format';
import { dayOfWeek } from '@/payroll/index.ts';

/** Hàm trang quản trị gọi trước khi rời form: trả false nếu admin muốn ở lại để lưu. */
export type LeaveGuard = () => Promise<boolean>;

/** Form tạo hoặc sửa quy định một năm: lương tối thiểu, điều kiện 주휴수당, ngày lễ. */
export function RulesEditor({
  year,
  initial,
  isNew,
  onSaved,
  guardRef,
}: {
  year: number;
  initial: RulesDraft;
  isNew: boolean;
  onSaved: (message: string) => void;
  guardRef: RefObject<LeaveGuard | null>;
}) {
  const theme = useTheme();
  const save = useSaveRulesMutation();
  const [draft, setDraft] = useState(initial);
  const [errors, setErrors] = useState<DraftErrors>({});
  const [serverError, setServerError] = useState<string | null>(null);
  const [newDate, setNewDate] = useState('');
  const [newName, setNewName] = useState('');
  const [addError, setAddError] = useState<string | null>(null);

  const dirty = isNew || isDirty(draft, initial);
  useEffect(() => {
    guardRef.current = async () =>
      !dirty || confirmAsync('Bỏ thay đổi?', `Quy định năm ${year} chưa được lưu.`, 'Bỏ thay đổi');
    return () => {
      guardRef.current = null;
    };
  }, [dirty, year, guardRef]);

  const set = (patch: Partial<RulesDraft>) => {
    setDraft((d) => ({ ...d, ...patch }));
    setServerError(null);
  };

  const onAdd = () => {
    const r = addHoliday(draft.holidays, newDate, newName, year);
    if (!r.ok) {
      setAddError(r.error);
      return;
    }
    set({ holidays: r.holidays });
    setErrors((e) => ({ ...e, holidays: undefined }));
    setNewDate('');
    setNewName('');
    setAddError(null);
  };

  const onSave = async () => {
    const v = validateDraft(year, draft);
    if (!v.ok) {
      setErrors(v.errors);
      return;
    }
    setErrors({});
    const ok = await confirmAsync(
      `Lưu quy định năm ${year}?`,
      'Mọi người dùng sẽ tính lương theo quy định mới khi app tải lại (trong vòng 12 giờ).',
      'Lưu',
    );
    if (!ok) return;
    save.mutate(
      { year, input: v.input },
      {
        onSuccess: () => onSaved(`Đã lưu quy định năm ${year}`),
        onError: (err) => setServerError(describeError(err)),
      },
    );
  };

  return (
    <>
      <Card title={isNew ? `Tạo quy định năm ${year}` : `Quy định năm ${year}`}>
        <Field
          label="Lương tối thiểu (₩/giờ)"
          value={draft.minimumWage}
          onChangeText={(minimumWage) => set({ minimumWage })}
          onBlur={() => draft.minimumWage.trim() && set({ minimumWage: formatNumber(parseWon(draft.minimumWage)) })}
          keyboardType="number-pad"
          placeholder="10.320"
        />
        <ErrorText text={errors.minimumWage} />
        {isNew ? <Hint>Chép từ năm gần nhất; nhớ sửa thành mức đã công bố cho năm {year}.</Hint> : null}
      </Card>

      <Card title="Điều kiện 주휴수당">
        <View style={styles.stack}>
          <Field
            label="Giờ cơ bản tối thiểu mỗi tuần"
            value={draft.minHours}
            onChangeText={(minHours) => set({ minHours })}
            keyboardType="decimal-pad"
          />
          <ErrorText text={errors.minHours} />
          <Field
            label="Số giờ tối đa được tính"
            value={draft.maxHours}
            onChangeText={(maxHours) => set({ maxHours })}
            keyboardType="decimal-pad"
          />
          <ErrorText text={errors.maxHours} />
          <Field
            label="Số giờ được trả khi làm đủ"
            value={draft.paidHours}
            onChangeText={(paidHours) => set({ paidHours })}
            keyboardType="decimal-pad"
          />
          <ErrorText text={errors.paidHours} />
        </View>
        <Hint>Luật hiện hành: từ 15 giờ mỗi tuần, tính tối đa 40 giờ, làm đủ thì được trả 8 giờ.</Hint>
      </Card>

      <Card title={`Ngày lễ (${draft.holidays.length})`}>
        {draft.holidays.length === 0 ? <Hint>Chưa có ngày lễ nào.</Hint> : null}
        {draft.holidays.map((h) => (
          <View key={h.date} style={[styles.holiday, { borderColor: theme.line }]}>
            <Text style={[styles.holidayDate, { color: theme.text }]}>
              {DOW_LABELS[dayOfWeek(h.date)]}, {formatDayMonth(h.date)}
            </Text>
            <Text style={[styles.holidayName, { color: theme.text }]} numberOfLines={1}>
              {h.name}
            </Text>
            <Pressable
              onPress={() => set({ holidays: draft.holidays.filter((x) => x.date !== h.date) })}
              accessibilityRole="button"
              accessibilityLabel={`Bỏ ngày lễ ${formatDayMonth(h.date)} ${h.name}`}
              hitSlop={8}
              style={[styles.remove, { backgroundColor: theme.backgroundElement }]}>
              <Icon name="close" size={16} color={theme.offText} />
            </Pressable>
          </View>
        ))}
        <ErrorText text={errors.holidays} />

        <View style={styles.addRow}>
          <TextInput
            value={newDate}
            onChangeText={setNewDate}
            placeholder="ngày/tháng"
            placeholderTextColor={theme.textSecondary}
            accessibilityLabel="Ngày lễ, dạng ngày/tháng"
            keyboardType="numbers-and-punctuation"
            style={[styles.input, styles.dateInput, { color: theme.text, borderColor: theme.line }]}
          />
          <TextInput
            value={newName}
            onChangeText={setNewName}
            placeholder="Tên ngày lễ"
            placeholderTextColor={theme.textSecondary}
            accessibilityLabel="Tên ngày lễ"
            maxLength={60}
            returnKeyType="done"
            onSubmitEditing={onAdd}
            style={[styles.input, styles.nameInput, { color: theme.text, borderColor: theme.line }]}
          />
        </View>
        <ErrorText text={addError ?? undefined} />
        <Button label="Thêm ngày lễ" onPress={onAdd} />
        <Hint>Gồm cả ngày nghỉ bù và ngày bầu cử nếu có. Ngày âm lịch (Seollal, Chuseok, Phật đản) đổi theo từng năm.</Hint>
      </Card>

      {serverError ? (
        <View style={[styles.banner, { backgroundColor: theme.offBg }]}>
          <Text style={[styles.bannerText, { color: theme.offText }]}>{serverError}</Text>
        </View>
      ) : null}
      <Button label={`Lưu quy định năm ${year}`} variant="primary" busy={save.isPending} onPress={onSave} />
    </>
  );
}

function ErrorText({ text }: { text?: string }) {
  const theme = useTheme();
  if (!text) return null;
  return <Text style={[styles.error, { color: theme.offText }]}>{text}</Text>;
}

/** Lỗi server: 422 kèm chi tiết từng trường, 403 khi đã bị thu quyền admin. */
export function describeError(err: unknown): string {
  if (!(err instanceof ApiError)) return 'Có lỗi xảy ra, thử lại sau';
  if (err.status === 403) return 'Tài khoản này không còn quyền quản trị';
  if (Array.isArray(err.details) && err.details.length > 0) {
    const first = err.details[0] as { path?: string; message?: string };
    return `${err.message}: ${first.path ? `${first.path} ` : ''}${first.message ?? ''}`.trim();
  }
  return err.message;
}

const styles = StyleSheet.create({
  stack: { gap: 8 },
  error: { fontSize: 12.5, marginTop: 4 },
  holiday: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  holidayDate: { fontSize: 14, fontWeight: 700, width: 64 },
  holidayName: { fontSize: 14, flex: 1 },
  remove: { width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  addRow: { flexDirection: 'row', gap: 8, marginTop: 12 },
  input: { borderWidth: 1, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 10, fontSize: 15 },
  dateInput: { width: 110 },
  nameInput: { flex: 1 },
  banner: { borderRadius: 14, paddingVertical: 10, paddingHorizontal: 14 },
  bannerText: { fontSize: 13.5, fontWeight: 600 },
});
