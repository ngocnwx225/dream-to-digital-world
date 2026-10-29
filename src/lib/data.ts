import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toNum, todayISO } from "./format";

export type Product = {
  id: string; code: string; name: string; unit: string; sale_price: number;
  low_stock_threshold: number | null; note: string | null; is_active: boolean; created_at: string;
};
export type Balance = {
  product_id: string; quantity: number; avg_cost: number; value: number;
  total_in: number; total_out: number; opening_qty: number;
};
export type Customer = {
  id: string; code: string; name: string; phone: string | null; vehicle_name: string | null;
  plate: string | null; note: string | null; created_at: string;
};
export type Settings = {
  store_name: string; default_low_stock: number; consumable_cost_per_vehicle: number;
  /** Absent until the branding columns are migrated. */
  logo_url?: string | null; brand_color?: string | null; brand_subtitle?: string | null;
};
export type DocStatus = "completed" | "cancelled";

type Result = { data: unknown; error: { message: string } | null };

export async function must<T>(p: PromiseLike<Result>): Promise<T> {
  const { data, error } = await p;
  if (error) throw error;
  return data as T;
}

const PAGE = 1000;

/** PostgREST caps responses at 1000 rows; page through so reports never silently truncate. */
export async function fetchAll<T>(make: () => { range: (from: number, to: number) => PromiseLike<Result> }): Promise<T[]> {
  const out: T[] = [];
  for (let from = 0; ; from += PAGE) {
    const rows = await must<T[]>(make().range(from, from + PAGE - 1));
    out.push(...rows);
    if (rows.length < PAGE) return out;
  }
}

/** Numeric columns can arrive as strings; normalise the named keys to numbers. */
function nums<T extends object>(row: T, keys: (keyof T)[]): T {
  const r = { ...row };
  for (const k of keys) (r as Record<keyof T, unknown>)[k] = toNum(r[k]);
  return r;
}

export function useInvalidateAll() {
  const qc = useQueryClient();
  return () => qc.invalidateQueries();
}

// ---------- master data ----------

export function useProducts() {
  return useQuery({
    queryKey: ["products"],
    queryFn: async () =>
      (await fetchAll<Product>(() => supabase.from("products").select("*").order("code"))).map((p) =>
        ({ ...nums(p, ["sale_price"]), low_stock_threshold: p.low_stock_threshold == null ? null : toNum(p.low_stock_threshold) }),
      ),
  });
}

export function useBalances() {
  return useQuery({
    queryKey: ["balances"],
    queryFn: async () => {
      const rows = await fetchAll<Balance>(() => supabase.from("inventory_balances").select("*").order("product_id"));
      const map = new Map<string, Balance>();
      rows.forEach((r) => map.set(r.product_id, nums(r, ["quantity", "avg_cost", "value", "total_in", "total_out", "opening_qty"])));
      return map;
    },
  });
}

export function useCustomers() {
  return useQuery({
    queryKey: ["customers"],
    queryFn: () => fetchAll<Customer>(() => supabase.from("customers").select("*").order("created_at", { ascending: false })),
  });
}

export function useCustomer(id: string) {
  return useQuery({
    queryKey: ["customers", id],
    queryFn: () => must<Customer | null>(supabase.from("customers").select("*").eq("id", id).maybeSingle()),
  });
}

export function useSettings() {
  return useQuery({
    queryKey: ["settings"],
    queryFn: async () => {
      const s = await must<Settings>(supabase.from("settings").select("*").eq("id", 1).single());
      return { ...s, default_low_stock: toNum(s.default_low_stock), consumable_cost_per_vehicle: toNum(s.consumable_cost_per_vehicle) };
    },
  });
}

export function useProfile() {
  return useQuery({
    queryKey: ["profile"],
    queryFn: async () => {
      const { data } = await supabase.auth.getUser();
      const user = data.user;
      if (!user) return null;
      const p = await must<{ full_name: string | null; email: string | null } | null>(
        supabase.from("profiles").select("full_name, email").eq("id", user.id).maybeSingle(),
      );
      return { id: user.id, email: user.email ?? p?.email ?? "", full_name: p?.full_name ?? "" };
    },
  });
}

export function lowStockOf(p: Product, defaultLow: number) {
  return p.low_stock_threshold != null ? p.low_stock_threshold : defaultLow;
}

export type StockState = "out" | "low" | "ok";
export function stockState(qty: number, threshold: number): StockState {
  if (qty <= 0) return "out";
  if (qty <= threshold) return "low";
  return "ok";
}

// ---------- sales ----------

export type SaleItemRow = {
  id: string; order_id: string; product_id: string; quantity: number; unit_price: number; amount: number;
  unit_cost: number; cost_amount: number;
  sales_orders: {
    id: string; code: string; order_date: string; status: DocStatus; customer_name: string | null; customer_id: string | null;
    consumable_total_cost: number;
  };
};

