// All monetary values are stored and displayed in "nghìn đồng" (thousand VND).
// Never multiply by 1000 for display: 850 means 850 nghìn đồng.
export const MONEY_UNIT = "nghìn đồng";
export const MONEY_UNIT_SHORT = "nghìn đ";

export function toNum(v: unknown): number {
  const n = typeof v === "number" ? v : parseFloat(String(v ?? 0));
  return Number.isFinite(n) ? n : 0;
}

/** Format a number with vi-VN separators, up to `max` decimals. */
export function fmtNum(v: unknown, max = 3): string {
  return toNum(v).toLocaleString("vi-VN", { maximumFractionDigits: max });
}

export function fmtMoney(v: unknown, withUnit = false): string {
  const s = fmtNum(v, 3);
  return withUnit ? `${s} ${MONEY_UNIT}` : s;
}

/** Unit costs can be fractional (254 / 5 = 50,8; 100 / 3 = 33,3333). */
export function fmtUnitCost(v: unknown): string {
  return fmtNum(v, 4);
}

export function fmtPct(v: number): string {
  return `${v.toLocaleString("vi-VN", { maximumFractionDigits: 1 })}%`;
}

export function fmtDate(d: string | Date | null | undefined): string {
  if (!d) return "";
  const dt = typeof d === "string" ? new Date(d.length === 10 ? d + "T00:00:00" : d) : d;
  return dt.toLocaleDateString("vi-VN", { day: "2-digit", month: "2-digit", year: "numeric" });
}

export function fmtDateTime(d: string | null | undefined): string {
  if (!d) return "";
  return new Date(d).toLocaleString("vi-VN", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

export function todayISO(): string {
  const d = new Date();
  const z = new Date(d.getTime() - d.getTimezoneOffset() * 60000);
  return z.toISOString().slice(0, 10);
}

const pad = (n: number) => String(n).padStart(2, "0");

export function monthRange(year: number, month: number) {
  const last = new Date(year, month, 0).getDate();
  return { from: `${year}-${pad(month)}-01`, to: `${year}-${pad(month)}-${pad(last)}`, days: last };
}

export function yearRange(year: number) {
  return { from: `${year}-01-01`, to: `${year}-12-31` };
}

export function prevMonth(year: number, month: number) {
  return month === 1 ? { year: year - 1, month: 12 } : { year, month: month - 1 };
}

export function pctChange(cur: number, prev: number): number | null {
  if (!prev) return null;
  return ((cur - prev) / Math.abs(prev)) * 100;
}

const FALLBACK_ERROR = "Có lỗi xảy ra, vui lòng thử lại";

/** Turn backend/auth errors into Vietnamese messages for toasts. */
export function errMsg(e: unknown): string {
  const m = (e as { message?: string })?.message ?? "";
  if (!m) return FALLBACK_ERROR;
  if (/invalid login credentials/i.test(m)) return "Email hoặc mật khẩu không đúng";
  if (/email not confirmed/i.test(m)) return "Email chưa được xác nhận. Vui lòng kiểm tra hộp thư.";
  if (/database error saving new user/i.test(m)) return "Đăng ký đã bị khóa. Hệ thống chỉ có một chủ cửa hàng.";
  if (/password should be at least/i.test(m)) return "Mật khẩu phải có ít nhất 6 ký tự";
  if (/failed to fetch|network/i.test(m)) return "Không kết nối được máy chủ. Vui lòng kiểm tra mạng.";
  if (/row-level security|permission denied/i.test(m)) return "Không có quyền thực hiện thao tác này";
  // The deployed database is behind the code: a migration hasn't been applied yet.
  if (/requires a where clause|could not find the function|column .* does not exist|schema cache/i.test(m)) {
    return `Cơ sở dữ liệu chưa được cập nhật – cần áp dụng migration mới nhất. (${m})`;
  }
  // Database exceptions raised by our functions are already Vietnamese.
  if (/[à-ỹ]/i.test(m)) return m;
  // Keep the original text so problems can be diagnosed instead of hidden.
  return `${FALLBACK_ERROR} (${m})`;
}
