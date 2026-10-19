import { useState, type ReactNode } from "react";
import { CalendarDays, Inbox, TrendingDown, TrendingUp, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { fmtPct } from "@/lib/format";
import type { Product, Balance } from "@/lib/data";
import { fmtMoney, fmtNum } from "@/lib/format";

export function PageHeader({ title, subtitle, actions }: { title: string; subtitle?: string; actions?: ReactNode }) {
  return (
    <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
      <div>
        <h2 className="text-xl font-semibold text-foreground">{title}</h2>
        {subtitle && <p className="mt-0.5 text-sm text-muted-foreground">{subtitle}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}

export function Card({ title, icon: Icon, action, children, className, tone }: {
  title?: ReactNode; icon?: LucideIcon; action?: ReactNode; children: ReactNode; className?: string; tone?: "danger";
}) {
  return (
    <section className={cn("card-surface p-4 md:p-5", tone === "danger" && "bg-danger-soft", className)}>
      {title && (
        <div className="mb-3 flex items-center justify-between gap-2">
          <h3 className={cn("flex items-center gap-2 text-base font-semibold", tone === "danger" ? "text-destructive" : "text-foreground")}>
            {Icon && <Icon className={cn("h-5 w-5", tone === "danger" ? "text-destructive" : "text-primary")} />}
            {title}
          </h3>
          {action}
        </div>
      )}
      {children}
    </section>
  );
}

const toneMap = {
  blue: { bg: "bg-info-soft", icon: "bg-primary text-primary-foreground" },
  green: { bg: "bg-success-soft", icon: "bg-success text-primary-foreground" },
  orange: { bg: "bg-warning-soft", icon: "bg-warning text-primary-foreground" },
  violet: { bg: "bg-violet-soft", icon: "bg-violet text-primary-foreground" },
} as const;

export function MetricCard({ label, value, unit, icon: Icon, tone, change, loading }: {
  label: string; value: string; unit?: string; icon: LucideIcon; tone: keyof typeof toneMap; change?: number | null; loading?: boolean;
}) {
  const t = toneMap[tone];
  return (
    <div className={cn("card-surface flex gap-4 p-4 md:p-5", t.bg)}>
      <div className={cn("flex h-11 w-11 shrink-0 items-center justify-center rounded-xl", t.icon)}>
        <Icon className="h-5 w-5" />
      </div>
      <div className="min-w-0">
        <p className="text-sm font-medium text-foreground/80">{label}</p>
        {loading ? <Skeleton className="mt-2 h-7 w-28" /> : (
          <p className="mt-1 flex items-baseline gap-1.5">
            <span className="num text-2xl font-bold text-foreground">{value}</span>
            {unit && <span className="text-sm text-muted-foreground">{unit}</span>}
          </p>
        )}
        <p className="mt-1 text-xs text-muted-foreground">
          {change == null ? "Chưa có dữ liệu tháng trước" : (
            <span className="inline-flex items-center gap-1">
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

export function StatusBadge({ kind }: { kind: "sale" | "purchase" | "completed" | "cancelled" | "active" | "inactive" | "low" | "out" | "ok" }) {
  const map = {
    sale: ["Bán ra", "bg-success-soft text-success"],
    purchase: ["Mua vào", "bg-info-soft text-primary"],
    completed: ["Hoàn tất", "bg-success-soft text-success"],
    cancelled: ["Đã hủy", "bg-danger-soft text-destructive"],
    active: ["Đang bán", "bg-success-soft text-success"],
    inactive: ["Ngừng bán", "bg-muted text-muted-foreground"],
    low: ["Sắp hết", "bg-warning-soft text-warning"],
    out: ["Hết hàng", "bg-danger-soft text-destructive"],
    ok: ["Còn hàng", "bg-success-soft text-success"],
  } as const;
  const [label, cls] = map[kind];
  return <span className={cn("inline-flex rounded-md px-2 py-0.5 text-xs font-semibold whitespace-nowrap", cls)}>{label}</span>;
}

export function EmptyState({ title, hint, action }: { title: string; hint?: string; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 py-10 text-center">
      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-accent text-primary"><Inbox className="h-6 w-6" /></div>
      <p className="font-medium text-foreground">{title}</p>
      {hint && <p className="max-w-sm text-sm text-muted-foreground">{hint}</p>}
      {action}
    </div>
  );
}

export function LoadingRows({ rows = 5 }: { rows?: number }) {
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
    <Select value={`${year}-${month}`} onValueChange={(v) => { const [y, m] = v.split("-").map(Number); onChange(y, m); }}>
      <SelectTrigger className={cn("w-auto gap-2 bg-card", size === "sm" ? "h-8 text-xs" : "h-10")}>
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
  return (
    <Dialog open={open} onOpenChange={(o) => { onOpenChange(o); if (!o) setReason(""); }}>
      <DialogContent>
        <DialogHeader><DialogTitle>{title}</DialogTitle><DialogDescription>{description}</DialogDescription></DialogHeader>
        <Textarea placeholder="Lý do hủy (bắt buộc)" value={reason} onChange={(e) => setReason(e.target.value)} maxLength={500} />
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Đóng</Button>
          <Button variant="destructive" disabled={!reason.trim() || pending} onClick={() => onConfirm(reason.trim())}>Xác nhận hủy</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function ProductSelector({ products, balances, value, onChange, allowIds = [], showStock }: {
  products: Product[]; balances?: Map<string, Balance>; value: string; onChange: (id: string) => void; allowIds?: string[]; showStock?: boolean;
}) {
  const list = products.filter((p) => p.is_active || allowIds.includes(p.id));
  return (
    <Select value={value || undefined} onValueChange={onChange}>
      <SelectTrigger className="h-9 min-w-[160px] bg-card"><SelectValue placeholder="Chọn sản phẩm" /></SelectTrigger>
      <SelectContent>
        {list.length === 0 && <div className="p-2 text-sm text-muted-foreground">Chưa có sản phẩm</div>}
        {list.map((p) => (
          <SelectItem key={p.id} value={p.id}>
            {p.name} <span className="text-muted-foreground">· {p.code}{showStock && balances ? ` · tồn ${fmtNum(balances.get(p.id)?.quantity ?? 0)}` : ` · ${fmtMoney(p.sale_price)}`}</span>
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

export function TableWrap({ children }: { children: ReactNode }) {
  return <div className="-mx-1 overflow-x-auto px-1">{children}</div>;
}
export const th = "px-3 py-2.5 text-left text-xs font-semibold text-muted-foreground whitespace-nowrap";
export const td = "px-3 py-2.5 text-sm whitespace-nowrap";
export const trHover = "border-t border-border transition-colors hover:bg-accent/50";