/** Completed sale lines between two dates (inclusive) — the single source for revenue and COGS. */
export function useSaleItems(from: string, to: string) {
  return useQuery({
    queryKey: ["sale-items", from, to],
    queryFn: async () => {
      const rows = await fetchAll<SaleItemRow>(() =>
        supabase
          .from("sales_order_items")
          .select("id, order_id, product_id, quantity, unit_price, amount, unit_cost, cost_amount, sales_orders!inner(id, code, order_date, status, customer_name, customer_id, consumable_total_cost)")
          .eq("sales_orders.status", "completed")
          .gte("sales_orders.order_date", from)
          .lte("sales_orders.order_date", to)
          .order("id"),
      );
      return rows.map((r) => ({
        ...nums(r, ["quantity", "unit_price", "amount", "unit_cost", "cost_amount"]),
        sales_orders: nums(r.sales_orders, ["consumable_total_cost"]),
      }));
    },
  });
}

export type SaleOrderListRow = {
  id: string; code: string; order_date: string; created_at: string; customer_id: string | null; customer_name: string | null;
  phone: string | null; plate: string | null; vehicle_name: string | null; note: string | null; status: DocStatus;
  total_qty: number; total_amount: number; total_cost: number;
  /** null = order saved before consumable costs existed (no retroactive charge) */
  vehicle_count: number | null; consumable_unit_cost: number | null; consumable_total_cost: number;
  sales_order_items: { product_id: string; quantity: number; products: { name: string } | null }[];
};

const SALE_LIST_SELECT =
  "id, code, order_date, created_at, customer_id, customer_name, phone, plate, vehicle_name, note, status, total_qty, total_amount, total_cost, vehicle_count, consumable_unit_cost, consumable_total_cost, sales_order_items(product_id, quantity, products(name))";

export function useSales(filter: { from?: string; to?: string; customerId?: string } = {}) {
  return useQuery({
    queryKey: ["sales", filter],
    queryFn: async () => {
      const rows = await fetchAll<SaleOrderListRow>(() => {
        let q = supabase.from("sales_orders").select(SALE_LIST_SELECT);
        if (filter.from) q = q.gte("order_date", filter.from);
        if (filter.to) q = q.lte("order_date", filter.to);
        if (filter.customerId) q = q.eq("customer_id", filter.customerId);
        return q.order("order_date", { ascending: false }).order("created_at", { ascending: false });
      });
      return rows.map(normaliseOrder);
    },
  });
}

function normaliseOrder<T extends Omit<SaleOrderListRow, "sales_order_items">>(o: T): T {
  return {
    ...nums(o, ["total_qty", "total_amount", "total_cost", "consumable_total_cost"]),
    consumable_unit_cost: o.consumable_unit_cost == null ? null : toNum(o.consumable_unit_cost),
  };
}

export type SaleOrderDetail = Omit<SaleOrderListRow, "sales_order_items"> & {
  cancel_reason: string | null; updated_at: string;
  customers: { id: string; code: string; name: string } | null;
  sales_order_items: {
    id: string; product_id: string; quantity: number; unit_price: number; amount: number; unit_cost: number; cost_amount: number;
    products: { code: string; name: string; unit: string } | null;
  }[];
};

export function useSaleOrder(id: string) {
  return useQuery({
    queryKey: ["sales", "detail", id],
    queryFn: async () => {
      const o = await must<SaleOrderDetail | null>(
        supabase
          .from("sales_orders")
          .select("*, customers(id, code, name), sales_order_items(id, product_id, quantity, unit_price, amount, unit_cost, cost_amount, created_at, products(code, name, unit))")
          .eq("id", id)
          .order("created_at", { referencedTable: "sales_order_items" })
          .maybeSingle(),
      );
      if (!o) return null;
      return {
        ...normaliseOrder(o),
        sales_order_items: o.sales_order_items.map((i) => nums(i, ["quantity", "unit_price", "amount", "unit_cost", "cost_amount"])),
      };
    },
  });
}

// ---------- purchases ----------

export type PurchaseListRow = {
  id: string; code: string; receipt_date: string; created_at: string; note: string | null; status: DocStatus;
  total_qty: number; total_amount: number;
  purchase_items: { product_id: string; quantity: number; products: { name: string } | null }[];
};

export function usePurchases(filter: { from?: string; to?: string } = {}) {
  return useQuery({
    queryKey: ["purchases", filter],
    queryFn: async () => {
      const rows = await fetchAll<PurchaseListRow>(() => {
        let q = supabase
          .from("purchase_receipts")
          .select("id, code, receipt_date, created_at, note, status, total_qty, total_amount, purchase_items(product_id, quantity, products(name))");
        if (filter.from) q = q.gte("receipt_date", filter.from);
        if (filter.to) q = q.lte("receipt_date", filter.to);
        return q.order("receipt_date", { ascending: false }).order("created_at", { ascending: false });
      });
      return rows.map((r) => nums(r, ["total_qty", "total_amount"]));
    },
  });
}

export type PurchaseDetail = Omit<PurchaseListRow, "purchase_items"> & {
  cancel_reason: string | null; updated_at: string;
  purchase_items: { id: string; product_id: string; quantity: number; unit_cost: number; amount: number; products: { code: string; name: string; unit: string } | null }[];
};

