import { useMemo, useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { Ban, Eye, MoreHorizontal, Pencil, Plus, ShoppingBag, Users, Wallet } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Card, DataTable, EmptyState, MetricCard, PageHeader, ReasonDialog, StatusBadge, type Column } from "@/components/app/shared";
import { CustomerDetailSheet } from "@/components/app/customer-detail-sheet";
import { CustomerFormDialog } from "@/components/app/customer-form-dialog";
import { CustomerListSection } from "@/components/app/customer-list";
import { DateRangeFilter, FilterBar, SearchInput, filterSelect, matches } from "@/components/app/inputs";
import { supabase } from "@/integrations/supabase/client";
import { productNames, useCustomers, useInvalidateAll, useSales, type Customer, type SaleOrderListRow } from "@/lib/data";
import { round3, salesPaymentTotal } from "@/lib/calc";
import { errMsg, fmtDate, fmtMoney, fmtNum, MONEY_UNIT, MONEY_UNIT_SHORT } from "@/lib/format";

export const Route = createFileRoute("/_app/sales/")({
  validateSearch: (s: Record<string, unknown>): { customer?: string } => (typeof s["customer"] === "string" ? { customer: s["customer"] } : {}),
  head: () => ({ meta: [{ title: "Bán hàng – Chơi Xe-Xe Chơi" }] }),
  component: SalesPage,
});

