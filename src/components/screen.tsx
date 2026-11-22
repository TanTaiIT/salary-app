import { router } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import type { ReactNode } from 'react';
import { Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Icon } from '@/components/icon';
import { BottomTabInset, MaxContentWidth, Spacing } from '@/constants/theme';
import { useApp } from '@/data/app-store';
import { monthLabel, monthOf, shiftMonth, todayKst } from '@/data/month';
import { useTheme } from '@/hooks/use-theme';

/** Khoảng cách từ đáy màn hình tới mép trên thanh tab (nội dung nằm dưới thanh tab). */
export function useBottomInset(): number {
  const insets = useSafeAreaInsets();
  return (Platform.OS === 'web' ? 0 : insets.bottom) + BottomTabInset;
}

const ADD_BUTTON_SPACE = 76;

/**
 * Khung chung cho mỗi tab: header xanh (tên app, chọn tháng, nút cài đặt),
 * vùng nội dung bo góc cuộn được, và nút "Thêm ngày công" cố định phía dưới nếu cần.
 */
export function Screen({
  title = 'Lịch Lương Hàn Quốc',
  monthNav = true,
  showAddButton = false,
  children,
}: {
  title?: string;
  monthNav?: boolean;
  showAddButton?: boolean;
  children?: ReactNode;
}) {
  const insets = useSafeAreaInsets();
  const bottomInset = useBottomInset();
  const theme = useTheme();
  const { month, setMonth } = useApp();

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <StatusBar style="light" />
      <View style={{ height: insets.top, backgroundColor: theme.primary }} />
      <ScrollView
        style={styles.container}
        contentContainerStyle={[
          styles.scroll,
          { paddingBottom: bottomInset + (showAddButton ? ADD_BUTTON_SPACE : 0) + Spacing.three },
        ]}
        keyboardShouldPersistTaps="handled">
        <View style={[styles.header, { backgroundColor: theme.primary }]}>
          <View style={styles.headerIcon}>
            <Icon name="calendar" size={26} color={theme.onPrimary} />
          </View>
          <View style={styles.headerText}>
            <Text style={[styles.title, { color: theme.onPrimary }]} numberOfLines={1}>
              {title}
            </Text>
            {monthNav ? (
              <View style={styles.monthNav}>
                <NavButton icon="prev" label="Tháng trước" onPress={() => setMonth(shiftMonth(month, -1))} />
                <Pressable
                  onPress={() => setMonth(monthOf(todayKst()))}
                  accessibilityRole="button"
                  accessibilityHint="Về tháng hiện tại">
                  <Text style={[styles.monthLabel, { color: theme.onPrimary }]}>{monthLabel(month)}</Text>
                </Pressable>
                <NavButton icon="next" label="Tháng sau" onPress={() => setMonth(shiftMonth(month, 1))} />
              </View>
            ) : null}
          </View>
          <Pressable
            onPress={() => router.navigate('/settings')}
            accessibilityRole="button"
            accessibilityLabel="Cài đặt"
            hitSlop={8}
            style={({ pressed }) => [styles.gear, pressed && styles.pressed]}>
            <Icon name="settings" size={26} color={theme.onPrimary} />
          </Pressable>
        </View>

        <View style={[styles.sheet, { backgroundColor: theme.surface }]}>{children}</View>
      </ScrollView>

      {showAddButton ? <AddDayButton bottom={bottomInset + Spacing.three} /> : null}
    </View>
  );
}

function NavButton({ icon, label, onPress }: { icon: 'prev' | 'next'; label: string; onPress: () => void }) {
  const theme = useTheme();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      hitSlop={6}
      style={({ pressed }) => [styles.navButton, pressed && styles.pressed]}>
      <Icon name={icon} size={18} color={theme.onPrimary} />
    </Pressable>
  );
}

/** Nút "Thêm ngày công": mở hôm nay nếu đang xem tháng này, nếu không thì mở ngày 1. */
function AddDayButton({ bottom }: { bottom: number }) {
  const theme = useTheme();
  const { month, openDay } = useApp();
  const today = todayKst();

  return (
    <View pointerEvents="box-none" style={[styles.addWrap, { bottom }]}>
      <Pressable
        onPress={() => openDay(monthOf(today) === month ? today : `${month}-01`)}
        accessibilityRole="button"
        style={({ pressed }) => [
          styles.addButton,
          { backgroundColor: theme.primary, shadowColor: theme.primary },
          pressed && styles.pressed,
        ]}>
        <Icon name="calendarAdd" size={22} color={theme.onPrimary} />
        <Text style={[styles.addText, { color: theme.onPrimary }]}>Thêm ngày công</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scroll: {
    flexGrow: 1,
    width: '100%',
    maxWidth: MaxContentWidth,
    alignSelf: 'center',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 18,
    paddingTop: 18,
    paddingBottom: 46,
  },
  headerIcon: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.18)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerText: { flex: 1, gap: 2 },
  title: { fontSize: 21, lineHeight: 26, fontWeight: 800 },
  monthNav: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  monthLabel: { fontSize: 15, opacity: 0.92, minWidth: 132, textAlign: 'center' },
  navButton: {
    width: 28,
    height: 28,
    borderRadius: 8,
    backgroundColor: 'rgba(255,255,255,0.16)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  gear: { padding: 6 },
  pressed: { opacity: 0.7 },
  sheet: {
    flexGrow: 1,
    marginTop: -26,
    borderTopLeftRadius: 22,
    borderTopRightRadius: 22,
    paddingTop: 14,
    paddingHorizontal: 12,
    gap: 12,
  },
  addWrap: {
    position: 'absolute',
    left: 16,
    right: 16,
    alignItems: 'center',
  },
  addButton: {
    width: '100%',
    maxWidth: MaxContentWidth - 32,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
    borderRadius: 999,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.35,
    shadowRadius: 12,
    elevation: 6,
  },
  addText: { fontSize: 16, fontWeight: 700 },
});
