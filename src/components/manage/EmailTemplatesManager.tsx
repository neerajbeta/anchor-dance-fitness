"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { usePermissions } from "@/lib/usePermissions";
import type { EmailTemplateContent, EmailVariable } from "@/lib/email/defaults";
import { EMAIL_LOGO_PATH, renderEmail, type DetailRow } from "@/lib/email/render";

type Template = {
  key: string;
  name: string;
  icon: string;
  trigger: string;
  audience: "customer" | "admin";
  variables: EmailVariable[];
  defaults: EmailTemplateContent;
  content: EmailTemplateContent;
  customised: boolean;
  updatedAt: string | null;
  updatedBy: string | null;
};

type LogRow = {
  id: string;
  templateKey: string;
  toEmail: string;
  subject: string;
  status: string;
  error: string | null;
  createdAt: string;
};

type Recipients = { emails: string[]; source: "settings" | "env" | "none" };

type Field = "subject" | "heading" | "body" | "buttonLabel" | "buttonUrl";

const SAMPLE_DETAILS: DetailRow[] = [
  ["Booking ID", "REG-1042"],
  ["Class", "Bollywood Beginners · 18:00–19:00"],
  ["Dates", "1 Oct 2026 – 31 Dec 2026"],
  ["Plan", "Quarterly"],
  ["Location", "Stockholm"],
  ["Mode", "In-Person"],
  ["Amount", "SEK 1 800"],
  ["Payment", "Paid · Swish"],
];

const STATUS_BADGE: Record<string, string> = {
  sent: "badge-ok",
  failed: "badge-danger",
  logged: "badge-gray",
  sending: "badge-info",
};

