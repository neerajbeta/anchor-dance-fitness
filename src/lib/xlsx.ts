/**
 * A small .xlsx writer — real Excel workbooks, no npm dependency.
 *
 * An .xlsx file is a ZIP of XML parts, so this builds both: `zip()` writes the
 * archive (deflate via zlib, with the CRC and central directory Excel expects)
 * and `sheetToXlsx()` writes the handful of parts a single-sheet workbook needs.
 *
 * What the sheets get: a bold frozen header row, an auto-filter, column widths
 * sized to the content, numbers kept as numbers (so totals can be summed) and
 * everything else written as text. Dates are written as ISO text, which sorts
 * correctly and never depends on the reader's locale.
 *
 * Server-only (uses zlib) — see /api/export/xlsx, which every admin list posts
 * its on-screen rows to.
 */

import { deflateRawSync } from "zlib";

// ───────────────────────────── ZIP ─────────────────────────────

const CRC_TABLE = (() => {
  const t = new Int32Array(256);
  for (let i = 0; i < 256; i++) {
    let c = i;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[i] = c;
  }
  return t;
})();

function crc32(buf: Buffer) {
  let c = -1;
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ -1) >>> 0;
}

type ZipEntry = { name: string; data: Buffer };

/** Builds a ZIP archive. Entries are deflated unless that would make them bigger. */
function zip(entries: ZipEntry[]): Buffer {
  const locals: Buffer[] = [];
  const centrals: Buffer[] = [];
  let offset = 0;

  for (const entry of entries) {
    const name = Buffer.from(entry.name, "utf8");
    const deflated = deflateRawSync(entry.data, { level: 6 });
    const stored = deflated.length >= entry.data.length;
    const body = stored ? entry.data : deflated;
    const method = stored ? 0 : 8;
    const crc = crc32(entry.data);

    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0); // local file header
    local.writeUInt16LE(20, 4); // version needed
    local.writeUInt16LE(0x0800, 6); // UTF-8 names
    local.writeUInt16LE(method, 8);
    local.writeUInt16LE(0, 10); // mod time
    local.writeUInt16LE(0x21, 12); // mod date (1996-01-01 — fixed, so output is reproducible)
    local.writeUInt32LE(crc, 14);
    local.writeUInt32LE(body.length, 18);
    local.writeUInt32LE(entry.data.length, 22);
    local.writeUInt16LE(name.length, 26);
    local.writeUInt16LE(0, 28); // extra field length
    locals.push(local, name, body);

    const central = Buffer.alloc(46);
    central.writeUInt32LE(0x02014b50, 0); // central directory header
    central.writeUInt16LE(20, 4); // version made by
    central.writeUInt16LE(20, 6); // version needed
    central.writeUInt16LE(0x0800, 8);
    central.writeUInt16LE(method, 10);
    central.writeUInt16LE(0, 12);
    central.writeUInt16LE(0x21, 14);
    central.writeUInt32LE(crc, 16);
    central.writeUInt32LE(body.length, 20);
    central.writeUInt32LE(entry.data.length, 24);
    central.writeUInt16LE(name.length, 28);
    central.writeUInt32LE(0, 38); // external attributes
    central.writeUInt32LE(offset, 42);
    centrals.push(central, name);

    offset += local.length + name.length + body.length;
  }

  const centralBuf = Buffer.concat(centrals);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0); // end of central directory
  end.writeUInt16LE(entries.length, 8);
  end.writeUInt16LE(entries.length, 10);
  end.writeUInt32LE(centralBuf.length, 12);
  end.writeUInt32LE(offset, 16);

  return Buffer.concat([...locals, centralBuf, end]);
}

// ──────────────────────────── Workbook ────────────────────────────

export type ExportColumn = { key: string; label: string };
export type ExportRow = Record<string, unknown>;

const xml = (s: string) =>
  s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    // Control characters are illegal in XML and make Excel refuse the file.
    // eslint-disable-next-line no-control-regex
    .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, "");

/** 0 → A, 25 → Z, 26 → AA … */
export function columnName(index: number) {
  let name = "";
  let n = index;
  while (n >= 0) {
    name = String.fromCharCode(65 + (n % 26)) + name;
    n = Math.floor(n / 26) - 1;
  }
  return name;
}

/** What a value becomes in the sheet. */
function cellFor(ref: string, value: unknown, styleId: number) {
  if (value === null || value === undefined || value === "") return `<c r="${ref}" s="${styleId}"/>`;
  if (typeof value === "number" && Number.isFinite(value)) {
    return `<c r="${ref}" s="${styleId}"><v>${value}</v></c>`;
  }
  if (typeof value === "boolean") {
    return `<c r="${ref}" s="${styleId}" t="inlineStr"><is><t>${value ? "Yes" : "No"}</t></is></c>`;
  }
  const text = value instanceof Date ? value.toISOString().slice(0, 19).replace("T", " ") : String(value);
  // xml:space keeps leading / trailing spaces Excel would otherwise drop.
  return `<c r="${ref}" s="${styleId}" t="inlineStr"><is><t xml:space="preserve">${xml(text)}</t></is></c>`;
}

/** Excel refuses these characters in a sheet name, and caps it at 31 chars. */
function safeSheetName(name: string) {
  const clean = name.replace(/[\\/?*[\]:]/g, " ").trim();
  return (clean || "Sheet1").slice(0, 31);
}

export type SheetInput = {
  /** Column order and headings. */
  columns: ExportColumn[];
  /** One object per row, keyed by the columns' `key`. */
  rows: ExportRow[];
  /** Tab name. Trimmed to Excel's 31-character limit. */
  sheetName?: string;
  /** Optional lines written above the table — e.g. which filters were applied. */
  notes?: string[];
};

