import { createFileRoute } from "@tanstack/react-router";
import { PageHeader } from "@/components/app/shared";
import { PurchaseForm, purchaseDefaults } from "@/components/app/purchase-form";

export const Route = createFileRoute("/_app/purchases/new")({
  head: () => ({ meta: [{ title: "Tạo phiếu nhập – Chơi Xe-Xe Chơi" }] }),
  component: () => (
    <>
      <PageHeader title="Tạo phiếu nhập" subtitle="Một phiếu nhập có thể gồm nhiều sản phẩm" />
      <PurchaseForm defaults={purchaseDefaults()} />
    </>
  ),
});
