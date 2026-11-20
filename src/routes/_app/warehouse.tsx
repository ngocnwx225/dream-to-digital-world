import { useEffect, useMemo, useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { AlertTriangle, Boxes, Eye, MoreHorizontal, Pencil, Plus, PackageX, Power, Wallet } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Card, ConfirmDialog, DataTable, EmptyState, MetricCard, PageHeader, StatusBadge, type Column } from "@/components/app/shared";
import { FilterBar, SearchInput, filterSelect, matches } from "@/components/app/inputs";
import { OpeningDialog, ProductFormDialog } from "@/components/app/product-dialogs";
import { ProductDetailSheet, type StockRow } from "@/components/app/product-detail-sheet";
import { PurchaseListSection } from "@/components/app/purchase-list";
import { supabase } from "@/integrations/supabase/client";
import { lowStockOf, stockState, useBalances, useInvalidateAll, useProducts, useSettings, type Product, type StockState } from "@/lib/data";
import { errMsg, fmtMoney, fmtNum, fmtUnitCost, MONEY_UNIT, MONEY_UNIT_SHORT } from "@/lib/format";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_app/warehouse")({
  validateSearch: (s: Record<string, unknown>): { q?: string; product?: string } => ({
    ...(typeof s["q"] === "string" ? { q: s["q"] } : {}),
    ...(typeof s["product"] === "string" ? { product: s["product"] } : {}),
  }),
  head: () => ({ meta: [{ title: "Sản phẩm – Chơi Xe-Xe Chơi" }] }),
  component: WarehousePage,
});

type Filter = "all" | StockState | "inactive";

