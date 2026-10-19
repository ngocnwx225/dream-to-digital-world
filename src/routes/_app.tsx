import { useEffect, type CSSProperties } from "react";
import { createFileRoute, Outlet, redirect, useNavigate, useRouterState } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import { FullPageLoader } from "@/components/app/shared";
import { AppSidebar } from "@/components/app/AppSidebar";
import { AppHeader } from "@/components/app/AppHeader";
import { PeriodProvider } from "@/lib/period";
import { getActiveSession } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";

// The Supabase session lives in browser storage, so the whole authenticated area
// renders client-side only; the guard runs before any business page loads.
export const Route = createFileRoute("/_app")({
  ssr: false,
  beforeLoad: async ({ location }) => {
    const session = await getActiveSession();
    if (!session) throw redirect({ to: "/login", search: { redirect: location.href } });
  },
  pendingComponent: FullPageLoader,
  component: AppLayout,
});

function sidebarCookieOpen() {
  if (typeof document === "undefined") return true;
  return !document.cookie.split("; ").includes("sidebar_state=false");
}

function AppLayout() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const pathname = useRouterState({ select: (r) => r.location.pathname });

  // Expired session or logout in another tab: drop cached data and go to login.
  useEffect(() => {
    const { data } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "SIGNED_OUT" || !session) {
        qc.clear();
        void navigate({ to: "/login", replace: true });
      }
    });
    return () => data.subscription.unsubscribe();
  }, [navigate, qc]);

  return (
    <PeriodProvider>
      <SidebarProvider defaultOpen={sidebarCookieOpen()} style={{ "--sidebar-width": "15rem" } as CSSProperties}>
        <AppSidebar />
        <SidebarInset className="min-w-0 bg-background">
          <AppHeader />
          <main className="mx-auto w-full max-w-[1440px] flex-1 p-4 md:p-6 lg:p-8">
            {/* Keyed by path so each page gets the entrance animation; state inside a page survives search-param changes. */}
            <div key={pathname} className="animate-page-in">
              <Outlet />
            </div>
          </main>
        </SidebarInset>
      </SidebarProvider>
    </PeriodProvider>
  );
}
