"use client";

import { useEffect, useState } from "react";
import { COUNTRIES, DIAL_CODES, flagFromCode } from "@/lib/countries";

const CLASS_TYPES = ["Group Class", "Private Class", "Trial Class"];

type Category = { id: string; name: string };
type Loc = { id: string; label: string; flag: string | null };

export function BookDemoButton({
  label = "📅 Book a Demo",
  className = "btn btn-primary",
}: {
  label?: string;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  const [categories, setCategories] = useState<Category[]>([]);
  const [locs, setLocs] = useState<Loc[]>([]);
  const [countryCode, setCountryCode] = useState("IN");
  const [consent, setConsent] = useState(false);

  useEffect(() => {
    if (!open) return;
    fetch("/api/categories").then((r) => r.json()).then((j) => setCategories(j.data ?? []));
    fetch("/api/locations").then((r) => r.json()).then((j) => setLocs(j.data ?? []));
  }, [open]);

  function reset() {
    setError(null);
    setDone(false);
    setCountryCode("IN");
    setConsent(false);
  }

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!consent) {
      setError("Please consent to the use of your data to continue.");
      return;
    }
    setBusy(true);
    setError(null);
    const fd = new FormData(e.currentTarget);
    const payload = {
      fullName: fd.get("fullName"),
      age: fd.get("age"),
      email: fd.get("email"),
      phoneCountryCode: DIAL_CODES[countryCode] ?? "",
      phone: fd.get("phone"),
      areaOfInterest: fd.get("areaOfInterest"),
      typeOfClass: fd.get("typeOfClass"),
      preferredLocation: fd.get("preferredLocation"),
      additionalInfo: fd.get("additionalInfo"),
      consent,
    };
    try {
      const res = await fetch("/api/enquiries", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(j.error || `Request failed (${res.status})`);
      setDone(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to submit");
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <button
        type="button"
        className={className}
        onClick={() => {
          reset();
          setOpen(true);
        }}
      >
        {label}
      </button>

      {open && (
        <div
          className="fixed inset-0 z-[70] flex items-center justify-center bg-black/45 p-4"
          onClick={() => setOpen(false)}
        >
          <div
            className="max-h-[90vh] w-full max-w-2xl overflow-hidden rounded-2xl bg-white shadow-pop animate-scale-in"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between bg-gradient-to-r from-brand-500 to-brand-600 px-6 py-4 text-white">
              <div className="font-display text-lg font-bold">Book a Demo</div>
              <button type="button" className="text-xl leading-none text-white/90" onClick={() => setOpen(false)}>
                ×
              </button>
            </div>

            <div className="max-h-[calc(90vh-64px)] overflow-y-auto px-6 py-6">
              {done ? (
                <div className="py-8 text-center">
                  <div className="text-4xl">✅</div>
                  <div className="mt-2 font-display text-lg font-bold text-ink">Thanks — we got it!</div>
                  <p className="mt-1 text-[13px] text-slate">
                    Our team will reach out to you shortly to schedule your demo.
                  </p>
                  <button type="button" className="btn btn-primary mt-5" onClick={() => setOpen(false)}>
                    Close
                  </button>
                </div>
              ) : (
                <form onSubmit={submit}>
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <div>
                      <label className="field-label">Full Name *</label>
                      <input name="fullName" className="field" placeholder="Enter full name" required />
                    </div>
                    <div>
                      <label className="field-label">Age *</label>
                      <input name="age" type="number" min={0} className="field" placeholder="Enter your age" required />
                    </div>
                    <div>
                      <label className="field-label">Email Id *</label>
                      <input name="email" type="email" className="field" placeholder="Enter email" required />
                    </div>
                    <div>
                      <label className="field-label">Phone Number *</label>
                      <div className="flex gap-2">
                        <select
                          className="field w-24 flex-shrink-0 px-1.5"
                          value={countryCode}
                          onChange={(e) => setCountryCode(e.target.value)}
                        >
                          {COUNTRIES.map((c) => (
                            <option key={c.code} value={c.code}>
                              {flagFromCode(c.code)} {DIAL_CODES[c.code]}
                            </option>
                          ))}
                        </select>
                        <input name="phone" className="field flex-1" placeholder="Phone number" required />
                      </div>
                    </div>
                    <div>
                      <label className="field-label">Area of Interest *</label>
                      <select name="areaOfInterest" className="field" required defaultValue="">
                        <option value="" disabled>
                          Select area of interest
                        </option>
                        {categories.map((c) => (
                          <option key={c.id}>{c.name}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="field-label">Type of Class</label>
                      <select name="typeOfClass" className="field" defaultValue="">
                        <option value="">Select type of class</option>
                        {CLASS_TYPES.map((t) => (
                          <option key={t}>{t}</option>
                        ))}
                      </select>
                    </div>
                  </div>

                  {locs.length > 0 && (
                    <div className="mt-4">
                      <label className="field-label">Preferred Location</label>
                      <div className="flex flex-col gap-2">
                        {locs.map((l) => (
                          <label key={l.id} className="flex items-center gap-2 text-[13px] text-ink">
                            <input type="radio" name="preferredLocation" value={l.label} className="h-4 w-4" />
                            {l.flag} {l.label}
                          </label>
                        ))}
                      </div>
                    </div>
                  )}

                  <div className="mt-4">
                    <label className="field-label">Additional Information</label>
                    <textarea name="additionalInfo" className="field" rows={3} />
                  </div>

                  <div className="mt-5 rounded-lg border-[1.5px] border-line bg-cream/50 p-4 text-[12px] leading-relaxed text-slate">
                    <div className="mb-1.5 font-bold text-ink">Privacy Notice and GDPR Consent</div>
                    By submitting this form, you consent to the collection and processing of your
                    personal data, including your name, contact details, class preferences, and
                    availability, for the purposes of organizing and managing dance and fitness
                    classes, workshops, and related events. Your information will be stored securely
                    and will not be shared with third parties without your consent. You may request
                    access to or deletion of your data at any time by contacting us at{" "}
                    <a className="text-brand-600 underline" href="mailto:info@anchorfitness.se">
                      info@anchorfitness.se
                    </a>
                    . We are committed to handling your data in accordance with the General Data
                    Protection Regulation (GDPR).*
                  </div>

                  <label className="mt-3 flex items-start gap-2.5 text-[13px] text-ink">
                    <input
                      type="checkbox"
                      className="mt-0.5 h-4 w-4"
                      checked={consent}
                      onChange={(e) => setConsent(e.target.checked)}
                    />
                    I have read and consent to the use of my data as described above.
                  </label>

                  {error && (
                    <div className="mt-3 rounded-lg border-[1.5px] border-danger/40 bg-danger/5 px-3 py-2 text-xs font-semibold text-danger">
                      {error}
                    </div>
                  )}

                  <div className="mt-5 flex justify-between">
                    <button type="button" className="btn btn-ghost" onClick={() => setOpen(false)}>
                      Cancel
                    </button>
                    <button type="submit" className={`btn btn-primary ${busy ? "is-disabled" : ""}`}>
                      {busy ? "Submitting…" : "Submit"}
                    </button>
                  </div>
                </form>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
