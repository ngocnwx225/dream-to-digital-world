import type { ReactNode } from "react";
import { Search, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { sanitizeDecimalInput } from "@/lib/calc";
import { MONEY_UNIT_SHORT } from "@/lib/format";

/** Label + control + validation message, used by every form. */
export function Field({ label, htmlFor, error, hint, required, className, children }: {
  label: ReactNode; htmlFor?: string | undefined; error?: string | undefined; hint?: ReactNode; required?: boolean; className?: string; children: ReactNode;
}) {
  return (
    <div className={cn("space-y-1.5", className)}>
      <Label htmlFor={htmlFor} className="text-sm font-medium text-foreground">
        {label}
        {required && <span className="ml-0.5 text-destructive">*</span>}
      </Label>
      {children}
      {error ? <p className="text-xs font-medium text-destructive">{error}</p> : hint ? <p className="text-xs text-muted-foreground">{hint}</p> : null}
    </div>
  );
}

type NumInputProps = {
  value: string; onChange: (v: string) => void; id?: string; placeholder?: string; disabled?: boolean;
  invalid?: boolean; className?: string; onBlur?: () => void; "aria-label"?: string;
};

/** Money input in nghìn đồng. Accepts "50,8" or "50.8"; the unit suffix makes the scale explicit. */
export function CurrencyInput({ value, onChange, invalid, className, ...rest }: NumInputProps) {
  return (
    <div className={cn("relative", className)}>
      <Input
        {...rest}
        inputMode="decimal"
        autoComplete="off"
        value={value}
        aria-invalid={invalid || undefined}
        onChange={(e) => onChange(sanitizeDecimalInput(e.target.value))}
        className="num h-9 bg-card pr-14 text-right"
      />
      <span className="pointer-events-none absolute inset-y-0 right-2.5 flex items-center text-xs text-muted-foreground">{MONEY_UNIT_SHORT}</span>
    </div>
  );
}

export function QuantityInput({ value, onChange, invalid, className, ...rest }: NumInputProps) {
  return (
    <Input
      {...rest}
      inputMode="decimal"
      autoComplete="off"
      value={value}
      aria-invalid={invalid || undefined}
      onChange={(e) => onChange(sanitizeDecimalInput(e.target.value))}
      className={cn("num h-9 bg-card text-right", className)}
    />
  );
}

export function SearchInput({ value, onChange, placeholder = "Tìm kiếm...", className }: {
  value: string; onChange: (v: string) => void; placeholder?: string; className?: string;
}) {
  return (
    <div className={cn("relative w-full sm:w-64", className)}>
      <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
      <Input value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} className="h-9 bg-card pl-9 pr-8" />
      {value && (
        <button type="button" aria-label="Xóa tìm kiếm" onClick={() => onChange("")} className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-0.5 text-muted-foreground hover:text-foreground">
          <X className="h-3.5 w-3.5" />
        </button>
      )}
    </div>
  );
}

export function DateRangeFilter({ from, to, onChange }: { from: string; to: string; onChange: (from: string, to: string) => void }) {
  return (
    <div className="flex items-center gap-1.5">
      <Input type="date" aria-label="Từ ngày" value={from} max={to || undefined} onChange={(e) => onChange(e.target.value, to)} className="h-9 w-[140px] bg-card text-sm" />
      <span className="text-sm text-muted-foreground">–</span>
      <Input type="date" aria-label="Đến ngày" value={to} min={from || undefined} onChange={(e) => onChange(from, e.target.value)} className="h-9 w-[140px] bg-card text-sm" />
      {(from || to) && (
        <button type="button" aria-label="Xóa khoảng ngày" onClick={() => onChange("", "")} className="rounded p-1 text-muted-foreground hover:text-foreground">
          <X className="h-4 w-4" />
        </button>
      )}
    </div>
  );
}

/** Lower-cased, accent-free text so "khanh" matches "Khánh". */
export function norm(s: string | null | undefined): string {
  return (s ?? "").normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/đ/g, "d").replace(/Đ/g, "D").toLowerCase().trim();
}

export function matches(q: string, ...fields: (string | null | undefined)[]): boolean {
  const n = norm(q);
  return !n || fields.some((f) => norm(f).includes(n));
}
