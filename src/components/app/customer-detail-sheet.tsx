import { Link, useNavigate } from "@tanstack/react-router";
import { CalendarClock, Pencil, Plus, Receipt, Wallet } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { DataTable, EmptyState, MetricCard, StatusBadge, type Column } from "@/components/app/shared";
import { productNames, useSales, type Customer, type SaleOrderListRow } from "@/lib/data";
import { round3, salesPaymentTotal } from "@/lib/calc";
import { fmtDate, fmtMoney, fmtNum, MONEY_UNIT, MONEY_UNIT_SHORT } from "@/lib/format";

/** One customer: details, totals and their order history (what the old customer detail page showed). */
export function CustomerDetailSheet({ customer, onClose, onEdit }: {
  customer: Customer | null; onClose: () => void; onEdit: (c: Customer) => void;
}) {
  const navigate = useNavigate();
  // Closed sheet reuses the all-orders cache the customer list already loads.
  const sales = useSales(customer ? { customerId: customer.id } : {});
  const completed = (sales.data ?? []).filter((s) => s.status === "completed");
  const spent = round3(completed.reduce((s, o) => s + salesPaymentTotal(o.total_amount, o.surcharge), 0));
  const last = completed[0]?.order_date;

  const columns: Column<SaleOrderListRow>[] = [
    { key: "code", header: "Mã đơn", mobile: "title", cell: (r) => <span className="font-medium text-primary">{r.code}</span> },
    { key: "date", header: "Ngày bán", cell: (r) => fmtDate(r.order_date) },
    { key: "vehicle", header: "Xe", cell: (r) => [r.vehicle_name, r.plate].filter(Boolean).join(" · ") || <span className="text-muted-foreground">—</span> },
    { key: "products", header: "Sản phẩm", className: "max-w-[200px] truncate", cell: (r) => productNames(r.sales_order_items, 3) },
    { key: "amount", header: `Tổng tiền (${MONEY_UNIT_SHORT})`, align: "right", mobile: "aside", cell: (r) => <span className="num font-semibold">{fmtMoney(salesPaymentTotal(r.total_amount, r.surcharge))}</span> },
    { key: "status", header: "Trạng thái", mobile: "aside", cell: (r) => <StatusBadge kind={r.status} /> },
  ];

  const info: [string, string][] = customer ? [
    ["Số điện thoại", customer.phone || "—"],
    ["Tên xe thường dùng", customer.vehicle_name || "—"],
    ["Biển số thường dùng", customer.plate || "—"],
    ["Ghi chú", customer.note || "—"],
  ] : [];

  return (
    <Sheet open={!!customer} onOpenChange={(o) => !o && onClose()}>
      <SheetContent className="w-full overflow-y-auto sm:max-w-3xl">
        <SheetHeader>
          <SheetTitle>{customer?.name} <span className="text-sm font-normal text-muted-foreground">· {customer?.code}</span></SheetTitle>
          <SheetDescription>Thông tin khách hàng và lịch sử mua hàng</SheetDescription>
        </SheetHeader>
        <div className="space-y-5 px-4 pb-6">
          <div className="flex flex-wrap gap-2">
            {customer && <Button variant="outline" onClick={() => onEdit(customer)}><Pencil className="h-4 w-4" />Sửa</Button>}
            <Button asChild><Link to="/sales/new"><Plus className="h-4 w-4" />Tạo đơn bán</Link></Button>
          </div>
          <div className="grid gap-3 sm:grid-cols-3">
            <MetricCard label="Số đơn mua" value={fmtNum(completed.length)} icon={Receipt} tone="violet" loading={sales.isLoading} hint="Đơn đã hoàn tất" />
            <MetricCard label="Tổng tiền đã mua" value={fmtMoney(spent)} unit={MONEY_UNIT} icon={Wallet} tone="blue" loading={sales.isLoading} hint="Không tính đơn đã hủy" />
            <MetricCard label="Mua gần nhất" value={last ? fmtDate(last) : "—"} icon={CalendarClock} tone="green" loading={sales.isLoading} hint={last ? "Ngày bán gần nhất" : "Chưa mua hàng"} />
          </div>
          <dl className="divide-y divide-border text-sm">
            {info.map(([k, v]) => (
              <div key={k} className="flex justify-between gap-4 py-2.5"><dt className="text-muted-foreground">{k}</dt><dd className="text-right font-medium">{v}</dd></div>
            ))}
          </dl>
          <div>
            <h3 className="mb-2 text-sm font-semibold">Lịch sử đơn bán</h3>
            <DataTable columns={columns} rows={sales.data} rowKey={(r) => r.id} pageSize={10}
              onRowClick={(r) => void navigate({ to: "/sales/$id", params: { id: r.id } })}
              rowClassName={(r) => (r.status === "cancelled" ? "opacity-60" : undefined)}
              loading={sales.isLoading} error={sales.error}
              empty={<EmptyState title="Khách hàng chưa có đơn bán" />} />
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
