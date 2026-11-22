import Constants from 'expo-constants';
import { StyleSheet, Text, View } from 'react-native';

import { isOlderVersion, useAppConfigQuery } from '@/api/queries';
import { Screen } from '@/components/screen';
import { AccountCard } from '@/components/settings/account-card';
import { JobsCard } from '@/components/settings/jobs-card';
import { Button, Card, Hint, Segmented } from '@/components/ui';
import { API_URL } from '@/config/env';
import { useApp } from '@/data/app-store';
import { DEDUCTION_PRESETS } from '@/data/deduction';
import { monthLabel, monthOf, todayKst } from '@/data/month';
import type { ThemePreference } from '@/data/types';
import { useTheme } from '@/hooks/use-theme';
import { confirmAsync } from '@/lib/confirm';

const THEMES: readonly { value: ThemePreference; label: string }[] = [
  { value: 'auto', label: 'Theo máy' },
  { value: 'light', label: 'Sáng' },
  { value: 'dark', label: 'Tối' },
];

const APP_VERSION = Constants.expoConfig?.version ?? '0.0.0';

export default function SettingsScreen() {
  const { settings, updateSettings, month, rules } = useApp();
  const minimumWage = rules(monthOf(todayKst()).slice(0, 4)).minimumWage;

  return (
    <Screen title="Cài đặt" monthNav={false}>
      <UpdateBanner />
      <AccountCard />
      <JobsCard minimumWage={minimumWage} />

      <Card title="Lương thực nhận">
        <Segmented
          label="Khấu trừ khi xem lương thực nhận"
          value={settings.deductRate}
          options={DEDUCTION_PRESETS}
          onChange={(deductRate) => updateSettings({ deductRate })}
        />
        <Hint>Chỉ để ước tính tiền về tài khoản; tỉ lệ thật tùy hợp đồng của bạn. Đồng bộ giữa các máy.</Hint>
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

/** Server báo phiên bản app tối thiểu (GET /v1/config) cao hơn bản đang chạy */
function UpdateBanner() {
  const theme = useTheme();
  const config = useAppConfigQuery();
  if (!config.data || !isOlderVersion(APP_VERSION, config.data.minAppVersion)) return null;
  return (
    <View style={[styles.banner, { backgroundColor: theme.warnBg }]}>
      <Text style={[styles.bannerText, { color: theme.warnText }]}>
        Có phiên bản mới ({config.data.minAppVersion}). Hãy cập nhật app để đồng bộ và tính lương đúng quy định mới.
      </Text>
    </View>
  );
}

function DataCard({ month }: { month: string }) {
  const { clearMonth, loadDemo, toast, job } = useApp();
  const label = monthLabel(month).toLowerCase();

  const onClear = async () => {
    if (!(await confirmAsync('Xóa dữ liệu tháng?', `Xóa toàn bộ ngày công của ${label} (${job?.name}).`))) return;
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
      <Hint>Dữ liệu lưu trên máy này và dùng được khi không có mạng. Đăng nhập để sao lưu lên server.</Hint>
      <Button label={`Xóa dữ liệu ${label}`} variant="danger" onPress={onClear} />
      {__DEV__ ? (
        <>
          <Button label={`Nạp dữ liệu mẫu cho ${label}`} variant="danger" onPress={onDemo} />
          <Hint>
            Server: {API_URL} · App {APP_VERSION}
          </Hint>
        </>
      ) : null}
    </Card>
  );
}

const styles = StyleSheet.create({
  banner: { borderRadius: 14, paddingVertical: 10, paddingHorizontal: 14 },
  bannerText: { fontSize: 13.5, fontWeight: 600 },
});
