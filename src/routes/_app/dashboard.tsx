import { useMemo } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { BarChart3, Boxes, CircleDollarSign, LineChart, PieChart, ReceiptText, ShoppingBag, TrendingUp } from "lucide-react";
import {
  Card, DataTable, EmptyState, InventoryAlertCard, LoadingSkeleton, MetricCard, MonthYearPicker, PageHeader, StatusBadge, TableWrap, td, th, theadRow, trHover, type Column,
} from "@/components/app/shared";
import { RevenueChart, SalesDonut } from "@/components/app/charts";
import { useBalances, useInventoryValueAt, useProducts, useRecentTransactions, useSaleItems, useSettings, type RecentTx } from "@/lib/data";
import { aggregateSales, orderConsumables, profitAfterConsumables, round3, totals } from "@/lib/calc";
import { fmtDate, fmtMoney, fmtNum, fmtPct, monthRange, MONEY_UNIT, MONEY_UNIT_SHORT, pctChange, prevMonth } from "@/lib/format";
import { usePeriod } from "@/lib/period";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_app/dashboard")({
  head: () => ({ meta: [{ title: "Tổng quan – Chơi Xe-Xe Chơi" }] }),
  component: DashboardPage,
});

function DashboardPage() {
  const navigate = useNavigate();
  const { year, month, setPeriod } = usePeriod();
  const cur = monthRange(year, month);
  const pm = prevMonth(year, month);
  const prev = monthRange(pm.year, pm.month);

  const curItems = useSaleItems(cur.from, cur.to);
  const prevItems = useSaleItems(prev.from, prev.to);
  const products = useProducts();
  const balances = useBalances();
  const { data: settings } = useSettings();
  const invValue = useInventoryValueAt(cur.to);
  const recent = useRecentTransactions(8);

  const nameOf = useMemo(() => {
    const m = new Map(products.data?.map((p) => [p.id, p.name]));
    return (id: string) => m.get(id) ?? "?";
  }, [products.data]);

  const stats = useMemo(() => {
    const items = curItems.data ?? [];
    const byProduct = aggregateSales(items, nameOf);
    const t = totals(byProduct);
    const daily = Array.from({ length: cur.days }, (_, i) => ({ day: i + 1, revenue: 0 }));
    for (const it of items) {
      const d = Number(it.sales_orders.order_date.slice(8, 10));
      const slot = daily[d - 1];
      if (slot) slot.revenue = round3(slot.revenue + it.amount);
    }
    const consumables = round3(orderConsumables(items).reduce((s, o) => s + o.cost, 0));
    return { byProduct, ...t, ...profitAfterConsumables(t.revenue, t.cost, consumables), consumables, daily, orders: new Set(items.map((i) => i.order_id)).size };
  }, [curItems.data, nameOf, cur.days]);

  const prevTotals = useMemo(() => {
    const items = prevItems.data ?? [];
    const t = totals(aggregateSales(items, nameOf));
    const consumables = orderConsumables(items).reduce((s, o) => s + o.cost, 0);
    return { ...t, ...profitAfterConsumables(t.revenue, t.cost, consumables), orders: new Set(items.map((i) => i.order_id)).size };
  }, [prevItems.data, nameOf]);

  const loading = curItems.isLoading || products.isLoading;
  const hasPrev = (prevItems.data?.length ?? 0) > 0;
  const change = (a: number, b: number) => (hasPrev ? pctChange(a, b) : null);
  const label = `tháng ${String(month).padStart(2, "0")}/${year}`;

  const recentCols: Column<RecentTx>[] = [
    { key: "date", header: "Ngày giao dịch", cell: (r) => fmtDate(r.date) },
    { key: "code", header: "Mã chứng từ", mobile: "title", cell: (r) => <span className="font-medium text-primary">{r.code}</span> },
    { key: "customer", header: "Khách hàng", cell: (r) => r.customer ?? <span className="text-muted-foreground">—</span> },
    { key: "products", header: "Sản phẩm", className: "max-w-[200px] truncate", cell: (r) => r.products },
    { key: "qty", header: "Số lượng", align: "right", cell: (r) => <span className="num">{fmtNum(r.qty)}</span> },
    { key: "amount", header: `Thành tiền (${MONEY_UNIT_SHORT})`, align: "right", mobile: "aside", cell: (r) => <span className="num font-semibold">{fmtMoney(r.amount)}</span> },
    { key: "kind", header: "Loại giao dịch", mobile: "aside", cell: (r) => <StatusBadge kind={r.kind} /> },
  ];

  return (
    <>
      <PageHeader title="Tổng quan" subtitle="Theo dõi hoạt động mua bán, tồn kho và hiệu quả kinh doanh"
        actions={<MonthYearPicker year={year} month={month} onChange={setPeriod} />} />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard label="Doanh thu tháng" value={fmtMoney(stats.revenue)} unit={MONEY_UNIT} icon={CircleDollarSign} tone="blue"
          loading={loading} change={change(stats.revenue, prevTotals.revenue)} />
        <MetricCard label="Lợi nhuận tháng" value={fmtMoney(stats.profit)} unit={MONEY_UNIT} icon={TrendingUp} tone="green"
          loading={loading} change={change(stats.profit, prevTotals.profit)} />
        {/* Profit above is after consumables: Doanh thu − Giá vốn − Vật tư tiêu hao. */}
        <MetricCard label="Giá trị tồn kho" value={fmtMoney(invValue.data ?? 0)} unit={MONEY_UNIT} icon={Boxes} tone="orange"
          loading={invValue.isLoading} hint={`Cuối ${label}, theo giá vốn bình quân`} />
        <MetricCard label="Số đơn bán" value={fmtNum(stats.orders)} unit="đơn" icon={ShoppingBag} tone="violet"
          loading={loading} change={change(stats.orders, prevTotals.orders)} />
      </div>

      <div className="mt-5 grid gap-5 lg:grid-cols-3">
        <Card title="Doanh thu theo ngày" icon={LineChart} className="lg:col-span-2"
          action={<span className="text-xs text-muted-foreground">Đơn vị: {MONEY_UNIT}</span>}>
          {loading ? <LoadingSkeleton rows={6} /> : <RevenueChart data={stats.daily} month={month} />}
        </Card>
        <Card title="Cơ cấu bán hàng theo sản phẩm" icon={PieChart}>
          {loading ? <LoadingSkeleton rows={6} /> : stats.byProduct.length === 0
            ? <EmptyState title="Chưa có doanh thu" hint={`Chưa có đơn bán hoàn tất trong ${label}.`} />
            : <SalesDonut rows={stats.byProduct} />}
        </Card>
      </div>

      <div className="mt-5 grid gap-5 lg:grid-cols-3">
        <Card title="Giao dịch gần đây" icon={ReceiptText} className="lg:col-span-2"
          action={<Link to="/sales" className="text-sm font-medium text-primary hover:underline">Xem tất cả</Link>}>
          <DataTable columns={recentCols} rows={recent.data} rowKey={(r) => `${r.kind}-${r.id}`} loading={recent.isLoading} error={recent.error}
            onRowClick={(r) => void (r.kind === "sale"
              ? navigate({ to: "/sales/$id", params: { id: r.id } })
              : navigate({ to: "/purchases/$id", params: { id: r.id } }))}
            empty={<EmptyState title="Chưa có giao dịch" hint="Tạo phiếu nhập hoặc đơn bán để bắt đầu." />} />
        </Card>
        <InventoryAlertCard products={products.data} balances={balances.data} defaultLow={settings?.default_low_stock ?? 5}
          loading={products.isLoading || balances.isLoading} />
      </div>

      <Card title="Lãi theo sản phẩm (chưa trừ vật tư chung)" icon={BarChart3} className="mt-5"
        action={<Link to="/reports" className="text-sm font-medium text-primary hover:underline">Báo cáo chi tiết</Link>}>
        {loading ? <LoadingSkeleton /> : stats.byProduct.length === 0 ? (
          <EmptyState title="Chưa có dữ liệu lợi nhuận" hint={`Chưa có đơn bán hoàn tất trong ${label}.`} />
        ) : (
          <TableWrap>
            <table className="w-full">
              <thead><tr className={theadRow}>
                <th className={th}>Sản phẩm</th>
                <th className={cn(th, "text-right")}>Doanh thu ({MONEY_UNIT_SHORT})</th>
                <th className={cn(th, "text-right")}>Giá vốn hàng bán ({MONEY_UNIT_SHORT})</th>
                <th className={cn(th, "text-right")}>Lãi sản phẩm ({MONEY_UNIT_SHORT})</th>
                <th className={cn(th, "text-right")}>Tỷ suất lãi SP</th>
              </tr></thead>
              <tbody>
                {stats.byProduct.map((r) => (
                  <tr key={r.product_id} className={trHover}>
                    <td className={cn(td, "font-medium")}>{r.name}</td>
                    <td className={cn(td, "num text-right")}>{fmtMoney(r.revenue)}</td>
                    <td className={cn(td, "num text-right text-muted-foreground")}>{fmtMoney(r.cost)}</td>
                    <td className={cn(td, "num text-right font-semibold", r.profit >= 0 ? "text-success" : "text-destructive")}>{fmtMoney(r.profit)}</td>
                    <td className={cn(td, "num text-right")}>{fmtPct(r.margin)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </TableWrap>
        )}
      </Card>
    </>
  );
}
