import { NextRequest, NextResponse } from "next/server";
import { requireAnyPermission } from "@/lib/auth/permissions";
import { searchStudents, DbNotConfiguredError } from "@/lib/services";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Shared by Book on Behalf (look up a student to book for) and the Studio page's own
// "Book Studio on Behalf" button — either permission is enough to search.
export async function GET(req: NextRequest) {
  const auth = await requireAnyPermission(["book_on_behalf.view", "studio.edit"]);
  if (!auth.ok) return auth.response;
  try {
    const q = req.nextUrl.searchParams.get("q") ?? "";
    return NextResponse.json({ data: await searchStudents(q) });
  } catch (err) {
    if (err instanceof DbNotConfiguredError)
      return NextResponse.json({ error: "Database not configured" }, { status: 503 });
    console.error("[api/students]", err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
