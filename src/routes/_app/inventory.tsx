import { createFileRoute, redirect } from "@tanstack/react-router";

// Stock now lives on the single warehouse page; keep old links (including ?product=) working.
export const Route = createFileRoute("/_app/inventory")({
  validateSearch: (s: Record<string, unknown>): { product?: string } => (typeof s["product"] === "string" ? { product: s["product"] } : {}),
  beforeLoad: ({ search }) => { throw redirect({ to: "/warehouse", search, replace: true }); },
});
