import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toNum } from "./format";

export type Product = {
  id: string; code: string; name: string; unit: string; sale_price: number;
  low_stock_threshold: number | null; note: string | null; is_active: boolean;
};
export type Balance = {
  product_id: string; quantity: number; avg_cost: number; value: number;
  total_in: number; total_out: number; opening_qty: number;
};
export type Customer = {
  id: string; code: string; name: string; phone: string | null; vehicle_name: string | null;
  plate: string | null; note: string | null; created_at: string;
};

async function must<T>(p: PromiseLike<{ data: T | null; error: { message: string } | null }>): Promise<T> {
  const { data, error } = await p;
  if (error) throw error;
  return data as T;
}

export function useProducts() {
  return useQuery({
    queryKey: ["products"],
    queryFn: () => must<Product[]>(supabase.from("products").select("*").order("code")),
  });
}

export function useBalances() {
  return useQuery({
    queryKey: ["balances"],
    queryFn: async () => {
      const rows = await must<Balance[]>(supabase.from("inventory_balances").select("*"));
      const map = new Map<string, Balance>();
      rows.forEach((r) =>
        map.set(r.product_id, {
          ...r, quantity: toNum(r.quantity), avg_cost: toNum(r.avg_cost), value: toNum(r.value),
          total_in: toNum(r.total_in), total_out: toNum(r.total_out), opening_qty: toNum(r.opening_qty),
        }),
      );
      return map;
    },
  });
}

export function useCustomers() {
  return useQuery({
    queryKey: ["customers"],
    queryFn: () => must<Customer[]>(supabase.from("customers").select("*").order("created_at", { ascending: false })),
  });
}

export function useSettings() {
  return useQuery({
    queryKey: ["settings"],
    queryFn: () => must<{ store_name: string; default_low_stock: number }>(supabase.from("settings").select("*").eq("id", 1).single()),
  });
}

export type SaleItemRow = {
  id: string; product_id: string; quantity: number; unit_price: number; amount: number;
  unit_cost: number; cost_amount: number;
  sales_orders: { id: string; code: string; order_date: string; status: string; customer_name: string | null; customer_id: string | null };
};

/** Completed sale items between two dates (inclusive). */
export function useSaleItems(from: string, to: string) {
  return useQuery({
    queryKey: ["sale-items", from, to],
    queryFn: async () => {
      const rows = await must<SaleItemRow[]>(
        supabase
          .from("sales_order_items")
          .select("id, product_id, quantity, unit_price, amount, unit_cost, cost_amount, sales_orders!inner(id, code, order_date, status, customer_name, customer_id)")
          .eq("sales_orders.status", "completed")
          .gte("sales_orders.order_date", from)
          .lte("sales_orders.order_date", to),
      );
      return rows.map((r) => ({
        ...r, quantity: toNum(r.quantity), unit_price: toNum(r.unit_price), amount: toNum(r.amount),
        unit_cost: toNum(r.unit_cost), cost_amount: toNum(r.cost_amount),
      }));
    },
  });
}

export function aggregateByProduct(items: SaleItemRow[], products: Product[]) {
  const m = new Map<string, { product_id: string; name: string; qty: number; revenue: number; cost: number }>();
  for (const it of items) {
    const p = products.find((x) => x.id === it.product_id);
    const cur = m.get(it.product_id) ?? { product_id: it.product_id, name: p?.name ?? "?", qty: 0, revenue: 0, cost: 0 };
    cur.qty += it.quantity; cur.revenue += it.amount; cur.cost += it.cost_amount;
    m.set(it.product_id, cur);
  }
  return [...m.values()]
    .map((r) => ({ ...r, revenue: round3(r.revenue), cost: round3(r.cost), profit: round3(r.revenue - r.cost), margin: r.revenue ? ((r.revenue - r.cost) / r.revenue) * 100 : 0 }))
    .sort((a, b) => b.revenue - a.revenue);
}

export function round3(n: number) {
  return Math.round(n * 1000) / 1000;
}

export function lowStockOf(p: Product, defaultLow: number) {
  return p.low_stock_threshold != null ? toNum(p.low_stock_threshold) : defaultLow;
}

export const INVALIDATE_ALL = [["products"], ["balances"], ["customers"], ["sale-items"], ["sales"], ["purchases"], ["movements"], ["dashboard"]];
