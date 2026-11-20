import { useMemo, useState } from "react";
import { Pencil, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, DataTable, EmptyState, type Column } from "@/components/app/shared";
import { FilterBar, SearchInput, matches } from "@/components/app/inputs";
import { useCustomers, useSales, type Customer } from "@/lib/data";
import { round3, salesPaymentTotal } from "@/lib/calc";
import { fmtDate, fmtMoney, fmtNum, MONEY_UNIT_SHORT } from "@/lib/format";

type Row = Customer & { orders: number; spent: number; last: string | null };

/** Customers tab of the sales page: most recent buyers first, searchable by name, phone, plate or vehicle. */
export function CustomerListSection({ onOpen, onEdit, onAdd }: {
  onOpen: (c: Customer) => void; onEdit: (c: Customer) => void; onAdd: () => void;
}) {
  const [q, setQ] = useState("");
  const customers = useCustomers();
  const sales = useSales();

  const rows = useMemo<Row[] | undefined>(() => {
    if (!customers.data) return undefined;
    const stats = new Map<string, { orders: number; spent: number; last: string | null }>();
    for (const s of sales.data ?? []) {
      if (!s.customer_id || s.status !== "completed") continue;
      const cur = stats.get(s.customer_id) ?? { orders: 0, spent: 0, last: null };
      cur.orders += 1;
      cur.spent = round3(cur.spent + salesPaymentTotal(s.total_amount, s.surcharge));
      if (!cur.last || s.order_date > cur.last) cur.last = s.order_date;
      stats.set(s.customer_id, cur);
    }
    return customers.data
      .filter((c) => matches(q, c.name, c.phone, c.plate, c.vehicle_name, c.code))
      .map((c) => ({ ...c, ...(stats.get(c.id) ?? { orders: 0, spent: 0, last: null }) }))
      .sort((a, b) => (b.last ?? "").localeCompare(a.last ?? ""));
  }, [customers.data, sales.data, q]);

  const dash = <span className="text-muted-foreground">—</span>;
  const columns: Column<Row>[] = [
    { key: "code", header: "Mã KH", mobile: "title", cell: (c) => <span className="font-medium text-primary">{c.code}</span> },
    { key: "name", header: "Tên khách", mobile: "title", cell: (c) => <span className="font-medium">{c.name}</span> },
    { key: "phone", header: "Số điện thoại", cell: (c) => c.phone || dash },
    { key: "vehicle", header: "Tên xe thường dùng", cell: (c) => c.vehicle_name || dash },
    { key: "plate", header: "Biển số thường dùng", cell: (c) => c.plate || dash },
    { key: "orders", header: "Số đơn", align: "right", cell: (c) => <span className="num">{fmtNum(c.orders)}</span> },
    { key: "spent", header: `Tổng chi tiêu (${MONEY_UNIT_SHORT})`, align: "right", mobile: "aside", cell: (c) => <span className="num font-semibold">{fmtMoney(c.spent)}</span> },
    { key: "last", header: "Mua gần nhất", cell: (c) => (c.last ? fmtDate(c.last) : dash) },
    {
      key: "actions", header: "", align: "right",
      cell: (c) => (
        <Button variant="ghost" size="icon" className="h-8 w-8" aria-label="Sửa khách hàng" onClick={(e) => { e.stopPropagation(); onEdit(c); }}>
          <Pencil className="h-4 w-4" />
        </Button>
      ),
    },
  ];

  return (
    <Card>
      <FilterBar><SearchInput value={q} onChange={setQ} placeholder="Tìm khách theo tên, SĐT, biển số, tên xe..." className="sm:w-80" /></FilterBar>
      <DataTable columns={columns} rows={rows} rowKey={(c) => c.id} onRowClick={onOpen}
        loading={customers.isLoading} error={customers.error} onRetry={() => void customers.refetch()}
        empty={<EmptyState title={q ? "Không tìm thấy khách hàng" : "Chưa có khách hàng"}
          hint="Khách hàng cũng có thể được tạo ngay khi lập đơn bán."
          action={!q && <Button size="sm" onClick={onAdd}><Plus className="h-4 w-4" />Thêm khách hàng</Button>} />} />
    </Card>
  );
}
