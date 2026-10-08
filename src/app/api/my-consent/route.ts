import { NextRequest, NextResponse } from "next/server";
import { getUserSession } from "@/lib/auth/userActions";
import { CONSENT_VERSION, hasRequiredConsent, readConsentChoices } from "@/lib/consent";
import { DbNotConfiguredError, getConsentStatus, recordConsent } from "@/lib/services";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** The signed-in student's GDPR permissions. */
export async function GET() {
  const session = await getUserSession();
  if (!session) return NextResponse.json({ data: null });
  try {
    const status = await getConsentStatus(session.email, CONSENT_VERSION);
    return NextResponse.json({ data: status ? { ...status, currentVersion: CONSENT_VERSION } : null });
  } catch (err) {
    if (!(err instanceof DbNotConfiguredError)) console.error("[api/my-consent]", err);
    return NextResponse.json({ data: null });
  }
}

/**
 * Saves the permissions as they are now ticked in My Portal:
 *   { choices: { data: true, photo: true, video: false, promo: false } }
 * Anything left out is withdrawn. The required ones can't be dropped here —
 * deleting an account is a separate request to info@anchorsports.se.
 */
export async function POST(req: NextRequest) {
  const session = await getUserSession();
  if (!session) return NextResponse.json({ error: "Please sign in." }, { status: 401 });
  try {
    const b = await req.json();
    const choices = readConsentChoices(b?.choices ?? b?.consent);
    if (!hasRequiredConsent(choices)) {
      return NextResponse.json(
        { error: "Consent for your contact and booking details is needed to keep your account." },
        { status: 400 }
      );
    }
    await recordConsent(session.email, CONSENT_VERSION, choices);
    const status = await getConsentStatus(session.email, CONSENT_VERSION);
    return NextResponse.json({ data: { ...status, currentVersion: CONSENT_VERSION } });
  } catch (err) {
    if (err instanceof DbNotConfiguredError)
      return NextResponse.json({ error: "Database not configured" }, { status: 503 });
    console.error("[api/my-consent]", err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
