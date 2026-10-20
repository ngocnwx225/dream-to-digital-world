import { useMemo, useState } from "react";
import { Check, ChevronsUpDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import type { Balance, Customer, Product } from "@/lib/data";
import { fmtMoney, fmtNum } from "@/lib/format";
import { matches } from "./inputs";

/**
 * Searchable product picker. Inactive products are hidden unless already on the
 * document being edited (`keepIds`), so old documents still render their lines.
 */
export function ProductSelector({ products, balances, value, onChange, keepIds = [], showStock, invalid, className }: {
  products: Product[]; balances?: Map<string, Balance> | undefined; value: string; onChange: (id: string) => void;
  keepIds?: string[]; showStock?: boolean; invalid?: boolean; className?: string;
}) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const selected = products.find((p) => p.id === value);
  const list = useMemo(
    () => products.filter((p) => (p.is_active || keepIds.includes(p.id)) && matches(q, p.name, p.code)).slice(0, 100),
    [products, keepIds, q],
  );

  return (
    <Popover open={open} onOpenChange={(o) => { setOpen(o); if (!o) setQ(""); }}>
      <PopoverTrigger asChild>
        <Button type="button" variant="outline" role="combobox" aria-expanded={open} aria-invalid={invalid || undefined}
          className={cn("h-9 w-full min-w-[180px] justify-between bg-card px-3 font-normal", !selected && "text-muted-foreground", invalid && "border-destructive", className)}>
          <span className="truncate">{selected ? selected.name : "Chọn sản phẩm"}</span>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[320px] p-0" align="start">
        <Command shouldFilter={false}>
          <CommandInput placeholder="Tìm theo tên hoặc mã..." value={q} onValueChange={setQ} />
          <CommandList>
            <CommandEmpty>Không tìm thấy sản phẩm đang bán</CommandEmpty>
            <CommandGroup>
              {list.map((p) => {
                const stock = balances?.get(p.id)?.quantity ?? 0;
                return (
                  <CommandItem key={p.id} value={p.id} onSelect={() => { onChange(p.id); setOpen(false); setQ(""); }}>
                    <Check className={cn("h-4 w-4", value === p.id ? "opacity-100" : "opacity-0")} />
                    <div className="flex min-w-0 flex-1 items-center justify-between gap-2">
                      <span className="truncate">{p.name} <span className="text-xs text-muted-foreground">{p.code}</span></span>
                      <span className={cn("num shrink-0 text-xs", showStock && stock <= 0 ? "text-destructive" : "text-muted-foreground")}>
                        {showStock ? `Tồn ${fmtNum(stock)}` : fmtMoney(p.sale_price)}
                      </span>
                    </div>
                  </CommandItem>
                );
              })}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

export function CustomerSelector({ customers, value, onChange, invalid }: {
  customers: Customer[]; value: string; onChange: (c: Customer) => void; invalid?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const selected = customers.find((c) => c.id === value);
  const list = useMemo(() => customers.filter((c) => matches(q, c.name, c.phone, c.plate, c.code)).slice(0, 100), [customers, q]);

  return (
    <Popover open={open} onOpenChange={(o) => { setOpen(o); if (!o) setQ(""); }}>
      <PopoverTrigger asChild>
        <Button type="button" variant="outline" role="combobox" aria-expanded={open}
          className={cn("h-10 w-full justify-between bg-card px-3 font-normal", !selected && "text-muted-foreground", invalid && "border-destructive")}>
          <span className="truncate">{selected ? `${selected.name}${selected.phone ? ` · ${selected.phone}` : ""}` : "Tìm khách hàng theo tên, SĐT, biển số..."}</span>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-(--radix-popover-trigger-width) min-w-[300px] p-0" align="start">
        <Command shouldFilter={false}>
          <CommandInput placeholder="Tên, số điện thoại, biển số..." value={q} onValueChange={setQ} />
          <CommandList>
            <CommandEmpty>Không tìm thấy khách hàng</CommandEmpty>
            <CommandGroup>
              {list.map((c) => (
                <CommandItem key={c.id} value={c.id} onSelect={() => { onChange(c); setOpen(false); setQ(""); }}>
                  <Check className={cn("h-4 w-4", value === c.id ? "opacity-100" : "opacity-0")} />
                  <div className="min-w-0">
                    <p className="truncate">{c.name} <span className="text-xs text-muted-foreground">{c.code}</span></p>
                    <p className="truncate text-xs text-muted-foreground">{[c.phone, c.plate, c.vehicle_name].filter(Boolean).join(" · ") || "Chưa có thông tin liên hệ"}</p>
                  </div>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
