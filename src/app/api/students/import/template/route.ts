import { NextResponse } from "next/server";
import { requirePermission } from "@/lib/auth/permissions";
import { sheetToXlsx } from "@/lib/xlsx";
import { TEMPLATE_COLUMNS } from "@/lib/studentImport";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** The blank workbook to fill in — same headings the importer expects. */
export async function GET() {
  const auth = await requirePermission("customers.edit");
  if (!auth.ok) return auth.response;

  const file = sheetToXlsx({
    sheetName: "Students",
    notes: [
      "Fill one student per row and keep this heading row. Name and Email are required; everything else is optional.",
      "Matching is by email — an email already on record is updated, a new one is added. A blank cell leaves the stored value unchanged.",
    ],
    columns: TEMPLATE_COLUMNS.map((c) => ({ key: c.key, label: c.label })),
    rows: [
      // One example row showing the formats, which the admin overwrites.
      {
        name: "Priya Sharma",
        email: "priya@example.com",
        phone: "+46 70 123 45 67",
        dob: "1998-03-15",
        gender: "Female",
        city: "Stockholm",
        country: "Sweden",
        location: "Stockholm",
        notes: "Example row — delete before importing",
      },
    ],
  });

  return new NextResponse(new Uint8Array(file), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": 'attachment; filename="Student-import-template.xlsx"',
      "Cache-Control": "no-store",
    },
  });
}
