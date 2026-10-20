// Minimal .xlsx reader: unzips with the platform's DecompressionStream and parses the first
// worksheet's XML. Enough for importing plain tables without adding a spreadsheet dependency.

export type Cell = string | number | null;

type ZipEntry = { name: string; method: number; compSize: number; offset: number };

function listZip(buf: ArrayBuffer): Map<string, ZipEntry> {
  const v = new DataView(buf);
  let eocd = -1;
  for (let i = buf.byteLength - 22; i >= Math.max(0, buf.byteLength - 65_557); i--) {
    if (v.getUint32(i, true) === 0x06054b50) { eocd = i; break; }
  }
  if (eocd < 0) throw new Error("File không phải định dạng .xlsx hợp lệ");
  const count = v.getUint16(eocd + 10, true);
  let p = v.getUint32(eocd + 16, true);
  const dec = new TextDecoder();
  const out = new Map<string, ZipEntry>();
  for (let i = 0; i < count; i++) {
    if (v.getUint32(p, true) !== 0x02014b50) break;
    const method = v.getUint16(p + 10, true);
    const compSize = v.getUint32(p + 20, true);
    const nameLen = v.getUint16(p + 28, true);
    const extraLen = v.getUint16(p + 30, true);
    const commentLen = v.getUint16(p + 32, true);
    const offset = v.getUint32(p + 42, true);
    const name = dec.decode(new Uint8Array(buf, p + 46, nameLen));
    out.set(name, { name, method, compSize, offset });
    p += 46 + nameLen + extraLen + commentLen;
  }
  return out;
}

async function readEntry(buf: ArrayBuffer, e: ZipEntry): Promise<string> {
  const v = new DataView(buf);
  const start = e.offset + 30 + v.getUint16(e.offset + 26, true) + v.getUint16(e.offset + 28, true);
  const data = new Uint8Array(buf, start, e.compSize);
  if (e.method === 0) return new TextDecoder().decode(data);
  if (e.method !== 8) throw new Error("Kiểu nén trong file .xlsx không được hỗ trợ");
  const source = new ReadableStream<BufferSource>({ start(c) { c.enqueue(data); c.close(); } });
  const stream = source.pipeThrough(new DecompressionStream("deflate-raw"));
  return new Response(stream).text();
}

const xml = (s: string) => new DOMParser().parseFromString(s, "application/xml");
const byTag = (n: Document | Element, tag: string) => Array.from(n.getElementsByTagNameNS("*", tag));

/** Column letters of a cell ref ("AB12") → 0-based index. */
function colIndex(ref: string): number {
  let n = 0;
  for (const ch of ref.replace(/\d+$/, "")) n = n * 26 + (ch.charCodeAt(0) - 64);
  return n - 1;
}

/** Rows of the first worksheet as raw values (numbers stay numbers, e.g. Excel date serials). */
export async function readFirstSheet(buf: ArrayBuffer): Promise<Cell[][]> {
  const zip = listZip(buf);
  const get = async (name: string) => { const e = zip.get(name); return e ? readEntry(buf, e) : null; };

  // Resolve the first sheet through workbook.xml and its relationships.
  let sheetPath = "xl/worksheets/sheet1.xml";
  const wb = await get("xl/workbook.xml");
  const rels = await get("xl/_rels/workbook.xml.rels");
  if (wb && rels) {
    const rid = byTag(xml(wb), "sheet")[0]?.getAttribute("r:id");
    const target = byTag(xml(rels), "Relationship").find((r) => r.getAttribute("Id") === rid)?.getAttribute("Target");
    if (target) sheetPath = target.startsWith("/") ? target.slice(1) : `xl/${target}`;
  }

  const sst = await get("xl/sharedStrings.xml");
  // A shared string may be split into rich-text runs; phonetic hints (rPh) are not content.
  const shared = sst
    ? byTag(xml(sst), "si").map((si) => byTag(si, "t").filter((t) => t.parentElement?.localName !== "rPh").map((t) => t.textContent ?? "").join(""))
    : [];

  const sheet = await get(sheetPath);
  if (!sheet) throw new Error("Không tìm thấy trang tính trong file");
  const rows: Cell[][] = [];
  for (const row of byTag(xml(sheet), "row")) {
    const r = Number(row.getAttribute("r") ?? NaN) - 1;
    const cells: Cell[] = [];
    for (const c of byTag(row, "c")) {
      const t = c.getAttribute("t");
      const raw = byTag(c, "v")[0]?.textContent ?? null;
      let value: Cell = null;
      if (t === "s") value = raw == null ? null : (shared[Number(raw)] ?? null);
      else if (t === "inlineStr") value = byTag(c, "t").map((x) => x.textContent ?? "").join("");
      else if (t === "str" || t === "e") value = raw;
      else if (t === "b") value = raw === "1" ? "TRUE" : "FALSE";
      else value = raw == null || raw === "" ? null : Number(raw);
      // Some writers omit the cell reference; then cells are consecutive.
      const ref = c.getAttribute("r");
      cells[ref ? colIndex(ref) : cells.length] = value;
    }
    rows[Number.isFinite(r) && r >= 0 ? r : rows.length] = Array.from(cells, (x) => x ?? null);
  }
  return Array.from(rows, (x) => x ?? []);
}
