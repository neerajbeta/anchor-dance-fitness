import { NextRequest, NextResponse } from "next/server";
import { requirePermission } from "@/lib/auth/permissions";
import { readXlsx, ImportError } from "@/lib/xlsxRead";
import { parseStudentSheet, type RowOutcome } from "@/lib/studentImport";
import {
  DbNotConfiguredError,
  importStudents,
  planStudentImport,
  recordAuditLog,
} from "@/lib/services";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_BYTES = 5 * 1024 * 1024; // 5 MB — thousands of students
const MAX_ROWS = 5_000;

/**
 * Bulk-import students from an .xlsx file.
 *
 * Two steps on purpose: the upload is always a dry run first, so the admin sees
 * exactly what would be created, updated and rejected before anything is
 * written. `confirm=1` then performs it.
 *
 * Students are matched on email. Blank cells never erase what's on record, and
 * imported students are left without GDPR consent — they're asked the first
 * time they book (consent is the person's to give, not a spreadsheet's).
 */
export async function POST(req: NextRequest) {
  const auth = await requirePermission("customers.edit");
  if (!auth.ok) return auth.response;

  try {
    const form = await req.formData();
    const file = form.get("file");
    const confirm = String(form.get("confirm") ?? "") === "1";

    if (!(file instanceof File)) {
      return NextResponse.json({ error: "Choose an .xlsx file to import." }, { status: 400 });
    }
    if (file.size === 0) {
      return NextResponse.json({ error: "That file is empty." }, { status: 400 });
    }
    if (file.size > MAX_BYTES) {
      return NextResponse.json(
        { error: `That file is ${(file.size / 1024 / 1024).toFixed(1)} MB — the limit is 5 MB.` },
        { status: 413 }
      );
    }
    if (!/\.xlsx$/i.test(file.name)) {
      return NextResponse.json(
        { error: "Only .xlsx files can be imported. In Excel: File → Save As → Excel Workbook (.xlsx)." },
        { status: 400 }
      );
    }

    const grid = readXlsx(Buffer.from(await file.arrayBuffer()), MAX_ROWS + 50);
    const { rows, headingLine } = parseStudentSheet(grid);

    const valid = rows.filter((r): r is RowOutcome & { data: NonNullable<RowOutcome["data"]> } => r.data !== null);
    const invalid = rows.filter((r) => r.error !== null);

    if (valid.length === 0) {
      return NextResponse.json(
        {
          error: invalid.length
            ? "No row in that file could be imported — see the problems below."
            : "That sheet has a heading row but no students under it.",
          data: { headingLine, total: rows.length, rows: [], problems: invalid },
        },
        { status: 400 }
      );
    }
    if (valid.length > MAX_ROWS) {
      return NextResponse.json(
        { error: `That file has ${valid.length.toLocaleString()} students — import at most ${MAX_ROWS.toLocaleString()} at a time.` },
        { status: 413 }
      );
    }

    const payload = valid.map((r) => ({ ...r.data, line: r.line }));
    const plan = await planStudentImport(payload);

    // Dry run — show what would happen and stop.
    if (!confirm) {
      return NextResponse.json({
        data: {
          preview: true,
          file: file.name,
          headingLine,
          counts: {
            create: plan.filter((p) => p.action === "create").length,
            update: plan.filter((p) => p.action === "update").length,
            unchanged: plan.filter((p) => p.action === "update" && p.changes.length === 0).length,
            problems: invalid.length,
          },
          rows: plan,
          problems: invalid,
        },
      });
    }

    const result = await importStudents(payload);
    await recordAuditLog({
      userId: auth.actor.id === "demo-admin" ? null : auth.actor.id,
      actorName: auth.actor.name,
      action: "students.imported",
      module: "customers",
      newValues: { file: file.name, ...result },
    });

    return NextResponse.json({
      data: {
        preview: false,
        file: file.name,
        ...result,
        problems: invalid,
      },
    });
  } catch (err) {
    if (err instanceof ImportError) return NextResponse.json({ error: err.message }, { status: 400 });
    if (err instanceof DbNotConfiguredError)
      return NextResponse.json({ error: "Database not configured" }, { status: 503 });
    // parseStudentSheet throws a plain Error with wording meant for the admin.
    if (err instanceof Error && /heading row/i.test(err.message)) {
      return NextResponse.json({ error: err.message }, { status: 400 });
    }
    console.error("[api/students/import]", err);
    return NextResponse.json({ error: "Couldn't read that file. Is it a real .xlsx workbook?" }, { status: 500 });
  }
}
