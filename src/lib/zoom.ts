// Zoom integration for ONLINE classes (Server-to-Server OAuth app). Server only.
//
// Each online class gets one Zoom meeting: recurring on the class's weekdays
// between its start and end date (or a single meeting for a one-off class).
// The meeting is created, updated and deleted along with the class.
//
// Credentials come from Admin → Portal Settings → Zoom (stored encrypted), or
// from ZOOM_ACCOUNT_ID / ZOOM_CLIENT_ID / ZOOM_CLIENT_SECRET in the environment.

import { eq, inArray } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { appSettings, classes } from "@/lib/db/schema";
import { decryptSecret, encryptSecret } from "@/lib/secrets";

const TOKEN_URL = "https://zoom.us/oauth/token";
const API = "https://api.zoom.us/v2";
const SETTINGS_KEY = "zoom.settings";
const SECRET_KEY = "zoom.client_secret";

export type ZoomSettings = {
  accountId: string;
  clientId: string;
  /** Zoom user the meetings are created under: an email, or "me" (the app owner). */
  hostUser: string;
  /** Create a meeting automatically when an online class is added. */
  autoCreate: boolean;
  waitingRoom: boolean;
  muteOnEntry: boolean;
};

const DEFAULTS: ZoomSettings = { accountId: "", clientId: "", hostUser: "me", autoCreate: true, waitingRoom: true, muteOnEntry: true };

export class ZoomNotConfiguredError extends Error {
  constructor() {
    super("Zoom isn't connected yet — add the credentials in Portal Settings → Zoom.");
  }
}
export class ZoomApiError extends Error {}

function requireDb() {
  if (!db) throw new Error("DATABASE_NOT_CONFIGURED");
  return db;
}

async function readSetting(key: string) {
  const [row] = await requireDb().select().from(appSettings).where(eq(appSettings.key, key));
  return row?.value ?? null;
}

/** Settings + whether Zoom is usable, in one database round-trip (for the admin card). */
export async function getZoomStatus() {
  const rows = await requireDb()
    .select()
    .from(appSettings)
    .where(inArray(appSettings.key, [SETTINGS_KEY, SECRET_KEY]));
  const byKey = new Map(rows.map((r) => [r.key, r.value]));
  let s: ZoomSettings = DEFAULTS;
  try {
    const raw = byKey.get(SETTINGS_KEY);
    if (raw) s = { ...DEFAULTS, ...(JSON.parse(raw) as Partial<ZoomSettings>) };
  } catch {
    /* defaults */
  }
  const envReady = Boolean(process.env.ZOOM_ACCOUNT_ID && process.env.ZOOM_CLIENT_ID && process.env.ZOOM_CLIENT_SECRET);
  const hasSecret = Boolean(byKey.get(SECRET_KEY));
  const accountId = s.accountId || (envReady ? process.env.ZOOM_ACCOUNT_ID! : "");
  const clientId = s.clientId || (envReady ? process.env.ZOOM_CLIENT_ID! : "");
  const fromSettings = Boolean(s.accountId && s.clientId && hasSecret);
  return {
    settings: { ...s, accountId, clientId, hasSecret: hasSecret || envReady, source: fromSettings ? "settings" : envReady ? "env" : "none" },
    configured: Boolean(accountId && clientId && (hasSecret || envReady)),
  };
}
async function writeSetting(key: string, value: string) {
  await requireDb()
    .insert(appSettings)
    .values({ key, value })
    .onConflictDoUpdate({ target: appSettings.key, set: { value, updatedAt: new Date() } });
}

