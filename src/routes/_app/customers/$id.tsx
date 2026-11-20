import { createFileRoute, redirect } from "@tanstack/react-router";

// A customer now opens in a side sheet on the sales page; keep the old detail link working.
export const Route = createFileRoute("/_app/customers/$id")({
  beforeLoad: ({ params }) => { throw redirect({ to: "/sales", search: { customer: params.id }, replace: true }); },
});
