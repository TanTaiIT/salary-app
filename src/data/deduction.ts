// Khấu trừ chỉ để ước tính lương thực nhận (docs/spec.md: người dùng tự chọn tỉ lệ).
// Số tiền tính bằng src/payroll để app và server ra cùng một con số.
import { deductionAmount } from '@/payroll/index.ts';

export const DEDUCTION_PRESETS = [
  { value: 0, label: 'Không khấu trừ' },
  { value: 3.3, label: 'Thuế 3,3%' },
  { value: 9.4, label: '4 bảo hiểm (~9,4%)' },
] as const;

export function deductionLabel(rate: number): string {
  if (rate === 3.3) return 'Thuế 3,3%';
  if (rate === 9.4) return '4 bảo hiểm (ước tính 9,4%)';
  return `Khấu trừ ${String(rate).replace('.', ',')}%`;
}

/** Nhãn và số tiền khấu trừ; null khi không khấu trừ. */
export function deduction(total: number, rate: number): { label: string; amount: number } | null {
  if (!(rate > 0)) return null;
  return { label: deductionLabel(rate), amount: deductionAmount(total, rate) };
}