export function usePurchase(id: string) {
  return useQuery({
    queryKey: ["purchases", "detail", id],
    queryFn: async () => {
      const r = await must<PurchaseDetail | null>(
        supabase
          .from("purchase_receipts")
          .select("*, purchase_items(id, product_id, quantity, unit_cost, amount, created_at, products(code, name, unit))")
          .eq("id", id)
          .order("created_at", { referencedTable: "purchase_items" })
          .maybeSingle(),
      );
      if (!r) return null;
      return {
        ...nums(r, ["total_qty", "total_amount"]),
        purchase_items: r.purchase_items.map((i) => nums(i, ["quantity", "unit_cost", "amount"])),
      };
    },
  });
}

// ---------- inventory ----------

export type Movement = {
  id: string; product_id: string; movement_date: string; seq: number; movement_type: "opening" | "purchase" | "sale";
  doc_code: string | null; ref_id: string | null; qty_change: number; qty_after: number; unit_cost: number | null;
  avg_cost_after: number; value_after: number;
};

export function useMovements(productId: string | null) {
  return useQuery({
    queryKey: ["movements", productId],
    enabled: !!productId,
    queryFn: async () => {
      const rows = await fetchAll<Movement>(() =>
        supabase.from("inventory_movements").select("*").eq("product_id", productId!).order("seq", { ascending: false }),
      );
      return rows.map((m) => ({
        ...nums(m, ["qty_change", "qty_after", "avg_cost_after", "value_after"]),
        unit_cost: m.unit_cost == null ? null : toNum(m.unit_cost),
      }));
    },
  });
}

export type Opening = { id: string; product_id: string; opening_date: string; quantity: number; unit_cost: number; amount: number };

export function useOpenings() {
  return useQuery({
    queryKey: ["openings"],
    queryFn: async () => {
      const rows = await fetchAll<Opening>(() => supabase.from("inventory_opening_balances").select("*").order("product_id"));
      const map = new Map<string, Opening>();
      rows.forEach((r) => map.set(r.product_id, nums(r, ["quantity", "unit_cost", "amount"])));
      return map;
    },
  });
}

/**
 * Inventory value at the end of `date`. For today or later it is the live balance;
 * for past dates it is the last movement per product on or before that date.
 */
export function useInventoryValueAt(date: string) {
  const live = date >= todayISO();
  return useQuery({
    queryKey: ["inventory-value", live ? "live" : date],
    queryFn: async () => {
      if (live) {
        const rows = await fetchAll<{ value: number }>(() => supabase.from("inventory_balances").select("value").order("product_id"));
        return rows.reduce((s, r) => s + toNum(r.value), 0);
      }
      const rows = await fetchAll<{ product_id: string; seq: number; value_after: number }>(() =>
        supabase
          .from("inventory_movements")
          .select("product_id, seq, value_after")
          .lte("movement_date", date)
          .order("product_id")
          .order("seq"),
      );
      const last = new Map<string, number>();
      rows.forEach((r) => last.set(r.product_id, toNum(r.value_after)));
      return [...last.values()].reduce((s, v) => s + v, 0);
    },
  });
}

// ---------- dashboard ----------

export type RecentTx = {
  kind: "sale" | "purchase"; id: string; code: string; date: string; created_at: string;
  customer: string | null; products: string; qty: number; amount: number;
};

export function useRecentTransactions(limit = 8) {
  return useQuery({
    queryKey: ["sales", "purchases", "recent", limit],
    queryFn: async () => {
      const [sales, purchases] = await Promise.all([
        must<SaleOrderListRow[]>(
          supabase.from("sales_orders").select(SALE_LIST_SELECT).eq("status", "completed")
            .order("order_date", { ascending: false }).order("created_at", { ascending: false }).limit(limit),
        ),
        must<PurchaseListRow[]>(
          supabase.from("purchase_receipts")
            .select("id, code, receipt_date, created_at, note, status, total_qty, total_amount, purchase_items(product_id, quantity, products(name))")
            .eq("status", "completed")
            .order("receipt_date", { ascending: false }).order("created_at", { ascending: false }).limit(limit),
        ),
      ]);
      const rows: RecentTx[] = [
        ...sales.map((s) => ({
          kind: "sale" as const, id: s.id, code: s.code, date: s.order_date, created_at: s.created_at,
          customer: s.customer_name, products: productNames(s.sales_order_items), qty: toNum(s.total_qty), amount: toNum(s.total_amount),
        })),
        ...purchases.map((p) => ({
          kind: "purchase" as const, id: p.id, code: p.code, date: p.receipt_date, created_at: p.created_at,
          customer: null, products: productNames(p.purchase_items), qty: toNum(p.total_qty), amount: toNum(p.total_amount),
        })),
      ];
      return rows
        .sort((a, b) => b.date.localeCompare(a.date) || b.created_at.localeCompare(a.created_at))
        .slice(0, limit);
    },
  });
}

/** "SMK, Bố thắng +2" style summary of the products on a document. */
export function productNames(items: { products: { name: string } | null }[], max = 2): string {
  const names = [...new Set(items.map((i) => i.products?.name ?? "?"))];
  return names.length <= max ? names.join(", ") : `${names.slice(0, max).join(", ")} +${names.length - max}`;
}
