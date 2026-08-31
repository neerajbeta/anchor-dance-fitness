import { NextResponse } from "next/server";
import { requirePermission } from "@/lib/auth/permissions";
import { getPaymentStats } from "@/lib/stats";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const auth = await requirePermission("payments.view");
  if (!auth.ok) return auth.response;
  return NextResponse.json({ data: await getPaymentStats() });
}
