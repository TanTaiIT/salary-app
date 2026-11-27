// Trang quản trị nằm trong app: thẻ "Quản trị" ở Cài đặt (chỉ hiện với admin) mở một màn hình toàn trang.
// Bên trong có 3 màn: danh sách năm, sửa quy định một năm, nhật ký thay đổi của năm đó.
import { useRef, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useAdminRulesQuery, useIsAdmin } from '@/api/admin';
import { Icon } from '@/components/icon';
import { Button, Card, Hint } from '@/components/ui';
import { MaxContentWidth } from '@/constants/theme';
import { draftForNewYear, draftFromRules, nextYear, type RulesDraft } from '@/data/admin-rules';
import { todayKst } from '@/data/month';
import { useTheme } from '@/hooks/use-theme';
import { formatNumber } from '@/lib/format';

import { AuditList, formatDateTime } from './audit-list';
import { describeError, RulesEditor, type LeaveGuard } from './rules-editor';

type View_ =
  | { kind: 'list' }
  | { kind: 'edit'; year: number; initial: RulesDraft; isNew: boolean }
  | { kind: 'audit'; year: number };

/** Thẻ trong màn Cài đặt; không hiện gì nếu tài khoản không phải admin. */
export function AdminCard() {
  const isAdmin = useIsAdmin();
  const [open, setOpen] = useState(false);
  if (!isAdmin) return null;
  return (
    <Card title="Quản trị">
      <Hint>Sửa lương tối thiểu, ngày lễ và điều kiện 주휴수당 từng năm cho mọi người dùng.</Hint>
      <Button label="Mở trang quản trị" variant="primary" onPress={() => setOpen(true)} />
      {open ? <AdminSheet onClose={() => setOpen(false)} /> : null}
    </Card>
  );
}

function AdminSheet({ onClose }: { onClose: () => void }) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const [view, setView] = useState<View_>({ kind: 'list' });
  const [notice, setNotice] = useState<string | null>(null);
  const guardRef = useRef<LeaveGuard | null>(null);

  // Nút quay lại (header, nút Back của Android): đang ở màn con thì về danh sách, đang ở danh sách thì đóng
  const goBack = async () => {
    if (guardRef.current && !(await guardRef.current())) return;
    if (view.kind === 'list') onClose();
    else setView({ kind: 'list' });
  };
  const close = async () => {
    if (guardRef.current && !(await guardRef.current())) return;
    onClose();
  };

  const title = view.kind === 'list' ? 'Quản trị' : view.kind === 'edit' ? `Quy định ${view.year}` : `Nhật ký ${view.year}`;

  return (
    <Modal visible animationType="slide" onRequestClose={goBack} statusBarTranslucent>
      <View style={[styles.fill, { backgroundColor: theme.background }]}>
        <View style={[styles.header, { backgroundColor: theme.primary, paddingTop: insets.top + 10 }]}>
          {view.kind !== 'list' ? (
            <HeaderButton icon="prev" label="Quay lại" onPress={goBack} />
          ) : (
            <View style={styles.headerSpacer} />
          )}
          <Text style={[styles.title, { color: theme.onPrimary }]} accessibilityRole="header" numberOfLines={1}>
            {title}
          </Text>
          <HeaderButton icon="close" label="Đóng trang quản trị" onPress={close} />
        </View>

        <KeyboardAvoidingView behavior="padding" style={styles.fill}>
          <ScrollView
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 24 }]}>
            {view.kind === 'list' ? (
              <YearList
                notice={notice}
                onEdit={(year, initial, isNew) => {
                  setNotice(null);
                  setView({ kind: 'edit', year, initial, isNew });
                }}
                onAudit={(year) => {
                  setNotice(null);
                  setView({ kind: 'audit', year });
                }}
              />
            ) : view.kind === 'edit' ? (
              <RulesEditor
                key={view.year}
                year={view.year}
                initial={view.initial}
                isNew={view.isNew}
                guardRef={guardRef}
                onSaved={(message) => {
                  guardRef.current = null;
                  setNotice(message);
                  setView({ kind: 'list' });
                }}
              />
            ) : (
              <AuditList year={view.year} />
            )}
          </ScrollView>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
}

function YearList({
  notice,
  onEdit,
  onAudit,
}: {
  notice: string | null;
  onEdit: (year: number, initial: RulesDraft, isNew: boolean) => void;
  onAudit: (year: number) => void;
}) {
  const theme = useTheme();
  const rules = useAdminRulesQuery();

  if (rules.isPending) return <ActivityIndicator style={styles.loading} color={theme.primary} />;
  if (rules.isError) {
    return (
      <Card>
        <Hint>{describeError(rules.error)}</Hint>
        <Button label="Thử lại" onPress={() => rules.refetch()} />
      </Card>
    );
  }

  const items = rules.data;
  const latest = items[0]; // server trả năm mới nhất trước
  const year = nextYear(
    items.map((r) => r.year),
    Number(todayKst().slice(0, 4)),
  );

  return (
    <>
      {notice ? (
        <View style={[styles.banner, { backgroundColor: theme.primarySoft }]}>
          <Text style={[styles.bannerText, { color: theme.primary }]}>{notice}</Text>
        </View>
      ) : null}

      <Card title="Quy định theo năm">
        <Hint>App của người dùng tải quy định mới trong vòng 12 giờ. Năm chưa có quy định thì app dùng mức của năm gần nhất và không có ngày lễ.</Hint>
        <Button label={`Tạo quy định năm ${year}`} variant="primary" onPress={() => onEdit(year, draftForNewYear(latest), true)} />
      </Card>

      {items.map((r) => (
        <Card key={r.year} title={`Năm ${r.year}`}>
          <Text style={[styles.summary, { color: theme.text }]}>
            Lương tối thiểu {formatNumber(r.minimumWage)} ₩ · {r.holidays.length} ngày lễ
          </Text>
          <Text style={[styles.meta, { color: theme.textSecondary }]}>Sửa lần cuối {formatDateTime(r.updatedAt)}</Text>
          <View style={styles.actions}>
            <View style={styles.action}>
              <Button label="Sửa" onPress={() => onEdit(r.year, draftFromRules(r), false)} />
            </View>
            <View style={styles.action}>
              <Button label="Nhật ký" onPress={() => onAudit(r.year)} />
            </View>
          </View>
        </Card>
      ))}
    </>
  );
}

function HeaderButton({ icon, label, onPress }: { icon: 'prev' | 'close'; label: string; onPress: () => void }) {
  const theme = useTheme();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      hitSlop={8}
      style={({ pressed }) => [styles.headerButton, pressed && { opacity: 0.7 }]}>
      <Icon name={icon} size={22} color={theme.onPrimary} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 12, paddingBottom: 14 },
  headerButton: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: 'rgba(255,255,255,0.16)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerSpacer: { width: 36 },
  title: { flex: 1, fontSize: 18, fontWeight: 800, textAlign: 'center' },
  content: { padding: 12, gap: 12, width: '100%', maxWidth: MaxContentWidth, alignSelf: 'center' },
  loading: { marginTop: 24 },
  banner: { borderRadius: 14, paddingVertical: 10, paddingHorizontal: 14 },
  bannerText: { fontSize: 13.5, fontWeight: 600 },
  summary: { fontSize: 15, fontWeight: 600 },
  meta: { fontSize: 12.5, marginTop: 2 },
  actions: { flexDirection: 'row', gap: 8 },
  action: { flex: 1 },
});
