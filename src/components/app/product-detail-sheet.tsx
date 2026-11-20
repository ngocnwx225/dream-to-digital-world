import { Link } from "@tanstack/react-router";
import { PackageOpen, Pencil, Power } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { EmptyState, LoadingSkeleton, StatusBadge, TableWrap, td, th, theadRow, trHover } from "@/components/app/shared";
import { useMovements, type Balance, type Product, type StockState } from "@/lib/data";
import { fmtDate, fmtMoney, fmtNum, fmtUnitCost, MONEY_UNIT } from "@/lib/format";
import { cn } from "@/lib/utils";

export type StockRow = { product: Product; balance: Balance; threshold: number; state: StockState };

const TYPE_LABEL = { opening: "Tồn đầu", purchase: "Nhập hàng", sale: "Bán hàng" } as const;
const TYPE_CLS = { opening: "bg-muted text-muted-foreground", purchase: "bg-info-soft text-primary", sale: "bg-success-soft text-success" } as const;

function DocLink({ type, id, code }: { type: "opening" | "purchase" | "sale"; id: string | null; code: string | null }) {
  if (!id || type === "opening") return <span className="text-muted-foreground">{code ?? "—"}</span>;
  return type === "sale"
    ? <Link to="/sales/$id" params={{ id }} className="font-medium text-primary hover:underline">{code}</Link>
    : <Link to="/purchases/$id" params={{ id }} className="font-medium text-primary hover:underline">{code}</Link>;
}

/** One product: its details and stock, plus the full in/out history (previously split across Sản phẩm and Tồn kho). */
export function ProductDetailSheet({ row, onClose, onEdit, onToggle }: {
  row: StockRow | null; onClose: () => void; onEdit: (p: Product) => void; onToggle: (p: Product) => void;
}) {
  const { data: movements, isLoading } = useMovements(row?.product.id ?? null);
  const p = row?.product;
  const b = row?.balance;
  const info: [string, React.ReactNode][] = p && b && row ? [
    ["Đơn vị tính", p.unit],
    ["Giá bán hiện tại", `${fmtMoney(p.sale_price)} ${MONEY_UNIT}`],
    ["Ngưỡng cảnh báo", `${fmtNum(row.threshold)}${p.low_stock_threshold == null ? " (mặc định)" : ""}`],
    ["Tồn đầu kỳ", fmtNum(b.opening_qty)],
    ["Tổng nhập", fmtNum(b.total_in)],
    ["Tổng bán", fmtNum(b.total_out)],
    ["Tồn hiện tại", <span className="flex items-center gap-2">{fmtNum(b.quantity)} <StatusBadge kind={row.state} /></span>],
    ["Giá vốn bình quân", `${fmtUnitCost(b.avg_cost)} ${MONEY_UNIT}`],
    ["Giá trị tồn kho", `${fmtMoney(b.value)} ${MONEY_UNIT}`],
    ["Trạng thái", <StatusBadge kind={p.is_active ? "active" : "inactive"} />],
    ["Ghi chú", p.note || "—"],
  ] : [];

  return (
    <Sheet open={!!row} onOpenChange={(o) => !o && onClose()}>
      <SheetContent className="w-full overflow-y-auto sm:max-w-3xl">
        <SheetHeader>
          <SheetTitle>{p?.name} <span className="text-sm font-normal text-muted-foreground">· {p?.code}</span></SheetTitle>
          <SheetDescription>Thông tin sản phẩm, tồn kho và lịch sử nhập – bán</SheetDescription>
        </SheetHeader>
        <div className="space-y-5 px-4 pb-6">
          <div className="flex flex-wrap gap-2">
            {p && <Button onClick={() => onEdit(p)}><Pencil className="h-4 w-4" />Sửa</Button>}
            {p && <Button variant="outline" onClick={() => onToggle(p)}><Power className="h-4 w-4" />{p.is_active ? "Ngừng kinh doanh" : "Kinh doanh lại"}</Button>}
          </div>
          <dl className="divide-y divide-border text-sm">
            {info.map(([k, v]) => (
              <div key={k} className="flex items-center justify-between gap-4 py-2.5">
                <dt className="text-muted-foreground">{k}</dt><dd className="num text-right font-medium">{v}</dd>
              </div>
            ))}
          </dl>
          <div>
            <h3 className="mb-2 text-sm font-semibold">Lịch sử nhập – bán</h3>
            {isLoading ? <LoadingSkeleton /> : !movements?.length ? (
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
                    {movements.map((m) => (
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
        </div>
      </SheetContent>
    </Sheet>
  );
}
