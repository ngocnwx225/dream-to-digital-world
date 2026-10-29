import { useNavigate } from "@tanstack/react-router";
import { Controller, useFieldArray, useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Loader2, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { useBalances, useCustomers, useInvalidateAll, useProducts, useSettings, type SaleOrderDetail } from "@/lib/data";
import { amountFromUnit, consumableCost, parseDecimal, profitAfterConsumables, round3, toInputString } from "@/lib/calc";
import { errMsg, fmtMoney, fmtNum, MONEY_UNIT, todayISO } from "@/lib/format";
import { cn } from "@/lib/utils";
import { CurrencyInput, Field, QuantityInput } from "./inputs";
import { CustomerSelector, ProductSelector } from "./selectors";
import { Card, CellLabel, FormActions, lineHead, lineRemove, lineRow, th } from "./shared";

const lineSchema = z.object({
  product_id: z.string().min(1, "Chọn sản phẩm"),
  unit_price: z.string().refine((s) => (parseDecimal(s) ?? -1) >= 0, "Giá bán không hợp lệ"),
  quantity: z.string().refine((s) => (parseDecimal(s) ?? 0) > 0, "Số lượng phải lớn hơn 0"),
});
const schema = z
  .object({
    order_date: z.string().min(1, "Vui lòng chọn ngày bán"),
    mode: z.enum(["guest", "existing", "new"]),
    customer_id: z.string(),
    name: z.string().max(200),
    phone: z.string().max(30),
    plate: z.string().max(30),
    vehicle_name: z.string().max(100),
    save_customer: z.boolean(),
    note: z.string().max(1000),
    vehicle_count: z.string().refine((s) => /^\d{1,3}$/.test(s.trim()), "Số xe phải là số nguyên ≥ 0"),
    items: z.array(lineSchema).min(1, "Đơn bán phải có ít nhất một sản phẩm"),
  })
  .superRefine((v, ctx) => {
    if (v.mode === "existing" && !v.customer_id) ctx.addIssue({ code: "custom", path: ["customer_id"], message: "Vui lòng chọn khách hàng" });
    if (v.mode === "new" && !v.name.trim()) ctx.addIssue({ code: "custom", path: ["name"], message: "Vui lòng nhập tên khách hàng" });
  });
export type SaleFormValues = z.infer<typeof schema>;
type Line = SaleFormValues["items"][number];

const emptyLine = (): Line => ({ product_id: "", unit_price: "", quantity: "" });
/** Column template for the table-like layout of the line editor (container ≥ 48rem). */
const LINE_COLS = "@3xl:grid-cols-[2.25rem_minmax(11rem,1fr)_9.5rem_6rem_7rem_8rem_2.75rem]";

export function saleDefaults(o?: SaleOrderDetail): SaleFormValues {
  if (!o) {
    return {
      order_date: todayISO(), mode: "guest", customer_id: "", name: "", phone: "", plate: "", vehicle_name: "",
      save_customer: true, note: "", vehicle_count: "1", items: [emptyLine()],
    };
  }
  return {
    order_date: o.order_date,
    mode: o.customer_id ? "existing" : "guest",
    customer_id: o.customer_id ?? "",
    name: o.customer_name && o.customer_name !== "Khách lẻ" ? o.customer_name : "",
    phone: o.phone ?? "", plate: o.plate ?? "", vehicle_name: o.vehicle_name ?? "",
    save_customer: false, note: o.note ?? "",
    // Legacy orders have no vehicle data; start at 0 so nothing is charged unless the owner sets it.
    vehicle_count: String(o.vehicle_count ?? 0),
    items: o.sales_order_items.map((i) => ({ product_id: i.product_id, unit_price: toInputString(i.unit_price, 3), quantity: toInputString(i.quantity, 3) })),
  };
}

function SummaryRow({ k, v, muted }: { k: string; v: React.ReactNode; muted?: boolean }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <dt className="text-muted-foreground">{k}</dt>
      <dd className={cn("num text-right", muted ? "text-muted-foreground" : "font-medium text-foreground")}>{v}</dd>
    </div>
  );
}

const MODES = [
  { value: "guest", label: "Khách lẻ" },
  { value: "existing", label: "Khách hàng có sẵn" },
  { value: "new", label: "Khách hàng mới" },
] as const;

/**
 * `storedRate` is the consumable cost per vehicle saved on the order being edited (null for new
 * orders and legacy orders); it mirrors how save_sale picks the rate so the preview matches.
 */
