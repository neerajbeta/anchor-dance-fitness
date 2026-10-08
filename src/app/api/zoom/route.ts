import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { requirePermission } from "@/lib/auth/permissions";
import { db } from "@/lib/db/client";
import { classes } from "@/lib/db/schema";
import { recordAuditLog } from "@/lib/services";
import { disconnectZoom, getZoomStatus, saveZoomSettings, testZoomConnection, ZoomApiError, ZoomNotConfiguredError } from "@/lib/zoom";
import { SecretsKeyMissingError } from "@/lib/secrets";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Zoom connection status + the Zoom state of every online class (admin only). */
export async function GET() {
  try {
    // Inside the try: a database hiccup in the permission check must come back
    // as JSON the card can show, not an HTML error page.
    const auth = await requirePermission("classes.view");
    if (!auth.ok) return auth.response;
    const [status, rows] = await Promise.all([
      getZoomStatus(),
      db
        ? db
            .select({
              id: classes.id,
              name: classes.name,
              mode: classes.mode,
              zoomMeetingId: classes.zoomMeetingId,
              zoomJoinUrl: classes.zoomJoinUrl,
              zoomPassword: classes.zoomPassword,
              zoomSyncedAt: classes.zoomSyncedAt,
              zoomError: classes.zoomError,
            })
            .from(classes)
            .where(eq(classes.mode, "online"))
        : Promise.resolve([]),
    ]);
    // Never returns the client secret — only whether one is stored.
    return NextResponse.json({ data: { configured: status.configured, settings: status.settings, classes: rows } });
  } catch (err) {
    return handle(err);
  }
}

/** Save the connection / defaults. A blank clientSecret keeps the stored one. */
export async function PUT(req: NextRequest) {
  const auth = await requirePermission("settings.edit");
  if (!auth.ok) return auth.response;
  try {
    const b = await req.json();
    const saved = await saveZoomSettings({
      accountId: b.accountId,
      clientId: b.clientId,
      clientSecret: b.clientSecret,
      hostUser: b.hostUser,
      autoCreate: b.autoCreate,
      waitingRoom: b.waitingRoom,
      muteOnEntry: b.muteOnEntry,
    });
    await recordAuditLog({
      userId: auth.actor.id === "demo-admin" ? null : auth.actor.id,
      actorName: auth.actor.name,
      action: "zoom.settings_updated",
      module: "settings",
      // never the secret
      newValues: { accountId: saved.accountId, clientId: saved.clientId, hostUser: saved.hostUser, autoCreate: saved.autoCreate, secretChanged: Boolean(b.clientSecret) },
    });
    return NextResponse.json({ data: { ok: true } });
  } catch (err) {
    return handle(err);
  }
}

/** { action: "test" } checks the credentials · { action: "disconnect" } removes the stored secret. */
export async function POST(req: NextRequest) {
  const auth = await requirePermission("settings.edit");
  if (!auth.ok) return auth.response;
  try {
    const b = await req.json();
    if (b?.action === "test") {
      const u = await testZoomConnection();
      return NextResponse.json({
        data: {
          message: `Connected ✓ — meetings will be created under ${u.email || "the app owner"}${u.name ? ` (${u.name})` : ""}.${u.licensed ? "" : " Note: this Zoom user isn't on a paid plan, so meetings with 3+ people end after 40 minutes."}`,
        },
      });
    }
    if (b?.action === "disconnect") {
      await disconnectZoom();
      await recordAuditLog({
        userId: auth.actor.id === "demo-admin" ? null : auth.actor.id,
        actorName: auth.actor.name,
        action: "zoom.disconnected",
        module: "settings",
      });
      return NextResponse.json({ data: { message: "Zoom disconnected. Existing class links keep working in Zoom." } });
    }
    return NextResponse.json({ error: "Unknown action" }, { status: 400 });
  } catch (err) {
    return handle(err);
  }
}

function handle(err: unknown) {
  if (err instanceof ZoomNotConfiguredError || err instanceof ZoomApiError || err instanceof SecretsKeyMissingError)
    return NextResponse.json({ error: err.message }, { status: 400 });
  console.error("[api/zoom]", err);
  // A database that timed out or refused the connection — say so, because
  // "Internal error" sends people looking at their Zoom credentials instead.
  const msg = err instanceof Error ? err.message : "";
  if (/timeout|ECONNRESET|ECONNREFUSED|terminat|connection/i.test(msg)) {
    return NextResponse.json(
      { error: "The database didn't answer in time. Please try again in a moment." },
      { status: 503 }
    );
  }
  return NextResponse.json({ error: "Internal error" }, { status: 500 });
}
