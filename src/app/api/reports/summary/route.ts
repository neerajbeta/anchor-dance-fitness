import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth/api";
import { getFullReport } from "@/lib/stats";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Unified report across all admin features (registrations, classes, events,
// studio, payments, discounts) — one endpoint, filterable by month/location/type.
export async function GET(req: NextRequest) {
  const auth = await requireAdmin();
  if (!auth.ok) return auth.response;

  const month = req.nextUrl.searchParams.get("month") || undefined;
  const location = req.nextUrl.searchParams.get("location") || undefined;
  const typeParam = req.nextUrl.searchParams.get("type") || undefined;
  const type = (["class", "workshop", "event", "studio"].includes(typeParam ?? "")
    ? typeParam
    : undefined) as "class" | "workshop" | "event" | "studio" | undefined;

  const data = await getFullReport({ month, location, type });
  return NextResponse.json({ data });
}
