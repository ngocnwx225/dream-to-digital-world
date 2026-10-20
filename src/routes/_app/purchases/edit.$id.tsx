import { createFileRoute, Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { Card, EmptyState, LoadingSkeleton, PageHeader } from "@/components/app/shared";
import { PurchaseForm, purchaseDefaults } from "@/components/app/purchase-form";
import { usePurchase } from "@/lib/data";

export const Route = createFileRoute("/_app/purchases/edit/$id")({
  head: () => ({ meta: [{ title: "Sửa phiếu nhập – StoreFlow" }] }),
  component: EditPurchasePage,
});

function EditPurchasePage() {
  const { id } = Route.useParams();
  const { data, isLoading } = usePurchase(id);
  if (isLoading) return <Card><LoadingSkeleton rows={6} /></Card>;
  if (!data || data.status !== "completed") {
    return (
      <Card>
        <EmptyState title={data ? "Phiếu nhập đã hủy, không thể sửa" : "Không tìm thấy phiếu nhập"}
          action={<Button asChild variant="outline"><Link to="/purchases">Về danh sách</Link></Button>} />
      </Card>
    );
  }
  return (
    <>
      <PageHeader title={`Sửa phiếu nhập ${data.code}`} subtitle="Thay đổi sẽ tính lại tồn kho, giá vốn bình quân và lợi nhuận các đơn bán sau đó" />
      <PurchaseForm id={id} code={data.code} defaults={purchaseDefaults(data)} />
    </>
  );
}
