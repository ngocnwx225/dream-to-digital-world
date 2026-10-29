import { useEffect, useMemo, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { AlertTriangle, CheckCircle2, FileSpreadsheet, Loader2, Upload, XCircle } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Card, ConfirmDialog, EmptyState, PageHeader, TableWrap, td, th, theadRow, trHover } from "@/components/app/shared";
import { CurrencyInput, norm } from "@/components/app/inputs";
import { supabase } from "@/integrations/supabase/client";
import { usePurchases, useCustomers, useInvalidateAll, useProducts, useSales, type Product } from "@/lib/data";
import { parseDecimal, round3, toInputString, unitFromAmount } from "@/lib/calc";
import { customerKey, isConsumableName, parseWorkbook, purchaseUnit, type PurchaseRow, type SaleRow } from "@/lib/excel-import";
import { readFirstSheet } from "@/lib/xlsx-reader";
import { errMsg, fmtDate, fmtMoney, fmtNum, fmtUnitCost, MONEY_UNIT, MONEY_UNIT_SHORT, todayISO } from "@/lib/format";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_app/import-excel")({
  head: () => ({ meta: [{ title: "Nhập dữ liệu từ Excel – Chơi Xe-Xe Chơi" }] }),
  component: ImportExcelPage,
});

type PEdit = { row: PurchaseRow; include: boolean; date: string };
type SEdit = { row: SaleRow; include: boolean; date: string; phone: string; vehicles: string };
type LogLine = { ok: boolean; text: string };

