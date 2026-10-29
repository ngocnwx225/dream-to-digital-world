import { useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { ArrowLeft, CalendarClock, Pencil, Plus, Receipt, Wallet } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, DataTable, EmptyState, LoadingSkeleton, MetricCard, PageHeader, StatusBadge, type Column } from "@/components/app/shared";
import { CustomerFormDialog } from "@/components/app/customer-form-dialog";
import { productNames, useCustomer, useSales, type Customer, type SaleOrderListRow } from "@/lib/data";
import { round3 } from "@/lib/calc";
import { fmtDate, fmtMoney, fmtNum, MONEY_UNIT, MONEY_UNIT_SHORT } from "@/lib/format";

export const Route = createFileRoute("/_app/customers/$id")({
  head: () => ({ meta: [{ title: "Chi tiết khách hàng – StoreFlow" }] }),
  component: CustomerDetailPage,
});

function CustomerDetailPage() {
  const { id } = Route.useParams();
  const navigate = useNavigate();
  const customer = useCustomer(id);
  const sales = useSales({ customerId: id });
  const [editing, setEditing] = useState<Customer | null>(null);

  if (customer.isLoading) return <Card><LoadingSkeleton rows={6} /></Card>;
  const c = customer.data;
  if (!c) return <Card><EmptyState title="Không tìm thấy khách hàng" action={<Button asChild variant="outline"><Link to="/customers">Về danh sách</Link></Button>} /></Card>;

  const completed = (sales.data ?? []).filter((s) => s.status === "completed");
  const spent = round3(completed.reduce((s, o) => s + o.total_amount, 0));
  const last = completed[0]?.order_date;

  const columns: Column<SaleOrderListRow>[] = [
    { key: "code", header: "Mã đơn", mobile: "title", cell: (r) => <span className="font-medium text-primary">{r.code}</span> },
    { key: "date", header: "Ngày bán", cell: (r) => fmtDate(r.order_date) },
    { key: "vehicle", header: "Xe", cell: (r) => [r.vehicle_name, r.plate].filter(Boolean).join(" · ") || <span className="text-muted-foreground">—</span> },
    { key: "products", header: "Sản phẩm", className: "max-w-[240px] truncate", cell: (r) => productNames(r.sales_order_items, 3) },
    { key: "qty", header: "SL", align: "right", cell: (r) => <span className="num">{fmtNum(r.total_qty)}</span> },
    { key: "amount", header: `Tổng tiền (${MONEY_UNIT_SHORT})`, align: "right", mobile: "aside", cell: (r) => <span className="num font-semibold">{fmtMoney(r.total_amount)}</span> },
    { key: "status", header: "Trạng thái", mobile: "aside", cell: (r) => <StatusBadge kind={r.status} /> },
  ];

  return (
    <>
      <PageHeader title={c.name} subtitle={`Mã khách hàng ${c.code}`}
        actions={<>
          <Button variant="outline" asChild><Link to="/customers"><ArrowLeft className="h-4 w-4" />Danh sách</Link></Button>
          <Button variant="outline" onClick={() => setEditing(c)}><Pencil className="h-4 w-4" />Sửa</Button>
          <Button asChild><Link to="/sales/new"><Plus className="h-4 w-4" />Tạo đơn bán</Link></Button>
        </>} />

      <div className="mb-5 grid gap-4 md:grid-cols-3">
        <MetricCard label="Tổng số đơn mua" value={fmtNum(completed.length)} icon={Receipt} tone="violet" loading={sales.isLoading} hint="Đơn đã hoàn tất" />
        <MetricCard label="Tổng tiền đã mua" value={fmtMoney(spent)} unit={MONEY_UNIT} icon={Wallet} tone="blue" loading={sales.isLoading} hint="Không tính đơn đã hủy" />
        <MetricCard label="Lần mua gần nhất" value={last ? fmtDate(last) : "—"} icon={CalendarClock} tone="green" loading={sales.isLoading} hint={last ? "Ngày bán gần nhất" : "Chưa mua hàng"} />
      </div>

      <div className="grid gap-5 lg:grid-cols-3">
        <Card title="Thông tin khách hàng">
          <dl className="space-y-2.5 text-sm">
            {([
              ["Mã khách hàng", c.code], ["Tên khách", c.name], ["Số điện thoại", c.phone || "—"],
              ["Tên xe thường dùng", c.vehicle_name || "—"], ["Biển số thường dùng", c.plate || "—"], ["Ghi chú", c.note || "—"],
            ] as const).map(([k, v]) => (
              <div key={k} className="flex justify-between gap-4"><dt className="text-muted-foreground">{k}</dt><dd className="text-right font-medium">{v}</dd></div>
            ))}
          </dl>
        </Card>
        <Card title="Lịch sử đơn bán" className="lg:col-span-2">
          <DataTable columns={columns} rows={sales.data} rowKey={(r) => r.id} pageSize={10}
            onRowClick={(r) => void navigate({ to: "/sales/$id", params: { id: r.id } })}
            rowClassName={(r) => (r.status === "cancelled" ? "opacity-60" : undefined)}
            loading={sales.isLoading} error={sales.error}
            empty={<EmptyState title="Khách hàng chưa có đơn bán" />} />
        </Card>
      </div>
      <CustomerFormDialog customer={editing} onClose={() => setEditing(null)} />
    </>
  );
}
