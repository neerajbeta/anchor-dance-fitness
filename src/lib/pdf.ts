// A tiny one-page PDF writer — just enough for invoices: text in Helvetica /
// Helvetica-Bold, filled or stroked rectangles, lines and a PNG image.
// No dependencies (uses Node's zlib). Server only.
//
// Coordinates are in points on an A4 page (595 × 842), measured from the TOP
// left, like a web page; they're flipped to PDF's bottom-left origin here.

import { deflateSync, inflateSync } from "node:zlib";

export const A4 = { width: 595.28, height: 841.89 };

type Rgb = [number, number, number];
export type Color = string | Rgb; // "#EF5B2B" or [r, g, b] 0–1

// Helvetica / Helvetica-Bold advance widths (1/1000 em) for ASCII 32–126.
const W_REG = [
  278, 278, 355, 556, 556, 889, 667, 191, 333, 333, 389, 584, 278, 333, 278, 278, 556, 556, 556, 556, 556, 556, 556, 556,
  556, 556, 278, 278, 584, 584, 584, 556, 1015, 667, 667, 722, 722, 667, 611, 778, 722, 278, 500, 667, 556, 833, 722, 778,
  667, 778, 722, 667, 611, 722, 667, 944, 667, 667, 611, 278, 278, 278, 469, 556, 333, 556, 556, 500, 556, 556, 278, 556,
  556, 222, 222, 500, 222, 833, 556, 556, 556, 556, 333, 500, 278, 556, 500, 722, 500, 500, 500, 334, 260, 334, 584,
];
const W_BOLD = [
  278, 333, 474, 556, 556, 889, 722, 238, 333, 333, 389, 584, 278, 333, 278, 278, 556, 556, 556, 556, 556, 556, 556, 556,
  556, 556, 333, 333, 584, 584, 584, 611, 975, 722, 722, 722, 722, 667, 611, 778, 722, 278, 556, 722, 611, 833, 722, 778,
  667, 778, 722, 667, 611, 722, 667, 944, 667, 667, 611, 333, 278, 333, 584, 556, 333, 556, 611, 556, 611, 556, 333, 611,
  611, 278, 278, 556, 278, 889, 611, 611, 611, 611, 389, 556, 333, 611, 556, 778, 556, 556, 500, 389, 280, 389, 584,
];

// Characters outside Latin-1 that WinAnsiEncoding still has.
const WIN_ANSI_EXTRA: Record<string, number> = {
  "€": 0x80, "‚": 0x82, "„": 0x84, "…": 0x85, "†": 0x86, "‡": 0x87, "‰": 0x89, "‹": 0x8b,
  "‘": 0x91, "’": 0x92, "“": 0x93, "”": 0x94, "•": 0x95, "–": 0x96, "—": 0x97, "™": 0x99, "›": 0x9b,
};

/** Text → WinAnsi byte string. Emoji and anything unsupported are dropped / replaced. */
function winAnsi(text: string) {
  let out = "";
  for (const ch of text) {
    const cp = ch.codePointAt(0)!;
    if (WIN_ANSI_EXTRA[ch] !== undefined) out += String.fromCharCode(WIN_ANSI_EXTRA[ch]);
    else if (cp === 0x2212) out += "-";
    else if (cp >= 32 && cp < 127) out += ch;
    else if (cp >= 0xa0 && cp <= 0xff) out += ch;
    else if (cp === 0x202f || cp === 0x2009 || cp === 0x2007) out += " "; // thin / narrow spaces (sv-SE numbers)
    else if (cp > 0xffff || (cp >= 0x2600 && cp <= 0x27bf) || cp === 0xfe0f || cp === 0x200d) continue; // emoji
    else out += "?";
  }
  return out;
}

function escapePdfString(s: string) {
  return s.replace(/\\/g, "\\\\").replace(/\(/g, "\\(").replace(/\)/g, "\\)");
}

