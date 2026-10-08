import { NextRequest, NextResponse } from "next/server";
import { requirePermission } from "@/lib/auth/permissions";
import { ConflictError, DbNotConfiguredError, listHolidays, recordAuditLog, saveHolidays } from "@/lib/services";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Public: studio holidays / closures (shown on calendars). */
export async function GET() {
  try {
    return NextResponse.json({ data: await listHolidays() });
  } catch (err) {
    if (err instanceof DbNotConfiguredError) return NextResponse.json({ data: [] });
    console.error("[api/holidays]", err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}

/** Admin: replace the list. Body: { holidays: StudioHoliday[] } */
export async function PUT(req: NextRequest) {
  const auth = await requirePermission("settings.edit");
  if (!auth.ok) return auth.response;
  try {
    const b = await req.json();
    const before = await listHolidays();
    const saved = await saveHolidays(b?.holidays);
    await recordAuditLog({
      userId: auth.actor.id === "demo-admin" ? null : auth.actor.id,
      actorName: auth.actor.name,
      action: "holidays.updated",
      module: "settings",
      targetType: "app_settings",
      oldValues: before,
      newValues: saved,
    });
    return NextResponse.json({ data: saved });
  } catch (err) {
    if (err instanceof ConflictError) return NextResponse.json({ error: err.message }, { status: 400 });
    if (err instanceof DbNotConfiguredError)
      return NextResponse.json({ error: "Database not configured" }, { status: 503 });
    console.error("[api/holidays]", err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