export function SaleForm({ id, code, defaults, storedRate = null }: {
  id?: string; code?: string; defaults: SaleFormValues; storedRate?: number | null;
}) {
  const navigate = useNavigate();
  const invalidate = useInvalidateAll();
  const { data: products = [], isLoading } = useProducts();
  const { data: balances } = useBalances();
  const { data: customers = [] } = useCustomers();
  const { data: settings } = useSettings();
  const form = useForm<SaleFormValues>({ resolver: zodResolver(schema), defaultValues: defaults });
  const { fields, append, remove } = useFieldArray({ control: form.control, name: "items" });
  const items = useWatch({ control: form.control, name: "items" }) ?? [];
  const mode = useWatch({ control: form.control, name: "mode" });
  const vehiclesRaw = useWatch({ control: form.control, name: "vehicle_count" });
  const { errors, isSubmitting, isSubmitted } = form.formState;
  const keepIds = defaults.items.map((i) => i.product_id);

  // When editing, this order's own quantities are already deducted from stock, so add them back.
  const originalQty = new Map<string, number>();
  if (id) defaults.items.forEach((i) => originalQty.set(i.product_id, (originalQty.get(i.product_id) ?? 0) + (parseDecimal(i.quantity) ?? 0)));
  const available = (pid: string) => round3((balances?.get(pid)?.quantity ?? 0) + (originalQty.get(pid) ?? 0));
  const requested = new Map<string, number>();
  items.forEach((l) => l.product_id && requested.set(l.product_id, (requested.get(l.product_id) ?? 0) + (parseDecimal(l.quantity) ?? 0)));
  const short = (pid: string) => !!pid && round3(requested.get(pid) ?? 0) > available(pid);

  const lineTotal = (l: Line) => amountFromUnit(parseDecimal(l.unit_price) ?? 0, parseDecimal(l.quantity) ?? 0);
  const totalQty = round3(items.reduce((s, l) => s + (parseDecimal(l.quantity) ?? 0), 0));
  const totalAmount = round3(items.reduce((s, l) => s + lineTotal(l), 0));
  const opts = { shouldValidate: isSubmitted, shouldDirty: true };

  // Order summary (internal): consumables are a cost only, never added to what the customer pays.
  const vehicles = /^\d+$/.test(vehiclesRaw?.trim() ?? "") ? Number(vehiclesRaw) : 0;
  const rate = storedRate ?? (!id || vehicles > 0 ? (settings?.consumable_cost_per_vehicle ?? 0) : 0);
  const consumables = consumableCost(vehicles, rate);
  const estCogs = round3(items.reduce((s, l) => s + (parseDecimal(l.quantity) ?? 0) * (balances?.get(l.product_id)?.avg_cost ?? 0), 0));
  const { profit: estProfit } = profitAfterConsumables(totalAmount, estCogs, consumables);

  const onSubmit = form.handleSubmit(async (v) => {
    const shortRows = v.items.map((l, i) => (short(l.product_id) ? i : -1)).filter((i) => i >= 0);
    if (shortRows.length) {
      shortRows.forEach((i) => form.setError(`items.${i}.quantity`, { message: `Chỉ còn ${fmtNum(available(v.items[i]!.product_id))} trong kho` }));
      return void toast.error("Không đủ số lượng tồn kho");
    }
    const { data, error } = await supabase.rpc("save_sale", {
      p_id: (id ?? null) as string,
      p_date: v.order_date,
      p_customer_id: (v.mode === "existing" ? v.customer_id : null) as string,
      p_customer: { name: v.name.trim(), phone: v.phone.trim(), plate: v.plate.trim().toUpperCase(), vehicle_name: v.vehicle_name.trim() },
      p_save_customer: v.mode === "new" && v.save_customer,
      p_note: (v.note.trim() || null) as string,
      p_items: v.items.map((l) => ({ product_id: l.product_id, quantity: parseDecimal(l.quantity), unit_price: parseDecimal(l.unit_price) })),
      p_vehicle_count: Number(v.vehicle_count.trim()),
    });
    // Stock is re-validated in the database (including backdated orders); its message names the product and date.
    if (error) return void toast.error(errMsg(error));
    toast.success(id ? "Lưu thành công" : "Tạo đơn bán thành công");
    await invalidate();
    await navigate({ to: "/sales/$id", params: { id: data ?? id! } });
  });

  return (
    <form onSubmit={onSubmit} noValidate className="space-y-5">
      <Card title="Thông tin khách hàng">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <Field label="Mã đơn"><Input value={code ?? "Tự động tạo khi lưu"} disabled className="h-9" /></Field>
          <Field label="Ngày bán" htmlFor="order_date" required error={errors.order_date?.message}>
            <Input id="order_date" type="date" className="h-9" {...form.register("order_date")} />
          </Field>
          <Field label="Loại khách" className="sm:col-span-2 lg:col-span-1">
            <div role="radiogroup" className="flex rounded-lg border border-border bg-muted/50 p-0.5">
              {MODES.map((m) => (
                <button key={m.value} type="button" role="radio" aria-checked={mode === m.value}
                  onClick={() => { form.setValue("mode", m.value); if (m.value !== "existing") form.setValue("customer_id", ""); }}
                  className={cn("min-h-8 flex-1 rounded-md px-1.5 py-1.5 text-xs font-medium leading-tight transition-colors pointer-coarse:min-h-10 sm:text-sm",
                    mode === m.value ? "bg-card text-primary shadow-sm" : "text-muted-foreground hover:text-foreground")}>
                  {m.label}
                </button>
              ))}
            </div>
          </Field>

          {mode === "existing" && (
            <Field label="Khách hàng" required error={errors.customer_id?.message} className="sm:col-span-2 lg:col-span-3">
              <Controller control={form.control} name="customer_id" render={({ field }) => (
                <CustomerSelector customers={customers} value={field.value} invalid={!!errors.customer_id}
                  onChange={(c) => {
                    field.onChange(c.id);
                    // Preload the customer's usual details; they stay editable for this order (e.g. another vehicle).
                    form.setValue("name", c.name);
                    form.setValue("phone", c.phone ?? "");
                    form.setValue("plate", c.plate ?? "");
                    form.setValue("vehicle_name", c.vehicle_name ?? "");
                  }} />
              )} />
            </Field>
          )}

          <Field label="Tên khách hàng" htmlFor="name" required={mode === "new"} error={errors.name?.message}
            hint={mode === "guest" ? "Không bắt buộc với khách lẻ" : undefined}>
            <Input id="name" className="h-9" readOnly={mode === "existing"} placeholder={mode === "guest" ? "Khách lẻ" : ""} {...form.register("name")} />
          </Field>
          <Field label="Số điện thoại" htmlFor="phone">
            <Input id="phone" type="tel" inputMode="tel" className="h-9" {...form.register("phone")} />
          </Field>
          <Field label="Biển số xe" htmlFor="plate">
            <Input id="plate" className="h-9 uppercase" placeholder="VD: 59A-123.45" {...form.register("plate")} />
          </Field>
          <Field label="Tên xe" htmlFor="vehicle_name">
            <Input id="vehicle_name" className="h-9" placeholder="VD: Honda Vision" {...form.register("vehicle_name")} />
          </Field>
          <Field label="Ghi chú" htmlFor="note" className="sm:col-span-2">
            <Input id="note" className="h-9" {...form.register("note")} />
          </Field>
          {mode === "new" && (
            <div className="flex items-center gap-2 sm:col-span-2 lg:col-span-3">
              <Controller control={form.control} name="save_customer" render={({ field }) => (
                <Checkbox id="save_customer" checked={field.value} onCheckedChange={(c) => field.onChange(c === true)} />
              )} />
              <Label htmlFor="save_customer" className="text-sm font-normal">Lưu vào danh sách khách hàng để theo dõi lịch sử mua</Label>
            </div>
          )}
        </div>
      </Card>

      <Card title="Sản phẩm" action={<span className="text-xs text-muted-foreground">Đơn vị tiền: {MONEY_UNIT}</span>}>
        <div className="@container">
          <div className={cn(lineHead, LINE_COLS)}>
            <span className={th}>#</span>
            <span className={th}>Sản phẩm</span>
            <span className={cn(th, "text-right")}>Giá bán</span>
            <span className={cn(th, "text-right")}>Tồn hiện tại</span>
            <span className={cn(th, "text-right")}>Số lượng</span>
            <span className={cn(th, "text-right")}>Thành tiền</span>
            <span />
          </div>
          <div className="space-y-2.5 @3xl:space-y-0">
            {fields.map((f, i) => {
              const e = errors.items?.[i];
              const line = items[i] ?? emptyLine();
              const isShort = short(line.product_id);
              return (
                <div key={f.id} className={cn(lineRow, LINE_COLS)}>
                  <p className="col-span-2 pr-10 text-sm font-semibold text-muted-foreground @3xl:col-span-1 @3xl:px-3 @3xl:pt-2.5 @3xl:font-normal">
                    <span className="@3xl:hidden">Sản phẩm </span>{i + 1}
                  </p>
                  <div className="col-span-2 min-w-0 @3xl:col-span-1">
                    <ProductSelector products={products} balances={balances} showStock value={line.product_id} keepIds={keepIds} invalid={!!e?.product_id}
                      onChange={(pid) => {
                        form.setValue(`items.${i}.product_id`, pid, opts);
                        const p = products.find((x) => x.id === pid);
                        if (p) form.setValue(`items.${i}.unit_price`, toInputString(p.sale_price, 3), opts);
                      }} />
                    {e?.product_id && <p className="mt-1 text-xs text-destructive">{e.product_id.message}</p>}
                  </div>
                  <div className="min-w-0">
                    <CellLabel className="@3xl:hidden">Giá bán</CellLabel>
                    <CurrencyInput aria-label="Giá bán" value={line.unit_price} onChange={(v) => form.setValue(`items.${i}.unit_price`, v, opts)} invalid={!!e?.unit_price} />
                    {e?.unit_price && <p className="mt-1 text-xs text-destructive">{e.unit_price.message}</p>}
                  </div>
                  <div className={cn("num text-sm @3xl:px-1 @3xl:pt-2.5 @3xl:text-right", isShort ? "font-semibold text-destructive" : "text-muted-foreground")}>
                    <CellLabel className="@3xl:hidden">Tồn hiện tại</CellLabel>
                    <span className="flex h-9 items-center @3xl:block @3xl:h-auto">{line.product_id ? fmtNum(available(line.product_id)) : "—"}</span>
                  </div>
                  <div className="min-w-0">
                    <CellLabel className="@3xl:hidden">Số lượng</CellLabel>
                    <QuantityInput aria-label="Số lượng" value={line.quantity} onChange={(v) => form.setValue(`items.${i}.quantity`, v, opts)} invalid={!!e?.quantity || isShort} />
                    {e?.quantity ? <p className="mt-1 text-xs text-destructive">{e.quantity.message}</p>
                      : isShort && <p className="mt-1 text-xs text-destructive">Vượt tồn kho</p>}
                  </div>
                  <div className="num text-sm font-semibold @3xl:px-1 @3xl:pt-2.5 @3xl:text-right">
                    <CellLabel className="font-medium @3xl:hidden">Thành tiền</CellLabel>
                    <span className="flex h-9 items-center text-base @3xl:block @3xl:h-auto @3xl:text-sm">{fmtMoney(lineTotal(line))}</span>
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

        <div className="mt-5 grid gap-5 border-t border-border pt-4 lg:grid-cols-[1fr_minmax(300px,380px)]">
          <Field label="Số xe" htmlFor="vehicle_count" error={errors.vehicle_count?.message} className="max-w-xs"
            hint={`Vật tư tiêu hao ${fmtMoney(rate)} ${MONEY_UNIT}/xe. Đặt 0 nếu chỉ bán phụ tùng.`}>
            <QuantityInput id="vehicle_count" value={vehiclesRaw ?? ""} invalid={!!errors.vehicle_count} className="max-w-[120px]"
              onChange={(v) => form.setValue("vehicle_count", v.replace(/\D/g, ""), opts)} />
          </Field>
          <div className="rounded-xl bg-muted/50 p-4 text-sm">
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Tổng kết đơn hàng</p>
            <dl className="space-y-1.5">
              <SummaryRow k="Tổng số lượng" v={fmtNum(totalQty)} />
              <SummaryRow k="Tổng tiền bán" v={<><span className="num text-lg font-bold text-primary">{fmtMoney(totalAmount)}</span> {MONEY_UNIT}</>} />
              <SummaryRow k="Giá vốn sản phẩm (dự kiến)" v={`${fmtMoney(estCogs)} ${MONEY_UNIT}`} muted />
              <SummaryRow k={`Vật tư tiêu hao (${fmtNum(vehicles)} xe)`} v={`${fmtMoney(consumables)} ${MONEY_UNIT}`} muted />
              <div className="border-t border-border pt-1.5">
                <SummaryRow k="Lợi nhuận dự kiến" v={<span className={cn("num font-semibold", estProfit >= 0 ? "text-success" : "text-destructive")}>{fmtMoney(estProfit)} {MONEY_UNIT}</span>} />
              </div>
            </dl>
            <p className="mt-2 text-xs text-muted-foreground">Khách thanh toán theo Tổng tiền bán; vật tư tiêu hao chỉ dùng để tính lợi nhuận.</p>
          </div>
        </div>
      </Card>

      <FormActions>
        <Button type="button" variant="outline" onClick={() => window.history.back()}>Hủy</Button>
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting && <Loader2 className="h-4 w-4 animate-spin" />}{id ? "Lưu thay đổi" : "Hoàn tất bán hàng"}
        </Button>
      </FormActions>
    </form>
  );
}
