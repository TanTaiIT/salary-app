import { StyleSheet, Text, View } from 'react-native';
import Animated, { FadeInDown, FadeOut } from 'react-native-reanimated';

import { useBottomInset } from '@/components/screen';
import { useApp } from '@/data/app-store';
import { useTheme } from '@/hooks/use-theme';

/**
 * Thông báo ngắn ("Đã lưu ngày công"), mặc định nằm trên nút Thêm ngày công.
 * `bottom`: khoảng cách tới đáy màn hình, dùng khi đặt Toast trong một Modal (Modal che Toast ở gốc app).
 */
export function Toast({ bottom: fixedBottom }: { bottom?: number } = {}) {
  const { toastMessage } = useApp();
  const theme = useTheme();
  const defaultBottom = useBottomInset() + 90;
  const bottom = fixedBottom ?? defaultBottom;

  return (
    <View pointerEvents="none" style={[styles.wrap, { bottom }]}>
      {toastMessage ? (
        <Animated.View
          key={toastMessage}
          entering={FadeInDown.duration(180)}
          exiting={FadeOut.duration(180)}
          accessibilityLiveRegion="polite"
          style={[styles.toast, { backgroundColor: theme.text }]}>
          <Text style={[styles.text, { color: theme.surface }]}>{toastMessage}</Text>
        </Animated.View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { position: 'absolute', left: 16, right: 16, alignItems: 'center', zIndex: 30 },
  toast: { borderRadius: 999, paddingVertical: 10, paddingHorizontal: 18 },
  text: { fontSize: 14 },
});