/** Products, stock and purchase receipts on one screen. */
function WarehousePage() {
  const { q: initialQ, product: focusId } = Route.useSearch();
  const navigate = useNavigate({ from: Route.fullPath });
  const products = useProducts();
  const balances = useBalances();
  const { data: settings } = useSettings();
  const invalidate = useInvalidateAll();
  const [q, setQ] = useState(initialQ ?? "");
  const [filter, setFilter] = useState<Filter>("all");
  const [editing, setEditing] = useState<Product | "new" | null>(null);
  const [toggling, setToggling] = useState<Product | null>(null);
  const [pendingToggle, setPendingToggle] = useState(false);
  const [openingOpen, setOpeningOpen] = useState(false);
  const defaultLow = settings?.default_low_stock ?? 5;

  useEffect(() => setQ(initialQ ?? ""), [initialQ]);

  const all = useMemo<StockRow[] | undefined>(() => {
    if (!products.data || !balances.data) return undefined;
    return products.data.map((p) => {
      const balance = balances.data.get(p.id) ?? { product_id: p.id, quantity: 0, avg_cost: 0, value: 0, total_in: 0, total_out: 0, opening_qty: 0 };
      const threshold = lowStockOf(p, defaultLow);
      return { product: p, balance, threshold, state: stockState(balance.quantity, threshold) };
    });
  }, [products.data, balances.data, defaultLow]);

  const rows = all?.filter((r) => matches(q, r.product.name, r.product.code)
    && (filter === "all" || (filter === "inactive" ? !r.product.is_active : r.product.is_active && r.state === filter)));
  const active = all?.filter((r) => r.product.is_active) ?? [];
  const totalValue = (all ?? []).reduce((s, r) => s + r.balance.value, 0);
  const focus = all?.find((r) => r.product.id === focusId) ?? null;
  const open = (r: StockRow) => void navigate({ search: (prev) => ({ ...prev, product: r.product.id }) });
  const closeSheet = () => void navigate({ search: (prev) => (prev.q ? { q: prev.q } : {}) });

  const toggleActive = async () => {
    if (!toggling) return;
    setPendingToggle(true);
    const { error } = await supabase.from("products").update({ is_active: !toggling.is_active }).eq("id", toggling.id);
    setPendingToggle(false);
    if (error) return void toast.error(errMsg(error));
    toast.success("Lưu thành công");
    setToggling(null);
    void invalidate();
  };

  const columns: Column<StockRow>[] = [
    { key: "code", header: "Mã sản phẩm", mobile: "title", cell: (r) => <span className="font-medium text-primary">{r.product.code}</span> },
    { key: "name", header: "Tên sản phẩm", mobile: "title", cell: (r) => <span className="font-medium">{r.product.name}{!r.product.is_active && <span className="ml-2 text-xs text-muted-foreground">(ngừng bán)</span>}</span> },
    { key: "price", header: `Giá bán (${MONEY_UNIT_SHORT})`, align: "right", cell: (r) => <span className="num">{fmtMoney(r.product.sale_price)}</span> },
    { key: "qty", header: "Tồn hiện tại", align: "right", mobile: "aside", cell: (r) => <span className={cn("num font-semibold", r.state === "out" && "text-destructive", r.state === "low" && "text-warning")}>{fmtNum(r.balance.quantity)} <span className="font-normal text-muted-foreground">{r.product.unit}</span></span> },
    { key: "avg", header: `Giá vốn BQ (${MONEY_UNIT_SHORT})`, align: "right", cell: (r) => <span className="num">{fmtUnitCost(r.balance.avg_cost)}</span> },
    { key: "value", header: `Giá trị tồn (${MONEY_UNIT_SHORT})`, align: "right", cell: (r) => <span className="num font-medium">{fmtMoney(r.balance.value)}</span> },
    { key: "state", header: "Tình trạng", mobile: "aside", cell: (r) => <StatusBadge kind={r.state} /> },
    {
      key: "actions", header: "Thao tác", align: "right",
      cell: (r) => (
        <div onClick={(e) => e.stopPropagation()}>
          <DropdownMenu>
            <DropdownMenuTrigger asChild><Button variant="ghost" size="icon" className="h-8 w-8" aria-label="Thao tác"><MoreHorizontal className="h-4 w-4" /></Button></DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onSelect={() => open(r)}><Eye className="h-4 w-4" />Xem chi tiết và lịch sử</DropdownMenuItem>
              <DropdownMenuItem onSelect={() => setEditing(r.product)}><Pencil className="h-4 w-4" />Sửa</DropdownMenuItem>
              <DropdownMenuItem onSelect={() => setToggling(r.product)}><Power className="h-4 w-4" />{r.product.is_active ? "Ngừng kinh doanh" : "Kinh doanh lại"}</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      ),
    },
  ];

  return (
    <>
      <PageHeader title="Sản phẩm" subtitle="Danh mục sản phẩm, tồn kho và phiếu nhập hàng – tồn kho = tồn đầu + nhập − bán"
        actions={<>
          <Button variant="outline" onClick={() => setOpeningOpen(true)}>Tồn kho ban đầu</Button>
          <Button variant="outline" onClick={() => setEditing("new")}><Plus className="h-4 w-4" />Thêm sản phẩm</Button>
          <Button asChild><Link to="/purchases/new"><Plus className="h-4 w-4" />Nhập hàng</Link></Button>
        </>} />

      <div className="mb-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard label="Giá trị tồn kho" value={fmtMoney(totalValue)} unit={MONEY_UNIT} icon={Wallet} tone="orange" loading={!all} hint="Theo giá vốn bình quân" />
        <MetricCard label="Sản phẩm đang bán" value={fmtNum(active.length)} icon={Boxes} tone="blue" loading={!all} hint="Mặt hàng đang kinh doanh" />
        <MetricCard label="Sắp hết hàng" value={fmtNum(active.filter((r) => r.state === "low").length)} icon={AlertTriangle} tone="orange" loading={!all} hint="Dưới mức cảnh báo"
          onClick={() => setFilter("low")} />
        <MetricCard label="Hết hàng" value={fmtNum(active.filter((r) => r.state === "out").length)} icon={PackageX} tone="red" loading={!all} hint="Tồn bằng 0"
          onClick={() => setFilter("out")} />
      </div>

      <Card>
        <FilterBar>
          <SearchInput value={q} onChange={setQ} placeholder="Tìm theo tên hoặc mã..." />
          <Select value={filter} onValueChange={(v) => setFilter(v as Filter)}>
            <SelectTrigger className={filterSelect} aria-label="Lọc tình trạng"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Tất cả</SelectItem>
              <SelectItem value="ok">Còn hàng</SelectItem>
              <SelectItem value="low">Sắp hết</SelectItem>
              <SelectItem value="out">Hết hàng</SelectItem>
              <SelectItem value="inactive">Ngừng bán</SelectItem>
            </SelectContent>
          </Select>
          <p className="col-span-2 text-xs text-muted-foreground sm:ml-auto">Bấm vào một dòng để xem chi tiết và lịch sử nhập – bán</p>
        </FilterBar>
        <DataTable columns={columns} rows={rows} rowKey={(r) => r.product.id} onRowClick={open}
          loading={products.isLoading || balances.isLoading} error={products.error ?? balances.error}
          empty={<EmptyState title={q || filter !== "all" ? "Không có sản phẩm phù hợp" : "Chưa có sản phẩm"}
            hint="Thêm sản phẩm, sau đó nhập tồn kho ban đầu hoặc tạo phiếu nhập."
            action={!q && filter === "all" && <Button size="sm" onClick={() => setEditing("new")}><Plus className="h-4 w-4" />Thêm sản phẩm</Button>} />} />
      </Card>

      <div className="mt-5">
        <PurchaseListSection />
      </div>

      <ProductFormDialog product={editing} onClose={() => setEditing(null)} />
      <OpeningDialog open={openingOpen} onClose={() => setOpeningOpen(false)} />
      <ProductDetailSheet row={focus} onClose={closeSheet}
        onEdit={(p) => { closeSheet(); setEditing(p); }} onToggle={(p) => { closeSheet(); setToggling(p); }} />
      <ConfirmDialog open={!!toggling} onOpenChange={(o) => !o && setToggling(null)} pending={pendingToggle} onConfirm={() => void toggleActive()}
        title={toggling?.is_active ? "Ngừng kinh doanh sản phẩm?" : "Kinh doanh lại sản phẩm?"}
        description={toggling?.is_active
          ? <>Sản phẩm <b>{toggling.name}</b> sẽ không thể chọn trong phiếu nhập và đơn bán mới. Lịch sử giao dịch vẫn được giữ nguyên.</>
          : <>Sản phẩm <b>{toggling?.name}</b> sẽ có thể chọn lại trong giao dịch mới.</>}
        confirmLabel={toggling?.is_active ? "Ngừng kinh doanh" : "Kinh doanh lại"} destructive={!!toggling?.is_active} />
    </>
  );
}
