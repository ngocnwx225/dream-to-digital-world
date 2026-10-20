import { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft, Ban, Pencil } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, EmptyState, LoadingSkeleton, PageHeader, ReasonDialog, StatusBadge, TableWrap, td, th, theadRow, trHover } from "@/components/app/shared";
import { supabase } from "@/integrations/supabase/client";
import { useInvalidateAll, usePurchase } from "@/lib/data";
import { errMsg, fmtDate, fmtDateTime, fmtMoney, fmtNum, fmtUnitCost, MONEY_UNIT, MONEY_UNIT_SHORT } from "@/lib/format";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_app/purchases/$id")({
  head: () => ({ meta: [{ title: "Chi tiết phiếu nhập – StoreFlow" }] }),
  component: PurchaseDetailPage,
});

function PurchaseDetailPage() {
  const { id } = Route.useParams();
  const { data: r, isLoading } = usePurchase(id);
  const invalidate = useInvalidateAll();
  const [cancelOpen, setCancelOpen] = useState(false);
  const [pending, setPending] = useState(false);

  if (isLoading) return <Card><LoadingSkeleton rows={6} /></Card>;
  if (!r) return <Card><EmptyState title="Không tìm thấy phiếu nhập" action={<Button asChild variant="outline"><Link to="/purchases">Về danh sách</Link></Button>} /></Card>;

  const cancel = async (reason: string) => {
    setPending(true);
    const { error } = await supabase.rpc("cancel_purchase", { p_id: id, p_reason: reason });
    setPending(false);
    if (error) return void toast.error(errMsg(error));
    toast.success("Đã hủy phiếu nhập");
    setCancelOpen(false);
    void invalidate();
  };

  return (
    <>
      <PageHeader title={`Phiếu nhập ${r.code}`} subtitle={`Ngày nhập ${fmtDate(r.receipt_date)}`}
        actions={<>
          <Button variant="outline" asChild><Link to="/purchases"><ArrowLeft className="h-4 w-4" />Danh sách</Link></Button>
          {r.status === "completed" && <>
            <Button variant="outline" asChild><Link to="/purchases/edit/$id" params={{ id }}><Pencil className="h-4 w-4" />Sửa</Link></Button>
            <Button variant="outline" className="text-destructive hover:text-destructive" onClick={() => setCancelOpen(true)}><Ban className="h-4 w-4" />Hủy phiếu</Button>
          </>}
        </>} />

      {r.status === "cancelled" && (
        <div className="mb-4 rounded-xl border border-destructive/30 bg-danger-soft p-4 text-sm">
          <p className="font-semibold text-destructive">Phiếu nhập đã hủy</p>
          <p className="text-muted-foreground">Lý do: {r.cancel_reason || "—"} · Không tính vào tồn kho và giá vốn.</p>
        </div>
      )}

      <div className="grid gap-5 lg:grid-cols-3">
        <Card title="Thông tin phiếu" className="lg:col-span-1">
          <dl className="space-y-2.5 text-sm">
            <Row k="Mã phiếu" v={r.code} />
            <Row k="Ngày nhập" v={fmtDate(r.receipt_date)} />
            <Row k="Trạng thái" v={<StatusBadge kind={r.status} />} />
            <Row k="Ghi chú" v={r.note || "—"} />
            <Row k="Tạo lúc" v={fmtDateTime(r.created_at)} />
            <Row k="Cập nhật" v={fmtDateTime(r.updated_at)} />
          </dl>
        </Card>
        <Card title="Sản phẩm nhập" className="lg:col-span-2">
          <TableWrap>
            <table className="w-full">
              <thead><tr className={theadRow}>
                <th className={th}>Sản phẩm</th><th className={cn(th, "text-right")}>Số lượng</th>
                <th className={cn(th, "text-right")}>Đơn giá nhập ({MONEY_UNIT_SHORT})</th><th className={cn(th, "text-right")}>Thành tiền ({MONEY_UNIT_SHORT})</th>
              </tr></thead>
              <tbody>
                {r.purchase_items.map((i) => (
                  <tr key={i.id} className={trHover}>
                    <td className={td}><span className="font-medium">{i.products?.name}</span> <span className="text-xs text-muted-foreground">{i.products?.code}</span></td>
                    <td className={cn(td, "num text-right")}>{fmtNum(i.quantity)} <span className="text-muted-foreground">{i.products?.unit}</span></td>
                    <td className={cn(td, "num text-right")}>{fmtUnitCost(i.unit_cost)}</td>
                    <td className={cn(td, "num text-right font-semibold")}>{fmtMoney(i.amount)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot><tr className="border-t-2 border-border">
                <td className={cn(td, "font-semibold")}>Tổng cộng</td>
                <td className={cn(td, "num text-right font-semibold")}>{fmtNum(r.total_qty)}</td>
                <td className={td} />
                <td className={cn(td, "num text-right text-base font-bold")}>{fmtMoney(r.total_amount)}</td>
              </tr></tfoot>
            </table>
          </TableWrap>
          <p className="mt-3 text-right text-xs text-muted-foreground">Đơn vị tiền: {MONEY_UNIT}</p>
        </Card>
      </div>

      <ReasonDialog open={cancelOpen} onOpenChange={setCancelOpen} pending={pending} onConfirm={(x) => void cancel(x)}
        title={`Hủy phiếu nhập ${r.code}`}
        description="Tồn kho và giá vốn của các đơn bán liên quan sẽ được tính lại. Hệ thống sẽ từ chối nếu việc hủy làm tồn kho bị âm." />
    </>
  );
}

function Row({ k, v }: { k: string; v: React.ReactNode }) {
  return <div className="flex justify-between gap-4"><dt className="text-muted-foreground">{k}</dt><dd className="text-right font-medium">{v}</dd></div>;
}
