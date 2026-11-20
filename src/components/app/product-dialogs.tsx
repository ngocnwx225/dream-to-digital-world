import { useEffect, useState } from "react";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { CurrencyInput, Field, QuantityInput } from "./inputs";
import { ProductSelector } from "./selectors";
import { supabase } from "@/integrations/supabase/client";
import { useInvalidateAll, useOpenings, useProducts, type Product } from "@/lib/data";
import { parseDecimal, toInputString, updateCostLine, type CostLine } from "@/lib/calc";
import { errMsg, fmtDate, fmtMoney, fmtNum, MONEY_UNIT, todayISO } from "@/lib/format";

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

export function ProductFormDialog({ product, onClose }: { product: Product | "new" | null; onClose: () => void }) {
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

const EMPTY_LINE: CostLine = { quantity: "", unit_cost: "", amount: "", driver: "amount" };

export function OpeningDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
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
