import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth/api";
import { listPlans, listCoaches, listBatches, DbNotConfiguredError } from "@/lib/services";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Convenience endpoint: plans + coaches + batches in one call for admin forms.
export async function GET() {
  const auth = await requireAdmin();
  if (!auth.ok) return auth.response;
  try {
    const [plans, coaches, batches] = await Promise.all([
      listPlans(),
      listCoaches(),
      listBatches(),
    ]);
    return NextResponse.json({ data: { plans, coaches, batches } });
  } catch (err) {
    if (err instanceof DbNotConfiguredError)
      return NextResponse.json({ error: "Database not configured" }, { status: 503 });
    console.error("[api/catalog]", err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