/** Sales orders and customers on one screen; a customer opens in a side sheet via ?customer=. */
function SalesPage() {
  const navigate = useNavigate({ from: Route.fullPath });
  const { customer: customerId } = Route.useSearch();
  const [range, setRange] = useState({ from: "", to: "" });
  const [q, setQ] = useState("");
  const [status, setStatus] = useState("all");
  const [cancelling, setCancelling] = useState<SaleOrderListRow | null>(null);
  const [editingCustomer, setEditingCustomer] = useState<Customer | "new" | null>(null);
  const [pending, setPending] = useState(false);
  const sales = useSales(range);
  const { data: customers } = useCustomers();
  const invalidate = useInvalidateAll();

  const focusCustomer = customers?.find((c) => c.id === customerId) ?? null;
  const openCustomer = (id: string) => void navigate({ search: { customer: id } });
  const closeCustomer = () => void navigate({ search: {} });

  // Summary of completed orders in the chosen date range.
  const summary = useMemo(() => {
    const done = (sales.data ?? []).filter((r) => r.status === "completed");
    return {
      orders: done.length,
      paid: round3(done.reduce((s, r) => s + salesPaymentTotal(r.total_amount, r.surcharge), 0)),
      buyers: new Set(done.map((r) => r.customer_id ?? `guest:${r.customer_name ?? ""}:${r.phone ?? ""}`)).size,
    };
  }, [sales.data]);

  const rows = useMemo(() => sales.data?.filter((r) =>
    matches(q, r.code, r.customer_name, r.phone, r.plate, r.vehicle_name, ...r.sales_order_items.map((i) => i.products?.name)) &&
    (status === "all" || r.status === status),
  ), [sales.data, q, status]);

  const cancel = async (reason: string) => {
    if (!cancelling) return;
    setPending(true);
    const { error } = await supabase.rpc("cancel_sale", { p_id: cancelling.id, p_reason: reason });
    setPending(false);
    if (error) return void toast.error(errMsg(error));
    toast.success("Đã hủy đơn bán");
    setCancelling(null);
    void invalidate();
  };

  const columns: Column<SaleOrderListRow>[] = [
    { key: "code", header: "Mã đơn bán", mobile: "title", cell: (r) => <span className="font-medium text-primary">{r.code}</span> },
    { key: "date", header: "Ngày bán", cell: (r) => fmtDate(r.order_date) },
    {
      key: "customer", header: "Khách hàng", mobile: "title",
      cell: (r) => (r.customer_id
        ? <button type="button" className="font-medium text-primary hover:underline" onClick={(e) => { e.stopPropagation(); openCustomer(r.customer_id!); }}>{r.customer_name || "Khách hàng"}</button>
        : <span className="font-medium">{r.customer_name || "Khách lẻ"}</span>),
    },
    { key: "phone", header: "Số điện thoại", cell: (r) => r.phone || <span className="text-muted-foreground">—</span> },
    { key: "plate", header: "Biển số xe", cell: (r) => r.plate || <span className="text-muted-foreground">—</span> },
    { key: "vehicle", header: "Tên xe", cell: (r) => r.vehicle_name || <span className="text-muted-foreground">—</span> },
    { key: "products", header: "Sản phẩm", className: "max-w-[220px] truncate", cell: (r) => productNames(r.sales_order_items) },
    { key: "qty", header: "Tổng SL", align: "right", cell: (r) => <span className="num">{fmtNum(r.total_qty)}</span> },
    { key: "amount", header: `Tổng tiền (${MONEY_UNIT_SHORT})`, align: "right", mobile: "aside", cell: (r) => <span className="num font-semibold">{fmtMoney(r.total_amount + r.surcharge)}</span> },
    { key: "status", header: "Trạng thái", mobile: "aside", cell: (r) => <StatusBadge kind={r.status} /> },
    {
      key: "actions", header: "Thao tác", align: "right",
      cell: (r) => (
        <div onClick={(e) => e.stopPropagation()}>
          <DropdownMenu>
            <DropdownMenuTrigger asChild><Button variant="ghost" size="icon" className="h-8 w-8" aria-label="Thao tác"><MoreHorizontal className="h-4 w-4" /></Button></DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem asChild><Link to="/sales/$id" params={{ id: r.id }}><Eye className="h-4 w-4" />Xem chi tiết</Link></DropdownMenuItem>
              {r.status === "completed" && <>
                <DropdownMenuItem asChild><Link to="/sales/edit/$id" params={{ id: r.id }}><Pencil className="h-4 w-4" />Sửa đơn</Link></DropdownMenuItem>
                <DropdownMenuItem className="text-destructive focus:text-destructive" onSelect={() => setCancelling(r)}><Ban className="h-4 w-4" />Hủy đơn</DropdownMenuItem>
              </>}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      ),
    },
  ];

  return (
    <>
      <PageHeader title="Bán hàng" subtitle="Đơn bán và khách hàng – đơn bán tự động trừ tồn kho và ghi nhận giá vốn"
        actions={<>
          <Button variant="outline" onClick={() => setEditingCustomer("new")}><Plus className="h-4 w-4" />Thêm khách hàng</Button>
          <Button asChild><Link to="/sales/new"><Plus className="h-4 w-4" />Tạo đơn bán</Link></Button>
        </>} />

      <div className="mb-5 grid gap-4 sm:grid-cols-3">
        <MetricCard label="Số đơn bán" value={fmtNum(summary.orders)} unit="đơn" icon={ShoppingBag} tone="violet" loading={sales.isLoading} hint="Đơn hoàn tất theo khoảng ngày đã chọn" />
        <MetricCard label="Tổng thanh toán" value={fmtMoney(summary.paid)} unit={MONEY_UNIT} icon={Wallet} tone="blue" loading={sales.isLoading} hint="Đã gồm phụ thu / tip" />
        <MetricCard label="Khách mua" value={fmtNum(summary.buyers)} unit="khách" icon={Users} tone="green" loading={sales.isLoading} hint="Khách có đơn trong khoảng ngày đã chọn" />
      </div>

      <Card title="Đơn bán" icon={ShoppingBag}>
        <FilterBar>
          <SearchInput value={q} onChange={setQ} placeholder="Mã đơn, khách, SĐT, biển số..." />
          <DateRangeFilter from={range.from} to={range.to} onChange={(from, to) => setRange({ from, to })} />
          <Select value={status} onValueChange={setStatus}>
            <SelectTrigger className={filterSelect} aria-label="Lọc trạng thái"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Tất cả trạng thái</SelectItem>
              <SelectItem value="completed">Hoàn tất</SelectItem>
              <SelectItem value="cancelled">Đã hủy</SelectItem>
            </SelectContent>
          </Select>
        </FilterBar>
        <DataTable columns={columns} rows={rows} rowKey={(r) => r.id}
          onRowClick={(r) => void navigate({ to: "/sales/$id", params: { id: r.id } })}
          rowClassName={(r) => (r.status === "cancelled" ? "opacity-60" : undefined)}
          loading={sales.isLoading} error={sales.error} onRetry={() => void sales.refetch()}
          empty={<EmptyState title="Chưa có đơn bán" hint="Tạo đơn bán đầu tiên để ghi nhận doanh thu."
            action={<Button size="sm" asChild><Link to="/sales/new"><Plus className="h-4 w-4" />Tạo đơn bán</Link></Button>} />} />
      </Card>

      <div className="mt-5">
        <CustomerListSection onOpen={(c) => openCustomer(c.id)} onEdit={setEditingCustomer} onAdd={() => setEditingCustomer("new")} />
      </div>

      <CustomerDetailSheet customer={focusCustomer} onClose={closeCustomer} onEdit={(c) => { closeCustomer(); setEditingCustomer(c); }} />
      <CustomerFormDialog customer={editingCustomer} onClose={() => setEditingCustomer(null)} />
      <ReasonDialog open={!!cancelling} onOpenChange={(o) => !o && setCancelling(null)} pending={pending} onConfirm={(r) => void cancel(r)}
        title={`Hủy đơn bán ${cancelling?.code ?? ""}`}
        description="Hàng sẽ được hoàn lại kho; doanh thu, giá vốn và lợi nhuận sẽ được tính lại. Đơn đã hủy vẫn được lưu trong lịch sử." />
    </>
  );
}
