import { useEffect, useState, type ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import { AlertTriangle, CalendarDays, ChevronLeft, ChevronRight, Inbox, Loader2, TrendingDown, TrendingUp, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Textarea } from "@/components/ui/textarea";
import { fmtNum, fmtPct } from "@/lib/format";
import { lowStockOf, stockState, type Balance, type Product } from "@/lib/data";

export function PageHeader({ title, subtitle, actions }: { title: string; subtitle?: string; actions?: ReactNode }) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
      <div className="min-w-0">
        <h1 className="text-2xl font-bold leading-tight tracking-tight text-foreground">{title}</h1>
        {subtitle && <p className="mt-1.5 text-sm text-muted-foreground">{subtitle}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}

export function Card({ title, icon: Icon, action, children, className, tone }: {
  title?: ReactNode; icon?: LucideIcon; action?: ReactNode; children: ReactNode; className?: string | undefined; tone?: "danger";
}) {
  return (
    <section className={cn("card-surface min-w-0 p-4 md:p-5", className)}>
      {title && (
        <div className="mb-4 flex items-center justify-between gap-2">
          <h2 className="flex items-center gap-2.5 text-[15px] font-semibold text-foreground">
            {Icon && (
              <span className={cn("flex h-8 w-8 shrink-0 items-center justify-center rounded-lg",
                tone === "danger" ? "bg-danger-soft text-destructive" : "bg-info-soft text-primary")}>
                <Icon className="h-4 w-4" />
              </span>
            )}
            {title}
          </h2>
          {action}
        </div>
      )}
      {children}
    </section>
  );
}

const toneMap = {
  blue: "bg-info-soft text-primary",
  green: "bg-success-soft text-success",
  orange: "bg-warning-soft text-warning",
  violet: "bg-violet-soft text-violet",
  red: "bg-danger-soft text-destructive",
} as const;

export function MetricCard({ label, value, unit, icon: Icon, tone, change, hint, loading }: {
  label: string; value: string; unit?: string; icon: LucideIcon; tone: keyof typeof toneMap;
  change?: number | null | undefined; hint?: string; loading?: boolean;
}) {
  return (
    <div className="card-surface group relative flex gap-4 overflow-hidden p-4 transition-[box-shadow,transform] duration-200 hover:-translate-y-0.5 hover:shadow-elevated md:p-5">
      <div className={cn("flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ring-1 ring-inset ring-current/10", toneMap[tone])}>
        <Icon className="h-5 w-5" />
      </div>
      <div className="min-w-0">
        <p className="text-sm font-medium text-muted-foreground">{label}</p>
        {loading ? <Skeleton className="mt-2 h-7 w-28" /> : (
          <p className="mt-1 flex flex-wrap items-baseline gap-x-1.5">
            <span className="num text-2xl font-bold tracking-tight text-foreground">{value}</span>
            {unit && <span className="text-sm text-muted-foreground">{unit}</span>}
          </p>
        )}
        <p className="mt-1 text-xs text-muted-foreground">
          {change === undefined ? hint : change === null ? "Tháng trước chưa có dữ liệu" : (
            <span className="inline-flex flex-wrap items-center gap-1">
              <span className={cn("inline-flex items-center gap-0.5 font-semibold", change >= 0 ? "text-success" : "text-destructive")}>
                {change >= 0 ? <TrendingUp className="h-3.5 w-3.5" /> : <TrendingDown className="h-3.5 w-3.5" />}
                {change >= 0 ? "+" : ""}{fmtPct(change)}
              </span>
              so với tháng trước
            </span>
          )}
        </p>
      </div>
    </div>
  );
}

export type BadgeKind = "sale" | "purchase" | "completed" | "cancelled" | "active" | "inactive" | "low" | "out" | "ok";

export function StatusBadge({ kind }: { kind: BadgeKind }) {
  const map: Record<BadgeKind, [string, string]> = {
    sale: ["Bán ra", "bg-success-soft text-success"],
    purchase: ["Mua vào", "bg-info-soft text-primary"],
    completed: ["Hoàn tất", "bg-success-soft text-success"],
    cancelled: ["Đã hủy", "bg-danger-soft text-destructive"],
    active: ["Đang bán", "bg-success-soft text-success"],
    inactive: ["Ngừng bán", "bg-muted text-muted-foreground"],
    low: ["Sắp hết", "bg-warning-soft text-warning"],
    out: ["Hết hàng", "bg-danger-soft text-destructive"],
    ok: ["Còn hàng", "bg-success-soft text-success"],
  };
  const [label, cls] = map[kind];
  return (
    <span className={cn("inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-semibold whitespace-nowrap", cls)}>
      <span className="h-1.5 w-1.5 rounded-full bg-current" aria-hidden />{label}
    </span>
  );
}

export function EmptyState({ title, hint, action, icon: Icon = Inbox }: { title: string; hint?: string; action?: ReactNode; icon?: LucideIcon }) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 py-10 text-center">
      <div className="mb-1 flex h-14 w-14 items-center justify-center rounded-2xl bg-info-soft text-primary ring-8 ring-info-soft/40"><Icon className="h-6 w-6" /></div>
      <p className="font-semibold text-foreground">{title}</p>
      {hint && <p className="max-w-sm text-sm text-muted-foreground">{hint}</p>}
      {action && <div className="mt-2">{action}</div>}
    </div>
  );
}