const fmtWhen = (iso: string) =>
  new Date(iso).toLocaleString("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });

/**
 * Admin → Email Templates: edit the wording of every automatic email with a
 * live preview, send yourself a test, and see what went out recently.
 */
export function EmailTemplatesManager() {
  const { can } = usePermissions();
  const editable = can("settings.edit");

  const [templates, setTemplates] = useState<Template[]>([]);
  const [configured, setConfigured] = useState<boolean | null>(null);
  const [from, setFrom] = useState("");
  const [log, setLog] = useState<LogRow[]>([]);
  const [recipients, setRecipients] = useState<Recipients | null>(null);
  const [activeKey, setActiveKey] = useState<string>("welcome");
  const [draft, setDraft] = useState<EmailTemplateContent | null>(null);
  const [busy, setBusy] = useState<"save" | "reset" | "test" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [device, setDevice] = useState<"desktop" | "mobile">("desktop");

  const lastField = useRef<Field>("body");
  const inputs = useRef<Partial<Record<Field, HTMLInputElement | HTMLTextAreaElement | null>>>({});

  async function load(keepKey?: string) {
    const res = await fetch("/api/email-templates");
    const j = await res.json().catch(() => ({}));
    if (!res.ok) {
      setError(j.error || "Couldn't load email templates");
      return;
    }
    setTemplates(j.data.templates);
    setConfigured(j.data.configured);
    setFrom(j.data.from);
    setLog(j.data.log);
    setRecipients(j.data.adminRecipients);
    const key = keepKey ?? activeKey;
    const t = (j.data.templates as Template[]).find((x) => x.key === key);
    if (t) setDraft({ ...t.content });
  }
  useEffect(() => {
    load();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const active = templates.find((t) => t.key === activeKey) ?? null;
  const dirty = useMemo(
    () => Boolean(active && draft && JSON.stringify(active.content) !== JSON.stringify(draft)),
    [active, draft]
  );

  function pick(key: string) {
    if (key === activeKey) return;
    if (dirty && !window.confirm("Discard your unsaved changes to this template?")) return;
    const t = templates.find((x) => x.key === key);
    setActiveKey(key);
    setDraft(t ? { ...t.content } : null);
    setError(null);
    setNotice(null);
  }

  function set<K extends keyof EmailTemplateContent>(k: K, v: EmailTemplateContent[K]) {
    setDraft((d) => (d ? { ...d, [k]: v } : d));
  }

  /** Drops {{variable}} at the cursor of whichever field was used last. */
  function insertVariable(name: string) {
    if (!draft) return;
    const field = lastField.current;
    const el = inputs.current[field];
    const token = `{{${name}}}`;
    const current = String(draft[field] ?? "");
    const start = el?.selectionStart ?? current.length;
    const end = el?.selectionEnd ?? current.length;
    const next =
      name === "booking_details" && field === "body"
        ? `${current.slice(0, start).replace(/\s*$/, "")}\n\n${token}\n\n${current.slice(end).replace(/^\s*/, "")}`
        : current.slice(0, start) + token + current.slice(end);
    set(field, next);
    requestAnimationFrame(() => {
      if (!el) return;
      el.focus();
      const pos = next.indexOf(token, Math.max(0, start - 2)) + token.length;
      el.setSelectionRange(pos, pos);
    });
  }

  async function save() {
    if (!draft || !active) return;
    setBusy("save");
    setError(null);
    setNotice(null);
    try {
      const res = await fetch("/api/email-templates", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ key: active.key, ...draft }),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(j.error || "Couldn't save");
      await load(active.key);
      setNotice("✓ Saved — the next emails will use this version.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't save");
    } finally {
      setBusy(null);
    }
  }

  async function reset() {
    if (!active) return;
    if (!window.confirm(`Restore the original "${active.name}"? Your edits will be lost.`)) return;
    setBusy("reset");
    setError(null);
    setNotice(null);
    try {
      const res = await fetch(`/api/email-templates?key=${active.key}`, { method: "DELETE" });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(j.error || "Couldn't reset");
      await load(active.key);
      setNotice("Restored the original template.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't reset");
    } finally {
      setBusy(null);
    }
  }

  async function sendTest() {
    if (!draft || !active) return;
    setBusy("test");
    setError(null);
    setNotice(null);
    try {
      const res = await fetch("/api/email-templates/test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ key: active.key, ...draft }),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(j.error || "Couldn't send the test");
      setNotice(`✓ Test email sent to ${j.data.to}`);
      load(active.key);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't send the test");
    } finally {
      setBusy(null);
    }
  }

  const preview = useMemo(() => {
    if (!draft || !active) return null;
    const vars = Object.fromEntries(active.variables.map((v) => [v.name, v.sample]));
    // Absolute URL: the preview iframe's srcDoc has no base URL of its own.
    return renderEmail(draft, vars, SAMPLE_DETAILS, { logoSrc: `${typeof window === "undefined" ? "" : window.location.origin}${EMAIL_LOGO_PATH}` });
  }, [draft, active]);

  const bind = (field: Field) => ({
    ref: (el: HTMLInputElement | HTMLTextAreaElement | null) => {
      inputs.current[field] = el;
    },
    onFocus: () => {
      lastField.current = field;
    },
    value: String(draft?.[field] ?? ""),
    onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => set(field, e.target.value),
    disabled: !editable,
  });

  return (
    <div className="flex flex-col gap-4">
      <StatusBar configured={configured} from={from} />

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[260px_minmax(0,1fr)]">
        {/* Template list */}
        <div className="flex flex-col gap-2">
          {templates.length === 0 && !error ? <div className="card text-[13px] text-muted">Loading…</div> : null}
          {templates.map((t) => {
            const on = t.key === activeKey;
            return (
              <button
                key={t.key}
                type="button"
                onClick={() => pick(t.key)}
                className={`flex items-start gap-3 rounded-xl border p-3 text-left transition ${
                  on ? "border-brand-500 bg-brand-50 shadow-card" : "border-line bg-white hover:border-brand-300"
                }`}
              >
                <span
                  className={`flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg text-lg ${
                    on ? "bg-brand text-white" : "bg-cream-deep"
                  }`}
                >
                  {t.icon}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-[13px] font-bold text-ink">{t.name}</span>
                  <span className="block text-[11px] leading-snug text-muted">{t.trigger}</span>
                  <span className="mt-1 flex flex-wrap gap-1">
                    {t.audience === "admin" ? <span className="badge badge-grape">To admin</span> : null}
                    {t.audience === "admin" && recipients && !recipients.emails.length ? (
                      <span className="badge badge-warn">No recipients</span>
                    ) : null}
                    {!t.content.enabled ? <span className="badge badge-gray">Off</span> : null}
                    {t.customised ? <span className="badge badge-brand">Edited</span> : <span className="badge badge-info">Default</span>}
                  </span>
                </span>
              </button>
            );
          })}
        </div>

        {/* Editor + preview */}
        {active && draft ? (
          <div className="grid grid-cols-1 gap-4 2xl:grid-cols-2">
            <div className="card flex flex-col gap-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <div className="card-title mb-0">
                    {active.icon} {active.name}
                  </div>
                  <div className="text-[11px] text-muted">
                    {active.trigger}
                    {active.updatedAt
                      ? ` · last edited ${fmtWhen(active.updatedAt)}${active.updatedBy ? ` by ${active.updatedBy}` : ""}`
                      : ""}
                  </div>
                </div>
                <label className="flex cursor-pointer items-center gap-2 text-[12px] font-semibold text-ink">
                  <input
                    type="checkbox"
                    className="h-4 w-4 accent-brand-500"
                    checked={draft.enabled}
                    disabled={!editable}
                    onChange={(e) => set("enabled", e.target.checked)}
                  />
                  {draft.enabled ? "Sending on" : "Sending off"}
                </label>
              </div>

              {active.audience === "admin" && recipients ? (
                <AdminRecipients value={recipients} editable={editable} onSaved={setRecipients} />
              ) : null}

              <div>
                <label className="field-label">Subject line *</label>
                <input className="field" maxLength={200} {...bind("subject")} />
              </div>
              <div>
                <label className="field-label">Heading *</label>
                <input className="field" maxLength={200} {...bind("heading")} />
              </div>
              <div>
                <label className="field-label">Message *</label>
                <textarea className="field min-h-[260px] font-mono text-[13px] leading-relaxed" {...bind("body")} />
                <p className="mt-1 text-[11px] text-muted">
                  Blank line = new paragraph · <code>**bold**</code> · start lines with <code>- </code> for a bullet list
                </p>
              </div>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div>
                  <label className="field-label">Button text</label>
                  <input className="field" maxLength={60} placeholder="(no button)" {...bind("buttonLabel")} />
                </div>
                <div>
                  <label className="field-label">Button link</label>
                  <input className="field" maxLength={500} placeholder="{{portal_url}}" {...bind("buttonUrl")} />
                </div>
              </div>

              <div className="rounded-lg border border-line bg-cream/60 p-3">
                <div className="mb-2 text-[11px] font-bold uppercase tracking-wide text-muted">
                  Insert a variable <span className="font-normal normal-case">— click to add it where your cursor is</span>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {active.variables.map((v) => (
                    <button
                      key={v.name}
                      type="button"
                      disabled={!editable}
                      title={`e.g. ${v.sample}`}
                      onMouseDown={(e) => e.preventDefault()} // keep the cursor in the field
                      onClick={() => insertVariable(v.name)}
                      className="rounded-full border border-line bg-white px-2.5 py-1 text-[11px] font-semibold text-slate transition hover:border-brand-400 hover:text-brand-600 disabled:opacity-50"
                    >
                      {v.label} <span className="font-mono text-[10px] text-muted">{`{{${v.name}}}`}</span>
                    </button>
                  ))}
                </div>
              </div>

              {error ? <div className="text-[12px] font-semibold text-danger">⚠️ {error}</div> : null}
              {notice ? <div className="text-[12px] font-semibold text-ok">{notice}</div> : null}

              {editable ? (
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    className={`btn btn-primary ${busy || !dirty ? "is-disabled" : ""}`}
                    disabled={Boolean(busy) || !dirty}
                    onClick={save}
                  >
                    {busy === "save" ? "Saving…" : "Save template"}
                  </button>
                  <button
                    type="button"
                    className={`btn btn-ghost ${busy || !configured ? "is-disabled" : ""}`}
                    disabled={Boolean(busy) || !configured}
                    onClick={sendTest}
                    title={configured ? "Sends this version to your own email" : "Email sending isn't set up"}
                  >
                    {busy === "test" ? "Sending…" : "✉️ Send me a test"}
                  </button>
                  {dirty ? (
                    <button type="button" className="btn btn-ghost" onClick={() => setDraft({ ...active.content })}>
                      Discard changes
                    </button>
                  ) : null}
                  {active.customised ? (
                    <button
                      type="button"
                      className="btn btn-ghost ml-auto text-danger"
                      disabled={Boolean(busy)}
                      onClick={reset}
                    >
                      Restore original
                    </button>
                  ) : null}
                </div>
              ) : (
                <div className="text-[12px] text-muted">You can view templates but not change them.</div>
              )}
            </div>

            <div className="card flex flex-col">
              <div className="mb-2 flex items-center justify-between gap-2">
                <div className="card-title mb-0">👁️ Live preview</div>
                <div className="flex rounded-full border border-line p-0.5 text-[11px] font-bold">
                  {(["desktop", "mobile"] as const).map((d) => (
                    <button
                      key={d}
                      type="button"
                      onClick={() => setDevice(d)}
                      className={`rounded-full px-3 py-1 ${device === d ? "bg-ink text-white" : "text-muted"}`}
                    >
                      {d === "desktop" ? "🖥️ Desktop" : "📱 Mobile"}
                    </button>
                  ))}
                </div>
              </div>
              {preview ? (
                <>
                  <div className="mb-2 rounded-lg border border-line bg-cream/60 px-3 py-2 text-[12px]">
                    <span className="font-bold text-muted">Subject: </span>
                    <span className="font-semibold text-ink">{preview.subject}</span>
                  </div>
                  <div className="flex flex-1 justify-center rounded-lg bg-cream-deep p-2">
                    <iframe
                      title="Email preview"
                      srcDoc={preview.html}
                      sandbox=""
                      className="h-[640px] rounded-md border border-line bg-white transition-all"
                      style={{ width: device === "mobile" ? 380 : "100%" }}
                    />
                  </div>
                  <p className="mt-2 text-[11px] text-muted">Filled with sample values — real emails use the customer&apos;s details.</p>
                </>
              ) : null}
            </div>
          </div>
        ) : null}
      </div>

      <RecentSends log={log} templates={templates} />
    </div>
  );
}

/** "Send to" list for the admin notification — saved on its own, separate from the wording. */
function AdminRecipients({
  value,
  editable,
  onSaved,
}: {
  value: Recipients;
  editable: boolean;
  onSaved: (r: Recipients) => void;
}) {
  const initial = value.source === "settings" ? value.emails.join(", ") : "";
  const [text, setText] = useState(initial);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  useEffect(() => setText(initial), [initial]);

  async function save() {
    setBusy(true);
    setMsg(null);
    try {
      const res = await fetch("/api/email-templates/recipients", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ emails: text }),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(j.error || "Couldn't save");
      onSaved(j.data);
      setMsg({ ok: true, text: "✓ Recipients saved" });
    } catch (err) {
      setMsg({ ok: false, text: err instanceof Error ? err.message : "Couldn't save" });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="rounded-lg border border-grape/30 bg-grape/5 p-3">
      <label className="field-label" htmlFor="admin-recipients">
        🔔 Send to (admin emails) *
      </label>
      <div className="flex flex-col gap-2 sm:flex-row">
        <input
          id="admin-recipients"
          className="field flex-1"
          placeholder="bookings@yourstudio.se, owner@yourstudio.se"
          value={text}
          disabled={!editable}
          onChange={(e) => setText(e.target.value)}
        />
        {editable ? (
          <button
            type="button"
            className={`btn btn-ink ${busy || text === initial ? "is-disabled" : ""}`}
            disabled={busy || text === initial}
            onClick={save}
          >
            {busy ? "Saving…" : "Save recipients"}
          </button>
        ) : null}
      </div>
      <p className="mt-1 text-[11px] text-muted">
        Separate several addresses with commas.{" "}
        {value.source === "env"
          ? `Nothing set here — using the server default: ${value.emails.join(", ")}.`
          : value.source === "none"
            ? "⚠️ No one is set yet, so admin booking emails aren't being sent."
            : null}
      </p>
      {msg ? (
        <div className={`mt-1 text-[12px] font-semibold ${msg.ok ? "text-ok" : "text-danger"}`}>{msg.text}</div>
      ) : null}
    </div>
  );
}

function StatusBar({ configured, from }: { configured: boolean | null; from: string }) {
  if (configured === null) return null;
  return configured ? (
    <div className="flex flex-wrap items-center gap-2 rounded-xl border border-ok/30 bg-ok/5 px-4 py-3 text-[13px]">
      <span className="badge badge-ok">● Sending live</span>
      <span className="text-slate">
        Emails are delivered through Postmark from <strong className="text-ink">{from}</strong>
      </span>
    </div>
  ) : (
    <div className="flex flex-wrap items-center gap-2 rounded-xl border border-warn/40 bg-warn/5 px-4 py-3 text-[13px]">
      <span className="badge badge-warn">Not sending</span>
      <span className="text-slate">
        No <code>POSTMARK_SERVER_TOKEN</code> on the server — emails are only written to the log below.
      </span>
    </div>
  );
}

function RecentSends({ log, templates }: { log: LogRow[]; templates: Template[] }) {
  const names = new Map(templates.map((t) => [t.key, `${t.icon} ${t.name}`]));
  return (
    <div className="card">
      <div className="card-title">📬 Recent emails</div>
      {log.length === 0 ? (
        <div className="text-[13px] text-muted">Nothing sent yet.</div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left text-[12px]">
            <thead>
              <tr className="border-b border-line text-[11px] uppercase tracking-wide text-muted">
                <th className="py-2 pr-3">When</th>
                <th className="py-2 pr-3">Email</th>
                <th className="py-2 pr-3">To</th>
                <th className="py-2 pr-3">Subject</th>
                <th className="py-2">Status</th>
              </tr>
            </thead>
            <tbody>
              {log.map((l) => (
                <tr key={l.id} className="border-b border-line/60 align-top last:border-0">
                  <td className="whitespace-nowrap py-2 pr-3 text-muted">{fmtWhen(l.createdAt)}</td>
                  <td className="whitespace-nowrap py-2 pr-3">{names.get(l.templateKey) ?? l.templateKey}</td>
                  <td className="py-2 pr-3">{l.toEmail}</td>
                  <td className="py-2 pr-3 text-slate">{l.subject}</td>
                  <td className="py-2">
                    <span className={`badge ${STATUS_BADGE[l.status] ?? "badge-gray"}`}>{l.status}</span>
                    {l.error ? <div className="mt-1 max-w-[220px] text-[11px] text-danger">{l.error}</div> : null}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
