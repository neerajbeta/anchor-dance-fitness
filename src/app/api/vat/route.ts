import { NextRequest, NextResponse } from "next/server";
import { requirePermission } from "@/lib/auth/permissions";
import { listVatRules, recordAuditLog, saveVatRules, DbNotConfiguredError } from "@/lib/services";
import { DEFAULT_VAT_RULES, VAT_BOOKING_TYPES, type VatRule } from "@/lib/vat";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET — public: the booking pages show the same VAT breakdown the server
 *       charges, so they need the rules (rates are shown to customers anyway).
 * PUT — admin: { rules: [{ bookingType, rateBp, mode, active }] }.
 */
export async function GET() {
  try {
    return NextResponse.json({ data: await listVatRules() });
  } catch (err) {
    if (err instanceof DbNotConfiguredError) return NextResponse.json({ data: DEFAULT_VAT_RULES });
    console.error("[api/vat]", err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
  const auth = await requirePermission("settings.edit");
  if (!auth.ok) return auth.response;
  try {
    const b = (await req.json()) as { rules?: Partial<VatRule>[] };
    const types = new Set<string>(VAT_BOOKING_TYPES.map((t) => t.type));
    const rules: VatRule[] = [];
    for (const r of b.rules ?? []) {
      if (!r.bookingType || !types.has(r.bookingType)) {
        return NextResponse.json({ error: "Unknown booking type." }, { status: 400 });
      }
      const rateBp = Number(r.rateBp);
      if (!Number.isInteger(rateBp) || rateBp < 0 || rateBp > 10000) {
        return NextResponse.json({ error: "VAT rate must be between 0% and 100% (up to 2 decimals)." }, { status: 400 });
      }
      if (r.mode !== "inclusive" && r.mode !== "exclusive") {
        return NextResponse.json({ error: "Choose Inclusive or Exclusive." }, { status: 400 });
      }
      rules.push({ bookingType: r.bookingType, rateBp, mode: r.mode, active: r.active !== false });
    }
    if (!rules.length) return NextResponse.json({ error: "Nothing to save." }, { status: 400 });

    const before = await listVatRules();
    const saved = await saveVatRules(rules, auth.actor.name);
    await recordAuditLog({
      userId: auth.actor.id === "demo-admin" ? null : auth.actor.id,
      actorName: auth.actor.name,
      action: "vat.updated",
      module: "settings",
      targetType: "vat_rates",
      oldValues: before.map(({ bookingType, rateBp, mode, active }) => ({ bookingType, rateBp, mode, active })),
      newValues: rules,
    });
    return NextResponse.json({ data: saved });
  } catch (err) {
    if (err instanceof DbNotConfiguredError) {
      return NextResponse.json({ error: "Database not configured" }, { status: 503 });
    }
    console.error("[api/vat]", err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