/** Builds a one-sheet workbook. Returns the .xlsx file bytes. */
export function sheetToXlsx({ columns, rows, sheetName = "Sheet1", notes = [] }: SheetInput): Buffer {
  const cols = columns.length ? columns : [{ key: "value", label: "Value" }];
  const headerRow = notes.length + 1;

  const lines: string[] = [];
  let r = 0;

  // Notes first (plain text, no filter), then a blank line.
  for (const note of notes) {
    r += 1;
    lines.push(`<row r="${r}">${cellFor(`A${r}`, note, 2)}</row>`);
  }
  r = headerRow;
  lines.push(
    `<row r="${r}" ht="18" customHeight="1">${cols
      .map((c, i) => cellFor(`${columnName(i)}${r}`, c.label, 1))
      .join("")}</row>`
  );

  for (const row of rows) {
    r += 1;
    lines.push(
      `<row r="${r}">${cols.map((c, i) => cellFor(`${columnName(i)}${r}`, row[c.key], 0)).join("")}</row>`
    );
  }

  // Width ≈ the widest value in the column, within sensible bounds.
  const widths = cols.map((c, i) => {
    let max = c.label.length;
    for (const row of rows) {
      const v = row[c.key];
      const len = v === null || v === undefined ? 0 : String(v).length;
      if (len > max) max = len;
    }
    return `<col min="${i + 1}" max="${i + 1}" width="${Math.min(60, Math.max(9, max + 2))}" customWidth="1"/>`;
  });

  const lastCol = columnName(cols.length - 1);
  const lastRow = headerRow + rows.length;
  const sheet =
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>` +
    `<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">` +
    `<sheetPr><outlinePr summaryBelow="1" summaryRight="1"/></sheetPr>` +
    `<dimension ref="A1:${lastCol}${Math.max(lastRow, headerRow)}"/>` +
    `<sheetViews><sheetView workbookViewId="0">` +
    // Freeze everything above the first data row, so headings stay put.
    `<pane ySplit="${headerRow}" topLeftCell="A${headerRow + 1}" activePane="bottomLeft" state="frozen"/>` +
    `<selection pane="bottomLeft" activeCell="A${headerRow + 1}" sqref="A${headerRow + 1}"/>` +
    `</sheetView></sheetViews>` +
    `<sheetFormatPr defaultRowHeight="15"/>` +
    `<cols>${widths.join("")}</cols>` +
    `<sheetData>${lines.join("")}</sheetData>` +
    (rows.length
      ? `<autoFilter ref="A${headerRow}:${lastCol}${lastRow}"/>`
      : "") +
    `</worksheet>`;

  const styles =
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>` +
    `<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">` +
    `<fonts count="3">` +
    `<font><sz val="11"/><name val="Calibri"/></font>` +
    `<font><b/><sz val="11"/><color rgb="FFFFFFFF"/><name val="Calibri"/></font>` +
    `<font><i/><sz val="10"/><color rgb="FF666666"/><name val="Calibri"/></font>` +
    `</fonts>` +
    `<fills count="3">` +
    `<fill><patternFill patternType="none"/></fill>` +
    `<fill><patternFill patternType="gray125"/></fill>` +
    `<fill><patternFill patternType="solid"><fgColor rgb="FFEA3835"/><bgColor indexed="64"/></patternFill></fill>` +
    `</fills>` +
    `<borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders>` +
    `<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>` +
    `<cellXfs count="3">` +
    `<xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>` +
    `<xf numFmtId="0" fontId="1" fillId="2" borderId="0" xfId="0" applyFont="1" applyFill="1" applyAlignment="1"><alignment vertical="center"/></xf>` +
    `<xf numFmtId="0" fontId="2" fillId="0" borderId="0" xfId="0" applyFont="1"/>` +
    `</cellXfs>` +
    `<cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles>` +
    `</styleSheet>`;

  const workbook =
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>` +
    `<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" ` +
    `xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">` +
    `<sheets><sheet name="${xml(safeSheetName(sheetName))}" sheetId="1" r:id="rId1"/></sheets>` +
    `</workbook>`;

  const contentTypes =
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>` +
    `<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">` +
    `<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>` +
    `<Default Extension="xml" ContentType="application/xml"/>` +
    `<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>` +
    `<Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>` +
    `<Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>` +
    `</Types>`;

  const rootRels =
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>` +
    `<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">` +
    `<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>` +
    `</Relationships>`;

  const workbookRels =
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>` +
    `<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">` +
    `<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/>` +
    `<Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>` +
    `</Relationships>`;

  const utf8 = (s: string) => Buffer.from(s, "utf8");
  return zip([
    { name: "[Content_Types].xml", data: utf8(contentTypes) },
    { name: "_rels/.rels", data: utf8(rootRels) },
    { name: "xl/workbook.xml", data: utf8(workbook) },
    { name: "xl/_rels/workbook.xml.rels", data: utf8(workbookRels) },
    { name: "xl/styles.xml", data: utf8(styles) },
    { name: "xl/worksheets/sheet1.xml", data: utf8(sheet) },
  ]);
}

/** "Customers 2026-10-07.xlsx" — safe on every operating system. */
export function exportFilename(base: string) {
  const clean = base.replace(/[^A-Za-z0-9 _.-]+/g, "-").replace(/-+/g, "-").trim() || "export";
  return `${clean}-${new Date().toISOString().slice(0, 10)}.xlsx`;
}
