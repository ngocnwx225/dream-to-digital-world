import { createFileRoute } from "@tanstack/react-router";
import { PageHeader } from "@/components/app/shared";
import { SaleForm, saleDefaults } from "@/components/app/sale-form";

export const Route = createFileRoute("/_app/sales/new")({
  head: () => ({ meta: [{ title: "Tạo đơn bán – StoreFlow" }] }),
  component: () => (
    <>
      <PageHeader title="Tạo đơn bán" subtitle="Một đơn bán có thể gồm nhiều sản phẩm" />
      <SaleForm defaults={saleDefaults()} />
    </>
  ),
});
