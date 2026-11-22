// Trạng thái giao diện dùng chung giữa các tab: tháng đang xem, ngày đang mở bảng chấm công, thông báo ngắn.
import { create } from 'zustand';

import { monthOf, todayKst } from './month';

interface UiState {
  /** Tháng đang xem "YYYY-MM" */
  month: string;
  /** Ngày đang mở trong bảng chấm công, null khi đóng */
  editingDate: string | null;
  toastMessage: string | null;
}

export const useUiStore = create<UiState>(() => ({
  month: monthOf(todayKst()),
  editingDate: null,
  toastMessage: null,
}));

export const setMonth = (month: string) => useUiStore.setState({ month });
export const openDay = (date: string) => useUiStore.setState({ editingDate: date });
export const closeDay = () => useUiStore.setState({ editingDate: null });

let toastTimer: ReturnType<typeof setTimeout> | null = null;
export function toast(message: string): void {
  useUiStore.setState({ toastMessage: message });
  if (toastTimer) clearTimeout(toastTimer);
  toastTimer = setTimeout(() => useUiStore.setState({ toastMessage: null }), 2200);
}