export function textWidth(text: string, size: number, bold = false) {
  const widths = bold ? W_BOLD : W_REG;
  let w = 0;
  for (const ch of winAnsi(text)) {
    const c = ch.charCodeAt(0);
    w += c >= 32 && c <= 126 ? widths[c - 32] : 556;
  }
  return (w / 1000) * size;
}

function rgb(color: Color): Rgb {
  if (Array.isArray(color)) return color;
  const hex = color.replace("#", "");
  const n = parseInt(hex.length === 3 ? hex.split("").map((c) => c + c).join("") : hex, 16);
  return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
}
const f = (n: number) => (Math.round(n * 100) / 100).toString();
const colorOp = (c: Color, op: "rg" | "RG") => `${rgb(c).map(f).join(" ")} ${op}`;

type PngImage = { width: number; height: number; rgb: Buffer; alpha: Buffer | null };

/** Decodes an 8-bit, non-interlaced PNG (RGB, RGBA, grey or grey+alpha). */
export function decodePng(buf: Buffer): PngImage {
  if (buf.readUInt32BE(0) !== 0x89504e47) throw new Error("Not a PNG");
  let pos = 8;
  let width = 0,
    height = 0,
    colorType = 0,
    depth = 0,
    interlace = 0;
  const idat: Buffer[] = [];
  while (pos < buf.length) {
    const len = buf.readUInt32BE(pos);
    const type = buf.toString("latin1", pos + 4, pos + 8);
    const data = buf.subarray(pos + 8, pos + 8 + len);
    if (type === "IHDR") {
      width = data.readUInt32BE(0);
      height = data.readUInt32BE(4);
      depth = data[8];
      colorType = data[9];
      interlace = data[12];
    } else if (type === "IDAT") idat.push(data);
    else if (type === "IEND") break;
    pos += 12 + len;
  }
  const channels = { 0: 1, 2: 3, 4: 2, 6: 4 }[colorType as 0 | 2 | 4 | 6];
  if (depth !== 8 || !channels || interlace) throw new Error("Unsupported PNG (need 8-bit, non-interlaced, no palette)");

  const raw = inflateSync(Buffer.concat(idat));
  const stride = width * channels;
  const pixels = Buffer.alloc(stride * height);
  for (let y = 0; y < height; y++) {
    const filter = raw[y * (stride + 1)];
    const line = raw.subarray(y * (stride + 1) + 1, (y + 1) * (stride + 1));
    const out = pixels.subarray(y * stride, (y + 1) * stride);
    const prev = y > 0 ? pixels.subarray((y - 1) * stride, y * stride) : null;
    for (let x = 0; x < stride; x++) {
      const a = x >= channels ? out[x - channels] : 0;
      const b = prev ? prev[x] : 0;
      const c = prev && x >= channels ? prev[x - channels] : 0;
      let v = line[x];
      if (filter === 1) v += a;
      else if (filter === 2) v += b;
      else if (filter === 3) v += (a + b) >> 1;
      else if (filter === 4) {
        const p = a + b - c;
        const pa = Math.abs(p - a),
          pb = Math.abs(p - b),
          pc = Math.abs(p - c);
        v += pa <= pb && pa <= pc ? a : pb <= pc ? b : c;
      }
      out[x] = v & 255;
    }
  }

  const colorCh = channels >= 3 ? 3 : 1;
  const hasAlpha = channels === 2 || channels === 4;
  const rgbBuf = Buffer.alloc(width * height * 3);
  const alpha = hasAlpha ? Buffer.alloc(width * height) : null;
  for (let i = 0; i < width * height; i++) {
    const px = i * channels;
    if (colorCh === 3) {
      rgbBuf[i * 3] = pixels[px];
      rgbBuf[i * 3 + 1] = pixels[px + 1];
      rgbBuf[i * 3 + 2] = pixels[px + 2];
    } else {
      rgbBuf[i * 3] = rgbBuf[i * 3 + 1] = rgbBuf[i * 3 + 2] = pixels[px];
    }
    if (alpha) alpha[i] = pixels[px + channels - 1];
  }
  return { width, height, rgb: rgbBuf, alpha };
}

