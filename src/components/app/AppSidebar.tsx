import { Link, useRouterState } from "@tanstack/react-router";
import { BarChart3, Home, Package, Settings, ShoppingCart, Truck, Users, Warehouse } from "lucide-react";
import {
  Sidebar, SidebarContent, SidebarFooter, SidebarGroup, SidebarGroupContent, SidebarGroupLabel,
  SidebarHeader, SidebarMenu, SidebarMenuButton, SidebarMenuItem, useSidebar,
} from "@/components/ui/sidebar";
import { useBrand } from "@/lib/brand";

const groups = [
  { label: "Tổng quan", items: [{ title: "Tổng quan", url: "/dashboard", icon: Home }] },
  { label: "Giao dịch", items: [{ title: "Mua vào", url: "/purchases", icon: Truck }, { title: "Bán ra", url: "/sales", icon: ShoppingCart }] },
  { label: "Quản lý", items: [{ title: "Sản phẩm", url: "/products", icon: Package }, { title: "Tồn kho", url: "/inventory", icon: Warehouse }, { title: "Khách hàng", url: "/customers", icon: Users }] },
  { label: "Thống kê", items: [{ title: "Doanh thu & Lợi nhuận", url: "/reports", icon: BarChart3 }] },
  { label: "Hệ thống", items: [{ title: "Cài đặt", url: "/settings", icon: Settings }] },
] as const;

export function AppSidebar() {
  const { state, isMobile, setOpenMobile } = useSidebar();
  const collapsed = state === "collapsed" && !isMobile;
  const path = useRouterState({ select: (r) => r.location.pathname });
  const brand = useBrand();

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader className="px-3 py-4">
        <Link to="/dashboard" onClick={() => setOpenMobile(false)} className="flex items-center gap-3 rounded-lg">
          <img src={brand.logo} alt={brand.name} className="h-9 w-9 shrink-0 rounded-full object-cover" />
          {!collapsed && (
            <div className="leading-tight">
              <p className="text-base font-bold tracking-tight text-sidebar-accent-foreground">{brand.name}</p>
              <p className="text-xs text-sidebar-foreground/60">Quản lý mua bán & tồn kho</p>
            </div>
          )}
        </Link>
      </SidebarHeader>
      <SidebarContent>
        {groups.map((g) => (
          <SidebarGroup key={g.label} className="py-1">
            <SidebarGroupLabel className="text-[10.5px] font-semibold uppercase tracking-[0.08em] text-sidebar-foreground/45">{g.label}</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {g.items.map((it) => {
                  const active = path === it.url || path.startsWith(it.url + "/");
                  return (
                    <SidebarMenuItem key={it.url}>
                      <SidebarMenuButton asChild isActive={active} tooltip={it.title}
                        className="h-10 rounded-lg font-medium text-sidebar-foreground/85 transition-colors hover:text-sidebar-accent-foreground data-[active=true]:bg-brand data-[active=true]:text-sidebar-primary-foreground data-[active=true]:shadow-glow">
                        <Link to={it.url} onClick={() => setOpenMobile(false)} className="flex items-center gap-3">
                          <it.icon className="h-[18px] w-[18px]" />
                          {!collapsed && <span>{it.title}</span>}
                        </Link>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  );
                })}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        ))}
      </SidebarContent>
      {!collapsed && (
        <SidebarFooter className="p-3">
          <div className="flex items-center gap-3 rounded-xl border border-sidebar-border bg-sidebar-accent/60 p-3 text-xs text-sidebar-foreground/80">
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-sidebar-primary/20 text-sidebar-primary"><BarChart3 className="h-4 w-4" /></span>
            <span>Quản lý kho hàng<br />đơn giản – hiệu quả</span>
          </div>
        </SidebarFooter>
      )}
    </Sidebar>
  );
}
