import { useEffect, useMemo, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Eye, MoreHorizontal, Pencil, Plus, Power } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Card, ConfirmDialog, DataTable, EmptyState, PageHeader, StatusBadge, type Column } from "@/components/app/shared";
import { CurrencyInput, Field, QuantityInput, SearchInput, matches } from "@/components/app/inputs";
import { supabase } from "@/integrations/supabase/client";
import { lowStockOf, stockState, useBalances, useInvalidateAll, useProducts, useSettings, type Product } from "@/lib/data";
import { parseDecimal, toInputString } from "@/lib/calc";
import { errMsg, fmtMoney, fmtNum, fmtUnitCost, MONEY_UNIT, MONEY_UNIT_SHORT } from "@/lib/format";

export const Route = createFileRoute("/_app/products")({
  validateSearch: (s: Record<string, unknown>): { q?: string } => (typeof s["q"] === "string" ? { q: s["q"] } : {}),
  head: () => ({ meta: [{ title: "Sản phẩm – StoreFlow" }] }),
  component: ProductsPage,
});

function ProductsPage() {
  const { q: initialQ } = Route.useSearch();
  const [q, setQ] = useState(initialQ ?? "");
  const [status, setStatus] = useState<"all" | "active" | "inactive">("all");
  const [editing, setEditing] = useState<Product | "new" | null>(null);
  const [viewing, setViewing] = useState<Product | null>(null);
  const [toggling, setToggling] = useState<Product | null>(null);
  const products = useProducts();
  const { data: balances } = useBalances();
  const invalidate = useInvalidateAll();

  useEffect(() => setQ(initialQ ?? ""), [initialQ]);

  const rows = useMemo(
    () => products.data?.filter((p) => matches(q, p.name, p.code) && (status === "all" || (status === "active") === p.is_active)),
    [products.data, q, status],
  );

  const [pendingToggle, setPendingToggle] = useState(false);
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

  const columns: Column<Product>[] = [
    { key: "code", header: "Mã sản phẩm", cell: (p) => <span className="font-medium text-primary">{p.code}</span> },
    { key: "name", header: "Tên sản phẩm", cell: (p) => <span className="font-medium">{p.name}</span> },
    { key: "unit", header: "Đơn vị tính", cell: (p) => p.unit },
    { key: "price", header: `Giá bán (${MONEY_UNIT_SHORT})`, align: "right", cell: (p) => <span className="num">{fmtMoney(p.sale_price)}</span> },
    { key: "qty", header: "Số lượng tồn", align: "right", cell: (p) => <span className="num">{fmtNum(balances?.get(p.id)?.quantity ?? 0)}</span> },
    { key: "avg", header: `Giá vốn BQ (${MONEY_UNIT_SHORT})`, align: "right", cell: (p) => <span className="num">{fmtUnitCost(balances?.get(p.id)?.avg_cost ?? 0)}</span> },
    { key: "status", header: "Trạng thái", cell: (p) => <StatusBadge kind={p.is_active ? "active" : "inactive"} /> },
    {
      key: "actions", header: "Thao tác", align: "right",
      cell: (p) => (
        <div onClick={(e) => e.stopPropagation()}>
          <DropdownMenu>
            <DropdownMenuTrigger asChild><Button variant="ghost" size="icon" className="h-8 w-8" aria-label="Thao tác"><MoreHorizontal className="h-4 w-4" /></Button></DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onSelect={() => setViewing(p)}><Eye className="h-4 w-4" />Xem chi tiết</DropdownMenuItem>
              <DropdownMenuItem onSelect={() => setEditing(p)}><Pencil className="h-4 w-4" />Sửa</DropdownMenuItem>
              <DropdownMenuItem onSelect={() => setToggling(p)}><Power className="h-4 w-4" />{p.is_active ? "Ngừng kinh doanh" : "Kinh doanh lại"}</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      ),
    },
  ];

  return (
    <>
      <PageHeader title="Sản phẩm" subtitle="Danh mục sản phẩm, giá bán hiện tại và tồn kho"
        actions={<Button onClick={() => setEditing("new")}><Plus className="h-4 w-4" />Thêm sản phẩm</Button>} />
      <Card>
        <div className="mb-4 flex flex-wrap items-center gap-2">
          <SearchInput value={q} onChange={setQ} placeholder="Tìm theo tên hoặc mã..." />
          <Select value={status} onValueChange={(v) => setStatus(v as typeof status)}>
            <SelectTrigger className="h-9 w-[160px] bg-card" aria-label="Lọc trạng thái"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Tất cả trạng thái</SelectItem>
              <SelectItem value="active">Đang bán</SelectItem>
              <SelectItem value="inactive">Ngừng bán</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <DataTable columns={columns} rows={rows} rowKey={(p) => p.id} onRowClick={setViewing}
          loading={products.isLoading} error={products.error} onRetry={() => void products.refetch()}
          empty={<EmptyState title={q || status !== "all" ? "Không có sản phẩm phù hợp" : "Chưa có sản phẩm"}
            hint="Thêm sản phẩm để bắt đầu nhập hàng và bán hàng."
            action={!q && <Button size="sm" onClick={() => setEditing("new")}><Plus className="h-4 w-4" />Thêm sản phẩm</Button>} />} />
      </Card>

      <ProductFormDialog product={editing} onClose={() => setEditing(null)} />
      <ProductDetailSheet product={viewing} onClose={() => setViewing(null)} onEdit={(p) => { setViewing(null); setEditing(p); }} />
      <ConfirmDialog open={!!toggling} onOpenChange={(o) => !o && setToggling(null)} pending={pendingToggle} onConfirm={() => void toggleActive()}
        title={toggling?.is_active ? "Ngừng kinh doanh sản phẩm?" : "Kinh doanh lại sản phẩm?"}
        description={toggling?.is_active
          ? <>Sản phẩm <b>{toggling.name}</b> sẽ không thể chọn trong phiếu nhập và đơn bán mới. Lịch sử giao dịch vẫn được giữ nguyên.</>
          : <>Sản phẩm <b>{toggling?.name}</b> sẽ có thể chọn lại trong giao dịch mới.</>}
        confirmLabel={toggling?.is_active ? "Ngừng kinh doanh" : "Kinh doanh lại"} destructive={!!toggling?.is_active} />
    </>
  );
}

