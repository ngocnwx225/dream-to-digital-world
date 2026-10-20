import { createFileRoute, redirect } from "@tanstack/react-router";

// The app has no public landing page: "/" goes to the dashboard, whose layout
// route sends unauthenticated visitors on to /login.
export const Route = createFileRoute("/")({
  beforeLoad: () => {
    throw redirect({ to: "/dashboard", replace: true });
  },
});