export class PdfPage {
  private ops: string[] = [];
  private image: PngImage | null = null;

  private y(top: number) {
    return A4.height - top;
  }

  /** Text with its baseline at `top`. */
  text(
    x: number,
    top: number,
    text: string,
    opts: { size?: number; bold?: boolean; color?: Color; align?: "left" | "right" | "center" } = {}
  ) {
    const size = opts.size ?? 10;
    const w = textWidth(text, size, opts.bold);
    const left = opts.align === "right" ? x - w : opts.align === "center" ? x - w / 2 : x;
    this.ops.push(
      `BT /${opts.bold ? "F2" : "F1"} ${f(size)} Tf ${colorOp(opts.color ?? "#1F1A17", "rg")} ${f(left)} ${f(this.y(top))} Td (${escapePdfString(winAnsi(text))}) Tj ET`
    );
    return w;
  }

  /** Wraps text to `maxWidth`; returns the number of lines drawn. */
  paragraph(x: number, top: number, text: string, maxWidth: number, opts: { size?: number; bold?: boolean; color?: Color; lineHeight?: number } = {}) {
    const size = opts.size ?? 10;
    const lh = opts.lineHeight ?? size * 1.35;
    const lines: string[] = [];
    for (const para of text.split("\n")) {
      let line = "";
      for (const word of para.split(/\s+/).filter(Boolean)) {
        const next = line ? `${line} ${word}` : word;
        if (textWidth(next, size, opts.bold) > maxWidth && line) {
          lines.push(line);
          line = word;
        } else line = next;
      }
      lines.push(line);
    }
    lines.forEach((l, i) => this.text(x, top + i * lh, l, opts));
    return lines.length;
  }

  rect(x: number, top: number, w: number, h: number, opts: { fill?: Color; stroke?: Color; lineWidth?: number; radius?: number } = {}) {
    const parts: string[] = ["q"];
    if (opts.fill) parts.push(colorOp(opts.fill, "rg"));
    if (opts.stroke) parts.push(`${colorOp(opts.stroke, "RG")} ${f(opts.lineWidth ?? 1)} w`);
    const r = Math.min(opts.radius ?? 0, w / 2, h / 2);
    const x0 = x,
      y0 = this.y(top + h),
      x1 = x + w,
      y1 = this.y(top);
    if (r > 0) {
      const k = r * 0.5523;
      parts.push(
        `${f(x0 + r)} ${f(y0)} m ${f(x1 - r)} ${f(y0)} l ${f(x1 - r + k)} ${f(y0)} ${f(x1)} ${f(y0 + r - k)} ${f(x1)} ${f(y0 + r)} c`,
        `${f(x1)} ${f(y1 - r)} l ${f(x1)} ${f(y1 - r + k)} ${f(x1 - r + k)} ${f(y1)} ${f(x1 - r)} ${f(y1)} c`,
        `${f(x0 + r)} ${f(y1)} l ${f(x0 + r - k)} ${f(y1)} ${f(x0)} ${f(y1 - r + k)} ${f(x0)} ${f(y1 - r)} c`,
        `${f(x0)} ${f(y0 + r)} l ${f(x0)} ${f(y0 + r - k)} ${f(x0 + r - k)} ${f(y0)} ${f(x0 + r)} ${f(y0)} c h`
      );
    } else parts.push(`${f(x0)} ${f(y0)} ${f(w)} ${f(h)} re`);
    parts.push(opts.fill && opts.stroke ? "B" : opts.fill ? "f" : "S", "Q");
    this.ops.push(parts.join(" "));
  }

