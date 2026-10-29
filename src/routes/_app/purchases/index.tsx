import { useMemo, useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { Ban, Eye, MoreHorizontal, Pencil, Plus } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Card, DataTable, EmptyState, PageHeader, ReasonDialog, StatusBadge, type Column } from "@/components/app/shared";
import { DateRangeFilter, FilterBar, SearchInput, filterSelect, matches } from "@/components/app/inputs";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { productNames, useInvalidateAll, usePurchases, useProducts, type PurchaseListRow } from "@/lib/data";
import { errMsg, fmtDate, fmtMoney, fmtNum, MONEY_UNIT_SHORT } from "@/lib/format";

export const Route = createFileRoute("/_app/purchases/")({
  head: () => ({ meta: [{ title: "Mua vào – Chơi Xe-Xe Chơi" }] }),
  component: PurchasesPage,
});

function PurchasesPage() {
  const navigate = useNavigate();
  const [range, setRange] = useState({ from: "", to: "" });
  const [q, setQ] = useState("");
  const [productId, setProductId] = useState("all");
  const [status, setStatus] = useState("all");
  const [cancelling, setCancelling] = useState<PurchaseListRow | null>(null);
  const [pending, setPending] = useState(false);
  const purchases = usePurchases(range);
  const { data: products = [] } = useProducts();
  const invalidate = useInvalidateAll();

  const rows = useMemo(() => purchases.data?.filter((r) =>
    matches(q, r.code, r.note, ...r.purchase_items.map((i) => i.products?.name)) &&
    (productId === "all" || r.purchase_items.some((i) => i.product_id === productId)) &&
    (status === "all" || r.status === status),
  ), [purchases.data, q, productId, status]);

  const cancel = async (reason: string) => {
    if (!cancelling) return;
    setPending(true);
    const { error } = await supabase.rpc("cancel_purchase", { p_id: cancelling.id, p_reason: reason });
    setPending(false);
    if (error) return void toast.error(errMsg(error));
    toast.success("Đã hủy phiếu nhập");
    setCancelling(null);
    void invalidate();
  };

  const columns: Column<PurchaseListRow>[] = [
    { key: "code", header: "Mã phiếu nhập", mobile: "title", cell: (r) => <span className="font-medium text-primary">{r.code}</span> },
    { key: "date", header: "Ngày nhập", cell: (r) => fmtDate(r.receipt_date) },
    { key: "products", header: "Sản phẩm", className: "max-w-[260px] truncate", cell: (r) => productNames(r.purchase_items, 3) },
    { key: "qty", header: "Tổng số lượng", align: "right", cell: (r) => <span className="num">{fmtNum(r.total_qty)}</span> },
    { key: "amount", header: `Tổng tiền nhập (${MONEY_UNIT_SHORT})`, align: "right", mobile: "aside", cell: (r) => <span className="num font-semibold">{fmtMoney(r.total_amount)}</span> },
    { key: "status", header: "Trạng thái", mobile: "aside", cell: (r) => <StatusBadge kind={r.status} /> },
    {
      key: "actions", header: "Thao tác", align: "right",
      cell: (r) => (
        <div onClick={(e) => e.stopPropagation()}>
          <DropdownMenu>
            <DropdownMenuTrigger asChild><Button variant="ghost" size="icon" className="h-8 w-8" aria-label="Thao tác"><MoreHorizontal className="h-4 w-4" /></Button></DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem asChild><Link to="/purchases/$id" params={{ id: r.id }}><Eye className="h-4 w-4" />Xem chi tiết</Link></DropdownMenuItem>
              {r.status === "completed" && <>
                <DropdownMenuItem asChild><Link to="/purchases/edit/$id" params={{ id: r.id }}><Pencil className="h-4 w-4" />Sửa phiếu</Link></DropdownMenuItem>
                <DropdownMenuItem className="text-destructive focus:text-destructive" onSelect={() => setCancelling(r)}><Ban className="h-4 w-4" />Hủy phiếu</DropdownMenuItem>
              </>}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      ),
    },
  ];

  return (
    <>
      <PageHeader title="Mua vào" subtitle="Phiếu nhập hàng – tự động cập nhật tồn kho và giá vốn bình quân"
        actions={<Button asChild><Link to="/purchases/new"><Plus className="h-4 w-4" />Tạo phiếu nhập</Link></Button>} />
      <Card>
        <FilterBar>
          <SearchInput value={q} onChange={setQ} placeholder="Mã phiếu, sản phẩm, ghi chú..." />
          <DateRangeFilter from={range.from} to={range.to} onChange={(from, to) => setRange({ from, to })} />
          <Select value={productId} onValueChange={setProductId}>
            <SelectTrigger className={cn(filterSelect, "sm:max-w-[16rem]")} aria-label="Lọc theo sản phẩm"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Tất cả sản phẩm</SelectItem>
              {products.map((p) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
            </SelectContent>
          </Select>
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
          onRowClick={(r) => void navigate({ to: "/purchases/$id", params: { id: r.id } })}
          rowClassName={(r) => (r.status === "cancelled" ? "opacity-60" : undefined)}
          loading={purchases.isLoading} error={purchases.error} onRetry={() => void purchases.refetch()}
          empty={<EmptyState title="Chưa có phiếu nhập" hint="Tạo phiếu nhập để tăng tồn kho."
            action={<Button size="sm" asChild><Link to="/purchases/new"><Plus className="h-4 w-4" />Tạo phiếu nhập</Link></Button>} />} />
      </Card>
      <ReasonDialog open={!!cancelling} onOpenChange={(o) => !o && setCancelling(null)} pending={pending} onConfirm={(r) => void cancel(r)}
        title={`Hủy phiếu nhập ${cancelling?.code ?? ""}`}
        description="Tồn kho và giá vốn của các đơn bán liên quan sẽ được tính lại. Hệ thống sẽ từ chối nếu việc hủy làm tồn kho bị âm." />
    </>
  );
}
