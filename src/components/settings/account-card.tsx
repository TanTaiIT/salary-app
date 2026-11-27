import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { useMeQuery } from '@/api/queries';
import { useSession } from '@/api/session';
import { Button, Card, Field, Hint } from '@/components/ui';
import { useApp } from '@/data/app-store';
import { discardRejected } from '@/data/actions';
import { useTheme } from '@/hooks/use-theme';
import { confirmAsync } from '@/lib/confirm';
import { deleteAccount, signInDev, signOut } from '@/sync/account';
import { syncNow, useSyncStatus } from '@/sync/engine';

const PROVIDER: Record<string, string> = { dev: 'Tài khoản dev', apple: 'Apple', google: 'Google', kakao: 'Kakao' };

const REJECT_REASON: Record<string, string> = {
  duplicate_day: 'trùng ngày với ngày công đã có trên máy khác',
  duplicate_week: 'trùng tuần với khoản 주휴수당 đã có trên máy khác',
  unknown_job: 'thuộc nơi làm việc không còn tồn tại',
  // Server từ chối id đã thuộc tài khoản khác (máy này từng đồng bộ bằng tài khoản khác)
  not_found: 'đã được đồng bộ bằng một tài khoản khác trên máy này',
};

const errorMessage = (err: unknown) => (err instanceof Error ? err.message : 'Có lỗi, hãy thử lại');

/** Đăng nhập (không bắt buộc) để sao lưu và dùng trên nhiều máy; trạng thái đồng bộ. */
export function AccountCard() {
  const status = useSession((s) => s.status);
  if (status === 'loading') return null;
  return status === 'signedIn' ? <SignedIn /> : <SignedOut />;
}

function SignedOut() {
  const { toast } = useApp();
  const [name, setName] = useState('');
  const login = useMutation({
    mutationFn: () => signInDev(name),
    onSuccess: () => toast('Đã đăng nhập và đồng bộ'),
    onError: (err) => toast(errorMessage(err)),
  });

  return (
    <Card title="Tài khoản" style={styles.first}>
      <Hint>
        Đăng nhập để sao lưu và dùng trên nhiều máy. Lần đầu đăng nhập, dữ liệu trên máy này được đẩy lên và gộp với dữ
        liệu đã có.
      </Hint>
      {__DEV__ ? (
        <>
          <View style={styles.gap} />
          <Field label="Tên (dev)" value={name} onChangeText={setName} maxLength={60} autoCapitalize="words" />
          <Button
            label="Đăng nhập (bản dev)"
            variant="primary"
            disabled={!name.trim()}
            busy={login.isPending}
            onPress={() => login.mutate()}
          />
          <Hint>Đăng nhập bằng tên chỉ có ở server dev. Bản phát hành dùng Apple, Google.</Hint>
        </>
      ) : (
        <Hint>Đăng nhập bằng Apple, Google sẽ có ở bản sau.</Hint>
      )}
    </Card>
  );
}

function SignedIn() {
  const theme = useTheme();
  const user = useSession((s) => s.user);
  const me = useMeQuery();
  const { sync, toast } = useApp();
  const { running, error } = useSyncStatus();
  const queryClient = useQueryClient();

  const syncMutation = useMutation({
    mutationFn: () => syncNow(),
    onSuccess: () => toast('Đã đồng bộ'),
    onError: (err) => toast(errorMessage(err)),
  });
  const logout = useMutation({
    mutationFn: signOut,
    onSuccess: () => {
      queryClient.removeQueries({ queryKey: ['me'] });
      toast('Đã đăng xuất. Dữ liệu trên máy vẫn giữ.');
    },
  });
  const remove = useMutation({
    mutationFn: deleteAccount,
    onSuccess: () => {
      queryClient.removeQueries({ queryKey: ['me'] });
      toast('Đã xóa tài khoản trên server');
    },
    onError: (err) => toast(errorMessage(err)),
  });

  const onLogout = async () => {
    if (await confirmAsync('Đăng xuất?', 'Dữ liệu trên máy vẫn giữ; đăng nhập lại để đồng bộ tiếp.', 'Đăng xuất')) {
      logout.mutate();
    }
  };
  const onDelete = async () => {
    const ok = await confirmAsync(
      'Xóa tài khoản?',
      'Toàn bộ dữ liệu trên server (nơi làm, ngày công, 주휴수당, cài đặt) sẽ bị xóa vĩnh viễn. Dữ liệu trên máy này vẫn giữ.',
    );
    if (ok) remove.mutate();
  };
  const onDiscard = async () => {
    const ok = await confirmAsync('Giữ bản trên server?', 'Các bản trên máy bị từ chối sẽ bị bỏ, dùng bản đã có trên server.', 'Giữ bản server');
    if (ok) {
      discardRejected();
      syncNow().catch(() => {});
    }
  };

  const last = sync.lastSyncedAt ? formatDateTime(sync.lastSyncedAt) : 'chưa đồng bộ';

  return (
    <Card title="Tài khoản" style={styles.first}>
      <Text style={[styles.name, { color: theme.text }]}>{me.data?.name ?? user?.name}</Text>
      <Text style={[styles.meta, { color: theme.textSecondary }]}>
        {me.data ? PROVIDER[me.data.provider] : 'Đã đăng nhập'}
      </Text>

      <View style={[styles.status, { backgroundColor: error ? theme.warnBg : theme.backgroundElement }]}>
        <Text style={[styles.statusText, { color: error ? theme.warnText : theme.textSecondary }]}>
          {running ? 'Đang đồng bộ…' : error ? error : `Đồng bộ lần cuối: ${last}`}
        </Text>
      </View>

      {sync.rejections.length > 0 ? (
        <View style={[styles.status, { backgroundColor: theme.offBg }]}>
          <Text style={[styles.statusText, { color: theme.offText }]}>
            {sync.rejections.length} bản chưa đồng bộ được:{' '}
            {[...new Set(sync.rejections.map((r) => REJECT_REASON[r.code] ?? r.code))].join('; ')}.
          </Text>
          <Button label="Giữ bản trên server" variant="danger" onPress={onDiscard} />
        </View>
      ) : null}

      <Button label="Đồng bộ ngay" variant="primary" busy={syncMutation.isPending || running} onPress={() => syncMutation.mutate()} />
      <Button label="Đăng xuất" busy={logout.isPending} onPress={onLogout} />
      <Button label="Xóa tài khoản" variant="danger" busy={remove.isPending} onPress={onDelete} />
    </Card>
  );
}

function formatDateTime(iso: string): string {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${pad(d.getHours())}:${pad(d.getMinutes())} ${d.getDate()}/${d.getMonth() + 1}`;
}

const styles = StyleSheet.create({
  first: { marginTop: 4 },
  gap: { height: 8 },
  name: { fontSize: 17, fontWeight: 700 },
  meta: { fontSize: 13, marginTop: 2 },
  status: { marginTop: 10, borderRadius: 12, paddingVertical: 8, paddingHorizontal: 12 },
  statusText: { fontSize: 13 },
});
