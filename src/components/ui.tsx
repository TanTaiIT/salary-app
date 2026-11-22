// Khối giao diện nhỏ dùng chung: thẻ, ô nhập, nút chọn một trong nhiều.
import type { ReactNode } from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
  type TextInputProps,
  type ViewStyle,
} from 'react-native';

import { useTheme } from '@/hooks/use-theme';

export function Card({ title, children, style }: { title?: string; children: ReactNode; style?: ViewStyle }) {
  const theme = useTheme();
  return (
    <View style={[styles.card, { backgroundColor: theme.surface, borderColor: theme.line }, style]}>
      {title ? <Text style={[styles.cardTitle, { color: theme.text }]}>{title}</Text> : null}
      {children}
    </View>
  );
}

/** Ô nhập một dòng: nhãn bên trái, giá trị canh phải. */
export function Field({ label, ...input }: { label: string } & TextInputProps) {
  const theme = useTheme();
  return (
    <View style={[styles.field, { borderColor: theme.line, backgroundColor: theme.surface }]}>
      <Text style={[styles.fieldLabel, { color: theme.textSecondary }]}>{label}</Text>
      <TextInput
        accessibilityLabel={label}
        placeholderTextColor={theme.textSecondary}
        style={[styles.fieldInput, { color: theme.text }]}
        {...input}
      />
    </View>
  );
}

/** Chọn một trong vài lựa chọn (thay cho <select>). */
export function Segmented<T extends string | number>({
  value,
  options,
  onChange,
  label,
}: {
  value: T;
  options: readonly { value: T; label: string }[];
  onChange: (value: T) => void;
  label: string;
}) {
  const theme = useTheme();
  return (
    <View accessibilityRole="radiogroup" accessibilityLabel={label} style={styles.segmented}>
      {options.map((o) => {
        const selected = o.value === value;
        return (
          <Pressable
            key={String(o.value)}
            accessibilityRole="radio"
            accessibilityState={{ selected }}
            onPress={() => onChange(o.value)}
            style={({ pressed }) => [
              styles.segment,
              {
                borderColor: selected ? theme.primary : theme.line,
                backgroundColor: selected ? theme.primarySoft : theme.surface,
              },
              pressed && { opacity: 0.7 },
            ]}>
            <Text style={[styles.segmentText, { color: selected ? theme.primary : theme.text }]}>{o.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

/** Nút bấm: primary (nền xanh), secondary (viền), danger (chữ đỏ, viền) */
export function Button({
  label,
  onPress,
  variant = 'secondary',
  disabled = false,
  busy = false,
}: {
  label: string;
  onPress: () => void;
  variant?: 'primary' | 'secondary' | 'danger';
  disabled?: boolean;
  busy?: boolean;
}) {
  const theme = useTheme();
  const primary = variant === 'primary';
  const off = disabled || busy;
  return (
    <Pressable
      onPress={onPress}
      disabled={off}
      accessibilityRole="button"
      accessibilityState={{ disabled: off, busy }}
      style={({ pressed }) => [
        styles.button,
        primary
          ? { backgroundColor: theme.primary, borderColor: theme.primary }
          : { backgroundColor: theme.surface, borderColor: theme.line },
        (pressed || off) && { opacity: 0.6 },
      ]}>
      {busy ? <ActivityIndicator color={primary ? theme.onPrimary : theme.textSecondary} style={styles.spinner} /> : null}
      <Text
        style={[
          styles.buttonText,
          { color: primary ? theme.onPrimary : variant === 'danger' ? theme.offText : theme.text },
        ]}>
        {label}
      </Text>
    </Pressable>
  );
}

export function Hint({ children }: { children: ReactNode }) {
  const theme = useTheme();
  return <Text style={[styles.hint, { color: theme.textSecondary }]}>{children}</Text>;
}

export function Label({ children }: { children: ReactNode }) {
  const theme = useTheme();
  return <Text style={[styles.label, { color: theme.textSecondary }]}>{children}</Text>;
}

const styles = StyleSheet.create({
  card: { borderWidth: 1, borderRadius: 18, paddingVertical: 14, paddingHorizontal: 16 },
  cardTitle: { fontSize: 15, fontWeight: 700, marginBottom: 10 },
  field: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 14,
  },
  fieldLabel: { flex: 1, fontSize: 15, paddingVertical: 12 },
  fieldInput: { width: '55%', textAlign: 'right', fontSize: 17, fontWeight: 700, paddingVertical: 12 },
  segmented: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  segment: { borderWidth: 1, borderRadius: 12, paddingVertical: 10, paddingHorizontal: 12, flexGrow: 1 },
  segmentText: { fontSize: 14, fontWeight: 600, textAlign: 'center' },
  hint: { fontSize: 12.5, lineHeight: 18, marginTop: 6 },
  button: {
    marginTop: 10,
    borderWidth: 1,
    borderRadius: 12,
    paddingVertical: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  buttonText: { fontWeight: 600, fontSize: 15 },
  spinner: { marginRight: 2 },
  label: { fontSize: 13, marginTop: 12, marginBottom: 6 },
});
