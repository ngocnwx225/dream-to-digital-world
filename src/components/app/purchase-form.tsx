import { useNavigate } from "@tanstack/react-router";
import { useFieldArray, useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Loader2, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { useInvalidateAll, useProducts } from "@/lib/data";
import { parseDecimal, round3, toInputString, unitFromAmount, updateCostLine } from "@/lib/calc";
import { errMsg, fmtMoney, fmtNum, MONEY_UNIT, todayISO } from "@/lib/format";
import { cn } from "@/lib/utils";
import { CurrencyInput, Field, QuantityInput } from "./inputs";
import { ProductSelector } from "./selectors";
import { Card, CellLabel, FormActions, lineHead, lineRemove, lineRow, th } from "./shared";

const positive = (msg: string) => z.string().refine((s) => (parseDecimal(s) ?? 0) > 0, msg);
const lineSchema = z.object({
  product_id: z.string().min(1, "Chọn sản phẩm"),
  quantity: positive("Số lượng phải lớn hơn 0"),
  unit_cost: z.string(),
  amount: z.string().refine((s) => (parseDecimal(s) ?? -1) >= 0, "Nhập thành tiền"),
  driver: z.enum(["amount", "unit"]),
});
const schema = z.object({
  receipt_date: z.string().min(1, "Vui lòng chọn ngày nhập"),
  note: z.string().max(1000),
  items: z.array(lineSchema).min(1, "Phiếu nhập phải có ít nhất một sản phẩm"),
});
export type PurchaseFormValues = z.infer<typeof schema>;
type Line = PurchaseFormValues["items"][number];

const emptyLine = (): Line => ({ product_id: "", quantity: "", unit_cost: "", amount: "", driver: "amount" });
/** Column template for the table-like layout of the line editor (container ≥ 48rem). */
const LINE_COLS = "@3xl:grid-cols-[2.25rem_minmax(11rem,1fr)_7.5rem_10rem_10rem_2.75rem]";

export function purchaseDefaults(src?: {
  receipt_date: string; note: string | null; purchase_items: { product_id: string; quantity: number; unit_cost: number; amount: number }[];
}): PurchaseFormValues {
  if (!src) return { receipt_date: todayISO(), note: "", items: [emptyLine()] };
  return {
    receipt_date: src.receipt_date,
    note: src.note ?? "",
    items: src.purchase_items.map((i) => ({
      product_id: i.product_id, quantity: toInputString(i.quantity, 3), unit_cost: toInputString(i.unit_cost, 4),
      amount: toInputString(i.amount, 3), driver: "amount" as const,
    })),
  };
}

export function PurchaseForm({ id, code, defaults }: { id?: string; code?: string; defaults: PurchaseFormValues }) {
  const navigate = useNavigate();
  const invalidate = useInvalidateAll();
  const { data: products = [], isLoading } = useProducts();
  const form = useForm<PurchaseFormValues>({ resolver: zodResolver(schema), defaultValues: defaults });
  const { fields, append, remove } = useFieldArray({ control: form.control, name: "items" });
  const items = useWatch({ control: form.control, name: "items" }) ?? [];
  const { errors, isSubmitting, isSubmitted } = form.formState;
  const keepIds = defaults.items.map((i) => i.product_id);

  const totalQty = round3(items.reduce((s, l) => s + (parseDecimal(l.quantity) ?? 0), 0));
  const totalAmount = round3(items.reduce((s, l) => s + (parseDecimal(l.amount) ?? 0), 0));

  // Each edit recomputes the dependent field once (see updateCostLine), so there are no effect loops.
  const editLine = (i: number, field: "quantity" | "unit_cost" | "amount", value: string) => {
    const cur = form.getValues(`items.${i}`);
    const next = updateCostLine(cur, field, value);
    const opts = { shouldValidate: isSubmitted, shouldDirty: true };
    form.setValue(`items.${i}.quantity`, next.quantity, opts);
    form.setValue(`items.${i}.unit_cost`, next.unit_cost, opts);
    form.setValue(`items.${i}.amount`, next.amount, opts);
    form.setValue(`items.${i}.driver`, next.driver);
  };

  const onSubmit = form.handleSubmit(async (v) => {
    const p_items = v.items.map((l) => {
      const quantity = parseDecimal(l.quantity)!;
      const amount = round3(parseDecimal(l.amount)!);
      const typedUnit = parseDecimal(l.unit_cost);
      // The total is the value of record; send the exact unit cost rather than the rounded display.
      const unit_cost = l.driver === "unit" && typedUnit != null ? typedUnit : unitFromAmount(amount, quantity);
      return { product_id: l.product_id, quantity, amount, unit_cost };
    });
    const { data, error } = await supabase.rpc("save_purchase", {
      p_id: (id ?? null) as string, p_date: v.receipt_date, p_note: (v.note.trim() || null) as string, p_items,
    });
    if (error) return void toast.error(errMsg(error));
    toast.success(id ? "Lưu thành công" : "Nhập hàng thành công");
    await invalidate();
    await navigate({ to: "/purchases/$id", params: { id: data ?? id! } });
  });

  return (
    <form onSubmit={onSubmit} noValidate className="space-y-5">
      <Card title="Thông tin chung">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <Field label="Mã phiếu"><Input value={code ?? "Tự động tạo khi lưu"} disabled className="h-9" /></Field>
          <Field label="Ngày nhập" htmlFor="receipt_date" required error={errors.receipt_date?.message}>
            <Input id="receipt_date" type="date" className="h-9" {...form.register("receipt_date")} />
          </Field>
          <Field label="Ghi chú" htmlFor="note" className="sm:col-span-2 lg:col-span-3">
            <Textarea id="note" rows={2} placeholder="Nhà cung cấp, số hóa đơn..." {...form.register("note")} />
          </Field>
        </div>
      </Card>

      <Card title="Chi tiết sản phẩm" action={<span className="text-xs text-muted-foreground">Đơn vị tiền: {MONEY_UNIT}</span>}>
        <p className="mb-3 text-xs text-muted-foreground">Nhập <b>Thành tiền</b> và <b>Số lượng</b> để tự tính <b>Đơn giá nhập</b> = Thành tiền / Số lượng. Bạn cũng có thể sửa đơn giá, thành tiền sẽ tự tính lại.</p>
        <div className="@container">
          <div className={cn(lineHead, LINE_COLS)}>
            <span className={th}>#</span>
            <span className={th}>Sản phẩm</span>
            <span className={cn(th, "text-right")}>Số lượng</span>
            <span className={cn(th, "text-right")}>Đơn giá nhập</span>
            <span className={cn(th, "text-right")}>Thành tiền nhập</span>
            <span />
          </div>
          <div className="space-y-2.5 @3xl:space-y-0">
            {fields.map((f, i) => {
              const e = errors.items?.[i];
              const line = items[i] ?? emptyLine();
              return (
                <div key={f.id} className={cn(lineRow, LINE_COLS)}>
                  <p className="col-span-2 pr-10 text-sm font-semibold text-muted-foreground @3xl:col-span-1 @3xl:px-3 @3xl:pt-2.5 @3xl:font-normal">
                    <span className="@3xl:hidden">Sản phẩm </span>{i + 1}
                  </p>
                  <div className="col-span-2 min-w-0 @3xl:col-span-1">
                    <ProductSelector products={products} value={line.product_id} keepIds={keepIds} invalid={!!e?.product_id}
                      onChange={(pid) => form.setValue(`items.${i}.product_id`, pid, { shouldValidate: isSubmitted })} />
                    {e?.product_id && <p className="mt-1 text-xs text-destructive">{e.product_id.message}</p>}
                  </div>
                  <div className="min-w-0">
                    <CellLabel className="@3xl:hidden">Số lượng</CellLabel>
                    <QuantityInput aria-label="Số lượng" value={line.quantity} onChange={(v) => editLine(i, "quantity", v)} invalid={!!e?.quantity} />
                    {e?.quantity && <p className="mt-1 text-xs text-destructive">{e.quantity.message}</p>}
                  </div>
                  <div className="min-w-0">
                    <CellLabel className="@3xl:hidden">Đơn giá nhập</CellLabel>
                    <CurrencyInput aria-label="Đơn giá nhập" value={line.unit_cost} onChange={(v) => editLine(i, "unit_cost", v)} />
                  </div>
                  <div className="col-span-2 min-w-0 @3xl:col-span-1">
                    <CellLabel className="@3xl:hidden">Thành tiền nhập</CellLabel>
                    <CurrencyInput aria-label="Thành tiền nhập" value={line.amount} onChange={(v) => editLine(i, "amount", v)} invalid={!!e?.amount} />
                    {e?.amount && <p className="mt-1 text-xs text-destructive">{e.amount.message}</p>}
                  </div>
                  <div className={lineRemove}>
                    <Button type="button" variant="ghost" size="icon" className="h-9 w-9 text-muted-foreground hover:text-destructive"
                      aria-label={`Xóa dòng ${i + 1}`} disabled={fields.length === 1} onClick={() => remove(i)}><Trash2 className="h-4 w-4" /></Button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
        {errors.items?.root?.message && <p className="mt-2 text-sm text-destructive">{errors.items.root.message}</p>}
        <Button type="button" variant="outline" className="mt-3 w-full border-dashed sm:w-auto" onClick={() => append(emptyLine())} disabled={isLoading}>
          <Plus className="h-4 w-4" />Thêm sản phẩm
        </Button>

        <dl className="mt-5 space-y-1.5 rounded-xl bg-muted/50 p-4 text-sm sm:ml-auto sm:max-w-sm">
          <div className="flex items-baseline justify-between gap-3"><dt className="text-muted-foreground">Tổng số lượng</dt><dd className="num font-semibold">{fmtNum(totalQty)}</dd></div>
          <div className="flex items-baseline justify-between gap-3">
            <dt className="text-muted-foreground">Tổng tiền nhập</dt>
            <dd className="text-right"><span className="num text-xl font-bold text-primary">{fmtMoney(totalAmount)}</span> <span className="text-muted-foreground">{MONEY_UNIT}</span></dd>
          </div>
        </dl>
      </Card>

      <FormActions>
        <Button type="button" variant="outline" onClick={() => window.history.back()}>Hủy</Button>
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting && <Loader2 className="h-4 w-4 animate-spin" />}{id ? "Lưu thay đổi" : "Hoàn tất nhập hàng"}
        </Button>
      </FormActions>
    </form>
  );
}
