import { createFileRoute, redirect } from "@tanstack/react-router";

// Customers are a section of the sales page; keep the old link working.
export const Route = createFileRoute("/_app/customers/")({
  beforeLoad: () => { throw redirect({ to: "/sales", search: { tab: "customers" }, replace: true }); },
});
