/**
 * Reads an .xlsx file back into rows — the other half of lib/xlsx.ts, again
 * with no npm dependency.
 *
 * Handles what Excel and Google Sheets actually produce: the ZIP container,
 * shared strings (how Excel stores text, rather than the inline strings we
 * write), inline strings, numbers, booleans and date cells (which are numbers
 * plus a date format, so the formats have to be read to tell them apart).
 *
 * Server-only (uses zlib).
 */

import { inflateRawSync } from "zlib";

export type SheetRows = string[][];

// ───────────────────────────── ZIP ─────────────────────────────

function readZip(buf: Buffer): Map<string, Buffer> {
  const files = new Map<string, Buffer>();
  // Walk the central directory — more reliable than scanning local headers,
  // which may carry sizes only in a trailing data descriptor.
  const eocd = findEocd(buf);
  if (eocd < 0) throw new ImportError("That file isn't a valid .xlsx workbook.");
  const count = buf.readUInt16LE(eocd + 10);
  let p = buf.readUInt32LE(eocd + 16);

  for (let n = 0; n < count && p + 46 <= buf.length; n++) {
    if (buf.readUInt32LE(p) !== 0x02014b50) break;
    const method = buf.readUInt16LE(p + 10);
    const compSize = buf.readUInt32LE(p + 20);
    const nameLen = buf.readUInt16LE(p + 28);
    const extraLen = buf.readUInt16LE(p + 30);
    const commentLen = buf.readUInt16LE(p + 32);
    const localOffset = buf.readUInt32LE(p + 42);
    const name = buf.subarray(p + 46, p + 46 + nameLen).toString("utf8");

    // The local header repeats the name/extra lengths; the data follows it.
    const lNameLen = buf.readUInt16LE(localOffset + 26);
    const lExtraLen = buf.readUInt16LE(localOffset + 28);
    const start = localOffset + 30 + lNameLen + lExtraLen;
    const body = buf.subarray(start, start + compSize);
    try {
      files.set(name, method === 8 ? inflateRawSync(body) : body);
    } catch {
      /* skip a part we can't read — the sheet may still be fine */
    }
    p += 46 + nameLen + extraLen + commentLen;
  }
  return files;
}

function findEocd(buf: Buffer) {
  // The end-of-central-directory record is at the end, after an optional comment.
  for (let i = buf.length - 22; i >= 0 && i > buf.length - 22 - 65_535; i--) {
    if (buf.readUInt32LE(i) === 0x06054b50) return i;
  }
  return -1;
}

// ──────────────────────────── Parsing ────────────────────────────

export class ImportError extends Error {}

const unescape = (s: string) =>
  s
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(Number(d)))
    .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&amp;/g, "&");

/** All the <t> text inside one element (shared strings can be split by runs). */
function textOf(xmlChunk: string) {
  const parts = xmlChunk.match(/<t[^>]*>([\s\S]*?)<\/t>/g) ?? [];
  return unescape(parts.map((p) => p.replace(/<t[^>]*>([\s\S]*?)<\/t>/, "$1")).join(""));
}

function sharedStrings(files: Map<string, Buffer>): string[] {
  const xml = files.get("xl/sharedStrings.xml")?.toString("utf8");
  if (!xml) return [];
  return (xml.match(/<si>[\s\S]*?<\/si>|<si\/>/g) ?? []).map(textOf);
}

/** Style index → true when that style is a date/time format. */
function dateStyles(files: Map<string, Buffer>): boolean[] {
  const xml = files.get("xl/styles.xml")?.toString("utf8");
  if (!xml) return [];
  // Built-in date formats, plus any custom one whose code looks like a date.
  const builtInDates = new Set([14, 15, 16, 17, 18, 19, 20, 21, 22, 45, 46, 47]);
  const customDates = new Set<number>();
  for (const m of xml.matchAll(/<numFmt[^>]*numFmtId="(\d+)"[^>]*formatCode="([^"]*)"/g)) {
    const code = unescape(m[2]).replace(/\[[^\]]*\]/g, "");
    if (/[dmyhs]/i.test(code) && !/^[#0.,%\s]*$/.test(code)) customDates.add(Number(m[1]));
  }
  const cellXfs = /<cellXfs[^>]*>([\s\S]*?)<\/cellXfs>/.exec(xml)?.[1] ?? "";
  return (cellXfs.match(/<xf[^>]*\/?>/g) ?? []).map((xf) => {
    const id = Number(/numFmtId="(\d+)"/.exec(xf)?.[1] ?? "0");
    return builtInDates.has(id) || customDates.has(id);
  });
}

