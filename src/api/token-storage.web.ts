// SecureStore không có trên web; bản web chỉ để xem thử nên lưu vào localStorage.
const KEY = 'llhq.session';

export async function readSecret(): Promise<string | null> {
  try {
    return globalThis.localStorage?.getItem(KEY) ?? null;
  } catch {
    return null;
  }
}

export async function writeSecret(value: string | null): Promise<void> {
  try {
    if (value === null) globalThis.localStorage?.removeItem(KEY);
    else globalThis.localStorage?.setItem(KEY, value);
  } catch {
    // Trình duyệt chặn lưu: phiên chỉ còn trong lần mở này
  }
}
