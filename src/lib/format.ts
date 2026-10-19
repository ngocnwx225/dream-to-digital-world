// All monetary values are stored and displayed in "nghìn đồng" (thousand VND).
export const MONEY_UNIT = "nghìn đồng";

export function toNum(v: unknown): number {
  const n = typeof v === "number" ? v : parseFloat(String(v ?? 0));
  return Number.isFinite(n) ? n : 0;
}

/** Format a number in nghìn đồng, up to `max` decimals, vi-VN separators. */
export function fmtNum(v: unknown, max = 3): string {
  return toNum(v).toLocaleString("vi-VN", { maximumFractionDigits: max });
}

export function fmtMoney(v: unknown, withUnit = false): string {
  const s = fmtNum(v, 3);
  return withUnit ? `${s} ${MONEY_UNIT}` : s;
}

export function fmtPct(v: number): string {
  return `${v.toLocaleString("vi-VN", { maximumFractionDigits: 1 })}%`;
}

export function fmtDate(d: string | Date | null | undefined): string {
  if (!d) return "";
  const dt = typeof d === "string" ? new Date(d.length === 10 ? d + "T00:00:00" : d) : d;
  return dt.toLocaleDateString("vi-VN", { day: "2-digit", month: "2-digit", year: "numeric" });
}

export function todayISO(): string {
  const d = new Date();
  const z = new Date(d.getTime() - d.getTimezoneOffset() * 60000);
  return z.toISOString().slice(0, 10);
}

export function monthRange(year: number, month: number) {
  const pad = (n: number) => String(n).padStart(2, "0");
  const last = new Date(year, month, 0).getDate();
  return { from: `${year}-${pad(month)}-01`, to: `${year}-${pad(month)}-${pad(last)}`, days: last };
}

export function prevMonth(year: number, month: number) {
  return month === 1 ? { year: year - 1, month: 12 } : { year, month: month - 1 };
}

export function pctChange(cur: number, prev: number): number | null {
  if (!prev) return null;
  return ((cur - prev) / Math.abs(prev)) * 100;
}

export function errMsg(e: unknown): string {
  const m = (e as { message?: string })?.message;
  return m || "Có lỗi xảy ra, vui lòng thử lại";
}