/** Excel's serial number → ISO date. Day 1 is 1900-01-01, with its leap-year bug. */
function serialToIso(serial: number) {
  if (!Number.isFinite(serial) || serial <= 0) return String(serial);
  const ms = Math.round((serial - 25569) * 86_400_000);
  const d = new Date(ms);
  if (Number.isNaN(d.getTime())) return String(serial);
  const iso = d.toISOString();
  // A whole number is a plain date; a fraction carries a time too.
  return serial % 1 === 0 ? iso.slice(0, 10) : iso.slice(0, 19).replace("T", " ");
}

/** "C7" → 2 (zero-based column index). */
function colIndex(ref: string) {
  const letters = /^([A-Z]+)/.exec(ref)?.[1] ?? "A";
  let n = 0;
  for (const ch of letters) n = n * 26 + (ch.charCodeAt(0) - 64);
  return n - 1;
}

/**
 * Reads the first worksheet as a grid of strings. Empty cells come back as "",
 * and every row is padded to the width of the widest row.
 */
export function readXlsx(buf: Buffer, maxRows = 5_000): SheetRows {
  const files = readZip(buf);

  // The workbook's first sheet, following the relationship — sheet1.xml isn't
  // always the first tab.
  let sheetPath = "xl/worksheets/sheet1.xml";
  const wb = files.get("xl/workbook.xml")?.toString("utf8");
  const rels = files.get("xl/_rels/workbook.xml.rels")?.toString("utf8");
  if (wb && rels) {
    const rid = /<sheet[^>]*r:id="([^"]+)"/.exec(wb)?.[1];
    const target = rid
      ? new RegExp(`<Relationship[^>]*Id="${rid}"[^>]*Target="([^"]+)"`).exec(rels)?.[1]
      : undefined;
    if (target) {
      const clean = target.replace(/^\/?xl\//, "").replace(/^\//, "");
      if (files.has(`xl/${clean}`)) sheetPath = `xl/${clean}`;
    }
  }
  const sheetXml = files.get(sheetPath)?.toString("utf8");
  if (!sheetXml) throw new ImportError("Couldn't find a worksheet in that file — is it really an .xlsx?");

  const shared = sharedStrings(files);
  const isDate = dateStyles(files);

  const out: SheetRows = [];
  let width = 0;

  for (const rowXml of sheetXml.match(/<row[^>]*>[\s\S]*?<\/row>/g) ?? []) {
    if (out.length >= maxRows) break;
    const row: string[] = [];
    for (const cellXml of rowXml.match(/<c[^>]*\/>|<c[^>]*>[\s\S]*?<\/c>/g) ?? []) {
      const ref = /r="([A-Z]+\d+)"/.exec(cellXml)?.[1];
      const at = ref ? colIndex(ref) : row.length;
      const type = /t="([^"]+)"/.exec(cellXml)?.[1] ?? "n";
      const styleId = Number(/s="(\d+)"/.exec(cellXml)?.[1] ?? "-1");
      const raw = /<v>([\s\S]*?)<\/v>/.exec(cellXml)?.[1];

      let value = "";
      if (type === "s") value = shared[Number(raw ?? "-1")] ?? "";
      else if (type === "inlineStr") value = textOf(cellXml);
      else if (type === "str") value = unescape(raw ?? "");
      else if (type === "b") value = raw === "1" ? "Yes" : "No";
      else if (type === "e") value = "";
      else if (raw !== undefined) {
        const num = Number(raw);
        value = styleId >= 0 && isDate[styleId] ? serialToIso(num) : raw;
      }

      while (row.length < at) row.push("");
      row[at] = value.trim();
    }
    if (row.length > width) width = row.length;
    out.push(row);
  }

  for (const row of out) while (row.length < width) row.push("");
  // Drop rows that are entirely empty — Excel often leaves a tail of them.
  return out.filter((r) => r.some((c) => c !== ""));
}
