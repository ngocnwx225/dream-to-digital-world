import { useEffect, useMemo, useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { AlertTriangle, Boxes, PackageOpen, PackageX, Plus, Wallet } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Card, DataTable, EmptyState, LoadingSkeleton, MetricCard, PageHeader, StatusBadge, TableWrap, td, th, theadRow, trHover, type Column } from "@/components/app/shared";
import { CurrencyInput, Field, FilterBar, QuantityInput, SearchInput, filterSelect, matches } from "@/components/app/inputs";
import { ProductSelector } from "@/components/app/selectors";
import { supabase } from "@/integrations/supabase/client";
import {
  lowStockOf, stockState, useBalances, useInvalidateAll, useMovements, useOpenings, useProducts, useSettings,
  type Balance, type Product, type StockState,
} from "@/lib/data";
import { parseDecimal, updateCostLine, type CostLine } from "@/lib/calc";
import { errMsg, fmtDate, fmtMoney, fmtNum, fmtUnitCost, MONEY_UNIT, MONEY_UNIT_SHORT, todayISO } from "@/lib/format";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_app/inventory")({
  validateSearch: (s: Record<string, unknown>): { product?: string } => (typeof s["product"] === "string" ? { product: s["product"] } : {}),
  head: () => ({ meta: [{ title: "Tồn kho – StoreFlow" }] }),
  component: InventoryPage,
});

type Row = { product: Product; balance: Balance; threshold: number; state: StockState };

function InventoryPage() {
  const { product: focusId } = Route.useSearch();
  const navigate = useNavigate({ from: Route.fullPath });
  const products = useProducts();
  const balances = useBalances();
  const { data: settings } = useSettings();
  const [q, setQ] = useState("");
  const [state, setState] = useState<"all" | StockState>("all");
  const [openingOpen, setOpeningOpen] = useState(false);
  const defaultLow = settings?.default_low_stock ?? 5;

  const all = useMemo<Row[] | undefined>(() => {
    if (!products.data || !balances.data) return undefined;
    return products.data.map((p) => {
      const balance = balances.data.get(p.id) ?? { product_id: p.id, quantity: 0, avg_cost: 0, value: 0, total_in: 0, total_out: 0, opening_qty: 0 };
      const threshold = lowStockOf(p, defaultLow);
      return { product: p, balance, threshold, state: stockState(balance.quantity, threshold) };
    });
  }, [products.data, balances.data, defaultLow]);

  const rows = all?.filter((r) => matches(q, r.product.name, r.product.code) && (state === "all" || r.state === state));
  const active = all?.filter((r) => r.product.is_active) ?? [];
  const totalValue = (all ?? []).reduce((s, r) => s + r.balance.value, 0);
  const focus = all?.find((r) => r.product.id === focusId) ?? null;

  const columns: Column<Row>[] = [
    { key: "code", header: "Mã sản phẩm", mobile: "title", cell: (r) => <span className="font-medium text-primary">{r.product.code}</span> },
    { key: "name", header: "Tên sản phẩm", mobile: "title", cell: (r) => <span className="font-medium">{r.product.name}{!r.product.is_active && <span className="ml-2 text-xs text-muted-foreground">(ngừng bán)</span>}</span> },
    { key: "open", header: "Tồn đầu", align: "right", cell: (r) => <span className="num text-muted-foreground">{fmtNum(r.balance.opening_qty)}</span> },
    { key: "in", header: "Tổng nhập", align: "right", cell: (r) => <span className="num">{fmtNum(r.balance.total_in)}</span> },
    { key: "out", header: "Tổng bán", align: "right", cell: (r) => <span className="num">{fmtNum(r.balance.total_out)}</span> },
    { key: "qty", header: "Tồn hiện tại", align: "right", mobile: "aside", cell: (r) => <span className={cn("num font-semibold", r.state === "out" && "text-destructive", r.state === "low" && "text-warning")}>{fmtNum(r.balance.quantity)} <span className="font-normal text-muted-foreground">{r.product.unit}</span></span> },
    { key: "avg", header: `Giá vốn BQ (${MONEY_UNIT_SHORT})`, align: "right", cell: (r) => <span className="num">{fmtUnitCost(r.balance.avg_cost)}</span> },
    { key: "value", header: `Giá trị tồn (${MONEY_UNIT_SHORT})`, align: "right", cell: (r) => <span className="num font-medium">{fmtMoney(r.balance.value)}</span> },
    { key: "state", header: "Trạng thái", mobile: "aside", cell: (r) => <StatusBadge kind={r.state} /> },
  ];

  return (
    <>
      <PageHeader title="Tồn kho" subtitle="Tồn kho = Tồn đầu + Tổng nhập − Tổng bán, tính từ các giao dịch hợp lệ"
        actions={<Button onClick={() => setOpeningOpen(true)}><Plus className="h-4 w-4" />Tồn kho ban đầu</Button>} />

      <div className="mb-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard label="Giá trị tồn kho" value={fmtMoney(totalValue)} unit={MONEY_UNIT} icon={Wallet} tone="orange" loading={!all} hint="Theo giá vốn bình quân" />
        <MetricCard label="Sản phẩm đang bán" value={fmtNum(active.length)} icon={Boxes} tone="blue" loading={!all} hint="Mặt hàng đang kinh doanh" />
        <MetricCard label="Sắp hết hàng" value={fmtNum(active.filter((r) => r.state === "low").length)} icon={AlertTriangle} tone="orange" loading={!all} hint="Dưới mức cảnh báo" />
        <MetricCard label="Hết hàng" value={fmtNum(active.filter((r) => r.state === "out").length)} icon={PackageX} tone="red" loading={!all} hint="Tồn bằng 0" />
      </div>

      <Card>
        <FilterBar>
          <SearchInput value={q} onChange={setQ} placeholder="Tìm sản phẩm..." />
          <Select value={state} onValueChange={(v) => setState(v as typeof state)}>
            <SelectTrigger className={filterSelect} aria-label="Lọc tình trạng"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Tất cả</SelectItem>
              <SelectItem value="ok">Còn hàng</SelectItem>
              <SelectItem value="low">Sắp hết</SelectItem>
              <SelectItem value="out">Hết hàng</SelectItem>
            </SelectContent>
          </Select>
          <p className="col-span-2 text-xs text-muted-foreground sm:ml-auto">Bấm vào một dòng để xem lịch sử nhập – xuất</p>
        </FilterBar>
        <DataTable columns={columns} rows={rows} rowKey={(r) => r.product.id}
          onRowClick={(r) => void navigate({ search: { product: r.product.id } })}
          loading={products.isLoading || balances.isLoading} error={products.error ?? balances.error}
          empty={<EmptyState title="Chưa có sản phẩm trong kho" hint="Thêm sản phẩm, sau đó nhập tồn kho ban đầu hoặc tạo phiếu nhập." />} />
      </Card>

      <MovementSheet row={focus} onClose={() => void navigate({ search: {} })} />
      <OpeningDialog open={openingOpen} onClose={() => setOpeningOpen(false)} />
    </>
  );
}

