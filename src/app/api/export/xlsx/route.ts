import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth/api";
import { exportFilename, sheetToXlsx, type ExportColumn, type ExportRow } from "@/lib/xlsx";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Keeps one export from tying up the server. Admin lists are far smaller. */
const MAX_ROWS = 50_000;
const MAX_COLUMNS = 200;

/**
 * Turns the rows an admin list already has on screen into an .xlsx download —
 * one endpoint for every list, so "Export Excel" exports exactly what the admin
 * is looking at, filters and all.
 *
 * Nothing is read from the database here: the caller is an admin who can
 * already see these rows, and the body is only reformatted.
 */
export async function POST(req: NextRequest) {
  const auth = await requireAdmin();
  if (!auth.ok) return auth.response;
  try {
    const body = (await req.json()) as {
      columns?: ExportColumn[];
      rows?: ExportRow[];
      filename?: string;
      sheetName?: string;
      notes?: string[];
    };

    const columns = (body.columns ?? []).filter((c) => c && typeof c.key === "string").slice(0, MAX_COLUMNS);
    const rows = Array.isArray(body.rows) ? body.rows : [];
    if (columns.length === 0) {
      return NextResponse.json({ error: "Nothing to export — no columns were given." }, { status: 400 });
    }
    if (rows.length > MAX_ROWS) {
      return NextResponse.json(
        { error: `That's ${rows.length.toLocaleString()} rows — narrow the filters and export under ${MAX_ROWS.toLocaleString()}.` },
        { status: 413 }
      );
    }

    const file = sheetToXlsx({
      columns: columns.map((c) => ({ key: c.key, label: String(c.label ?? c.key) })),
      rows,
      sheetName: body.sheetName || "Export",
      notes: (body.notes ?? []).slice(0, 10).map(String),
    });
    const name = exportFilename(body.filename || body.sheetName || "export");

    return new NextResponse(new Uint8Array(file), {
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="${name}"`,
        "Content-Length": String(file.length),
        "Cache-Control": "no-store",
      },
    });
  } catch (err) {
    console.error("[api/export/xlsx]", err);
    return NextResponse.json({ error: "Couldn't build the Excel file." }, { status: 500 });
  }
}