export async function getZoomSettings(): Promise<ZoomSettings & { hasSecret: boolean; source: "settings" | "env" | "none" }> {
  const raw = await readSetting(SETTINGS_KEY);
  let s: ZoomSettings = DEFAULTS;
  try {
    if (raw) s = { ...DEFAULTS, ...(JSON.parse(raw) as Partial<ZoomSettings>) };
  } catch {
    /* defaults */
  }
  const envReady = Boolean(process.env.ZOOM_ACCOUNT_ID && process.env.ZOOM_CLIENT_ID && process.env.ZOOM_CLIENT_SECRET);
  const hasSecret = Boolean(await readSetting(SECRET_KEY));
  const fromSettings = Boolean(s.accountId && s.clientId && hasSecret);
  return {
    ...s,
    accountId: s.accountId || (envReady ? process.env.ZOOM_ACCOUNT_ID! : ""),
    clientId: s.clientId || (envReady ? process.env.ZOOM_CLIENT_ID! : ""),
    hasSecret: hasSecret || envReady,
    source: fromSettings ? "settings" : envReady ? "env" : "none",
  };
}

/** Saves settings; a blank clientSecret keeps the stored one. */
export async function saveZoomSettings(input: Partial<ZoomSettings> & { clientSecret?: string }) {
  const cur = await getZoomSettings();
  const next: ZoomSettings = {
    accountId: input.accountId !== undefined ? String(input.accountId).trim() : cur.accountId,
    clientId: input.clientId !== undefined ? String(input.clientId).trim() : cur.clientId,
    hostUser: input.hostUser !== undefined ? String(input.hostUser).trim() || "me" : cur.hostUser,
    autoCreate: input.autoCreate !== undefined ? Boolean(input.autoCreate) : cur.autoCreate,
    waitingRoom: input.waitingRoom !== undefined ? Boolean(input.waitingRoom) : cur.waitingRoom,
    muteOnEntry: input.muteOnEntry !== undefined ? Boolean(input.muteOnEntry) : cur.muteOnEntry,
  };
  await writeSetting(SETTINGS_KEY, JSON.stringify(next));
  if (input.clientSecret && input.clientSecret.trim()) await writeSetting(SECRET_KEY, encryptSecret(input.clientSecret.trim()));
  token = null; // credentials may have changed
  return getZoomSettings();
}

export async function disconnectZoom() {
  await requireDb().delete(appSettings).where(eq(appSettings.key, SECRET_KEY));
  const s = await getZoomSettings();
  await writeSetting(SETTINGS_KEY, JSON.stringify({ ...DEFAULTS, hostUser: s.hostUser, autoCreate: s.autoCreate, waitingRoom: s.waitingRoom, muteOnEntry: s.muteOnEntry }));
  token = null;
}

async function credentials() {
  const s = await getZoomSettings();
  const stored = await readSetting(SECRET_KEY);
  const secret = stored ? decryptSecret(stored) : process.env.ZOOM_CLIENT_SECRET ?? "";
  if (!s.accountId || !s.clientId || !secret) throw new ZoomNotConfiguredError();
  return { ...s, secret };
}

export async function isZoomConfigured() {
  try {
    await credentials();
    return true;
  } catch {
    return false;
  }
}

let token: { value: string; expires: number; key: string } | null = null;

async function accessToken() {
  const c = await credentials();
  const key = `${c.accountId}:${c.clientId}`;
  if (token && token.key === key && token.expires > Date.now() + 60_000) return token.value;
  const res = await fetch(`${TOKEN_URL}?grant_type=account_credentials&account_id=${encodeURIComponent(c.accountId)}`, {
    method: "POST",
    headers: { Authorization: `Basic ${Buffer.from(`${c.clientId}:${c.secret}`).toString("base64")}` },
    signal: AbortSignal.timeout(15_000),
  });
  const j = (await res.json().catch(() => ({}))) as { access_token?: string; expires_in?: number; reason?: string; error?: string };
  if (!res.ok || !j.access_token) throw new ZoomApiError(`Zoom sign-in failed: ${j.reason || j.error || res.status}`);
  token = { value: j.access_token, expires: Date.now() + (j.expires_in ?? 3600) * 1000, key };
  return token.value;
}

