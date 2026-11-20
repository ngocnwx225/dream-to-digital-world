import { useMemo } from "react";
import { Link } from "@tanstack/react-router";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { EmptyState } from "@/components/app/shared";
import type { SaleItemRow } from "@/lib/data";
import { profitAfterConsumables, round3 } from "@/lib/calc";
import { fmtDate, fmtMoney, fmtPct, MONEY_UNIT_SHORT } from "@/lib/format";
import { cn } from "@/lib/utils";

/** Which figure the sheet explains; decides the highlighted column and the sort order. */
export type BreakdownMetric = "orders" | "revenue" | "cost" | "consumables" | "profit" | "margin";

const META: Record<BreakdownMetric, { title: string; sort: "date" | "desc" | "asc" }> = {
  orders: { title: "Đơn bán trong kỳ", sort: "date" },
  revenue: { title: "Doanh thu theo đơn", sort: "date" },
  cost: { title: "Giá vốn theo đơn", sort: "desc" },
  consumables: { title: "Vật tư tiêu hao theo đơn", sort: "desc" },
  profit: { title: "Lợi nhuận theo đơn", sort: "desc" },
  margin: { title: "Tỷ suất lợi nhuận theo đơn", sort: "asc" },
};

/** Sale lines grouped back into orders, with the same revenue − cost − consumables maths as the cards. */
function toOrders(items: SaleItemRow[]) {
  const m = new Map<string, { id: string; code: string; date: string; customer: string; revenue: number; cost: number; consumables: number }>();
  for (const it of items) {
    const o = m.get(it.order_id) ?? {
      id: it.order_id, code: it.sales_orders.code, date: it.sales_orders.order_date,
      customer: it.sales_orders.customer_name || "Khách lẻ", revenue: 0, cost: 0, consumables: it.sales_orders.consumable_total_cost,
    };
    o.revenue += it.amount;
    o.cost += it.cost_amount;
    m.set(it.order_id, o);
  }
  return [...m.values()].map((o) => ({ ...o, revenue: round3(o.revenue), cost: round3(o.cost), ...profitAfterConsumables(o.revenue, o.cost, o.consumables) }));
}

export function OrderBreakdownSheet({ metric, items, periodLabel, onClose }: {
  metric: BreakdownMetric | null; items: SaleItemRow[]; periodLabel: string; onClose: () => void;
}) {
  const orders = useMemo(() => toOrders(items), [items]);
  const meta = metric ? META[metric] : null;

  const rows = useMemo(() => {
    if (!metric) return [];
    const value = (o: (typeof orders)[number]) => ({
      orders: o.revenue, revenue: o.revenue, cost: o.cost, consumables: o.consumables, profit: o.profit, margin: o.margin,
    })[metric];
    const sorted = [...orders];
    if (meta?.sort === "date") sorted.sort((a, b) => b.date.localeCompare(a.date) || b.code.localeCompare(a.code));
    else sorted.sort((a, b) => (meta?.sort === "desc" ? value(b) - value(a) : value(a) - value(b)));
    return sorted.map((o) => ({ o, v: value(o) }));
  }, [orders, metric, meta]);

  const fmtValue = (v: number) => (metric === "margin" ? fmtPct(v) : fmtMoney(v));

  return (
    <Sheet open={metric !== null} onOpenChange={(open) => { if (!open) onClose(); }}>
      <SheetContent side="right" className="flex w-full flex-col gap-0 p-0 sm:max-w-md">
        <SheetHeader className="border-b border-border p-4 text-left">
          <SheetTitle>{meta?.title}</SheetTitle>
          <SheetDescription>{periodLabel} · {rows.length} đơn · Bấm vào đơn để xem chi tiết</SheetDescription>
        </SheetHeader>
        <div className="flex-1 overflow-y-auto">
          {rows.length === 0 ? (
            <EmptyState title="Chưa có đơn bán" hint={`Không có đơn bán hoàn tất trong ${periodLabel}.`} />
          ) : (
            <ul className="divide-y divide-border">
              {rows.map(({ o, v }) => (
                <li key={o.id}>
                  <Link to="/sales/$id" params={{ id: o.id }} className="flex items-center justify-between gap-3 px-4 py-3 hover:bg-muted/50">
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-medium">{o.customer}</span>
                      <span className="block text-xs text-muted-foreground">{o.code} · {fmtDate(o.date)}</span>
                    </span>
                    <span className="shrink-0 text-right">
                      <span className={cn("num block text-sm font-semibold", (metric === "profit" || metric === "margin") && v < 0 && "text-destructive")}>
                        {fmtValue(v)}{metric !== "margin" && <span className="ml-1 text-xs font-normal text-muted-foreground">{MONEY_UNIT_SHORT}</span>}
                      </span>
                      {(metric === "profit" || metric === "margin") && (
                        <span className="block text-xs text-muted-foreground">
                          {fmtMoney(o.revenue)} − {fmtMoney(o.cost)} − {fmtMoney(o.consumables)}
                        </span>
                      )}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
