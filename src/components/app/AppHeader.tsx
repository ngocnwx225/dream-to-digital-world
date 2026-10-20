import { useMemo, useState } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { Bell, ChevronDown, LogOut, Package, Search, Settings, User } from "lucide-react";
import { toast } from "sonner";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { Input } from "@/components/ui/input";
import { Popover, PopoverAnchor, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useBalances, useCustomers, useProducts, useProfile, useSettings } from "@/lib/data";
import { signOut } from "@/lib/auth";
import { errMsg, fmtNum } from "@/lib/format";
import { matches } from "./inputs";
import { lowStockList, StatusBadge } from "./shared";

function GlobalSearch() {
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();
  const { data: products = [] } = useProducts();
  const { data: customers = [] } = useCustomers();
  const results = useMemo(() => {
    if (!q.trim()) return { products: [], customers: [] };
    return {
      products: products.filter((p) => matches(q, p.name, p.code)).slice(0, 5),
      customers: customers.filter((c) => matches(q, c.name, c.phone, c.plate, c.code)).slice(0, 5),
    };
  }, [q, products, customers]);
  const close = () => { setOpen(false); setQ(""); };
  const empty = results.products.length === 0 && results.customers.length === 0;

  return (
    <Popover open={open && !!q.trim()} onOpenChange={setOpen}>
      <PopoverAnchor asChild>
        <div className="relative w-full max-w-sm">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input value={q} onChange={(e) => { setQ(e.target.value); setOpen(true); }} onFocus={() => setOpen(true)}
            onKeyDown={(e) => { if (e.key === "Escape") close(); }}
            placeholder="Tìm sản phẩm, khách hàng..." aria-label="Tìm kiếm" className="h-10 rounded-xl border-transparent bg-muted/80 pl-9 shadow-none focus-visible:bg-card" />
        </div>
      </PopoverAnchor>
      <PopoverContent align="start" className="w-(--radix-popover-trigger-width) min-w-[300px] p-1" onOpenAutoFocus={(e) => e.preventDefault()}>
        {empty && <p className="px-3 py-4 text-center text-sm text-muted-foreground">Không tìm thấy kết quả</p>}
        {results.products.length > 0 && <p className="px-2 pb-1 pt-2 text-[11px] font-semibold uppercase text-muted-foreground">Sản phẩm</p>}
        {results.products.map((p) => (
          <button key={p.id} type="button" className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm hover:bg-accent"
            onClick={() => { void navigate({ to: "/products", search: { q: p.code } }); close(); }}>
            <Package className="h-4 w-4 text-primary" /><span className="flex-1 truncate">{p.name}</span><span className="text-xs text-muted-foreground">{p.code}</span>
          </button>
        ))}
        {results.customers.length > 0 && <p className="px-2 pb-1 pt-2 text-[11px] font-semibold uppercase text-muted-foreground">Khách hàng</p>}
        {results.customers.map((c) => (
          <button key={c.id} type="button" className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm hover:bg-accent"
            onClick={() => { void navigate({ to: "/customers/$id", params: { id: c.id } }); close(); }}>
            <User className="h-4 w-4 text-primary" /><span className="flex-1 truncate">{c.name}</span><span className="text-xs text-muted-foreground">{c.phone ?? c.code}</span>
          </button>
        ))}
      </PopoverContent>
    </Popover>
  );
}

function StockBell() {
  const { data: products } = useProducts();
  const { data: balances } = useBalances();
  const { data: settings } = useSettings();
  const list = products && balances ? lowStockList(products, balances, settings?.default_low_stock ?? 5) : [];
  return (
    <Popover>
      <PopoverTrigger asChild>
        <button type="button" aria-label="Cảnh báo tồn kho" className="relative flex h-9 w-9 items-center justify-center rounded-lg text-muted-foreground hover:bg-accent hover:text-foreground">
          <Bell className="h-[18px] w-[18px]" />
          {list.length > 0 && (
            <span className="absolute right-1 top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-bold text-destructive-foreground ring-2 ring-card">{list.length}</span>
          )}
        </button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 p-0">
        <p className="border-b border-border px-4 py-3 text-sm font-semibold">Cảnh báo tồn kho</p>
        {list.length === 0 ? <p className="px-4 py-6 text-center text-sm text-muted-foreground">Không có cảnh báo nào</p> : (
          <ul className="max-h-72 overflow-auto py-1">
            {list.map((r) => (
              <li key={r.product.id} className="flex items-center justify-between gap-2 px-4 py-2 text-sm">
                <span className="truncate">{r.product.name}</span>
                <span className="flex items-center gap-2"><span className="num text-muted-foreground">{fmtNum(r.qty)}</span><StatusBadge kind={r.state} /></span>
              </li>
            ))}
          </ul>
        )}
        <Link to="/inventory" className="block border-t border-border px-4 py-2.5 text-center text-sm font-medium text-primary hover:bg-accent">Xem tồn kho</Link>
      </PopoverContent>
    </Popover>
  );
}

export function AppHeader() {
  const { data: profile } = useProfile();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const name = profile?.full_name || profile?.email?.split("@")[0] || "Chủ cửa hàng";

  const logout = async () => {
    try {
      await signOut();
      qc.clear();
      await navigate({ to: "/login", replace: true });
    } catch (e) {
      toast.error(errMsg(e));
    }
  };

  return (
    <header className="sticky top-0 z-20 flex h-16 items-center gap-3 border-b border-border/80 bg-card/80 px-4 backdrop-blur-xl backdrop-saturate-150 md:px-6">
      <SidebarTrigger className="-ml-1 text-muted-foreground" />
      <GlobalSearch />
      <div className="ml-auto flex items-center gap-1">
        <StockBell />
        <DropdownMenu>
          <DropdownMenuTrigger className="flex items-center gap-2 rounded-lg px-2 py-1.5 hover:bg-accent">
            <span className="bg-brand flex h-8 w-8 items-center justify-center rounded-full text-sm font-semibold text-primary-foreground ring-2 ring-info-soft">
              {name.charAt(0).toUpperCase()}
            </span>
            <span className="hidden text-left leading-tight sm:block">
              <span className="block max-w-[140px] truncate text-sm font-medium text-foreground">{name}</span>
              <span className="block text-xs text-muted-foreground">Quản trị viên</span>
            </span>
            <ChevronDown className="hidden h-4 w-4 text-muted-foreground sm:block" />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuLabel className="font-normal">
              <p className="truncate text-sm font-medium">{name}</p>
              <p className="truncate text-xs text-muted-foreground">{profile?.email}</p>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem onSelect={() => void navigate({ to: "/settings" })}><Settings className="h-4 w-4" />Cài đặt</DropdownMenuItem>
            <DropdownMenuItem onSelect={() => void logout()} className="text-destructive focus:text-destructive"><LogOut className="h-4 w-4" />Đăng xuất</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
