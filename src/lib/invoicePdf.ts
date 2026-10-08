// Draws an invoice as a one-page A4 PDF. Server only.

import { readFile } from "node:fs/promises";
import path from "node:path";
import type { InvoiceRow } from "@/lib/db/schema";
import { A4, PdfPage } from "@/lib/pdf";
import { formatVatRate } from "@/lib/vat";
import { DEFAULT_INVOICE_SELLER, type InvoiceSeller } from "@/lib/services";

const BRAND = "#EF5B2B";
const INK = "#1F1A17";
const MUTED = "#8A8079";
const LINE = "#E8E0D6";
const SOFT = "#FBF6F1";

const TYPE_LABEL: Record<string, string> = { class: "Class", workshop: "Workshop", event: "Event", studio: "Studio hire" };
const METHOD_LABEL: Record<string, string> = { stripe: "Card (Stripe)", swish: "Swish", external: "Paid at the studio" };

const sek = (n: number) => `SEK ${n.toLocaleString("sv-SE").replace(/\s/g, " ")}`;
const date = (d: Date | null) =>
  (d ?? new Date()).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric", timeZone: "Europe/Stockholm" });

let logo: Promise<Buffer | null> | null = null;
function loadLogo() {
  logo ??= readFile(path.join(process.cwd(), "public", "email", "logo.png")).catch(() => null);
  return logo;
}

export function invoiceFileName(inv: Pick<InvoiceRow, "number">) {
  return `${inv.number}.pdf`;
}

