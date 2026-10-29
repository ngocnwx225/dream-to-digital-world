import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { Bell, ChevronDown, LogOut, Package, Search, Settings, User, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { Input } from "@/components/ui/input";
import { Popover, PopoverAnchor, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useBrand } from "@/lib/brand";
import { useBalances, useCustomers, useProducts, useProfile, useSettings } from "@/lib/data";
import { signOut } from "@/lib/auth";
import { errMsg, fmtNum } from "@/lib/format";
import { matches } from "./inputs";
import { lowStockList, StatusBadge } from "./shared";

/**
 * One search for every size: an inline field from md up; on phones an icon that expands the same
 * field over the header, so results and navigation behave identically.
 */
function GlobalSearch() {
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const navigate = useNavigate();
  useEffect(() => { if (expanded) inputRef.current?.focus(); }, [expanded]);
  const { data: products = [] } = useProducts();
  const { data: customers = [] } = useCustomers();
  const results = useMemo(() => {
    if (!q.trim()) return { products: [], customers: [] };
    return {
      products: products.filter((p) => matches(q, p.name, p.code)).slice(0, 5),
      customers: customers.filter((c) => matches(q, c.name, c.phone, c.plate, c.code)).slice(0, 5),
    };
  }, [q, products, customers]);
  const close = () => { setOpen(false); setQ(""); setExpanded(false); };
  const empty = results.products.length === 0 && results.customers.length === 0;

  return (
    <>
      <button type="button" aria-label="Tìm kiếm" onClick={() => setExpanded(true)}
        className="flex h-10 w-10 items-center justify-center rounded-lg text-muted-foreground hover:bg-accent hover:text-foreground md:hidden">
        <Search className="h-[18px] w-[18px]" />
      </button>
      <Popover open={open && !!q.trim()} onOpenChange={setOpen}>
        <PopoverAnchor asChild>
          <div className={cn("w-full max-w-[18rem] lg:max-w-sm",
            expanded
              ? "absolute inset-x-0 top-0 z-30 flex h-16 max-w-none items-center gap-2 border-b border-border bg-card px-3 md:static md:h-auto md:max-w-[18rem] md:border-0 md:bg-transparent md:p-0 lg:max-w-sm"
              : "hidden md:block")}>
            <div className="relative min-w-0 flex-1">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input ref={inputRef} type="search" enterKeyHint="search" value={q} onChange={(e) => { setQ(e.target.value); setOpen(true); }} onFocus={() => setOpen(true)}
                onKeyDown={(e) => { if (e.key === "Escape") close(); }}
                placeholder="Tìm sản phẩm, khách hàng..." aria-label="Tìm kiếm" className="h-10 rounded-xl border-transparent bg-muted/80 pl-9 shadow-none focus-visible:bg-card" />
            </div>
            {expanded && (
              <button type="button" onClick={close} aria-label="Đóng tìm kiếm"
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-muted-foreground hover:bg-accent md:hidden">
                <X className="h-5 w-5" />
              </button>
            )}
          </div>
        </PopoverAnchor>
        <PopoverContent align="start" className="w-(--radix-popover-trigger-width) min-w-[min(300px,calc(100vw-1.5rem))] p-1" onOpenAutoFocus={(e) => e.preventDefault()}>
        {empty && <p className="px-3 py-4 text-center text-sm text-muted-foreground">Không tìm thấy kết quả</p>}
        {results.products.length > 0 && <p className="px-2 pb-1 pt-2 text-[11px] font-semibold uppercase text-muted-foreground">Sản phẩm</p>}
        {results.products.map((p) => (
          <button key={p.id} type="button" className="flex w-full items-center gap-2 rounded-md px-2 py-2 text-left text-sm hover:bg-accent"
            onClick={() => { void navigate({ to: "/products", search: { q: p.code } }); close(); }}>
            <Package className="h-4 w-4 text-primary" /><span className="flex-1 truncate">{p.name}</span><span className="text-xs text-muted-foreground">{p.code}</span>
          </button>
        ))}
        {results.customers.length > 0 && <p className="px-2 pb-1 pt-2 text-[11px] font-semibold uppercase text-muted-foreground">Khách hàng</p>}
        {results.customers.map((c) => (
          <button key={c.id} type="button" className="flex w-full items-center gap-2 rounded-md px-2 py-2 text-left text-sm hover:bg-accent"
            onClick={() => { void navigate({ to: "/customers/$id", params: { id: c.id } }); close(); }}>
            <User className="h-4 w-4 text-primary" /><span className="flex-1 truncate">{c.name}</span><span className="text-xs text-muted-foreground">{c.phone ?? c.code}</span>
          </button>
        ))}
        </PopoverContent>
      </Popover>
    </>
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
        <button type="button" aria-label="Cảnh báo tồn kho" className="relative flex h-10 w-10 items-center justify-center rounded-lg text-muted-foreground hover:bg-accent hover:text-foreground">
          <Bell className="h-[18px] w-[18px]" />
          {list.length > 0 && (
            <span className="absolute right-1 top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-bold text-destructive-foreground ring-2 ring-card">{list.length}</span>
          )}
        </button>
      </PopoverTrigger>
      <PopoverContent align="end" collisionPadding={12} className="w-[min(20rem,calc(100vw-1.5rem))] p-0">
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
  const brand = useBrand();
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
    // Solid surface instead of a large backdrop blur: cheaper to composite while scrolling on phones.
    <header className="sticky top-0 z-20 flex h-16 items-center gap-1.5 border-b border-border/80 bg-card/95 px-3 sm:gap-3 sm:px-4 md:px-6">
      <SidebarTrigger aria-label="Mở menu điều hướng" className="h-10 w-10 shrink-0 text-muted-foreground" />
      <Link to="/dashboard" className="flex min-w-0 items-center gap-2 md:hidden">
        <img src={brand.logo} alt="" className="h-8 w-8 shrink-0 rounded-full object-cover" />
        <span className="truncate text-base font-bold tracking-tight text-foreground">{brand.name}</span>
      </Link>
      <div className="hidden h-6 w-px bg-border md:block" aria-hidden />
      <div className="ml-auto flex items-center gap-0.5 sm:gap-1 md:ml-0 md:flex-1">
        <GlobalSearch />
      </div>
      <div className="flex shrink-0 items-center gap-0.5 sm:gap-1">
        <StockBell />
        <DropdownMenu>
          <DropdownMenuTrigger aria-label="Tài khoản" className="flex min-h-10 items-center gap-2 rounded-lg px-1.5 py-1 hover:bg-accent sm:px-2">
            <span className="bg-brand flex h-8 w-8 items-center justify-center rounded-full text-sm font-semibold text-primary-foreground ring-2 ring-info-soft">
              {name.charAt(0).toUpperCase()}
            </span>
            <span className="hidden text-left leading-tight lg:block">
              <span className="block max-w-[140px] truncate text-sm font-medium text-foreground">{name}</span>
              <span className="block text-xs text-muted-foreground">Quản trị viên</span>
            </span>
            <ChevronDown className="hidden h-4 w-4 text-muted-foreground lg:block" />
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