const optionalNumber = z.string().refine((s) => s.trim() === "" || (parseDecimal(s) ?? -1) >= 0, "Giá trị không hợp lệ");
const productSchema = z.object({
  name: z.string().trim().min(1, "Vui lòng nhập tên sản phẩm").max(200),
  unit: z.string().trim().min(1, "Vui lòng nhập đơn vị tính").max(30),
  sale_price: z.string().refine((s) => s.trim() !== "", "Vui lòng nhập giá bán").refine((s) => (parseDecimal(s) ?? -1) >= 0, "Giá bán không hợp lệ"),
  low_stock_threshold: optionalNumber,
  note: z.string().max(1000),
  is_active: z.boolean(),
});
type ProductForm = z.infer<typeof productSchema>;

function ProductFormDialog({ product, onClose }: { product: Product | "new" | null; onClose: () => void }) {
  const invalidate = useInvalidateAll();
  const isNew = product === "new";
  const p = product && product !== "new" ? product : null;
  const form = useForm<ProductForm>({ resolver: zodResolver(productSchema) });
  const { errors, isSubmitting } = form.formState;

  useEffect(() => {
    if (!product) return;
    form.reset({
      name: p?.name ?? "", unit: p?.unit ?? "Cái", sale_price: toInputString(p?.sale_price, 3),
      low_stock_threshold: toInputString(p?.low_stock_threshold, 3), note: p?.note ?? "", is_active: p?.is_active ?? true,
    });
  }, [product]); // eslint-disable-line react-hooks/exhaustive-deps

  const onSubmit = form.handleSubmit(async (v) => {
    const payload = {
      name: v.name.trim(), unit: v.unit.trim(), sale_price: parseDecimal(v.sale_price) ?? 0,
      low_stock_threshold: v.low_stock_threshold.trim() ? parseDecimal(v.low_stock_threshold) : null,
      note: v.note.trim() || null, is_active: v.is_active,
    };
    const { error } = p
      ? await supabase.from("products").update(payload).eq("id", p.id)
      : await supabase.from("products").insert(payload);
    if (error) return void toast.error(errMsg(error));
    toast.success("Lưu thành công");
    void invalidate();
    onClose();
  });

  return (
    <Dialog open={!!product} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{isNew ? "Thêm sản phẩm" : "Sửa sản phẩm"}</DialogTitle>
          <DialogDescription>
            {isNew ? "Mã sản phẩm được tạo tự động." : "Đổi giá bán chỉ áp dụng cho đơn bán mới; đơn bán cũ giữ nguyên giá đã bán."}
          </DialogDescription>
        </DialogHeader>
        <form id="product-form" onSubmit={onSubmit} noValidate className="grid gap-4 sm:grid-cols-2">
          <Field label="Mã sản phẩm">
            <Input value={p?.code ?? "Tự động"} disabled className="h-9" />
          </Field>
          <Field label="Đơn vị tính" htmlFor="unit" required error={errors.unit?.message}>
            <Input id="unit" className="h-9" placeholder="Cái, Bộ, Hộp..." {...form.register("unit")} />
          </Field>
          <Field label="Tên sản phẩm" htmlFor="name" required error={errors.name?.message} className="sm:col-span-2">
            <Input id="name" className="h-9" autoFocus {...form.register("name")} />
          </Field>
          <Field label="Giá bán" htmlFor="sale_price" required error={errors.sale_price?.message} hint={`Đơn vị: ${MONEY_UNIT}`}>
            <Controller control={form.control} name="sale_price" render={({ field }) => (
              <CurrencyInput id="sale_price" value={field.value ?? ""} onChange={field.onChange} invalid={!!errors.sale_price} />
            )} />
          </Field>
          <Field label="Ngưỡng cảnh báo tồn" htmlFor="low" error={errors.low_stock_threshold?.message} hint="Để trống: dùng mức mặc định trong Cài đặt">
            <Controller control={form.control} name="low_stock_threshold" render={({ field }) => (
              <QuantityInput id="low" value={field.value ?? ""} onChange={field.onChange} invalid={!!errors.low_stock_threshold} />
            )} />
          </Field>
          <Field label="Ghi chú" htmlFor="note" className="sm:col-span-2">
            <Textarea id="note" rows={2} {...form.register("note")} />
          </Field>
          <div className="flex items-center justify-between rounded-lg border border-border px-3 py-2.5 sm:col-span-2">
            <div>
              <p className="text-sm font-medium">Đang kinh doanh</p>
              <p className="text-xs text-muted-foreground">Sản phẩm ngừng bán không thể chọn trong giao dịch mới</p>
            </div>
            <Controller control={form.control} name="is_active" render={({ field }) => (
              <Switch checked={!!field.value} onCheckedChange={field.onChange} aria-label="Trạng thái" />
            )} />
          </div>
        </form>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Hủy</Button>
          <Button type="submit" form="product-form" disabled={isSubmitting}>{isSubmitting ? "Đang lưu..." : "Lưu"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ProductDetailSheet({ product, onClose, onEdit }: { product: Product | null; onClose: () => void; onEdit: (p: Product) => void }) {
  const { data: balances } = useBalances();
  const { data: settings } = useSettings();
  const b = product ? balances?.get(product.id) : undefined;
  const threshold = product ? lowStockOf(product, settings?.default_low_stock ?? 5) : 0;
  const rows: [string, React.ReactNode][] = product ? [
    ["Mã sản phẩm", product.code],
    ["Đơn vị tính", product.unit],
    ["Giá bán hiện tại", `${fmtMoney(product.sale_price)} ${MONEY_UNIT}`],
    ["Ngưỡng cảnh báo", `${fmtNum(threshold)}${product.low_stock_threshold == null ? " (mặc định)" : ""}`],
    ["Tồn đầu kỳ", fmtNum(b?.opening_qty ?? 0)],
    ["Tổng nhập", fmtNum(b?.total_in ?? 0)],
    ["Tổng bán", fmtNum(b?.total_out ?? 0)],
    ["Tồn hiện tại", <span className="flex items-center gap-2">{fmtNum(b?.quantity ?? 0)} <StatusBadge kind={stockState(b?.quantity ?? 0, threshold)} /></span>],
    ["Giá vốn bình quân", `${fmtUnitCost(b?.avg_cost ?? 0)} ${MONEY_UNIT}`],
    ["Giá trị tồn kho", `${fmtMoney(b?.value ?? 0)} ${MONEY_UNIT}`],
    ["Trạng thái", <StatusBadge kind={product.is_active ? "active" : "inactive"} />],
    ["Ghi chú", product.note || "—"],
  ] : [];
  return (
    <Sheet open={!!product} onOpenChange={(o) => !o && onClose()}>
      <SheetContent className="w-full overflow-y-auto sm:max-w-md">
        <SheetHeader>
          <SheetTitle>{product?.name}</SheetTitle>
          <SheetDescription>Thông tin sản phẩm và tồn kho</SheetDescription>
        </SheetHeader>
        <dl className="mt-4 divide-y divide-border px-4 text-sm">
          {rows.map(([k, v]) => (
            <div key={k} className="flex items-center justify-between gap-4 py-2.5">
              <dt className="text-muted-foreground">{k}</dt><dd className="num text-right font-medium">{v}</dd>
            </div>
          ))}
        </dl>
        <div className="mt-4 flex gap-2 px-4">
          {product && <Button onClick={() => onEdit(product)}><Pencil className="h-4 w-4" />Sửa</Button>}
          {product && <Button variant="outline" asChild><Link to="/inventory" search={{ product: product.id }}>Lịch sử kho</Link></Button>}
        </div>
      </SheetContent>
    </Sheet>
  );
}
