import { createFileRoute, Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { Card, EmptyState, LoadingSkeleton, PageHeader } from "@/components/app/shared";
import { SaleForm, saleDefaults } from "@/components/app/sale-form";
import { useSaleOrder } from "@/lib/data";

export const Route = createFileRoute("/_app/sales/edit/$id")({
  head: () => ({ meta: [{ title: "Sửa đơn bán – Chơi Xe-Xe Chơi" }] }),
  component: EditSalePage,
});

function EditSalePage() {
  const { id } = Route.useParams();
  const { data, isLoading } = useSaleOrder(id);
  if (isLoading) return <Card><LoadingSkeleton rows={6} /></Card>;
  if (!data || data.status !== "completed") {
    return (
      <Card>
        <EmptyState title={data ? "Đơn bán đã hủy, không thể sửa" : "Không tìm thấy đơn bán"}
          action={<Button asChild variant="outline"><Link to="/sales">Về danh sách</Link></Button>} />
      </Card>
    );
  }
  return (
    <>
      <PageHeader title={`Sửa đơn bán ${data.code}`} subtitle="Thay đổi sẽ tính lại tồn kho, giá vốn và lợi nhuận" />
      <SaleForm id={id} code={data.code} defaults={saleDefaults(data)} />
    </>
  );
}