export async function renderInvoicePdf(inv: InvoiceRow): Promise<Buffer> {
  let seller: InvoiceSeller = DEFAULT_INVOICE_SELLER;
  try {
    seller = { ...DEFAULT_INVOICE_SELLER, ...(inv.seller ? JSON.parse(inv.seller) : {}) };
  } catch {
    /* keep defaults */
  }

  const p = new PdfPage();
  const L = 48;
  const R = A4.width - 48;

  // Top brand stripe
  p.rect(0, 0, A4.width, 6, { fill: BRAND });

  // Header: logo left, INVOICE right
  const png = await loadLogo();
  let headerBottom = 92;
  if (png) {
    try {
      const h = p.png(png, L, 34, 150);
      headerBottom = Math.max(headerBottom, 34 + h);
    } catch {
      p.text(L, 62, seller.businessName, { size: 18, bold: true, color: INK });
    }
  } else {
    p.text(L, 62, seller.businessName, { size: 18, bold: true, color: INK });
  }
  p.text(R, 56, "INVOICE", { size: 24, bold: true, color: INK, align: "right" });
  p.text(R, 74, inv.number, { size: 11, bold: true, color: BRAND, align: "right" });
  p.rect(R - 52, 82, 52, 18, { fill: "#E3F4EC", radius: 9 });
  p.text(R - 26, 94.5, "PAID", { size: 9, bold: true, color: "#1F7A52", align: "center" });

  // From / Bill to / dates
  let y = Math.max(headerBottom, 104) + 26;
  p.line(L, y - 12, R, y - 12, LINE);
  const col2 = L + 190;
  const col3 = L + 360;
  p.text(L, y, "FROM", { size: 8, bold: true, color: MUTED });
  p.text(col2, y, "BILL TO", { size: 8, bold: true, color: MUTED });
  p.text(col3, y, "INVOICE DETAILS", { size: 8, bold: true, color: MUTED });
  y += 15;
  const fromLines = [
    seller.businessName,
    ...seller.address.split("\n").map((s) => s.trim()).filter(Boolean),
    seller.orgNumber ? `Org. no. ${seller.orgNumber}` : "",
    seller.vatNumber ? `VAT no. ${seller.vatNumber}` : "",
    seller.email,
    seller.phone,
  ].filter(Boolean);
  fromLines.forEach((l, i) => p.text(L, y + i * 13, l, { size: i === 0 ? 10 : 9, bold: i === 0, color: i === 0 ? INK : "#4A433D" }));
  p.text(col2, y, inv.customerName, { size: 10, bold: true, color: INK });
  p.text(col2, y + 13, inv.customerEmail, { size: 9, color: "#4A433D" });
  const meta: [string, string][] = [
    ["Invoice date", date(inv.issuedAt)],
    ["Booking ID", inv.registrationId],
    ["Paid with", inv.paymentMethod ? METHOD_LABEL[inv.paymentMethod] ?? inv.paymentMethod : "—"],
  ];
  meta.forEach(([k, v], i) => {
    p.text(col3, y + i * 13, k, { size: 9, color: MUTED });
    p.text(R, y + i * 13, v, { size: 9, bold: true, color: INK, align: "right" });
  });
  y += Math.max(fromLines.length, 3) * 13 + 26;

  // Line items table
  p.rect(L, y, R - L, 24, { fill: SOFT, radius: 4 });
  p.text(L + 12, y + 15.5, "DESCRIPTION", { size: 8, bold: true, color: MUTED });
  p.text(R - 12, y + 15.5, "AMOUNT", { size: 8, bold: true, color: MUTED, align: "right" });
  y += 42;
  p.text(L + 12, y, `${TYPE_LABEL[inv.bookingType] ?? inv.bookingType}: ${inv.description}`, { size: 10.5, bold: true, color: INK });
  const listPrice = inv.baseAmount ?? inv.total;
  p.text(R - 12, y, sek(listPrice), { size: 10.5, bold: true, color: INK, align: "right" });
  let lines = 0;
  if (inv.details) lines = p.paragraph(L + 12, y + 15, inv.details, R - L - 150, { size: 9, color: MUTED });
  y += 15 + lines * 12 + 14;
  p.line(L, y, R, y, LINE);
  y += 24;

  // Totals
  const tx = L + 290;
  const row = (label: string, value: string, opts: { bold?: boolean; color?: string } = {}) => {
    p.text(tx, y, label, { size: 10, bold: opts.bold, color: opts.color ?? "#4A433D" });
    p.text(R - 12, y, value, { size: 10, bold: opts.bold, color: opts.color ?? INK, align: "right" });
    y += 18;
  };
  row("Price", sek(listPrice));
  if (inv.discountAmount > 0 || inv.discountCode) {
    row(`Discount${inv.discountCode ? ` (${inv.discountCode})` : ""}`, inv.discountAmount > 0 ? `- ${sek(inv.discountAmount)}` : "applied", { color: "#1F7A52" });
  }
  if (inv.vatMode) {
    row("Total excl. VAT", sek(inv.netAmount));
    row(`VAT ${formatVatRate(inv.vatRateBp)}${inv.vatMode === "inclusive" ? " (included)" : ""}`, sek(inv.vatAmount));
  } else {
    row("VAT", "Not applicable");
  }
  y += 4;
  p.rect(tx - 12, y - 6, R - tx + 12, 32, { fill: BRAND, radius: 6 });
  p.text(tx, y + 14, "TOTAL PAID", { size: 10, bold: true, color: "#FFFFFF" });
  p.text(R - 12, y + 14.5, sek(inv.total), { size: 13, bold: true, color: "#FFFFFF", align: "right" });
  y += 60;

  if (inv.paymentRef) {
    p.text(L, y, `Payment reference: ${inv.paymentRef}`, { size: 8, color: MUTED });
    y += 14;
  }

  // Footer
  const fy = A4.height - 70;
  p.line(L, fy - 16, R, fy - 16, LINE);
  if (seller.footerNote) p.text(A4.width / 2, fy, seller.footerNote, { size: 10, bold: true, color: BRAND, align: "center" });
  const contact = [seller.businessName, seller.orgNumber && `Org. no. ${seller.orgNumber}`, seller.vatNumber && `VAT no. ${seller.vatNumber}`, seller.website, seller.email]
    .filter(Boolean)
    .join("  ·  ");
  p.text(A4.width / 2, fy + 16, contact, { size: 8, color: MUTED, align: "center" });
  p.rect(0, A4.height - 6, A4.width, 6, { fill: BRAND });

  return p.toBuffer({ title: `Invoice ${inv.number}`, author: seller.businessName });
}
