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

/**
 * Initial desktop sidebar state. A saved choice (cookie) wins; otherwise laptops and tablets
 * (< 1280px) start icon-only so content keeps its width. Checked once at mount, no resize listener.
 * Phones (< 768px) always use the drawer regardless of this value.
 */
function sidebarDefaultOpen() {
  if (typeof document === "undefined") return true;
  const cookie = document.cookie.split("; ").find((c) => c.startsWith("sidebar_state="));
  if (cookie) return cookie.endsWith("=true");
  return window.matchMedia("(min-width: 1280px)").matches;
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
      <SidebarProvider defaultOpen={sidebarDefaultOpen()} style={{ "--sidebar-width": "15.5rem" } as CSSProperties}>
        <AppSidebar />
        <SidebarInset className="min-w-0 bg-background">
          <AppHeader />
          <main className="mx-auto w-full min-w-0 max-w-[1600px] flex-1 px-4 pb-[max(1.5rem,env(safe-area-inset-bottom))] pt-4 sm:px-5 sm:pt-5 md:px-6 md:pt-6 lg:px-8 lg:pt-7">
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
