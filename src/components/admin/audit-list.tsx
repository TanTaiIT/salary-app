import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';

import { useAuditLogsQuery } from '@/api/admin';
import { useMeQuery } from '@/api/queries';
import { Button, Card, Hint } from '@/components/ui';
import { summarizeChange } from '@/data/admin-rules';
import { useTheme } from '@/hooks/use-theme';

import { describeError } from './rules-editor';

/** Nhật ký thay đổi quy định một năm: ai sửa, lúc nào, sửa gì. */
export function AuditList({ year }: { year: number }) {
  const theme = useTheme();
  const logs = useAuditLogsQuery(year);
  const myId = useMeQuery().data?.id;

  if (logs.isPending) return <ActivityIndicator style={styles.loading} color={theme.primary} />;
  if (logs.isError) {
    return (
      <Card>
        <Hint>{describeError(logs.error)}</Hint>
        <Button label="Thử lại" onPress={() => logs.refetch()} />
      </Card>
    );
  }

  return (
    <Card title={`Nhật ký năm ${year}`}>
      {logs.data.length === 0 ? <Hint>Chưa có thay đổi nào được ghi lại (dữ liệu nạp bằng script không có nhật ký).</Hint> : null}
      {logs.data.map((log) => (
        <View key={log.id} style={[styles.entry, { borderColor: theme.line }]}>
          <Text style={[styles.meta, { color: theme.textSecondary }]}>
            {formatDateTime(log.at)} · {log.action === 'rules.create' ? 'Tạo' : 'Sửa'} ·{' '}
            {log.actorId === myId ? 'Bạn' : `admin ${log.actorId.slice(0, 8)}`}
          </Text>
          {summarizeChange(log.before, log.after).map((line) => (
            <Text key={line} style={[styles.line, { color: theme.text }]}>
              {line}
            </Text>
          ))}
        </View>
      ))}
    </Card>
  );
}

export function formatDateTime(iso: string): string {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${pad(d.getHours())}:${pad(d.getMinutes())} ${d.getDate()}/${d.getMonth() + 1}/${d.getFullYear()}`;
}

const styles = StyleSheet.create({
  loading: { marginTop: 24 },
  entry: { paddingVertical: 10, borderBottomWidth: StyleSheet.hairlineWidth, gap: 3 },
  meta: { fontSize: 12.5 },
  line: { fontSize: 14, lineHeight: 20 },
});
