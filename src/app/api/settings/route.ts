import { NextRequest, NextResponse } from "next/server";
import { requirePermission } from "@/lib/auth/permissions";
import { getPortalSettings, updatePortalSettings, DbNotConfiguredError } from "@/lib/services";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Public read: every value here is shown to students anyway (studio hourly rate,
// studio purposes, Book-a-Demo class types).
export async function GET() {
  try {
    return NextResponse.json({ data: await getPortalSettings() });
  } catch (err) {
    return handle(err);
  }
}

// Admin only: update any subset of the settings.
export async function PUT(req: NextRequest) {
  const auth = await requirePermission("settings.edit");
  if (!auth.ok) return auth.response;
  try {
    const b = (await req.json()) ?? {};
    const patch: Parameters<typeof updatePortalSettings>[0] = {};

    if (b.studioHourlyRate !== undefined) {
      const rate = Number(b.studioHourlyRate);
      if (b.studioHourlyRate === "" || !Number.isFinite(rate) || rate < 0) {
        return NextResponse.json({ error: "Studio hourly rate must be a number of 0 or more" }, { status: 400 });
      }
      patch.studioHourlyRate = Math.round(rate);
    }

    const list = (v: unknown) =>
      Array.isArray(v) ? Array.from(new Set(v.map((x) => String(x).trim()).filter(Boolean))) : null;

    if (b.studioPurposes !== undefined) {
      const purposes = list(b.studioPurposes);
      if (!purposes || purposes.length === 0) {
        return NextResponse.json({ error: "Add at least one studio purpose" }, { status: 400 });
      }
      patch.studioPurposes = purposes;
    }
    if (b.demoClassTypes !== undefined) {
      const types = list(b.demoClassTypes);
      if (!types || types.length === 0) {
        return NextResponse.json({ error: "Add at least one Book-a-Demo class type" }, { status: 400 });
      }
      patch.demoClassTypes = types;
    }

    return NextResponse.json({ data: await updatePortalSettings(patch) });
  } catch (err) {
    return handle(err);
  }
}

function handle(err: unknown) {
  if (err instanceof DbNotConfiguredError)
    return NextResponse.json({ error: "Database not configured" }, { status: 503 });
  console.error("[api/settings]", err);
  return NextResponse.json({ error: "Internal error" }, { status: 500 });
}
