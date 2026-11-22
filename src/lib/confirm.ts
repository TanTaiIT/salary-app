import { Alert, Platform } from 'react-native';

/** Hỏi xác nhận trước thao tác xóa. Alert của react-native-web không có nút, nên web dùng window.confirm. */
export function confirmAsync(title: string, message: string, okLabel = 'Xóa'): Promise<boolean> {
  if (Platform.OS === 'web') {
    return Promise.resolve(globalThis.confirm?.(`${title}\n\n${message}`) ?? false);
  }
  return new Promise((resolve) => {
    Alert.alert(
      title,
      message,
      [
        { text: 'Hủy', style: 'cancel', onPress: () => resolve(false) },
        { text: okLabel, style: 'destructive', onPress: () => resolve(true) },
      ],
      { cancelable: true, onDismiss: () => resolve(false) },
    );
  });
}
