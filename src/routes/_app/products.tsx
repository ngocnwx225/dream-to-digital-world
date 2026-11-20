import { createFileRoute, redirect } from "@tanstack/react-router";

// Products, stock and purchases now live on the single warehouse page; keep old links working.
export const Route = createFileRoute("/_app/products")({
  validateSearch: (s: Record<string, unknown>): { q?: string } => (typeof s["q"] === "string" ? { q: s["q"] } : {}),
  beforeLoad: ({ search }) => { throw redirect({ to: "/warehouse", search, replace: true }); },
});
