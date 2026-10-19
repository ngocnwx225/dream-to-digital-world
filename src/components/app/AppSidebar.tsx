import { Link, useRouterState } from "@tanstack/react-router";
import { BarChart3, Boxes, Home, Package, Settings, ShoppingCart, Truck, Users, Warehouse } from "lucide-react";
import {
  Sidebar, SidebarContent, SidebarFooter, SidebarGroup, SidebarGroupContent, SidebarGroupLabel,
  SidebarHeader, SidebarMenu, SidebarMenuButton, SidebarMenuItem, useSidebar,
} from "@/components/ui/sidebar";

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

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader className="px-3 py-4">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-sidebar-primary text-sidebar-primary-foreground"><Boxes className="h-5 w-5" /></div>
          {!collapsed && (
            <div className="leading-tight">
              <p className="text-base font-bold text-sidebar-accent-foreground">StoreFlow</p>
              <p className="text-xs text-sidebar-foreground/70">Quản lý mua bán & tồn kho</p>
            </div>
          )}
        </div>
      </SidebarHeader>
      <SidebarContent>
        {groups.map((g) => (
          <SidebarGroup key={g.label} className="py-1">
            <SidebarGroupLabel className="text-[11px] uppercase tracking-wider text-sidebar-foreground/50">{g.label}</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {g.items.map((it) => {
                  const active = path === it.url || path.startsWith(it.url + "/");
                  return (
                    <SidebarMenuItem key={it.url}>
                      <SidebarMenuButton asChild isActive={active} tooltip={it.title}
                        className="h-10 data-[active=true]:bg-sidebar-primary data-[active=true]:text-sidebar-primary-foreground">
                        <Link to={it.url as "/"} onClick={() => setOpenMobile(false)} className="flex items-center gap-3">
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
          <div className="flex items-center gap-3 rounded-xl bg-sidebar-accent p-3 text-xs text-sidebar-foreground">
            <BarChart3 className="h-6 w-6 text-sidebar-foreground/70" />
            <span>Quản lý kho hàng<br />đơn giản – hiệu quả</span>
          </div>
        </SidebarFooter>
      )}
    </Sidebar>
  );
}
