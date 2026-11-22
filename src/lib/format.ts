/** 3245000 -> "3.245.000 ₩" (docs/spec.md, mục Yêu cầu phi chức năng). */
export function formatWon(amount: number): string {
  return `${formatNumber(amount)} ₩`;
}

/** 3245000 -> "3.245.000" */
export function formatNumber(amount: number): string {
  const digits = Math.trunc(Math.abs(amount))
    .toString()
    .replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  return `${amount < 0 ? '-' : ''}${digits}`;
}

/** Tiền rút gọn trong ô lịch: 103200 -> "103k", 41280 -> "41,3k" */
export function formatK(amount: number): string {
  const k = amount / 1000;
  const oneDecimal = Math.round(k * 10) / 10;
  if (k >= 100 || Number.isInteger(oneDecimal)) return `${Math.round(k)}k`;
  return `${oneDecimal.toString().replace('.', ',')}k`;
}

/** 7.5 -> "7,5h" */
export function formatHours(hours: number): string {
  return `${formatDecimal(hours)}h`;
}

export function formatDecimal(n: number): string {
  return Number.isInteger(n) ? String(n) : String(n).replace('.', ',');
}

/** "2026-11-22" -> "22/11" */
export function formatDayMonth(date: string): string {
  const [, m, d] = date.split('-');
  return `${Number(d)}/${Number(m)}`;
}

/** Chỉ giữ chữ số: "10.320 ₩" -> 10320 */
export function parseWon(text: string): number {
  return parseInt(text.replace(/\D/g, ''), 10) || 0;
}
