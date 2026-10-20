import { Area, AreaChart, Bar, BarChart, CartesianGrid, Cell, Legend, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { fmtMoney, fmtPct, MONEY_UNIT } from "@/lib/format";

// Categorical order validated for colour-vision deficiency (blue, orange, aqua, yellow, magenta);
// anything beyond five slices folds into a neutral "Khác".
export const SERIES = ["#3461f5", "#eb6834", "#1baf7a", "#eda100", "#e87ba4"] as const;
const OTHER = "#94a3b8";
const AXIS = { fontSize: 12, fill: "#64748b" };
const GRID = "#e4ecf5";

function MoneyTooltip({ active, payload, label, labelPrefix, labelSuffix }: {
  active?: boolean; payload?: { name?: string; value?: number; color?: string }[]; label?: string | number; labelPrefix?: string; labelSuffix?: string;
}) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-xl border border-border bg-card/95 px-3 py-2 text-xs shadow-elevated backdrop-blur">
      <p className="mb-1 font-semibold text-foreground">{labelPrefix}{label}{labelSuffix}</p>
      {payload.map((p) => (
        <p key={p.name} className="flex items-center gap-2 text-muted-foreground">
          <span className="h-2 w-2 rounded-full" style={{ background: p.color }} />
          {p.name}: <span className="num font-semibold text-foreground">{fmtMoney(p.value)} {MONEY_UNIT}</span>
        </p>
      ))}
    </div>
  );
}

const compact = (v: number) => v.toLocaleString("vi-VN", { notation: "compact", maximumFractionDigits: 1 });

/** Daily revenue for a month; days without sales are zero. */
export function RevenueChart({ data, month }: { data: { day: number; revenue: number }[]; month: number }) {
  return (
    <ResponsiveContainer width="100%" height={260}>
      <AreaChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
        <defs>
          <linearGradient id="revFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={SERIES[0]} stopOpacity={0.24} />
            <stop offset="100%" stopColor={SERIES[0]} stopOpacity={0.02} />
          </linearGradient>
        </defs>
        <CartesianGrid stroke={GRID} vertical={false} />
        <XAxis dataKey="day" tick={AXIS} tickLine={false} axisLine={{ stroke: GRID }} interval="preserveStartEnd" minTickGap={12} />
        <YAxis tick={AXIS} tickLine={false} axisLine={false} width={48} tickFormatter={compact} />
        <Tooltip content={<MoneyTooltip labelPrefix="Ngày " labelSuffix={`/${String(month).padStart(2, "0")}`} />}
          cursor={{ stroke: SERIES[0], strokeDasharray: "3 3" }} />
        <Area type="monotone" dataKey="revenue" name="Doanh thu" stroke={SERIES[0]} strokeWidth={2.5} fill="url(#revFill)"
          activeDot={{ r: 5, strokeWidth: 2, stroke: "#fff" }} dot={false} />
      </AreaChart>
    </ResponsiveContainer>
  );
}

/** Revenue share per product as a donut with a labelled legend (doubles as the table view). */
export function SalesDonut({ rows }: { rows: { name: string; revenue: number }[] }) {
  const total = rows.reduce((s, r) => s + r.revenue, 0);
  const top = rows.slice(0, SERIES.length);
  const rest = rows.slice(SERIES.length).reduce((s, r) => s + r.revenue, 0);
  const data = [
    ...top.map((r, i) => ({ name: r.name, value: r.revenue, color: SERIES[i] ?? OTHER })),
    ...(rest > 0 ? [{ name: "Khác", value: rest, color: OTHER }] : []),
  ];
  return (
    <div className="flex flex-col items-center gap-4 sm:flex-row lg:flex-col xl:flex-row">
      <div className="relative h-[180px] w-[180px] shrink-0">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie data={data} dataKey="value" nameKey="name" innerRadius={58} outerRadius={84} paddingAngle={data.length > 1 ? 2 : 0} stroke="#fff" strokeWidth={2}>
              {data.map((d) => <Cell key={d.name} fill={d.color} />)}
            </Pie>
            <Tooltip content={({ active, payload }) => {
              const p = payload?.[0];
              if (!active || !p) return null;
              const v = Number(p.value ?? 0);
              return (
                <div className="rounded-xl border border-border bg-card/95 px-3 py-2 text-xs shadow-elevated backdrop-blur">
                  <p className="font-semibold text-foreground">{String(p.name)}</p>
                  <p className="num text-muted-foreground">{fmtMoney(v)} {MONEY_UNIT} · {fmtPct(total ? (v / total) * 100 : 0)}</p>
                </div>
              );
            }} />
          </PieChart>
        </ResponsiveContainer>
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center text-center">
          <span className="text-xs text-muted-foreground">Tổng</span>
          <span className="num text-base font-bold text-foreground">{fmtMoney(total)}</span>
          <span className="text-[11px] text-muted-foreground">nghìn đ</span>
        </div>
      </div>
      <ul className="w-full min-w-0 space-y-2">
        {data.map((d) => (
          <li key={d.name} className="flex items-center gap-2 text-sm">
            <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: d.color }} />
            <span className="min-w-0 flex-1 truncate text-foreground">{d.name}</span>
            <span className="num text-muted-foreground">{fmtMoney(d.value)}</span>
            <span className="num w-12 text-right font-semibold text-foreground">{fmtPct(total ? (d.value / total) * 100 : 0)}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/** Revenue vs profit per period bucket (day or month); one shared money axis. */
export function ProfitChart({ data, labelPrefix }: { data: { label: string; revenue: number; profit: number }[]; labelPrefix: string }) {
  return (
    <ResponsiveContainer width="100%" height={280}>
      <BarChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }} barGap={2}>
        <CartesianGrid stroke={GRID} vertical={false} />
        <XAxis dataKey="label" tick={AXIS} tickLine={false} axisLine={{ stroke: GRID }} interval="preserveStartEnd" minTickGap={8} />
        <YAxis tick={AXIS} tickLine={false} axisLine={false} width={48} tickFormatter={compact} />
        <Tooltip content={<MoneyTooltip labelPrefix={labelPrefix} />} cursor={{ fill: "#eef3fb" }} />
        <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 12, color: "#64748b" }} />
        <Bar dataKey="revenue" name="Doanh thu" fill={SERIES[0]} radius={[6, 6, 0, 0]} maxBarSize={22} />
        <Bar dataKey="profit" name="Lợi nhuận sau vật tư" fill={SERIES[2]} radius={[6, 6, 0, 0]} maxBarSize={22} />
      </BarChart>
    </ResponsiveContainer>
  );
}
