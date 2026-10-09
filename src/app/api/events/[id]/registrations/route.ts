import { NextRequest, NextResponse } from "next/server";
import { requirePermission } from "@/lib/auth/permissions";
import { getEventRegistrations, DbNotConfiguredError } from "@/lib/services";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Admin only: everyone registered for this workshop/event.
export async function GET(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const params = await ctx.params;
  const auth = await requirePermission("events.view");
  if (!auth.ok) return auth.response;
  try {
    return NextResponse.json({ data: await getEventRegistrations(params.id) });
  } catch (err) {
    if (err instanceof DbNotConfiguredError) return NextResponse.json({ data: [] });
    console.error("[api/events/:id/registrations]", err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
