import { readFileSync, existsSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { cleanPhone, customerKey, isConsumableName, parseExcelDate, parseWorkbook, purchaseUnit } from "@/lib/excel-import";
import { readFirstSheet } from "@/lib/xlsx-reader";

describe("parseExcelDate", () => {
  it("reads serials and text dates, rejects impossible ones", () => {
    expect(parseExcelDate(45658).iso).toBe("2025-01-01");
    expect(parseExcelDate("2026-10-16 00:00:00").iso).toBe("2026-10-16");
    expect(parseExcelDate("20/10/2026").iso).toBe("2026-10-20");
    expect(parseExcelDate("20/20/2026").iso).toBeNull();
    expect(parseExcelDate("none").iso).toBeNull();
    expect(parseExcelDate(null).iso).toBeNull();
  });
});

describe("row helpers", () => {
  it("cleans phones and detects consumables", () => {
    expect(cleanPhone("0857722386")).toBe("0857722386");
    expect(cleanPhone(857722386)).toBe("0857722386");
    expect(cleanPhone("none")).toBe("");
    expect(["Dây rút lớn", "Dây rút nhỏ", "Ống gen", "Keo điện", "Băng keo"].every(isConsumableName)).toBe(true);
    expect(["SMK", "Bố thắng"].some(isConsumableName)).toBe(false);
  });

  it("groups customers by phone, never merges different phones by name", () => {
    expect(customerKey({ customer: "a Khanh", phone: "0857722386" })).toBe(customerKey({ customer: "A Khánh", phone: "0857722386" }));
    expect(customerKey({ customer: "a Khanh", phone: "0857722386" })).not.toBe(customerKey({ customer: "a Khanh", phone: "0857722387" }));
  });

  it("derives purchase unit cost from the total", () => {
    expect(purchaseUnit({ quantity: 5, amount: 254 })).toBe(50.8);
  });
});

// The store's real workbook, when present in the repo root.
const FILE = "xechoi choixe.xlsx";
describe.skipIf(!existsSync(FILE))("store workbook", () => {
  it("parses both tables", async () => {
    const buf = readFileSync(FILE);
    const rows = await readFirstSheet(buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength));
    const { purchases, sales } = parseWorkbook(rows);
    expect(purchases).toHaveLength(9);
    expect(sales).toHaveLength(5);
    expect(purchases.map((p) => [p.product, p.quantity, p.amount, p.date.iso])).toEqual([
      ["SMK", 1, 47, "2026-10-13"],
      ["SMK", 5, 254, "2026-10-16"],
      ["SMK", 6, 307, "2026-12-19"],
      ["Bố thắng", 2, 38, "2026-10-11"],
      ["Bố thắng", 5, 94, null],
      ["Dây rút lớn", 1, 35, "2026-10-18"],
      ["Dây rút nhỏ", 1, 5, "2026-10-16"],
      ["Ống gen", 3, 8, "2026-10-16"],
      ["Keo điện", 1, 10, null],
    ]);
    expect(sales.map((s) => [s.customer, s.phone, s.vehicle, s.product, s.unitPrice, s.quantity, s.amount, s.date.iso])).toEqual([
      ["a Khanh", "0857722386", "Gr+ Gr Lite", "SMK", 200, 2, 400, "2026-10-16"],
      ["a Khanh", "0857722387", "Gr", "Bố thắng", 50, 1, 50, "2026-10-16"],
      ["a Kông", "0775675765", "Feliz 2", "SMK", 200, 1, 200, "2026-10-18"],
      ["a Trung", "", "Evo Max", "SMK", 200, 1, 200, "2026-10-18"],
      ["xe nhà", "", "Gr", "SMK", 0, 1, 0, "2026-10-18"],
    ]);
  });
});
