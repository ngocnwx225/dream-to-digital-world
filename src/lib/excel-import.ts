// Parses the store's Excel workbook (a "Mua vào" table and a "Bán ra" table side by side)
// into rows the importer can preview, correct and save. Pure: no database access here.
import { norm } from "@/components/app/inputs";
import { round3, unitFromAmount } from "./calc";
import type { Cell } from "./xlsx-reader";

export type ParsedDate = { iso: string | null; raw: string };

export type PurchaseRow = {
  key: string; excelRow: number; product: string; quantity: number | null; amount: number | null; date: ParsedDate;
};

export type SaleRow = {
  key: string; excelRow: number; customer: string; phone: string; vehicle: string; product: string;
  unitPrice: number | null; quantity: number | null; amount: number | null; date: ParsedDate;
};

export type ParsedWorkbook = { purchases: PurchaseRow[]; sales: SaleRow[] };

const pad = (n: number) => String(n).padStart(2, "0");

function validYmd(y: number, m: number, d: number): string | null {
  const dt = new Date(Date.UTC(y, m - 1, d));
  if (dt.getUTCFullYear() !== y || dt.getUTCMonth() !== m - 1 || dt.getUTCDate() !== d) return null;
  return `${y}-${pad(m)}-${pad(d)}`;
}

/** Excel date serials, "yyyy-mm-dd[ hh:mm:ss]" and "dd/mm/yyyy"; anything else (e.g. "20/20/2026", "none") → null. */
export function parseExcelDate(c: Cell): ParsedDate {
  if (c == null || c === "") return { iso: null, raw: "" };
  if (typeof c === "number") {
    // 1900 date system: serial 1 = 1900-01-01, with Excel's fictitious 1900-02-29 → epoch 1899-12-30.
    const dt = new Date(Date.UTC(1899, 11, 30) + Math.floor(c) * 86_400_000);
    return { iso: c > 0 ? dt.toISOString().slice(0, 10) : null, raw: String(c) };
  }
  const s = c.trim();
  let m = /^(\d{4})-(\d{1,2})-(\d{1,2})(?:[ T].*)?$/.exec(s);
  if (m) return { iso: validYmd(Number(m[1]), Number(m[2]), Number(m[3])), raw: s };
  m = /^(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})$/.exec(s);
  if (m) return { iso: validYmd(Number(m[3]), Number(m[2]), Number(m[1])), raw: s };
  return { iso: null, raw: s };
}

const num = (c: Cell | undefined): number | null => {
  if (typeof c === "number") return Number.isFinite(c) ? c : null;
  if (typeof c !== "string" || !c.trim()) return null;
  const n = Number(c.trim().replace(",", "."));
  return Number.isFinite(n) ? n : null;
};
const text = (c: Cell | undefined) => (c == null ? "" : String(c).trim());
const isNone = (s: string) => /^(none|null|n\/a|-|không)$/i.test(s.trim());

/** Phone as typed in Excel; "none" and blanks become empty. Leading zeros are kept (stored as text). */
export function cleanPhone(c: Cell | undefined): string {
  const s = text(c);
  if (!s || isNone(s)) return "";
  const digits = s.replace(/[^\d+]/g, "");
  // A number-typed cell loses its leading 0 (857722386 → 0857722386).
  return typeof c === "number" && digits.length === 9 ? `0${digits}` : digits;
}

/**
 * Small supplies covered by the fixed per-vehicle consumable cost (dây rút, băng keo, keo dán,
 * gen co nhiệt) — not stocked, so the importer leaves them out by default.
 */
export function isConsumableName(name: string): boolean {
  return /\b(day rut|bang keo|keo|gen)\b/.test(norm(name));
}

type Cols = Record<string, number>;

