import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth/api";
import { getPaymentStats } from "@/lib/stats";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const auth = await requireAdmin();
  if (!auth.ok) return auth.response;
  return NextResponse.json({ data: await getPaymentStats() });
}
