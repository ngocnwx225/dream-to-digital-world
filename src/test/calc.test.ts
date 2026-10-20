import { describe, expect, it } from "vitest";
import { aggregateSales, consumableCost, movingAverage, orderConsumables, profitAfterConsumables, parseDecimal, round3, totals, unitFromAmount, updateCostLine, type CostLine } from "@/lib/calc";
import { fmtMoney } from "@/lib/format";

const line = (over: Partial<CostLine> = {}): CostLine => ({ quantity: "", unit_cost: "", amount: "", driver: "amount", ...over });

describe("purchase line pricing", () => {
  it("derives unit cost from total: 5 SMK for 254 → 50,8", () => {
    let l = updateCostLine(line(), "quantity", "5");
    l = updateCostLine(l, "amount", "254");
    expect(l.unit_cost).toBe("50,8");
    expect(unitFromAmount(254, 5)).toBe(50.8);
  });

  it("recomputes the total when the unit cost is edited", () => {
    const l = updateCostLine(line({ quantity: "5", amount: "254", unit_cost: "50,8" }), "unit_cost", "52");
    expect(l.amount).toBe("260");
    expect(l.driver).toBe("unit");
  });

  it("keeps the last-edited field as the driver when quantity changes", () => {
    const byAmount = updateCostLine(line({ quantity: "5", amount: "254", unit_cost: "50,8" }), "quantity", "4");
    expect(byAmount.amount).toBe("254");
    expect(byAmount.unit_cost).toBe("63,5");
    const byUnit = updateCostLine(line({ quantity: "5", amount: "260", unit_cost: "52", driver: "unit" }), "quantity", "2");
    expect(byUnit.unit_cost).toBe("52");
    expect(byUnit.amount).toBe("104");
  });

  it("leaves fields alone while quantity is empty or zero", () => {
    const l = updateCostLine(line({ quantity: "0" }), "amount", "100");
    expect(l.unit_cost).toBe("");
  });
});

describe("parseDecimal", () => {
  it("accepts Vietnamese decimal comma and dot", () => {
    expect(parseDecimal("50,8")).toBe(50.8);
    expect(parseDecimal("50.8")).toBe(50.8);
    expect(parseDecimal(" 200 ")).toBe(200);
  });
  it("rejects garbage", () => {
    expect(parseDecimal("")).toBeNull();
    expect(parseDecimal("abc")).toBeNull();
    expect(parseDecimal("1,2,3")).toBeNull();
  });
});

describe("profit (moving weighted average)", () => {
  it("acceptance scenario: buy 5 for 254, sell 2 at 200 → revenue 400, COGS 101,6, profit 298,4", () => {
    const stock = movingAverage(0, 0, 5, 254);
    expect(stock.avg).toBe(50.8);
    const cogs = round3(2 * stock.avg);
    const rows = aggregateSales([{ product_id: "smk", quantity: 2, amount: 400, cost_amount: cogs }], () => "SMK");
    expect(rows[0]).toMatchObject({ revenue: 400, cost: 101.6, profit: 298.4 });
    expect(rows[0]!.margin).toBeCloseTo(74.6, 1);
  });

  it("re-averages when a purchase arrives at a different unit cost", () => {
    // 3 left at 50,8 (value 152,4) + 5 bought at 60 (300) → 8 units worth 452,4 → avg 56,55
    const after = movingAverage(3, 152.4, 5, 300);
    expect(after.qty).toBe(8);
    expect(after.value).toBe(452.4);
    expect(after.avg).toBeCloseTo(56.55, 6);
  });

  it("computes profit per product from each product's own lines", () => {
    const rows = aggregateSales(
      [
        { product_id: "a", quantity: 2, amount: 400, cost_amount: 101.6 },
        { product_id: "b", quantity: 1, amount: 50, cost_amount: 30 },
        { product_id: "a", quantity: 1, amount: 200, cost_amount: 50.8 },
      ],
      (id) => id.toUpperCase(),
    );
    expect(rows.map((r) => [r.name, r.qty, r.revenue, r.cost, r.profit])).toEqual([
      ["A", 3, 600, 152.4, 447.6],
      ["B", 1, 50, 30, 20],
    ]);
    expect(totals(rows)).toMatchObject({ revenue: 650, cost: 182.4, profit: 467.6 });
  });
});

describe("consumable cost per vehicle", () => {
  const line = (order_id: string, date: string, cost: number) => ({ order_id, sales_orders: { order_date: date, consumable_total_cost: cost } });

  it("charges per vehicle, never per product (TC01–TC04)", () => {
    expect(consumableCost(1, 5)).toBe(5);
    expect(consumableCost(2, 5)).toBe(10);
    expect(consumableCost(0, 5)).toBe(0);
    // An order with 3 product lines for 1 vehicle is counted once.
    const orders = orderConsumables([line("o1", "2026-10-01", 5), line("o1", "2026-10-01", 5), line("o1", "2026-10-01", 5)]);
    expect(orders).toEqual([{ date: "2026-10-01", cost: 5 }]);
  });

  it("profit after consumables: 200 − 120 − 5 = 75 (TC05)", () => {
    expect(profitAfterConsumables(200, 120, 5)).toEqual({ profit: 75, margin: 37.5 });
  });

  it("two products for one vehicle: 300 − 180 − 5 = 115", () => {
    const rows = aggregateSales(
      [
        { product_id: "a", quantity: 1, amount: 200, cost_amount: 120 },
        { product_id: "b", quantity: 1, amount: 100, cost_amount: 60 },
      ],
      (id) => id,
    );
    const t = totals(rows);
    // Product profits stay before consumables; the 5 is subtracted once at order level.
    expect(rows.map((r) => r.profit)).toEqual([80, 40]);
    expect(profitAfterConsumables(t.revenue, t.cost, 5).profit).toBe(115);
  });
});

describe("money display", () => {
  it("shows nghìn đồng values as-is, never scaled by 1000", () => {
    expect(fmtMoney(850, true)).toBe("850 nghìn đồng");
    expect(fmtMoney(50.8)).toBe("50,8");
    expect(fmtMoney(1234.5)).toBe("1.234,5");
  });
});