export function ErrorState({ error, onRetry }: { error: unknown; onRetry?: () => void }) {
  return (
    <div className="flex flex-col items-center gap-2 py-10 text-center">
      <div className="mb-1 flex h-14 w-14 items-center justify-center rounded-2xl bg-danger-soft text-destructive ring-8 ring-danger-soft/40"><AlertTriangle className="h-6 w-6" /></div>
      <p className="font-semibold text-foreground">Không tải được dữ liệu</p>
      <p className="max-w-sm text-sm text-muted-foreground">{(error as { message?: string })?.message ?? "Có lỗi xảy ra, vui lòng thử lại"}</p>
      {onRetry && <Button variant="outline" size="sm" onClick={onRetry}>Thử lại</Button>}
    </div>
  );
}

export function FullPageLoader() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background">
      <Loader2 className="h-6 w-6 animate-spin text-primary" />
    </div>
  );
}

export function LoadingSkeleton({ rows = 5 }: { rows?: number }) {
  return <div className="space-y-2 py-2">{Array.from({ length: rows }).map((_, i) => <Skeleton key={i} className="h-9 w-full" />)}</div>;
}

export function MonthYearPicker({ year, month, onChange, size = "default" }: { year: number; month: number; onChange: (y: number, m: number) => void; size?: "sm" | "default" }) {
  const now = new Date();
  const opts: { y: number; m: number }[] = [];
  for (let i = 0; i < 36; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    opts.push({ y: d.getFullYear(), m: d.getMonth() + 1 });
  }
  return (
    <Select value={`${year}-${month}`} onValueChange={(v) => { const [y = year, m = month] = v.split("-").map(Number); onChange(y, m); }}>
      <SelectTrigger aria-label="Chọn tháng" className={cn("w-auto gap-2 bg-card", size === "sm" ? "h-8 text-xs" : "h-9")}>
        <CalendarDays className="h-4 w-4 text-muted-foreground" />
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {opts.map((o) => <SelectItem key={`${o.y}-${o.m}`} value={`${o.y}-${o.m}`}>Tháng {String(o.m).padStart(2, "0")}/{o.y}</SelectItem>)}
      </SelectContent>
    </Select>
  );
}

