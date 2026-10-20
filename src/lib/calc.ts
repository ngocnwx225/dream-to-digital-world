// Pure business math shared by forms and reports. Money is in nghìn đồng, 3 decimals;
// unit costs keep 6 decimals (matching the database columns) so totals don't drift.

export function round3(n: number) {
  return Math.round((n + Number.EPSILON) * 1000) / 1000;
}

export function round6(n: number) {
  return Math.round((n + Number.EPSILON) * 1e6) / 1e6;
}

/** Đơn giá nhập = Thành tiền nhập / Số lượng */
export function unitFromAmount(amount: number, qty: number): number {
  return qty > 0 ? round6(amount / qty) : 0;
}

/** Thành tiền = Số lượng × Đơn giá */
export function amountFromUnit(unit: number, qty: number): number {
  return round3(unit * qty);
}

/**
 * Parse a user-typed decimal. Accepts "50.8" and "50,8" (Vietnamese decimal comma).
 * Thousand separators are not supported in inputs, so "1.234" means 1.234.
 */
export function parseDecimal(s: string | number | null | undefined): number | null {
  if (typeof s === "number") return Number.isFinite(s) ? s : null;
  if (s == null) return null;
  const t = s.trim().replace(",", ".");
  if (t === "" || !/^-?\d*\.?\d*$/.test(t) || t === "." || t === "-") return null;
  const n = Number(t);
  return Number.isFinite(n) ? n : null;
}

/** Keep only characters that can form a non-negative decimal while typing. */
export function sanitizeDecimalInput(s: string): string {
  let out = s.replace(/[^\d.,]/g, "");
  const i = out.search(/[.,]/);
  if (i >= 0) out = out.slice(0, i + 1) + out.slice(i + 1).replace(/[.,]/g, "");
  return out;
}

/** Show a stored number in an input using the Vietnamese decimal comma. */
export function toInputString(n: number | null | undefined, maxDecimals = 6): string {
  if (n == null || !Number.isFinite(n)) return "";
  return String(Number(n.toFixed(maxDecimals))).replace(".", ",");
}

/**
 * A purchase/opening line where quantity, unit cost and total stay consistent.
 * `driver` remembers whether the user last typed the total or the unit cost, so editing
 * quantity recomputes the other one; each edit computes once, so there's no update loop.
 * The total is the value of record (it feeds inventory valuation); unit cost is derived.
 */
export type CostLine = { quantity: string; unit_cost: string; amount: string; driver: "amount" | "unit" };

export function updateCostLine(line: CostLine, field: "quantity" | "unit_cost" | "amount", value: string): CostLine {
  const next: CostLine = { ...line, [field]: value };
  if (field === "unit_cost") next.driver = "unit";
  if (field === "amount") next.driver = "amount";
  const q = parseDecimal(next.quantity);
  if (q == null || q <= 0) return next;
  if (next.driver === "amount") {
    const a = parseDecimal(next.amount);
    if (a != null) next.unit_cost = toInputString(unitFromAmount(a, q), 4);
  } else {
    const u = parseDecimal(next.unit_cost);
    if (u != null) next.amount = toInputString(amountFromUnit(u, q), 3);
  }
  return next;
}

export type ProductAgg = { product_id: string; name: string; qty: number; revenue: number; cost: number; profit: number; margin: number };

/** Group sale lines by product; profit uses each line's own recorded cost of goods sold. */
export function aggregateSales(
  items: { product_id: string; quantity: number; amount: number; cost_amount: number }[],
  nameOf: (id: string) => string,
): ProductAgg[] {
  const m = new Map<string, { product_id: string; name: string; qty: number; revenue: number; cost: number }>();
  for (const it of items) {
    const cur = m.get(it.product_id) ?? { product_id: it.product_id, name: nameOf(it.product_id), qty: 0, revenue: 0, cost: 0 };
    cur.qty += it.quantity;
    cur.revenue += it.amount;
    cur.cost += it.cost_amount;
    m.set(it.product_id, cur);
  }
  return [...m.values()]
    .map((r) => {
      const revenue = round3(r.revenue);
      const cost = round3(r.cost);
      const profit = round3(revenue - cost);
      return { ...r, qty: round3(r.qty), revenue, cost, profit, margin: revenue ? (profit / revenue) * 100 : 0 };
    })
    .sort((a, b) => b.revenue - a.revenue);
}

export function totals(rows: { revenue: number; cost: number }[]) {
  const revenue = round3(rows.reduce((s, r) => s + r.revenue, 0));
  const cost = round3(rows.reduce((s, r) => s + r.cost, 0));
  const profit = round3(revenue - cost);
  return { revenue, cost, profit, margin: revenue ? (profit / revenue) * 100 : 0 };
}

// ---------- consumables (vật tư tiêu hao) ----------
// A fixed cost per vehicle on each sales order. It is never billed, never stocked and never
// added to COGS; it is only subtracted at order level and in period totals.

/** Chi phí vật tư tiêu hao = Số xe × chi phí mỗi xe */
export function consumableCost(vehicles: number, ratePerVehicle: number): number {
  return round3(Math.max(0, vehicles) * Math.max(0, ratePerVehicle));
}

/**
 * Sale lines repeat their order's consumable cost; keep it once per order so a 3-product
 * order for one vehicle is charged once, not three times.
 */
export function orderConsumables(lines: { order_id: string; sales_orders: { order_date: string; consumable_total_cost: number } }[]) {
  const m = new Map<string, { date: string; cost: number }>();
  for (const l of lines) if (!m.has(l.order_id)) m.set(l.order_id, { date: l.sales_orders.order_date, cost: l.sales_orders.consumable_total_cost });
  return [...m.values()];
}

/** Lợi nhuận sau vật tư = Doanh thu − Giá vốn hàng bán − Chi phí vật tư tiêu hao */
export function profitAfterConsumables(revenue: number, cogs: number, consumables: number) {
  const profit = round3(revenue - cogs - consumables);
  return { profit, margin: revenue ? (profit / revenue) * 100 : 0 };
}

/** Moving weighted average after receiving stock — mirrors recalc_product in the database. */
export function movingAverage(prevQty: number, prevValue: number, inQty: number, inAmount: number) {
  const qty = prevQty + inQty;
  const value = round3(prevValue + inAmount);
  return { qty, value, avg: qty > 0 ? value / qty : 0 };
}