function ImportExcelPage() {
  const [fileName, setFileName] = useState("");
  const [parseId, setParseId] = useState(0);
  const [parseError, setParseError] = useState("");
  const [purchases, setPurchases] = useState<PEdit[]>([]);
  const [sales, setSales] = useState<SEdit[]>([]);
  const [prices, setPrices] = useState<Record<string, string>>({});
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [running, setRunning] = useState(false);
  const [log, setLog] = useState<LogLine[] | null>(null);
  const { data: products = [] } = useProducts();
  const { data: customers = [] } = useCustomers();
  const existingPurchases = usePurchases();
  const existingSales = useSales();
  const invalidate = useInvalidateAll();
  const today = todayISO();

  // Sales need the vehicle-count column; refuse to import into a database without it.
  const schema = useQuery({
    queryKey: ["schema-consumables"],
    queryFn: async () => {
      const { error } = await supabase.from("settings").select("consumable_cost_per_vehicle").eq("id", 1).maybeSingle();
      return !error;
    },
  });

  const onFile = async (f: File | undefined) => {
    if (!f) return;
    setFileName(f.name); setParseError(""); setLog(null);
    try {
      const { purchases: ps, sales: ss } = parseWorkbook(await readFirstSheet(await f.arrayBuffer()));
      // Defaults: consumables (covered by the per-vehicle cost) and zero-price lines start excluded.
      setPurchases(ps.map((row) => ({ row, include: !isConsumableName(row.product), date: row.date.iso ?? "" })));
      setSales(ss.map((row) => ({ row, include: (row.unitPrice ?? 0) > 0, date: row.date.iso ?? "", phone: row.phone, vehicles: "1" })));
      setPrices({});
      setParseId((n) => n + 1);
    } catch (e) {
      setPurchases([]); setSales([]);
      setParseError(errMsg(e) === "Có lỗi xảy ra, vui lòng thử lại" ? "Không đọc được file. Hãy chọn file .xlsx." : errMsg(e));
    }
  };

  const findProduct = (name: string): Product | undefined => products.find((p) => norm(p.name) === norm(name));

  // Mark rows that look already imported (same date, product, quantity and amount).
  const dupPurchase = (e: PEdit) => !!existingPurchases.data?.some((r) =>
    r.status === "completed" && r.receipt_date === e.date && r.purchase_items.length === 1 &&
    norm(r.purchase_items[0]?.products?.name) === norm(e.row.product) &&
    r.purchase_items[0]?.quantity === e.row.quantity && r.total_amount === e.row.amount);
  const dupSale = (e: SEdit) => !!existingSales.data?.some((r) =>
    r.status === "completed" && r.order_date === e.date && r.sales_order_items.length === 1 &&
    norm(r.sales_order_items[0]?.products?.name) === norm(e.row.product) &&
    r.sales_order_items[0]?.quantity === e.row.quantity && r.total_amount === e.row.amount);

  // Uncheck likely duplicates once existing data has loaded for a freshly parsed file.
  useEffect(() => {
    if (!existingPurchases.data || !existingSales.data) return;
    setPurchases((xs) => xs.map((x) => (dupPurchase(x) ? { ...x, include: false } : x)));
    setSales((xs) => xs.map((x) => (dupSale(x) ? { ...x, include: false } : x)));
  }, [parseId, existingPurchases.data, existingSales.data]); // eslint-disable-line react-hooks/exhaustive-deps

  const incP = purchases.filter((p) => p.include);
  const incS = sales.filter((s) => s.include);

  // Products to create: names used by included rows that don't exist yet.
  const newProducts = useMemo(() => {
    const m = new Map<string, { name: string; defaultPrice: number }>();
    for (const n of [...incP.map((p) => p.row.product), ...incS.map((s) => s.row.product)]) {
      if (findProduct(n) || m.has(norm(n))) continue;
      const seen = sales.filter((s) => norm(s.row.product) === norm(n)).map((s) => s.row.unitPrice ?? 0);
      m.set(norm(n), { name: n, defaultPrice: Math.max(0, ...seen) });
    }
    return [...m.entries()].map(([k, v]) => ({ key: k, ...v, price: prices[k] ?? toInputString(v.defaultPrice, 3) }));
  }, [incP, incS, products, prices, sales]); // eslint-disable-line react-hooks/exhaustive-deps

  // Customers: grouped by phone (or name without phone); reuse an existing customer with the same phone.
  const customerPlan = useMemo(() => {
    const m = new Map<string, { name: string; phone: string; vehicle: string; existingId?: string }>();
    for (const s of incS) {
      const k = customerKey({ customer: s.row.customer, phone: s.phone });
      if (m.has(k)) continue;
      const existing = s.phone ? customers.find((c) => (c.phone ?? "").replace(/[^\d+]/g, "") === s.phone) : undefined;
      m.set(k, { name: s.row.customer || "Khách lẻ", phone: s.phone, vehicle: s.row.vehicle, ...(existing ? { existingId: existing.id } : {}) });
    }
    return m;
  }, [incS, customers]);

  const problems = [
    ...incP.filter((p) => !p.date).map((p) => `Mua vào dòng ${p.row.excelRow}: thiếu ngày nhập hợp lệ`),
    ...incP.filter((p) => !(p.row.quantity && p.row.quantity > 0) || p.row.amount == null || p.row.amount < 0).map((p) => `Mua vào dòng ${p.row.excelRow}: số lượng / thành tiền không hợp lệ`),
    ...incS.filter((s) => !s.date).map((s) => `Bán ra dòng ${s.row.excelRow}: thiếu ngày bán hợp lệ`),
    ...incS.filter((s) => !(s.row.quantity && s.row.quantity > 0) || s.row.unitPrice == null || s.row.unitPrice < 0).map((s) => `Bán ra dòng ${s.row.excelRow}: số lượng / đơn giá không hợp lệ`),
    ...incS.filter((s) => !/^\d{1,3}$/.test(s.vehicles)).map((s) => `Bán ra dòng ${s.row.excelRow}: số xe không hợp lệ`),
    ...newProducts.filter((p) => (parseDecimal(p.price) ?? -1) < 0).map((p) => `Sản phẩm mới "${p.name}": giá bán không hợp lệ`),
  ];
  const canImport = schema.data === true && problems.length === 0 && incP.length + incS.length > 0 && !running;

  const run = async () => {
    setConfirmOpen(false); setRunning(true);
    const out: LogLine[] = [];
    const push = (ok: boolean, text: string) => { out.push({ ok, text }); setLog([...out]); };
    try {
      // 1. Products
      const ids = new Map(products.map((p) => [norm(p.name), p.id]));
      for (const p of newProducts) {
        const { data, error } = await supabase.from("products")
          .insert({ name: p.name.trim(), unit: "Cái", sale_price: parseDecimal(p.price) ?? 0, note: `Tạo khi nhập từ Excel (${fileName})` })
          .select("id, code").single();
        if (error) { push(false, `Sản phẩm "${p.name}": ${errMsg(error)}`); continue; }
        ids.set(p.key, data.id);
        push(true, `Tạo sản phẩm ${data.code} – ${p.name}`);
      }
      // 2. Purchases first (oldest first); stock is replayed by date, so sales below see them on the right day.
      for (const p of [...incP].sort((a, b) => a.date.localeCompare(b.date))) {
        const pid = ids.get(norm(p.row.product));
        if (!pid) { push(false, `Mua vào dòng ${p.row.excelRow}: không có sản phẩm "${p.row.product}"`); continue; }
        const qty = p.row.quantity!, amount = round3(p.row.amount!);
        const { error } = await supabase.rpc("save_purchase", {
          p_id: null as unknown as string, p_date: p.date, p_note: `Nhập từ Excel – dòng ${p.row.excelRow}`,
          p_items: [{ product_id: pid, quantity: qty, amount, unit_cost: unitFromAmount(amount, qty) }],
        });
        push(!error, `Phiếu nhập ${fmtDate(p.date)}: ${p.row.product} × ${fmtNum(qty)} = ${fmtMoney(amount)}${error ? ` — ${errMsg(error)}` : ""}`);
      }
      // 3. Customers
      const custIds = new Map<string, string>();
      for (const [k, c] of customerPlan) {
        if (c.existingId) { custIds.set(k, c.existingId); continue; }
        const { data, error } = await supabase.from("customers")
          .insert({ name: c.name, phone: c.phone || null, vehicle_name: c.vehicle || null, note: "Nhập từ Excel" })
          .select("id, code").single();
        if (error) { push(false, `Khách hàng "${c.name}": ${errMsg(error)}`); continue; }
        custIds.set(k, data.id);
        push(true, `Tạo khách hàng ${data.code} – ${c.name}`);
      }
      // 4. Sales, oldest first
      for (const s of [...incS].sort((a, b) => a.date.localeCompare(b.date))) {
        const pid = ids.get(norm(s.row.product));
        const cid = custIds.get(customerKey({ customer: s.row.customer, phone: s.phone }));
        if (!pid) { push(false, `Bán ra dòng ${s.row.excelRow}: không có sản phẩm "${s.row.product}"`); continue; }
        const { error } = await supabase.rpc("save_sale", {
          p_id: null as unknown as string, p_date: s.date, p_customer_id: (cid ?? null) as string,
          p_customer: { name: s.row.customer, phone: s.phone, plate: "", vehicle_name: s.row.vehicle },
          p_save_customer: false, p_note: `Nhập từ Excel – dòng ${s.row.excelRow}`,
          p_items: [{ product_id: pid, quantity: s.row.quantity, unit_price: s.row.unitPrice }],
          p_vehicle_count: Number(s.vehicles),
        });
        push(!error, `Đơn bán ${fmtDate(s.date)}: ${s.row.customer || "Khách lẻ"} – ${s.row.product} × ${fmtNum(s.row.quantity)}${error ? ` — ${errMsg(error)}` : ""}`);
      }
    } finally {
      setRunning(false);
      await invalidate();
      const failed = out.filter((l) => !l.ok).length;
      if (failed) toast.error(`Nhập xong, ${failed} mục bị lỗi – xem chi tiết bên dưới`);
      else toast.success("Nhập dữ liệu thành công");
    }
  };

  const setP = (i: number, patch: Partial<PEdit>) => setPurchases((xs) => xs.map((x, j) => (j === i ? { ...x, ...patch } : x)));
  const setS = (i: number, patch: Partial<SEdit>) => setSales((xs) => xs.map((x, j) => (j === i ? { ...x, ...patch } : x)));
  const hasData = purchases.length + sales.length > 0;

  return (
    <>
      <PageHeader title="Nhập dữ liệu từ Excel" subtitle="Đọc bảng Mua vào và Bán ra, xem trước, chỉnh sửa rồi lưu vào hệ thống"
        actions={<Button variant="outline" asChild><Link to="/settings">Về Cài đặt</Link></Button>} />

      {schema.data === false && (
        <div className="mb-4 flex gap-3 rounded-xl border border-destructive/30 bg-danger-soft p-4 text-sm">
          <AlertTriangle className="h-5 w-5 shrink-0 text-destructive" />
          <p><b className="text-destructive">Cơ sở dữ liệu chưa được cập nhật.</b> Cần áp dụng migration <code>0001_sale_consumable_cost</code> (số xe & chi phí vật tư tiêu hao) trước khi nhập đơn bán.</p>
        </div>
      )}

      <Card title="1. Chọn file" icon={FileSpreadsheet}>
        <label className="flex cursor-pointer flex-col items-center gap-2 rounded-xl border-2 border-dashed border-border p-6 text-center hover:border-primary/50 hover:bg-accent/40">
          <Upload className="h-6 w-6 text-primary" />
          <span className="text-sm font-medium">{fileName || "Chọn file .xlsx"}</span>
          <span className="text-xs text-muted-foreground">Bảng "Mua vào" (Sản phẩm, SL, TT, Đơn giá, Ngày nhập) và "Bán ra" (Tên, SĐT, Xe, Sản phẩm, Đơn giá, SL, TT, Ngày bán)</span>
          <input type="file" accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" className="sr-only"
            onChange={(e) => { void onFile(e.target.files?.[0]); e.target.value = ""; }} />
        </label>
        {parseError && <p className="mt-3 text-sm text-destructive">{parseError}</p>}
      </Card>

      {hasData && (
        <>
          <Card title={`2. Mua vào (${incP.length}/${purchases.length} dòng sẽ nhập)`} className="mt-5">
            <TableWrap>
              <table className="w-full">
                <thead><tr className={theadRow}>
                  <th className={th}>Nhập</th><th className={th}>Dòng</th><th className={th}>Sản phẩm</th>
                  <th className={cn(th, "text-right")}>SL</th><th className={cn(th, "text-right")}>Thành tiền ({MONEY_UNIT_SHORT})</th>
                  <th className={cn(th, "text-right")}>Đơn giá nhập</th><th className={th}>Ngày nhập</th><th className={th}>Ghi chú</th>
                </tr></thead>
                <tbody>
                  {purchases.map((p, i) => {
                    const notes = [
                      isConsumableName(p.row.product) && "Vật tư tiêu hao – đã tính 5 nghìn/xe, không nhập kho",
                      !p.row.date.iso && `Ngày gốc "${p.row.date.raw || "trống"}" không hợp lệ`,
                      p.date > today && "Ngày trong tương lai",
                      dupPurchase(p) && "Có thể đã nhập trước đó",
                    ].filter(Boolean);
                    return (
                      <tr key={p.row.key} className={cn(trHover, !p.include && "opacity-50")}>
                        <td className={td}><Checkbox checked={p.include} onCheckedChange={(c) => setP(i, { include: c === true })} aria-label="Nhập dòng này" /></td>
                        <td className={cn(td, "text-muted-foreground")}>{p.row.excelRow}</td>
                        <td className={cn(td, "font-medium")}>{p.row.product}{p.include && !findProduct(p.row.product) && <span className="ml-1.5 text-xs font-normal text-primary">(mới)</span>}</td>
                        <td className={cn(td, "num text-right")}>{fmtNum(p.row.quantity)}</td>
                        <td className={cn(td, "num text-right")}>{fmtMoney(p.row.amount)}</td>
                        <td className={cn(td, "num text-right text-muted-foreground")}>{fmtUnitCost(purchaseUnit(p.row))}</td>
                        <td className="px-2 py-2"><Input type="date" value={p.date} onChange={(e) => setP(i, { date: e.target.value })}
                          className={cn("h-8 w-40 bg-card text-sm", p.include && !p.date && "border-destructive")} /></td>
                        <td className={cn(td, "whitespace-normal text-xs text-warning")}>{notes.join(" · ")}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </TableWrap>
          </Card>

          <Card title={`3. Bán ra (${incS.length}/${sales.length} dòng sẽ nhập)`} className="mt-5">
            <p className="mb-3 text-xs text-muted-foreground">Khách hàng được gộp theo số điện thoại; sửa SĐT nếu file bị sai. Mỗi dòng là một đơn bán; vật tư tiêu hao tính theo "Số xe".</p>
            <TableWrap>
              <table className="w-full">
                <thead><tr className={theadRow}>
                  <th className={th}>Nhập</th><th className={th}>Dòng</th><th className={th}>Khách</th><th className={th}>SĐT</th><th className={th}>Xe</th>
                  <th className={th}>Sản phẩm</th><th className={cn(th, "text-right")}>Đơn giá</th><th className={cn(th, "text-right")}>SL</th>
                  <th className={cn(th, "text-right")}>Thành tiền</th><th className={th}>Số xe</th><th className={th}>Ngày bán</th><th className={th}>Ghi chú</th>
                </tr></thead>
                <tbody>
                  {sales.map((s, i) => {
                    const notes = [
                      (s.row.unitPrice ?? 0) === 0 && "Giá 0",
                      !s.row.date.iso && `Ngày gốc "${s.row.date.raw || "trống"}" không hợp lệ`,
                      s.date > today && "Ngày trong tương lai",
                      dupSale(s) && "Có thể đã nhập trước đó",
                      s.include && customerPlan.get(customerKey({ customer: s.row.customer, phone: s.phone }))?.existingId && "Khách đã có trong hệ thống",
                    ].filter(Boolean);
                    return (
                      <tr key={s.row.key} className={cn(trHover, !s.include && "opacity-50")}>
                        <td className={td}><Checkbox checked={s.include} onCheckedChange={(c) => setS(i, { include: c === true })} aria-label="Nhập dòng này" /></td>
                        <td className={cn(td, "text-muted-foreground")}>{s.row.excelRow}</td>
                        <td className={cn(td, "font-medium")}>{s.row.customer || "Khách lẻ"}</td>
                        <td className="px-2 py-2"><Input value={s.phone} inputMode="tel" onChange={(e) => setS(i, { phone: e.target.value.replace(/[^\d+]/g, "") })} className="h-8 w-[130px] bg-card text-sm" /></td>
                        <td className={td}>{s.row.vehicle || "—"}</td>
                        <td className={td}>{s.row.product}</td>
                        <td className={cn(td, "num text-right")}>{fmtMoney(s.row.unitPrice)}</td>
                        <td className={cn(td, "num text-right")}>{fmtNum(s.row.quantity)}</td>
                        <td className={cn(td, "num text-right font-semibold")}>{fmtMoney(s.row.amount)}</td>
                        <td className="px-2 py-2"><Input value={s.vehicles} inputMode="numeric" onChange={(e) => setS(i, { vehicles: e.target.value.replace(/\D/g, "") })}
                          className={cn("h-8 w-[64px] bg-card text-right text-sm", s.include && !/^\d{1,3}$/.test(s.vehicles) && "border-destructive")} /></td>
                        <td className="px-2 py-2"><Input type="date" value={s.date} onChange={(e) => setS(i, { date: e.target.value })}
                          className={cn("h-8 w-40 bg-card text-sm", s.include && !s.date && "border-destructive")} /></td>
                        <td className={cn(td, "whitespace-normal text-xs text-warning")}>{notes.join(" · ")}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </TableWrap>
          </Card>

          <Card title="4. Kiểm tra & lưu" className="mt-5">
            <div className="grid gap-5 lg:grid-cols-2">
              <div className="space-y-3 text-sm">
                <p className="font-medium">Sẽ tạo:</p>
                <ul className="space-y-1 text-muted-foreground">
                  <li>• {newProducts.length} sản phẩm mới, {incP.length} phiếu nhập ({fmtMoney(round3(incP.reduce((t, p) => t + (p.row.amount ?? 0), 0)))} {MONEY_UNIT})</li>
                  <li>• {[...customerPlan.values()].filter((c) => !c.existingId).length} khách hàng mới, {incS.length} đơn bán ({fmtMoney(round3(incS.reduce((t, s) => t + (s.row.amount ?? 0), 0)))} {MONEY_UNIT})</li>
                </ul>
                {newProducts.length > 0 && (
                  <div>
                    <p className="mb-2 font-medium">Giá bán hiện tại cho sản phẩm mới</p>
                    <div className="space-y-2">
                      {newProducts.map((p) => (
                        <div key={p.key} className="flex flex-wrap items-center gap-x-3 gap-y-1">
                          <span className="min-w-0 flex-1 basis-32">{p.name}</span>
                          <CurrencyInput value={p.price} onChange={(v) => setPrices((x) => ({ ...x, [p.key]: v }))} className="w-full sm:w-[180px]" aria-label={`Giá bán ${p.name}`} />
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
              <div className="space-y-3">
                {problems.length > 0 ? (
                  <div className="rounded-lg bg-danger-soft p-3 text-sm">
                    <p className="mb-1 font-semibold text-destructive">Cần sửa trước khi lưu</p>
                    <ul className="list-disc space-y-0.5 pl-5 text-destructive">{problems.map((p) => <li key={p}>{p}</li>)}</ul>
                  </div>
                ) : (
                  <p className="rounded-lg bg-success-soft p-3 text-sm text-success">Dữ liệu hợp lệ. Tồn kho sẽ được kiểm tra theo ngày khi lưu; đơn bán vượt tồn sẽ bị từ chối.</p>
                )}
                <Button disabled={!canImport} onClick={() => setConfirmOpen(true)} className="w-full sm:w-auto">
                  {running ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}Lưu vào hệ thống
                </Button>
              </div>
            </div>
          </Card>
        </>
      )}

      {log && (
        <Card title="Kết quả nhập" className="mt-5">
          <ul className="space-y-1.5 text-sm">
            {log.map((l, i) => (
              <li key={i} className="flex gap-2">
                {l.ok ? <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-success" /> : <XCircle className="mt-0.5 h-4 w-4 shrink-0 text-destructive" />}
                <span className={cn(!l.ok && "text-destructive")}>{l.text}</span>
              </li>
            ))}
          </ul>
          {!running && (
            <div className="mt-4 flex flex-wrap gap-2">
              <Button variant="outline" asChild><Link to="/purchases">Xem Mua vào</Link></Button>
              <Button variant="outline" asChild><Link to="/sales">Xem Bán ra</Link></Button>
              <Button variant="outline" asChild><Link to="/inventory">Xem Tồn kho</Link></Button>
            </div>
          )}
        </Card>
      )}

      {!hasData && !parseError && (
        <Card className="mt-5"><EmptyState icon={FileSpreadsheet} title="Chưa chọn file" hint="Chọn file Excel để xem trước dữ liệu trước khi lưu." /></Card>
      )}

      <ConfirmDialog open={confirmOpen} onOpenChange={setConfirmOpen} onConfirm={() => void run()} confirmLabel="Lưu dữ liệu"
        title="Lưu dữ liệu vào hệ thống?"
        description={<>Sẽ tạo {newProducts.length} sản phẩm, {incP.length} phiếu nhập và {incS.length} đơn bán. Dữ liệu được ghi thật vào cơ sở dữ liệu; nếu cần, có thể hủy từng phiếu/đơn sau.</>} />
    </>
  );
}
