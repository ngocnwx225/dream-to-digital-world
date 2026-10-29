import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { BarChart3, CircleDollarSign, Package, Percent, Receipt, Table2, TrendingUp } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, EmptyState, ErrorState, LoadingSkeleton, MetricCard, PageHeader, TableWrap, td, th, theadRow, trHover } from "@/components/app/shared";
import { ProfitChart } from "@/components/app/charts";
import { useProducts, useSaleItems } from "@/lib/data";
import { aggregateSales, orderConsumables, profitAfterConsumables, round3, totals } from "@/lib/calc";
import { fmtMoney, fmtNum, fmtPct, monthRange, MONEY_UNIT, MONEY_UNIT_SHORT, yearRange } from "@/lib/format";
import { usePeriod } from "@/lib/period";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_app/reports")({
  head: () => ({ meta: [{ title: "Doanh thu & Lợi nhuận – Chơi Xe-Xe Chơi" }] }),
  component: ReportsPage,
});

const ALL_YEAR = "0";

function ReportsPage() {
  const { year, month, setPeriod } = usePeriod();
  const [wholeYear, setWholeYear] = useState(false);
  const range = wholeYear ? { ...yearRange(year), days: 0 } : monthRange(year, month);
  const items = useSaleItems(range.from, range.to);
  const products = useProducts();
  const thisYear = new Date().getFullYear();
  const years = Array.from({ length: 6 }, (_, i) => thisYear - i);

  const data = useMemo(() => {
    const nameOf = (id: string) => products.data?.find((p) => p.id === id)?.name ?? "?";
    const rows = items.data ?? [];
    const byProduct = aggregateSales(rows, nameOf);
    const orders = orderConsumables(rows);
    const bucketOf = (date: string) => (wholeYear ? Number(date.slice(5, 7)) : Number(date.slice(8, 10))) - 1;
    const buckets = wholeYear
      ? Array.from({ length: 12 }, (_, i) => ({ label: `T${i + 1}`, revenue: 0, cost: 0 }))
      : Array.from({ length: range.days }, (_, i) => ({ label: String(i + 1), revenue: 0, cost: 0 }));
    for (const it of rows) {
      const b = buckets[bucketOf(it.sales_orders.order_date)];
      if (b) { b.revenue += it.amount; b.cost += it.cost_amount; }
    }
    // Consumables land in the bucket of their order's sale date, once per order.
    for (const o of orders) {
      const b = buckets[bucketOf(o.date)];
      if (b) b.cost += o.cost;
    }
    const chart = buckets.map((b) => ({ label: b.label, revenue: round3(b.revenue), profit: round3(b.revenue - b.cost) }));
    const t = totals(byProduct);
    const consumables = round3(orders.reduce((s, o) => s + o.cost, 0));
    return {
      byProduct, chart, ...t, productProfit: t.profit, consumables,
      ...profitAfterConsumables(t.revenue, t.cost, consumables), orders: orders.length,
    };
  }, [items.data, products.data, wholeYear, range.days]);

  const loading = items.isLoading || products.isLoading;
  const periodLabel = wholeYear ? `năm ${year}` : `tháng ${String(month).padStart(2, "0")}/${year}`;

  return (
    <>
      <PageHeader title="Doanh thu & Lợi nhuận" subtitle="Lợi nhuận sau vật tư = Doanh thu − Giá vốn hàng bán − Chi phí vật tư tiêu hao"
        actions={<>
          <Select value={wholeYear ? ALL_YEAR : String(month)} onValueChange={(v) => { if (v === ALL_YEAR) setWholeYear(true); else { setWholeYear(false); setPeriod(year, Number(v)); } }}>
            <SelectTrigger className="h-9 w-[130px] bg-card" aria-label="Tháng"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL_YEAR}>Cả năm</SelectItem>
              {Array.from({ length: 12 }, (_, i) => <SelectItem key={i} value={String(i + 1)}>Tháng {String(i + 1).padStart(2, "0")}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={String(year)} onValueChange={(v) => setPeriod(Number(v), month)}>
            <SelectTrigger className="h-9 w-[100px] bg-card" aria-label="Năm"><SelectValue /></SelectTrigger>
            <SelectContent>{years.map((y) => <SelectItem key={y} value={String(y)}>{y}</SelectItem>)}</SelectContent>
          </Select>
        </>} />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-5">
        <MetricCard label="Tổng doanh thu" value={fmtMoney(data.revenue)} unit={MONEY_UNIT} icon={CircleDollarSign} tone="blue" loading={loading} hint={`${fmtNum(data.orders)} đơn bán hoàn tất`} />
        <MetricCard label="Tổng giá vốn hàng bán" value={fmtMoney(data.cost)} unit={MONEY_UNIT} icon={Receipt} tone="orange" loading={loading} hint="SL bán × giá vốn BQ lúc bán" />
        <MetricCard label="Tổng chi phí vật tư tiêu hao" value={fmtMoney(data.consumables)} unit={MONEY_UNIT} icon={Package} tone="red" loading={loading} hint="Số xe × chi phí/xe của từng đơn" />
        <MetricCard label="Tổng lợi nhuận sau vật tư" value={fmtMoney(data.profit)} unit={MONEY_UNIT} icon={TrendingUp} tone="green" loading={loading} hint="Doanh thu − Giá vốn − Vật tư" />
        <MetricCard label="Tỷ suất lợi nhuận sau vật tư" value={fmtPct(data.margin)} icon={Percent} tone="violet" loading={loading} hint="Lợi nhuận sau vật tư / Doanh thu" />
      </div>

      <Card title={`Doanh thu & lợi nhuận sau vật tư ${wholeYear ? "theo tháng" : "theo ngày"}`} icon={BarChart3} className="mt-5"
        action={<span className="text-xs text-muted-foreground">Đơn vị: {MONEY_UNIT}</span>}>
        {items.error ? <ErrorState error={items.error} onRetry={() => void items.refetch()} /> : loading ? <LoadingSkeleton rows={7} /> : (
          <ProfitChart data={data.chart} labelPrefix={wholeYear ? "" : "Ngày "} />
        )}
      </Card>

      <Card title="Lãi sản phẩm (chưa trừ vật tư chung)" icon={Table2} className="mt-5">
        {loading ? <LoadingSkeleton /> : data.byProduct.length === 0 ? (
          <EmptyState title="Chưa có dữ liệu" hint={`Không có đơn bán hoàn tất trong ${periodLabel}.`} />
        ) : (
          <TableWrap>
            <table className="w-full">
              <thead><tr className={theadRow}>
                <th className={th}>Tên sản phẩm</th>
                <th className={cn(th, "text-right")}>Số lượng bán</th>
                <th className={cn(th, "text-right")}>Doanh thu ({MONEY_UNIT_SHORT})</th>
                <th className={cn(th, "text-right")}>Giá vốn hàng bán ({MONEY_UNIT_SHORT})</th>
                <th className={cn(th, "text-right")}>Lãi sản phẩm ({MONEY_UNIT_SHORT})</th>
                <th className={cn(th, "text-right")}>Tỷ suất lãi SP</th>
              </tr></thead>
              <tbody>
                {data.byProduct.map((r) => (
                  <tr key={r.product_id} className={trHover}>
                    <td className={cn(td, "font-medium")}>{r.name}</td>
                    <td className={cn(td, "num text-right")}>{fmtNum(r.qty)}</td>
                    <td className={cn(td, "num text-right")}>{fmtMoney(r.revenue)}</td>
                    <td className={cn(td, "num text-right text-muted-foreground")}>{fmtMoney(r.cost)}</td>
                    <td className={cn(td, "num text-right font-semibold", r.profit >= 0 ? "text-success" : "text-destructive")}>{fmtMoney(r.profit)}</td>
                    <td className={cn(td, "num text-right")}>{fmtPct(r.margin)}</td>
                  </tr>
                ))}
              </tbody>
              {/* Reconciliation: product profit total, then the order-level consumables subtracted exactly once. */}
              <tfoot className="text-sm">
                <tr className="border-t-2 border-border font-semibold">
                  <td className={td}>Tổng lãi sản phẩm</td>
                  <td className={cn(td, "num text-right")}>{fmtNum(round3(data.byProduct.reduce((s, r) => s + r.qty, 0)))}</td>
                  <td className={cn(td, "num text-right")}>{fmtMoney(data.revenue)}</td>
                  <td className={cn(td, "num text-right")}>{fmtMoney(data.cost)}</td>
                  <td className={cn(td, "num text-right")}>{fmtMoney(data.productProfit)}</td>
                  <td className={td} />
                </tr>
                <tr className="border-t border-border text-muted-foreground">
                  <td className={td} colSpan={4}>Trừ chi phí vật tư tiêu hao (theo xe, cấp đơn hàng)</td>
                  <td className={cn(td, "num text-right")}>−{fmtMoney(data.consumables)}</td>
                  <td className={td} />
                </tr>
                <tr className="border-t border-border font-bold">
                  <td className={td} colSpan={4}>Lợi nhuận sau vật tư</td>
                  <td className={cn(td, "num text-right", data.profit >= 0 ? "text-success" : "text-destructive")}>{fmtMoney(data.profit)}</td>
                  <td className={cn(td, "num text-right")}>{fmtPct(data.margin)}</td>
                </tr>
              </tfoot>
            </table>
          </TableWrap>
        )}
      </Card>
    </>
  );
}
