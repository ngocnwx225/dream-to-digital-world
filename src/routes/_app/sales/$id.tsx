import { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft, Ban, Pencil, Printer } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, EmptyState, LoadingSkeleton, PageHeader, ReasonDialog, StatusBadge, TableWrap, td, th, theadRow, trHover } from "@/components/app/shared";
import { supabase } from "@/integrations/supabase/client";
import { useInvalidateAll, useSaleOrder } from "@/lib/data";
import { profitAfterConsumables, round3 } from "@/lib/calc";
import { errMsg, fmtDate, fmtDateTime, fmtMoney, fmtNum, fmtPct, fmtUnitCost, MONEY_UNIT, MONEY_UNIT_SHORT } from "@/lib/format";
import { cn } from "@/lib/utils";
import { useBrand } from "@/lib/brand";

export const Route = createFileRoute("/_app/sales/$id")({
  head: () => ({ meta: [{ title: "Chi tiết đơn bán – Chơi Xe-Xe Chơi" }] }),
  component: SaleDetailPage,
});

function SaleDetailPage() {
  const { id } = Route.useParams();
  const { data: o, isLoading } = useSaleOrder(id);
  const brand = useBrand();
  const invalidate = useInvalidateAll();
  const [cancelOpen, setCancelOpen] = useState(false);
  const [pending, setPending] = useState(false);

  if (isLoading) return <Card><LoadingSkeleton rows={6} /></Card>;
  if (!o) return <Card><EmptyState title="Không tìm thấy đơn bán" action={<Button asChild variant="outline"><Link to="/sales">Về danh sách</Link></Button>} /></Card>;

  const cancel = async (reason: string) => {
    setPending(true);
    const { error } = await supabase.rpc("cancel_sale", { p_id: id, p_reason: reason });
    setPending(false);
    if (error) return void toast.error(errMsg(error));
    toast.success("Đã hủy đơn bán");
    setCancelOpen(false);
    void invalidate();
  };

  // Consumables are an order-level cost: subtracted once here, never spread over the lines.
  const legacy = o.vehicle_count == null;
  const { profit, margin } = profitAfterConsumables(o.total_amount, o.total_cost, o.consumable_total_cost);
  const totalPayment = round3(o.total_amount + o.surcharge);

  return (
    <>
      <div className="print:hidden">
      <PageHeader title={`Đơn bán ${o.code}`} subtitle={`Ngày bán ${fmtDate(o.order_date)}`}
        actions={<>
          <Button variant="outline" asChild><Link to="/sales"><ArrowLeft className="h-4 w-4" />Danh sách</Link></Button>
          <Button variant="outline" onClick={() => window.print()}><Printer className="h-4 w-4" />In hóa đơn</Button>
          {o.status === "completed" && <>
            <Button variant="outline" asChild><Link to="/sales/edit/$id" params={{ id }}><Pencil className="h-4 w-4" />Sửa</Link></Button>
            <Button variant="outline" className="text-destructive hover:text-destructive" onClick={() => setCancelOpen(true)}><Ban className="h-4 w-4" />Hủy đơn</Button>
          </>}
        </>} />

      {o.status === "cancelled" && (
        <div className="mb-4 rounded-xl border border-destructive/30 bg-danger-soft p-4 text-sm">
          <p className="font-semibold text-destructive">Đơn bán đã hủy</p>
          <p className="text-muted-foreground">Lý do: {o.cancel_reason || "—"} · Không tính vào doanh thu, lợi nhuận và tồn kho.</p>
        </div>
      )}

      <div className="grid gap-5 lg:grid-cols-3">
        <Card title="Khách hàng">
          <dl className="space-y-2.5 text-sm">
            <Row k="Khách hàng" v={o.customers
              ? <Link to="/sales" search={{ customer: o.customers.id }} className="text-primary hover:underline">{o.customer_name} ({o.customers.code})</Link>
              : o.customer_name || "Khách lẻ"} />
            <Row k="Số điện thoại" v={o.phone || "—"} />
            <Row k="Biển số xe" v={o.plate || "—"} />
            <Row k="Tên xe" v={o.vehicle_name || "—"} />
            <Row k="Số xe" v={legacy ? "Chưa ghi nhận" : fmtNum(o.vehicle_count)} />
            <Row k="Tổng số lượng" v={fmtNum(o.total_qty)} />
            <Row k="Ghi chú" v={o.note || "—"} />
            <Row k="Trạng thái" v={<StatusBadge kind={o.status} />} />
            <Row k="Tạo lúc" v={fmtDateTime(o.created_at)} />
          </dl>
        </Card>
        <Card title="Sản phẩm" className="lg:col-span-2">
          <TableWrap>
            <table className="w-full">
              <thead><tr className={theadRow}>
                <th className={th}>Sản phẩm</th><th className={cn(th, "text-right")}>SL</th>
                <th className={cn(th, "text-right")}>Giá bán</th><th className={cn(th, "text-right")}>Thành tiền</th>
                <th className={cn(th, "text-right")}>Giá vốn BQ</th><th className={cn(th, "text-right")}>Giá vốn</th><th className={cn(th, "text-right")}>Lãi</th>
              </tr></thead>
              <tbody>
                {o.sales_order_items.map((i) => (
                  <tr key={i.id} className={trHover}>
                    <td className={td}><span className="font-medium">{i.products?.name}</span> <span className="text-xs text-muted-foreground">{i.products?.code}</span></td>
                    <td className={cn(td, "num text-right")}>{fmtNum(i.quantity)}</td>
                    <td className={cn(td, "num text-right")}>{fmtMoney(i.unit_price)}</td>
                    <td className={cn(td, "num text-right font-semibold")}>{fmtMoney(i.amount)}</td>
                    <td className={cn(td, "num text-right text-muted-foreground")}>{fmtUnitCost(i.unit_cost)}</td>
                    <td className={cn(td, "num text-right text-muted-foreground")}>{fmtMoney(i.cost_amount)}</td>
                    <td className={cn(td, "num text-right font-medium text-success")}>{fmtMoney(round3(i.amount - i.cost_amount))}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </TableWrap>
          <div className="mt-4 grid grid-cols-2 gap-3 border-t border-border pt-4 text-sm xl:grid-cols-4">
            <Stat k="Tổng tiền bán" v={fmtMoney(o.total_amount)} strong />
            {o.surcharge > 0 && <Stat k="Phụ thu / Tip" v={fmtMoney(o.surcharge)} />}
            <Stat k="Tổng thanh toán" v={fmtMoney(totalPayment)} strong />
            <Stat k="Giá vốn sản phẩm" v={fmtMoney(o.total_cost)} />
            <Stat k={legacy ? "Vật tư tiêu hao (đơn cũ)" : `Vật tư tiêu hao (${fmtNum(o.vehicle_count)} xe)`} v={fmtMoney(o.consumable_total_cost)} />
            <Stat k={`Lợi nhuận${o.total_amount ? ` (${fmtPct(margin)})` : ""}`} v={fmtMoney(profit)} tone="success" />
          </div>
          <p className="mt-3 text-right text-xs text-muted-foreground">Đơn vị tiền: {MONEY_UNIT} · Giá vốn theo bình quân gia quyền di động lúc bán · Cột "Lãi" là lãi sản phẩm, chưa trừ vật tư chung{!legacy && o.consumable_unit_cost != null ? ` · Vật tư ${fmtMoney(o.consumable_unit_cost)} ${MONEY_UNIT_SHORT}/xe` : ""}</p>
        </Card>
      </div>

      <ReasonDialog open={cancelOpen} onOpenChange={setCancelOpen} pending={pending} onConfirm={(x) => void cancel(x)}
        title={`Hủy đơn bán ${o.code}`}
        description="Hàng sẽ được hoàn lại kho; doanh thu, giá vốn và lợi nhuận sẽ được tính lại. Đơn đã hủy vẫn được lưu trong lịch sử." />
      </div>
      <section data-print-bill className="hidden space-y-6 bg-background p-6 text-foreground">
        <header className="flex items-start justify-between gap-6 border-b border-border pb-5">
          <div>
            <p className="text-xl font-bold">{brand.name}</p>
            {brand.subtitle && <p className="mt-1 text-sm text-muted-foreground">{brand.subtitle}</p>}
          </div>
          <div className="text-right">
            <h1 className="text-xl font-bold">HÓA ĐƠN BÁN HÀNG</h1>
            <p className="mt-1 text-sm">Mã đơn: {o.code}</p>
            <p className="text-sm">Ngày bán: {fmtDate(o.order_date)}</p>
          </div>
        </header>
        <dl className="grid grid-cols-2 gap-x-8 gap-y-2 text-sm">
          <Row k="Khách hàng" v={o.customer_name || "Khách lẻ"} />
          <Row k="Số điện thoại" v={o.phone || "—"} />
          <Row k="Biển số xe" v={o.plate || "—"} />
          <Row k="Tên xe" v={o.vehicle_name || "—"} />
          {o.note && <Row k="Ghi chú" v={o.note} />}
        </dl>
        <table className="w-full border-collapse text-sm">
          <thead><tr className="border-b border-border text-left">
            <th className="py-2 pr-3">Sản phẩm</th><th className="py-2 px-3 text-right">SL</th>
            <th className="py-2 px-3 text-right">Giá bán</th><th className="py-2 pl-3 text-right">Thành tiền</th>
          </tr></thead>
          <tbody>{o.sales_order_items.map((i) => (
            <tr key={i.id} className="border-b border-border">
              <td className="py-2 pr-3">{i.products?.name} <span className="text-xs text-muted-foreground">{i.products?.code}</span></td>
              <td className="num py-2 px-3 text-right">{fmtNum(i.quantity)}</td>
              <td className="num py-2 px-3 text-right">{fmtMoney(i.unit_price)}</td>
              <td className="num py-2 pl-3 text-right">{fmtMoney(i.amount)}</td>
            </tr>
          ))}</tbody>
        </table>
        <dl className="ml-auto w-full max-w-sm space-y-2 border-t border-border pt-4 text-sm">
          <Row k="Tổng tiền bán" v={`${fmtMoney(o.total_amount)} ${MONEY_UNIT}`} />
          {o.surcharge > 0 && <Row k="Phụ thu / Tip" v={`${fmtMoney(o.surcharge)} ${MONEY_UNIT}`} />}
          <div className="flex justify-between gap-4 border-t border-border pt-2 text-base font-bold">
            <dt>Tổng thanh toán</dt><dd className="num text-right">{fmtMoney(totalPayment)} {MONEY_UNIT}</dd>
          </div>
        </dl>
      </section>
    </>
  );
}

function Row({ k, v }: { k: string; v: React.ReactNode }) {
  return <div className="flex justify-between gap-4"><dt className="text-muted-foreground">{k}</dt><dd className="text-right font-medium">{v}</dd></div>;
}

function Stat({ k, v, strong, tone }: { k: string; v: string; strong?: boolean; tone?: "success" }) {
  return (
    <div className="rounded-lg bg-muted/50 px-3 py-2">
      <p className="text-xs text-muted-foreground">{k}</p>
      <p className={cn("num text-base font-semibold", strong && "text-lg font-bold text-primary", tone === "success" && "text-success")}>{v}</p>
    </div>
  );
}