const TYPE_LABEL = { opening: "Tồn đầu", purchase: "Nhập hàng", sale: "Bán hàng" } as const;
const TYPE_CLS = { opening: "bg-muted text-muted-foreground", purchase: "bg-info-soft text-primary", sale: "bg-success-soft text-success" } as const;

function MovementSheet({ row, onClose }: { row: Row | null; onClose: () => void }) {
  const { data, isLoading } = useMovements(row?.product.id ?? null);
  return (
    <Sheet open={!!row} onOpenChange={(o) => !o && onClose()}>
      <SheetContent className="w-full overflow-y-auto sm:max-w-3xl">
        <SheetHeader>
          <SheetTitle>{row?.product.name} <span className="text-sm font-normal text-muted-foreground">· {row?.product.code}</span></SheetTitle>
          <SheetDescription>
            Tồn hiện tại <b className="num text-foreground">{fmtNum(row?.balance.quantity ?? 0)}</b> · Giá vốn BQ <b className="num text-foreground">{fmtUnitCost(row?.balance.avg_cost ?? 0)}</b> · Giá trị <b className="num text-foreground">{fmtMoney(row?.balance.value ?? 0)}</b> {MONEY_UNIT}
          </SheetDescription>
        </SheetHeader>
        <div className="px-4 pb-6">
          {isLoading ? <LoadingSkeleton /> : !data?.length ? (
            <EmptyState icon={PackageOpen} title="Chưa có biến động kho" hint="Nhập tồn đầu hoặc tạo phiếu nhập để bắt đầu." />
          ) : (
            <TableWrap>
              <table className="w-full">
                <thead><tr className={theadRow}>
                  <th className={th}>Ngày</th><th className={th}>Loại</th><th className={th}>Chứng từ</th>
                  <th className={cn(th, "text-right")}>SL thay đổi</th><th className={cn(th, "text-right")}>Tồn sau</th>
                  <th className={cn(th, "text-right")}>Đơn giá vốn</th><th className={cn(th, "text-right")}>Giá vốn BQ sau</th>
                </tr></thead>
                <tbody>
                  {data.map((m) => (
                    <tr key={m.id} className={trHover}>
                      <td className={td}>{fmtDate(m.movement_date)}</td>
                      <td className={td}>
                        <span className={cn("inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold", TYPE_CLS[m.movement_type])}>{TYPE_LABEL[m.movement_type]}</span>
                      </td>
                      <td className={td}><DocLink type={m.movement_type} id={m.ref_id} code={m.doc_code} /></td>
                      <td className={cn(td, "num text-right font-semibold", m.qty_change < 0 ? "text-destructive" : "text-success")}>{m.qty_change > 0 ? "+" : ""}{fmtNum(m.qty_change)}</td>
                      <td className={cn(td, "num text-right")}>{fmtNum(m.qty_after)}</td>
                      <td className={cn(td, "num text-right")}>{m.unit_cost == null ? "—" : fmtUnitCost(m.unit_cost)}</td>
                      <td className={cn(td, "num text-right text-muted-foreground")}>{fmtUnitCost(m.avg_cost_after)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </TableWrap>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}

function DocLink({ type, id, code }: { type: "opening" | "purchase" | "sale"; id: string | null; code: string | null }) {
  if (!id || type === "opening") return <span className="text-muted-foreground">{code ?? "—"}</span>;
  return type === "sale"
    ? <Link to="/sales/$id" params={{ id }} className="font-medium text-primary hover:underline">{code}</Link>
    : <Link to="/purchases/$id" params={{ id }} className="font-medium text-primary hover:underline">{code}</Link>;
}

const EMPTY_LINE: CostLine = { quantity: "", unit_cost: "", amount: "", driver: "amount" };

function OpeningDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { data: products = [] } = useProducts();
  const { data: openings } = useOpenings();
  const invalidate = useInvalidateAll();
  const [productId, setProductId] = useState("");
  const [date, setDate] = useState(todayISO());
  const [line, setLine] = useState<CostLine>(EMPTY_LINE);
  const [replace, setReplace] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const existing = productId ? openings?.get(productId) : undefined;

  useEffect(() => {
    if (open) { setProductId(""); setDate(todayISO()); setLine(EMPTY_LINE); setReplace(false); setErrors({}); }
  }, [open]);

  const set = (f: "quantity" | "unit_cost" | "amount") => (v: string) => setLine((l) => updateCostLine(l, f, v));

  const submit = async () => {
    const qty = parseDecimal(line.quantity);
    const amount = parseDecimal(line.amount);
    const e: Record<string, string> = {};
    if (!productId) e["product"] = "Vui lòng chọn sản phẩm";
    if (!date) e["date"] = "Vui lòng chọn ngày";
    if (qty == null || qty < 0) e["quantity"] = "Số lượng không hợp lệ";
    if (amount == null || amount < 0) e["amount"] = "Giá trị không hợp lệ";
    if (existing && !replace) e["replace"] = "Sản phẩm đã có tồn đầu. Đánh dấu xác nhận để ghi đè.";
    setErrors(e);
    if (Object.keys(e).length) return;
    setSaving(true);
    const { error } = await supabase.rpc("save_opening_balance", { p_product: productId, p_date: date, p_qty: qty!, p_amount: amount!, p_replace: !!existing });
    setSaving(false);
    if (error) return void toast.error(errMsg(error));
    toast.success("Lưu thành công");
    void invalidate();
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Tồn kho ban đầu</DialogTitle>
          <DialogDescription>Nhập số lượng và giá trị tồn khi bắt đầu dùng hệ thống. Tồn đầu ảnh hưởng cả số lượng và giá vốn bình quân.</DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Sản phẩm" required error={errors["product"]} className="sm:col-span-2">
            <ProductSelector products={products} value={productId} onChange={(id) => { setProductId(id); setReplace(false); }} invalid={!!errors["product"]} />
          </Field>
          {existing && (
            <div className="rounded-lg border border-warning/40 bg-warning-soft p-3 text-sm sm:col-span-2">
              <p className="font-medium text-foreground">Sản phẩm này đã có tồn đầu</p>
              <p className="text-muted-foreground">Ngày {fmtDate(existing.opening_date)} · SL {fmtNum(existing.quantity)} · Giá trị {fmtMoney(existing.amount)} {MONEY_UNIT}</p>
              <div className="mt-2 flex items-center gap-2">
                <Checkbox id="replace" checked={replace} onCheckedChange={(c) => setReplace(c === true)} />
                <Label htmlFor="replace" className="text-sm font-normal">Ghi đè tồn đầu hiện có (giá vốn sẽ được tính lại)</Label>
              </div>
              {errors["replace"] && <p className="mt-1 text-xs font-medium text-destructive">{errors["replace"]}</p>}
            </div>
          )}
          <Field label="Ngày tồn đầu" required error={errors["date"]}>
            <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="h-9" />
          </Field>
          <Field label="Số lượng ban đầu" required error={errors["quantity"]}>
            <QuantityInput value={line.quantity} onChange={set("quantity")} invalid={!!errors["quantity"]} />
          </Field>
          <Field label="Đơn giá vốn ban đầu">
            <CurrencyInput value={line.unit_cost} onChange={set("unit_cost")} />
          </Field>
          <Field label="Giá trị tồn ban đầu" required error={errors["amount"]}>
            <CurrencyInput value={line.amount} onChange={set("amount")} invalid={!!errors["amount"]} />
          </Field>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Hủy</Button>
          <Button onClick={() => void submit()} disabled={saving}>{saving ? "Đang lưu..." : "Lưu tồn đầu"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