/** Locate header labels in a row; returns null if any required label is missing. */
function findCols(row: Cell[], labels: Record<string, string[]>, from = 0, to = row.length - 1): Cols | null {
  const out: Cols = {};
  for (const [key, names] of Object.entries(labels)) {
    const i = row.findIndex((c, idx) => idx >= from && idx <= to && names.includes(norm(text(c))));
    if (i < 0) return null;
    out[key] = i;
  }
  return out;
}

const PURCHASE_LABELS = { product: ["san pham"], qty: ["sl", "so luong"], amount: ["tt", "thanh tien"], date: ["ngay nhap"] };
const SALE_LABELS = {
  name: ["ten", "ten khach", "khach hang"], phone: ["sdt", "so dien thoai"], vehicle: ["xe", "ten xe"], product: ["san pham"],
  price: ["don gia", "gia ban"], qty: ["sl", "so luong"], amount: ["tt", "thanh tien"], date: ["ngay ban"],
};

/** Read both tables from the sheet. Throws a Vietnamese message if the layout isn't recognised. */
export function parseWorkbook(rows: Cell[][]): ParsedWorkbook {
  const headerIdx = rows.findIndex((r) => r.some((c) => norm(text(c)) === "ngay nhap") || r.some((c) => norm(text(c)) === "ngay ban"));
  const header = rows[headerIdx];
  if (!header) throw new Error('Không tìm thấy dòng tiêu đề (cần các cột "Sản phẩm", "SL", "TT", "Ngày nhập" / "Ngày bán").');

  const pDateCol = header.findIndex((c) => norm(text(c)) === "ngay nhap");
  const sDateCol = header.findIndex((c) => norm(text(c)) === "ngay ban");
  const pCols = pDateCol >= 0 ? findCols(header, PURCHASE_LABELS, 0, pDateCol) : null;
  const sCols = sDateCol >= 0 ? findCols(header, SALE_LABELS, pDateCol + 1, sDateCol) : null;
  if (!pCols && !sCols) throw new Error("Không nhận diện được bảng Mua vào hoặc Bán ra trong file.");

  const purchases: PurchaseRow[] = [];
  const sales: SaleRow[] = [];
  for (let i = headerIdx + 1; i < rows.length; i++) {
    const r = rows[i] ?? [];
    const first = norm(text(r[0]));
    // The data block ends at the totals / stock summary rows.
    if (first.startsWith("tong cong") || first === "ton") break;
    if (pCols) {
      const product = text(r[pCols["product"]!]);
      if (product) {
        purchases.push({
          key: `p${i + 1}`, excelRow: i + 1, product,
          quantity: num(r[pCols["qty"]!]), amount: num(r[pCols["amount"]!]), date: parseExcelDate(r[pCols["date"]!] ?? null),
        });
      }
    }
    if (sCols) {
      const product = text(r[sCols["product"]!]);
      if (product) {
        const unitPrice = num(r[sCols["price"]!]);
        const quantity = num(r[sCols["qty"]!]);
        sales.push({
          key: `s${i + 1}`, excelRow: i + 1, customer: text(r[sCols["name"]!]), phone: cleanPhone(r[sCols["phone"]!]),
          vehicle: isNone(text(r[sCols["vehicle"]!])) ? "" : text(r[sCols["vehicle"]!]), product, unitPrice, quantity,
          amount: num(r[sCols["amount"]!]) ?? (unitPrice != null && quantity != null ? round3(unitPrice * quantity) : null),
          date: parseExcelDate(r[sCols["date"]!] ?? null),
        });
      }
    }
  }
  return { purchases, sales };
}

/** Unit cost shown in the preview: Thành tiền / Số lượng. */
export const purchaseUnit = (r: { quantity: number | null; amount: number | null }) =>
  r.quantity && r.amount != null ? unitFromAmount(r.amount, r.quantity) : null;

/** Same customer within one file = same phone, or (no phone) same name. Never merges by name across phones. */
export function customerKey(r: { customer: string; phone: string }): string {
  return r.phone ? `tel:${r.phone}` : `name:${norm(r.customer) || "khach le"}`;
}