async function zoom<T>(method: string, path: string, body?: unknown): Promise<T> {
  const res = await fetch(`${API}${path}`, {
    method,
    headers: { Authorization: `Bearer ${await accessToken()}`, "Content-Type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
    signal: AbortSignal.timeout(20_000),
  });
  if (res.status === 204) return undefined as T;
  const j = (await res.json().catch(() => ({}))) as T & { message?: string; code?: number };
  if (!res.ok) throw new ZoomApiError(j.message ? `Zoom: ${j.message}` : `Zoom responded ${res.status}`);
  return j;
}

/** Checks the credentials by reading the host user. */
export async function testZoomConnection() {
  const c = await credentials();
  const u = await zoom<{ email?: string; first_name?: string; last_name?: string; type?: number }>("GET", `/users/${encodeURIComponent(c.hostUser || "me")}`);
  return { email: u.email ?? "", name: [u.first_name, u.last_name].filter(Boolean).join(" "), licensed: u.type === 2 };
}

// ── Meetings for classes ──

type ClassRow = typeof classes.$inferSelect;

const ZOOM_DAY: Record<string, number> = { Sun: 1, Mon: 2, Tue: 3, Wed: 4, Thu: 5, Fri: 6, Sat: 7 };
const JS_DAY = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

/** Studios in India run on India time; everything else on Stockholm time. */
function timeZoneFor(location: string) {
  return /mumbai|india|indore|bhopal|delhi|pune|bangalore|bengaluru/i.test(location) ? "Asia/Kolkata" : "Europe/Stockholm";
}

const minutes = (t: string) => Number(t.slice(0, 2)) * 60 + Number(t.slice(3, 5));

function meetingBody(c: ClassRow, s: ZoomSettings) {
  const days = (c.days ?? "")
    .split(",")
    .map((d) => d.trim())
    .filter((d) => d in ZOOM_DAY);
  const duration = Math.max(15, minutes(c.endTime) - minutes(c.startTime));
  const tz = timeZoneFor(c.location);
  const time = `${c.startTime.slice(0, 5)}:00`;
  const base = {
    topic: `${c.name} — Anchor Dance & Fitness`.slice(0, 200),
    agenda: [`${c.category} · ${c.level}`, c.coach ? `Coach: ${c.coach}` : ""].filter(Boolean).join("\n").slice(0, 2000),
    duration,
    timezone: tz,
    settings: {
      join_before_host: false,
      waiting_room: s.waitingRoom,
      mute_upon_entry: s.muteOnEntry,
      host_video: true,
      participant_video: false,
      approval_type: 2,
      auto_recording: "none",
    },
  };

  if (!days.length) {
    // One-off class: a single scheduled meeting (or no fixed time when there's no date).
    return c.startDate ? { ...base, type: 2, start_time: `${c.startDate}T${time}` } : { ...base, type: 3 };
  }
  if (!c.startDate) return { ...base, type: 3 };
  // First session: the first class weekday on or after the start date.
  let first = c.startDate;
  for (let i = 0; i < 7; i++) {
    const d = new Date(`${c.startDate}T00:00:00Z`);
    d.setUTCDate(d.getUTCDate() + i);
    if (days.includes(JS_DAY[d.getUTCDay()])) {
      first = d.toISOString().slice(0, 10);
      break;
    }
  }
  return {
    ...base,
    type: 8,
    start_time: `${first}T${time}`,
    recurrence: {
      type: 2,
      repeat_interval: 1,
      weekly_days: days.map((d) => ZOOM_DAY[d]).sort().join(","),
      ...(c.endDate ? { end_date_time: `${c.endDate}T23:59:00Z` } : { end_times: 50 }),
    },
  };
}

async function getClass(id: string) {
  const [c] = await requireDb().select().from(classes).where(eq(classes.id, id));
  return c ?? null;
}

async function saveZoom(id: string, patch: Partial<ClassRow>) {
  await requireDb().update(classes).set(patch).where(eq(classes.id, id));
}

/** Creates (or re-creates) the class's Zoom meeting. */
export async function createClassMeeting(classId: string) {
  const c = await getClass(classId);
  if (!c) throw new ZoomApiError("Class not found.");
  if (c.mode !== "online") throw new ZoomApiError("Zoom is only for online classes.");
  const s = await credentials();
  try {
    const m = await zoom<{ id: number; join_url: string; password?: string }>("POST", `/users/${encodeURIComponent(s.hostUser || "me")}/meetings`, meetingBody(c, s));
    await saveZoom(classId, { zoomMeetingId: String(m.id), zoomJoinUrl: m.join_url, zoomPassword: m.password ?? null, zoomSyncedAt: new Date(), zoomError: null });
    return { meetingId: String(m.id), joinUrl: m.join_url };
  } catch (err) {
    await saveZoom(classId, { zoomError: err instanceof Error ? err.message : String(err) });
    throw err;
  }
}

/** Pushes the class's current name / days / time / dates to its meeting. */
export async function updateClassMeeting(classId: string) {
  const c = await getClass(classId);
  if (!c?.zoomMeetingId) return null;
  const s = await credentials();
  try {
    await zoom("PATCH", `/meetings/${c.zoomMeetingId}`, meetingBody(c, s));
    await saveZoom(classId, { zoomSyncedAt: new Date(), zoomError: null });
    return true;
  } catch (err) {
    await saveZoom(classId, { zoomError: err instanceof Error ? err.message : String(err) });
    throw err;
  }
}

/** Deletes the meeting in Zoom (if it was made through the API) and clears the link. */
export async function removeClassMeeting(classId: string, opts: { keepRow?: boolean } = {}) {
  const c = await getClass(classId);
  if (!c) return;
  if (c.zoomMeetingId && (await isZoomConfigured())) {
    try {
      await zoom("DELETE", `/meetings/${c.zoomMeetingId}?schedule_for_reminder=false`);
    } catch (err) {
      // Already gone in Zoom is fine.
      if (!(err instanceof ZoomApiError && /not found|does not exist/i.test(err.message))) throw err;
    }
  }
  if (!opts.keepRow) await saveZoom(classId, { zoomMeetingId: null, zoomJoinUrl: null, zoomPassword: null, zoomSyncedAt: null, zoomError: null });
}

/** A link an admin pasted (no API). Replaces an API meeting's link on this class. */
export async function setManualClassLink(classId: string, joinUrl: string, password?: string | null) {
  const url = joinUrl.trim();
  if (!/^https:\/\/([a-z0-9-]+\.)*zoom\.(us|com)\//i.test(url)) throw new ZoomApiError("Paste a Zoom meeting link (https://…zoom.us/…).");
  await saveZoom(classId, { zoomMeetingId: null, zoomJoinUrl: url, zoomPassword: password?.trim() || null, zoomSyncedAt: new Date(), zoomError: null });
}

/** Fresh host link to start the meeting (Zoom start links expire, so never stored). */
export async function classMeetingStartUrl(classId: string) {
  const c = await getClass(classId);
  if (!c?.zoomMeetingId) throw new ZoomApiError("This class has no Zoom meeting created through the app.");
  const m = await zoom<{ start_url: string }>("GET", `/meetings/${c.zoomMeetingId}`);
  return m.start_url;
}

/**
 * Keeps Zoom in step with a class change. Never throws — a Zoom problem must
 * not block saving the class; it's shown on the class instead (zoomError).
 */
export async function syncClassMeeting(classId: string, change: "created" | "updated" | "deleted") {
  try {
    if (!(await isZoomConfigured())) return;
    const c = await getClass(classId);
    if (change === "deleted") return; // handled before the row is removed
    if (!c) return;
    const settings = await getZoomSettings();
    if (c.mode !== "online") {
      if (c.zoomMeetingId) await removeClassMeeting(classId);
      return;
    }
    if (c.zoomMeetingId) await updateClassMeeting(classId);
    else if (!c.zoomJoinUrl && settings.autoCreate && c.active) await createClassMeeting(classId);
  } catch (err) {
    console.error(`[zoom] sync for class ${classId} (${change}) failed:`, err);
  }
}