export function ReasonDialog({ open, onOpenChange, title, description, onConfirm, pending }: {
  open: boolean; onOpenChange: (o: boolean) => void; title: string; description: string; onConfirm: (reason: string) => void; pending?: boolean;
}) {
  const [reason, setReason] = useState("");
  useEffect(() => { if (!open) setReason(""); }, [open]);
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader><DialogTitle>{title}</DialogTitle><DialogDescription>{description}</DialogDescription></DialogHeader>
        <Textarea placeholder="Lý do hủy (bắt buộc)" value={reason} onChange={(e) => setReason(e.target.value)} maxLength={500} autoFocus />
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Đóng</Button>
          <Button variant="destructive" disabled={!reason.trim() || pending} onClick={() => onConfirm(reason.trim())}>
            {pending ? "Đang xử lý..." : "Xác nhận hủy"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function ConfirmDialog({ open, onOpenChange, title, description, confirmLabel = "Xác nhận", onConfirm, destructive, pending }: {
  open: boolean; onOpenChange: (o: boolean) => void; title: string; description: ReactNode; confirmLabel?: string;
  onConfirm: () => void; destructive?: boolean; pending?: boolean;
}) {
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          <AlertDialogDescription asChild><div>{description}</div></AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Hủy bỏ</AlertDialogCancel>
          <AlertDialogAction disabled={pending} onClick={(e) => { e.preventDefault(); onConfirm(); }}
            className={cn(destructive && "bg-destructive text-destructive-foreground hover:bg-destructive/90")}>
            {pending ? "Đang xử lý..." : confirmLabel}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

// ---------- tables ----------

export const th = "px-3 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wide text-muted-foreground whitespace-nowrap first:rounded-l-lg last:rounded-r-lg";
export const td = "px-3 py-3 text-sm whitespace-nowrap";
export const trHover = "border-t border-border/70 transition-colors hover:bg-accent/60";
/** Header row background shared by every data table. */
export const theadRow = "bg-muted/80";

export function TableWrap({ children }: { children: ReactNode }) {
  return <div className="-mx-1 overflow-x-auto px-1">{children}</div>;
}

export type Column<T> = {
  key: string; header: ReactNode; cell: (row: T) => ReactNode; align?: "right" | "center"; className?: string;
};

/** Client-paginated table with loading, error and empty states. */
export function DataTable<T>({ columns, rows, rowKey, onRowClick, loading, error, onRetry, empty, pageSize = 20, footer, rowClassName }: {
  columns: Column<T>[]; rows: T[] | undefined; rowKey: (r: T) => string; onRowClick?: (r: T) => void;
  loading?: boolean; error?: unknown; onRetry?: () => void; empty?: ReactNode; pageSize?: number; footer?: ReactNode;
  rowClassName?: (r: T) => string | undefined;
}) {
  const [page, setPage] = useState(0);
  const total = rows?.length ?? 0;
  const pages = Math.max(1, Math.ceil(total / pageSize));
  useEffect(() => { if (page >= pages) setPage(0); }, [page, pages]);

  if (error) return <ErrorState error={error} {...(onRetry ? { onRetry } : {})} />;
  if (loading || !rows) return <LoadingSkeleton />;
  if (total === 0) return <>{empty ?? <EmptyState title="Chưa có dữ liệu" />}</>;

  const slice = rows.slice(page * pageSize, page * pageSize + pageSize);
  const alignCls = (a?: "right" | "center") => (a === "right" ? "text-right" : a === "center" ? "text-center" : "");
  return (
    <div>
      <TableWrap>
        <table className="w-full">
          <thead>
            <tr className={theadRow}>
              {columns.map((c) => <th key={c.key} className={cn(th, alignCls(c.align))}>{c.header}</th>)}
            </tr>
          </thead>
          <tbody>
            {slice.map((r) => (
              <tr key={rowKey(r)} onClick={onRowClick ? () => onRowClick(r) : undefined}
                className={cn(trHover, onRowClick && "cursor-pointer", rowClassName?.(r))}>
                {columns.map((c) => <td key={c.key} className={cn(td, alignCls(c.align), c.className)}>{c.cell(r)}</td>)}
              </tr>
            ))}
          </tbody>
          {footer}
        </table>
      </TableWrap>
      {pages > 1 && (
        <div className="mt-3 flex items-center justify-between gap-2 text-sm text-muted-foreground">
          <span>Hiển thị {page * pageSize + 1}–{Math.min(total, (page + 1) * pageSize)} / {total}</span>
          <div className="flex items-center gap-1">
            <Button variant="outline" size="icon" className="h-8 w-8" aria-label="Trang trước" disabled={page === 0} onClick={() => setPage(page - 1)}><ChevronLeft className="h-4 w-4" /></Button>
            <span className="num px-2 font-medium text-foreground">Trang {page + 1}/{pages}</span>
            <Button variant="outline" size="icon" className="h-8 w-8" aria-label="Trang sau" disabled={page >= pages - 1} onClick={() => setPage(page + 1)}><ChevronRight className="h-4 w-4" /></Button>
          </div>
        </div>
      )}
    </div>
  );
}

// ---------- inventory warnings ----------

export function lowStockList(products: Product[], balances: Map<string, Balance>, defaultLow: number) {
  return products
    .filter((p) => p.is_active)
    .map((p) => {
      const qty = balances.get(p.id)?.quantity ?? 0;
      const threshold = lowStockOf(p, defaultLow);
      return { product: p, qty, threshold, state: stockState(qty, threshold) };
    })
    .filter((r) => r.state !== "ok")
    .sort((a, b) => a.qty - b.qty);
}

export function InventoryAlertCard({ products, balances, defaultLow, loading, className }: {
  products: Product[] | undefined; balances: Map<string, Balance> | undefined; defaultLow: number; loading?: boolean; className?: string;
}) {
  const list = products && balances ? lowStockList(products, balances, defaultLow) : [];
  return (
    <Card title="Tồn kho cần chú ý" icon={AlertTriangle} tone="danger" className={className}
      action={<Link to="/inventory" className="text-sm font-medium text-primary hover:underline">Xem kho</Link>}>
      {loading ? <LoadingSkeleton rows={4} /> : list.length === 0 ? (
        <EmptyState title="Tồn kho ổn định" hint="Không có sản phẩm hết hàng hoặc dưới mức cảnh báo." />
      ) : (
        <TableWrap>
          <table className="w-full">
            <thead><tr className={theadRow}><th className={th}>Sản phẩm</th><th className={cn(th, "text-right")}>Tồn hiện tại</th><th className={cn(th, "text-right")}>Mức cảnh báo</th></tr></thead>
            <tbody>
              {list.slice(0, 8).map((r) => (
                <tr key={r.product.id} className={trHover}>
                  <td className={td}>
                    <div className="flex items-center gap-2"><span className="font-medium">{r.product.name}</span><StatusBadge kind={r.state} /></div>
                  </td>
                  <td className={cn(td, "num text-right font-semibold", r.state === "out" ? "text-destructive" : "text-warning")}>{fmtNum(r.qty)} {r.product.unit}</td>
                  <td className={cn(td, "num text-right text-muted-foreground")}>{fmtNum(r.threshold)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </TableWrap>
      )}
    </Card>
  );
}
