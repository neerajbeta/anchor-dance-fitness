import { NextRequest, NextResponse } from "next/server";
import { requirePermission } from "@/lib/auth/permissions";
import { recordAuditLog } from "@/lib/services";
import {
  classMeetingStartUrl,
  createClassMeeting,
  removeClassMeeting,
  setManualClassLink,
  updateClassMeeting,
  ZoomApiError,
  ZoomNotConfiguredError,
} from "@/lib/zoom";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Zoom for one online class:
 *  { action: "create" }                 → create the meeting in Zoom
 *  { action: "sync" }                   → push the class's current schedule to it
 *  { action: "remove" }                 → delete it in Zoom and clear the link
 *  { action: "manual", url, password }  → use a link pasted by an admin
 *  { action: "start" }                  → fresh host link to start the class
 */
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requirePermission("classes.edit");
  if (!auth.ok) return auth.response;
  try {
    const b = await req.json();
    const log = (action: string, values?: unknown) =>
      recordAuditLog({
        userId: auth.actor.id === "demo-admin" ? null : auth.actor.id,
        actorName: auth.actor.name,
        action: `zoom.${action}`,
        module: "classes",
        targetType: "class",
        targetId: params.id,
        newValues: values,
      });

    switch (b?.action) {
      case "create": {
        const m = await createClassMeeting(params.id);
        await log("meeting_created", { meetingId: m.meetingId });
        return NextResponse.json({ data: { message: "Zoom meeting created ✓", ...m } });
      }
      case "sync": {
        await updateClassMeeting(params.id);
        await log("meeting_synced");
        return NextResponse.json({ data: { message: "Zoom meeting updated to match the class ✓" } });
      }
      case "remove": {
        await removeClassMeeting(params.id);
        await log("meeting_removed");
        return NextResponse.json({ data: { message: "Zoom link removed from this class." } });
      }
      case "manual": {
        await setManualClassLink(params.id, String(b.url ?? ""), b.password ? String(b.password) : null);
        await log("link_pasted");
        return NextResponse.json({ data: { message: "Zoom link saved ✓" } });
      }
      case "start": {
        return NextResponse.json({ data: { url: await classMeetingStartUrl(params.id) } });
      }
      default:
        return NextResponse.json({ error: "Unknown action" }, { status: 400 });
    }
  } catch (err) {
    if (err instanceof ZoomNotConfiguredError || err instanceof ZoomApiError)
      return NextResponse.json({ error: err.message }, { status: 400 });
    console.error("[api/zoom/classes/:id]", err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
