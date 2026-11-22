import { useState } from 'react';
import { Pressable, StyleSheet, Text } from 'react-native';

import { Screen } from '@/components/screen';
import { Card, Field, Hint, Label, Segmented } from '@/components/ui';
import { API_URL } from '@/config/env';
import { useApp } from '@/data/app-store';
import { DEDUCTION_PRESETS } from '@/data/deduction';
import { monthLabel } from '@/data/month';
import type { CompanySize, Job, ThemePreference } from '@/data/types';
import { useTheme } from '@/hooks/use-theme';
import { confirmAsync } from '@/lib/confirm';
import { formatNumber, formatWon, parseWon } from '@/lib/format';

const THEMES: readonly { value: ThemePreference; label: string }[] = [
  { value: 'auto', label: 'Theo máy' },
  { value: 'light', label: 'Sáng' },
  { value: 'dark', label: 'Tối' },
];

const SIZES: readonly { value: CompanySize; label: string }[] = [
  { value: '5plus', label: 'Từ 5 người' },
  { value: 'under5', label: 'Dưới 5 người' },
];

export default function SettingsScreen() {
  const { job, settings, updateSettings, month, rules } = useApp();
  const minimumWage = rules(month.slice(0, 4)).minimumWage;

  return (
    <Screen title="Cài đặt" monthNav={false}>
      {/* key: khi đổi nơi làm, ô nhập lấy lại giá trị của nơi làm mới */}
      {job ? <JobCard key={job.id} job={job} minimumWage={minimumWage} /> : null}

      <Card title="Lương thực nhận">
        <Segmented
          label="Khấu trừ khi xem lương thực nhận"
          value={settings.deductRate}
          options={DEDUCTION_PRESETS}
          onChange={(deductRate) => updateSettings({ deductRate })}
        />
        <Hint>Chỉ để ước tính tiền về tài khoản; tỉ lệ thật tùy hợp đồng của bạn.</Hint>
      </Card>

      <Card title="Giao diện">
        <Segmented
          label="Chế độ màu"
          value={settings.theme}
          options={THEMES}
          onChange={(theme) => updateSettings({ theme })}
        />
      </Card>

      <DataCard month={month} />
    </Screen>
  );
}

function JobCard({ job, minimumWage }: { job: Job; minimumWage: number }) {
  const { updateJob, toast } = useApp();
  const [name, setName] = useState(job.name);
  const [wage, setWage] = useState(formatNumber(job.hourlyWage));

  const saveName = () => {
    const trimmed = name.trim().slice(0, 60);
    if (!trimmed) return setName(job.name);
    if (trimmed !== job.name) {
      updateJob({ name: trimmed });
      toast('Đã lưu tên nơi làm');
    }
  };

  const saveWage = () => {
    const v = Math.min(parseWon(wage), 1_000_000);
    if (v <= 0) return setWage(formatNumber(job.hourlyWage));
    if (v !== job.hourlyWage) {
      updateJob({ hourlyWage: v });
      toast('Đã lưu lương giờ');
    }
    setWage(formatNumber(v));
  };

  return (
    <Card title="Nơi làm việc" style={styles.first}>
      <Field label="Tên" value={name} onChangeText={setName} onBlur={saveName} onSubmitEditing={saveName} maxLength={60} />
      <Label>Mức lương giờ (₩)</Label>
      <Field
        label="Lương giờ"
        keyboardType="number-pad"
        value={wage}
        onChangeText={(t) => setWage(t ? formatNumber(parseWon(t)) : '')}
        onBlur={saveWage}
        onSubmitEditing={saveWage}
      />
      <Hint>
        Lương tối thiểu năm nay là {formatWon(minimumWage)}/giờ. Lương giờ mới áp dụng cho ngày công ghi từ bây giờ;
        ngày đã ghi giữ lương giờ lúc ghi.
      </Hint>
      <Label>Quy mô công ty</Label>
      <Segmented
        label="Quy mô công ty"
        value={job.companySize}
        options={SIZES}
        onChange={(companySize) => updateJob({ companySize })}
      />
    </Card>
  );
}

function DataCard({ month }: { month: string }) {
  const theme = useTheme();
  const { clearMonth, loadDemo, toast } = useApp();
  const label = monthLabel(month).toLowerCase();

  const onClear = async () => {
    if (!(await confirmAsync('Xóa dữ liệu tháng?', `Xóa toàn bộ ngày công của ${label}.`))) return;
    clearMonth(month);
    toast('Đã xóa dữ liệu tháng');
  };

  const onDemo = async () => {
    if (!(await confirmAsync('Nạp dữ liệu mẫu?', `Dữ liệu hiện có của ${label} sẽ bị thay.`, 'Nạp'))) return;
    loadDemo(month);
    toast('Đã nạp dữ liệu mẫu');
  };

  return (
    <Card title="Dữ liệu">
      <Hint>Dữ liệu lưu trên máy này. Đăng nhập để sao lưu sẽ có ở bản sau.</Hint>
      <Pressable onPress={onClear} accessibilityRole="button" style={[styles.danger, { borderColor: theme.line }]}>
        <Text style={[styles.dangerText, { color: theme.offText }]}>Xóa dữ liệu {label}</Text>
      </Pressable>
      {__DEV__ ? (
        <>
          <Pressable onPress={onDemo} accessibilityRole="button" style={[styles.danger, { borderColor: theme.line }]}>
            <Text style={[styles.dangerText, { color: theme.offText }]}>Nạp dữ liệu mẫu cho {label}</Text>
          </Pressable>
          <Hint>Server: {API_URL}</Hint>
        </>
      ) : null}
    </Card>
  );
}

const styles = StyleSheet.create({
  first: { marginTop: 4 },
  danger: { marginTop: 10, borderWidth: 1, borderRadius: 12, paddingVertical: 12, alignItems: 'center' },
  dangerText: { fontWeight: 600, fontSize: 15 },
});
