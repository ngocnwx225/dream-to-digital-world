import { useMemo, useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { Pencil, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, DataTable, EmptyState, PageHeader, type Column } from "@/components/app/shared";
import { SearchInput, matches } from "@/components/app/inputs";
import { CustomerFormDialog } from "@/components/app/customer-form-dialog";
import { useCustomers, useSales, type Customer } from "@/lib/data";
import { round3 } from "@/lib/calc";
import { fmtDate, fmtMoney, fmtNum, MONEY_UNIT_SHORT } from "@/lib/format";

export const Route = createFileRoute("/_app/customers/")({
  head: () => ({ meta: [{ title: "Khách hàng – StoreFlow" }] }),
  component: CustomersPage,
});

type Row = Customer & { orders: number; spent: number; last: string | null };

function CustomersPage() {
  const navigate = useNavigate();
  const [q, setQ] = useState("");
  const [editing, setEditing] = useState<Customer | "new" | null>(null);
  const customers = useCustomers();
  const sales = useSales();

  const rows = useMemo<Row[] | undefined>(() => {
    if (!customers.data) return undefined;
    const stats = new Map<string, { orders: number; spent: number; last: string | null }>();
    for (const s of sales.data ?? []) {
      if (!s.customer_id || s.status !== "completed") continue;
      const cur = stats.get(s.customer_id) ?? { orders: 0, spent: 0, last: null };
      cur.orders += 1;
      cur.spent = round3(cur.spent + s.total_amount);
      if (!cur.last || s.order_date > cur.last) cur.last = s.order_date;
      stats.set(s.customer_id, cur);
    }
    return customers.data
      .filter((c) => matches(q, c.name, c.phone, c.plate, c.vehicle_name, c.code))
      .map((c) => ({ ...c, ...(stats.get(c.id) ?? { orders: 0, spent: 0, last: null }) }));
  }, [customers.data, sales.data, q]);

  const dash = <span className="text-muted-foreground">—</span>;
  const columns: Column<Row>[] = [
    { key: "code", header: "Mã KH", cell: (c) => <span className="font-medium text-primary">{c.code}</span> },
    { key: "name", header: "Tên khách", cell: (c) => <span className="font-medium">{c.name}</span> },
    { key: "phone", header: "Số điện thoại", cell: (c) => c.phone || dash },
    { key: "vehicle", header: "Tên xe thường dùng", cell: (c) => c.vehicle_name || dash },
    { key: "plate", header: "Biển số thường dùng", cell: (c) => c.plate || dash },
    { key: "orders", header: "Số đơn", align: "right", cell: (c) => <span className="num">{fmtNum(c.orders)}</span> },
    { key: "spent", header: `Tổng chi tiêu (${MONEY_UNIT_SHORT})`, align: "right", cell: (c) => <span className="num font-semibold">{fmtMoney(c.spent)}</span> },
    { key: "last", header: "Mua gần nhất", cell: (c) => (c.last ? fmtDate(c.last) : dash) },
    { key: "note", header: "Ghi chú", className: "max-w-[180px] truncate text-muted-foreground", cell: (c) => c.note || "" },
    {
      key: "actions", header: "", align: "right",
      cell: (c) => (
        <Button variant="ghost" size="icon" className="h-8 w-8" aria-label="Sửa khách hàng" onClick={(e) => { e.stopPropagation(); setEditing(c); }}>
          <Pencil className="h-4 w-4" />
        </Button>
      ),
    },
  ];

  return (
    <>
      <PageHeader title="Khách hàng" subtitle="Thông tin khách hàng và lịch sử mua hàng"
        actions={<Button onClick={() => setEditing("new")}><Plus className="h-4 w-4" />Thêm khách hàng</Button>} />
      <Card>
        <div className="mb-4"><SearchInput value={q} onChange={setQ} placeholder="Tên, SĐT, biển số, tên xe..." className="sm:w-80" /></div>
        <DataTable columns={columns} rows={rows} rowKey={(c) => c.id}
          onRowClick={(c) => void navigate({ to: "/customers/$id", params: { id: c.id } })}
          loading={customers.isLoading} error={customers.error} onRetry={() => void customers.refetch()}
          empty={<EmptyState title={q ? "Không tìm thấy khách hàng" : "Chưa có khách hàng"}
            hint="Khách hàng cũng có thể được tạo ngay khi lập đơn bán."
            action={!q && <Button size="sm" onClick={() => setEditing("new")}><Plus className="h-4 w-4" />Thêm khách hàng</Button>} />} />
      </Card>
      <CustomerFormDialog customer={editing} onClose={() => setEditing(null)} />
    </>
  );
}
