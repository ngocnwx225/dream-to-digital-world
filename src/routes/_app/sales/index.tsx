import { useMemo, useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { Ban, Eye, MoreHorizontal, Pencil, Plus } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Card, DataTable, EmptyState, ReasonDialog, StatusBadge, type Column } from "@/components/app/shared";
import { CustomerDetailSheet } from "@/components/app/customer-detail-sheet";
import { CustomerFormDialog } from "@/components/app/customer-form-dialog";
import { CustomerListSection } from "@/components/app/customer-list";
import { DateRangeFilter, FilterBar, SearchInput, filterSelect, matches } from "@/components/app/inputs";
import { supabase } from "@/integrations/supabase/client";
import { productNames, useCustomers, useInvalidateAll, useSales, type Customer, type SaleOrderListRow } from "@/lib/data";
import { errMsg, fmtDate, fmtMoney, fmtNum, MONEY_UNIT_SHORT } from "@/lib/format";

export const Route = createFileRoute("/_app/sales/")({
  validateSearch: (s: Record<string, unknown>): { customer?: string; tab?: "customers" } => ({
    ...(typeof s["customer"] === "string" ? { customer: s["customer"] } : {}),
    ...(s["tab"] === "customers" ? { tab: "customers" as const } : {}),
  }),
  head: () => ({ meta: [{ title: "Bán hàng – Chơi Xe-Xe Chơi" }] }),
  component: SalesPage,
});

/** Orders and customers share one page as two tabs; a customer opens in a side sheet via ?customer=. */
function SalesPage() {
  const navigate = useNavigate({ from: Route.fullPath });
  const { customer: customerId, tab } = Route.useSearch();
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
  const openCustomer = (id: string) => void navigate({ search: (prev) => ({ ...prev, customer: id }) });
  const closeCustomer = () => void navigate({ search: (prev) => (prev.tab ? { tab: prev.tab } : {}) });
  const changeTab = (v: string) => void navigate({ search: (prev) => (v === "customers" ? { ...prev, tab: "customers" as const } : prev.customer ? { customer: prev.customer } : {}) });

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
      <Tabs value={tab ?? "orders"} onValueChange={changeTab}>
        {/* The tabs are the page title (the sidebar already says "Bán hàng"); the action for the current tab sits on the right. */}
        <div className="mb-4 flex flex-wrap items-end justify-between gap-x-4 gap-y-3 border-b border-border">
          <h1 className="sr-only">Bán hàng</h1>
          <TabsList className="h-auto gap-6 rounded-none bg-transparent p-0">
            {([["orders", "Đơn bán", sales.data?.length], ["customers", "Khách hàng", customers?.length]] as const).map(([value, label, count]) => (
              <TabsTrigger key={value} value={value}
                className="-mb-px rounded-none border-b-[3px] border-transparent bg-transparent px-0 pb-2.5 pt-1 text-xl font-bold tracking-tight text-muted-foreground shadow-none hover:text-foreground data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:text-foreground data-[state=active]:shadow-none sm:text-2xl lg:text-[26px]">
                {label}
                {count != null && <span className="ml-2 rounded-full bg-muted px-2 py-0.5 text-xs font-semibold text-muted-foreground">{fmtNum(count)}</span>}
              </TabsTrigger>
            ))}
          </TabsList>
          <div className="pb-2">
          {tab === "customers"
            ? <Button onClick={() => setEditingCustomer("new")}><Plus className="h-4 w-4" />Thêm khách hàng</Button>
            : <Button asChild><Link to="/sales/new"><Plus className="h-4 w-4" />Tạo đơn bán</Link></Button>}
          </div>
        </div>

        <TabsContent value="orders">
      <Card>
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
        </TabsContent>

        <TabsContent value="customers">
          <CustomerListSection onOpen={(c) => openCustomer(c.id)} onEdit={setEditingCustomer} onAdd={() => setEditingCustomer("new")} />
        </TabsContent>
      </Tabs>

      <CustomerDetailSheet customer={focusCustomer} onClose={closeCustomer} onEdit={(c) => { closeCustomer(); setEditingCustomer(c); }} />
      <CustomerFormDialog customer={editingCustomer} onClose={() => setEditingCustomer(null)} />
      <ReasonDialog open={!!cancelling} onOpenChange={(o) => !o && setCancelling(null)} pending={pending} onConfirm={(r) => void cancel(r)}
        title={`Hủy đơn bán ${cancelling?.code ?? ""}`}
        description="Hàng sẽ được hoàn lại kho; doanh thu, giá vốn và lợi nhuận sẽ được tính lại. Đơn đã hủy vẫn được lưu trong lịch sử." />
    </>
  );
}
