"use client";

import { useEffect, useState } from "react";

type Enquiry = {
  id: string;
  source: "demo" | "signup";
  fullName: string;
  age: number | null;
  email: string;
  phoneCountryCode: string | null;
  phone: string | null;
  areaOfInterest: string | null;
  typeOfClass: string | null;
  preferredLocation: string | null;
  additionalInfo: string | null;
  status: string | null;
  createdAt: string;
};

const STATUS_TONE: Record<string, string> = {
  new: "badge-warn",
  contacted: "badge-info",
  closed: "badge-ok",
};

const SOURCE_LABEL: Record<Enquiry["source"], string> = {
  demo: "📅 Book a Demo",
  signup: "📝 Registered · No Booking Yet",
};

export function EnquiriesClient() {
  const [items, setItems] = useState<Enquiry[]>([]);
  const [loading, setLoading] = useState(true);

  async function load() {
    const j = await fetch("/api/enquiries").then((r) => r.json());
    setItems(j.data ?? []);
    setLoading(false);
  }
  useEffect(() => {
    load();
  }, []);

  async function setStatus(id: string, status: string) {
    await fetch(`/api/enquiries/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    load();
  }

  if (loading) return null;

  return (
    <div className="card">
      <div className="card-title">📨 Enquiries</div>
      <p className="mb-3 text-[13px] text-slate">
        People who showed interest but haven&apos;t taken a service yet — &quot;Book a Demo&quot;
        leads, and registered students with no class/workshop/studio booking.
      </p>

      {items.length === 0 ? (
        <div className="rounded-lg border-[1.5px] border-dashed border-line bg-cream/40 py-10 text-center text-[13px] text-muted">
          No enquiries yet.
        </div>
      ) : (
        <div className="flex flex-col gap-2.5">
          {items.map((e) => (
            <div key={`${e.source}-${e.id}`} className="rounded-lg border-[1.5px] border-line bg-white p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2 text-[13px] font-bold text-ink">
                    {e.fullName}
                    {e.age != null && <span className="text-muted">· Age {e.age}</span>}
                    <span className="badge badge-gray">{SOURCE_LABEL[e.source]}</span>
                    {e.status && (
                      <span className={`badge ${STATUS_TONE[e.status] ?? "badge-gray"}`}>{e.status}</span>
                    )}
                  </div>
                  <div className="mt-1 text-[12px] text-muted">
                    {e.email}
                    {e.phone ? ` · ${e.phoneCountryCode ?? ""} ${e.phone}` : ""}
                  </div>
                  <div className="mt-1.5 flex flex-wrap gap-1.5">
                    {e.areaOfInterest && <span className="badge badge-brand">{e.areaOfInterest}</span>}
                    {e.typeOfClass && <span className="badge badge-gray">{e.typeOfClass}</span>}
                    {e.preferredLocation && <span className="badge badge-gray">📍 {e.preferredLocation}</span>}
                  </div>
                  {e.additionalInfo && (
                    <div className="mt-2 text-[12px] text-slate">&quot;{e.additionalInfo}&quot;</div>
                  )}
                  <div className="mt-1.5 text-[11px] text-muted">
                    {new Date(e.createdAt).toLocaleString()}
                  </div>
                </div>
                {e.source === "demo" && e.status && (
                  <select
                    className="field w-auto flex-shrink-0 text-xs"
                    value={e.status}
                    onChange={(ev) => setStatus(e.id, ev.target.value)}
                  >
                    <option value="new">New</option>
                    <option value="contacted">Contacted</option>
                    <option value="closed">Closed</option>
                  </select>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
