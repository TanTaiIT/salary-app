// Lưu phiên đăng nhập bằng SecureStore (Keychain/Keystore), không dùng AsyncStorage (docs/spec.md, Bảo mật).
import * as SecureStore from 'expo-secure-store';

const KEY = 'llhq.session';

export async function readSecret(): Promise<string | null> {
  return SecureStore.getItemAsync(KEY);
}

export async function writeSecret(value: string | null): Promise<void> {
  if (value === null) await SecureStore.deleteItemAsync(KEY);
  else await SecureStore.setItemAsync(KEY, value);
}
