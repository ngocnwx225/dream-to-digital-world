import { createFileRoute, redirect } from "@tanstack/react-router";

// The purchase list is a section of the warehouse page; receipt pages (new, edit, detail) stay separate.
export const Route = createFileRoute("/_app/purchases/")({
  beforeLoad: () => { throw redirect({ to: "/warehouse", replace: true }); },
});
