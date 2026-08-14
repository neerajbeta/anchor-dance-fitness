import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth/api";
import { updateEnquiryStatus, DbNotConfiguredError } from "@/lib/services";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requireAdmin();
  if (!auth.ok) return auth.response;
  try {
    const b = await req.json();
    if (!["new", "contacted", "closed"].includes(b?.status)) {
      return NextResponse.json({ error: "status must be new, contacted or closed" }, { status: 400 });
    }
    const row = await updateEnquiryStatus(params.id, b.status);
    if (!row) return NextResponse.json({ error: "Not found" }, { status: 404 });
    return NextResponse.json({ data: row });
  } catch (err) {
    if (err instanceof DbNotConfiguredError)
      return NextResponse.json({ error: "Database not configured" }, { status: 503 });
    console.error("[api/enquiries/:id]", err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