  line(x1: number, top1: number, x2: number, top2: number, color: Color = "#E5DDD3", width = 0.8) {
    this.ops.push(`q ${colorOp(color, "RG")} ${f(width)} w ${f(x1)} ${f(this.y(top1))} m ${f(x2)} ${f(this.y(top2))} l S Q`);
  }

  /** One PNG per page (enough for a logo). Height follows the image's aspect ratio when omitted. */
  png(png: Buffer, x: number, top: number, width: number, height?: number) {
    this.image = decodePng(png);
    const h = height ?? (width * this.image.height) / this.image.width;
    this.ops.push(`q ${f(width)} 0 0 ${f(h)} ${f(x)} ${f(this.y(top + h))} cm /Im1 Do Q`);
    return h;
  }

  /** The finished PDF file. */
  toBuffer(meta: { title?: string; author?: string } = {}) {
    const objects: Buffer[] = [];
    const add = (body: Buffer | string) => {
      objects.push(typeof body === "string" ? Buffer.from(body, "latin1") : body);
      return objects.length; // object number
    };
    const stream = (dict: string, data: Buffer) =>
      Buffer.concat([Buffer.from(`<< ${dict} /Length ${data.length} >>\nstream\n`, "latin1"), data, Buffer.from("\nendstream", "latin1")]);

    const catalog = add("<< /Type /Catalog /Pages 2 0 R >>");
    add("<< /Type /Pages /Kids [3 0 R] /Count 1 >>");
    add(""); // page — filled in below once the other objects have numbers
    const font1 = add("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>");
    const font2 = add("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>");
    let xobject = "";
    if (this.image) {
      const img = this.image;
      let smask = "";
      if (img.alpha) {
        const sm = add(
          stream(`/Type /XObject /Subtype /Image /Width ${img.width} /Height ${img.height} /ColorSpace /DeviceGray /BitsPerComponent 8 /Filter /FlateDecode`, deflateSync(img.alpha))
        );
        smask = ` /SMask ${sm} 0 R`;
      }
      const im = add(
        stream(
          `/Type /XObject /Subtype /Image /Width ${img.width} /Height ${img.height} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /FlateDecode${smask}`,
          deflateSync(img.rgb)
        )
      );
      xobject = ` /XObject << /Im1 ${im} 0 R >>`;
    }
    const content = add(stream("/Filter /FlateDecode", deflateSync(Buffer.from(this.ops.join("\n"), "latin1"))));
    objects[2] = Buffer.from(
      `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${f(A4.width)} ${f(A4.height)}] /Resources << /Font << /F1 ${font1} 0 R /F2 ${font2} 0 R >>${xobject} >> /Contents ${content} 0 R >>`,
      "latin1"
    );
    const pdfDate = `D:${new Date().toISOString().replace(/[-:T]/g, "").slice(0, 14)}Z`;
    const info = add(
      `<< /Title (${escapePdfString(winAnsi(meta.title ?? ""))}) /Author (${escapePdfString(winAnsi(meta.author ?? ""))}) /Producer (Anchor Dance & Fitness) /CreationDate (${pdfDate}) >>`
    );

    const chunks: Buffer[] = [Buffer.from("%PDF-1.4\n%\xE2\xE3\xCF\xD3\n", "latin1")];
    const offsets: number[] = [];
    let len = chunks[0].length;
    objects.forEach((body, i) => {
      offsets.push(len);
      const obj = Buffer.concat([Buffer.from(`${i + 1} 0 obj\n`, "latin1"), body, Buffer.from("\nendobj\n", "latin1")]);
      chunks.push(obj);
      len += obj.length;
    });
    const xref = [`xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`, ...offsets.map((o) => `${String(o).padStart(10, "0")} 00000 n \n`)].join("");
    chunks.push(Buffer.from(`${xref}trailer\n<< /Size ${objects.length + 1} /Root ${catalog} 0 R /Info ${info} 0 R >>\nstartxref\n${len}\n%%EOF\n`, "latin1"));
    return Buffer.concat(chunks);
  }
}
