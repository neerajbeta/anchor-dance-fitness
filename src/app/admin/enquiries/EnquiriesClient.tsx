"use client";

import { useEffect, useState } from "react";
import { ExportExcelButton } from "@/components/ExportExcelButton";

type Enquiry = {
  id: string;
  source: "demo" | "workshop" | "signup";
  eventTitle: string | null;
  promotionId: string | null;
  promotion: string | null;
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
  workshop: "🎭 Workshop question",
  signup: "📝 Registered · No Booking Yet",
};

export function EnquiriesClient() {
  const [items, setItems] = useState<Enquiry[]>([]);
  const [loading, setLoading] = useState(true);
  const [sourceFilter, setSourceFilter] = useState("");
  const [promoFilter, setPromoFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");

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

  const promoOptions = Array.from(new Map(items.filter((e) => e.promotionId).map((e) => [e.promotionId!, e.promotion ?? "Promotion"])));
  const shown = items.filter(
    (e) =>
      (!sourceFilter || e.source === sourceFilter) &&
      (!promoFilter || (promoFilter === "none" ? !e.promotionId : e.promotionId === promoFilter)) &&
      (!statusFilter || e.status === statusFilter)
  );

  return (
    <div className="card">
      <div className="flex items-start justify-between gap-2">
        <div className="card-title">📨 Enquiries</div>
        <ExportExcelButton
          rows={shown}
          filename="Enquiries"
          notes={[`Enquiries — ${shown.length} of ${items.length}`]}
          columns={[
            { label: "Received", value: (e) => e.createdAt?.slice(0, 10) ?? "" },
            { label: "Source", value: (e) => SOURCE_LABEL[e.source]?.replace(/^\S+\s/, "") ?? e.source },
            { label: "Name", value: (e) => e.fullName },
            { label: "Age", value: (e) => e.age ?? "" },
            { label: "Email", value: (e) => e.email },
            { label: "Phone", value: (e) => `${e.phoneCountryCode ?? ""} ${e.phone ?? ""}`.trim() },
            { label: "Area of interest", value: (e) => e.areaOfInterest ?? "" },
            { label: "Type of class", value: (e) => e.typeOfClass ?? "" },
            { label: "Preferred location", value: (e) => e.preferredLocation ?? "" },
            { label: "Workshop / event", value: (e) => e.eventTitle ?? "" },
            { label: "Promotion", value: (e) => e.promotion ?? "" },
            { label: "Status", value: (e) => e.status ?? "new" },
            { label: "Additional info", value: (e) => e.additionalInfo ?? "" },
          ]}
        />
      </div>
      <p className="mb-3 text-[13px] text-slate">
        People who showed interest but haven&apos;t taken a service yet — &quot;Book a Demo&quot;
        leads, questions about workshops and events, and registered students with no class/workshop/studio booking.
      </p>

      {items.length > 0 && (
        <div className="mb-3 flex flex-wrap gap-2">
          <select className="field w-auto text-xs" value={sourceFilter} onChange={(e) => setSourceFilter(e.target.value)}>
            <option value="">All sources</option>
            <option value="demo">📅 Book a Demo</option>
            <option value="workshop">🎭 Workshop questions</option>
            <option value="signup">📝 Registered, no booking</option>
          </select>
          <select className="field w-auto text-xs" value={promoFilter} onChange={(e) => setPromoFilter(e.target.value)}>
            <option value="">Any promotion</option>
            {promoOptions.map(([id, name]) => (
              <option key={id} value={id}>
                📣 {name}
              </option>
            ))}
            <option value="none">No promotion</option>
          </select>
          <select className="field w-auto text-xs" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
            <option value="">Any status</option>
            <option value="new">New — needs follow-up</option>
            <option value="contacted">Contacted</option>
            <option value="closed">Closed</option>
          </select>
          <span className="self-center text-[12px] text-muted">
            {shown.length} of {items.length}
          </span>
        </div>
      )}

      {items.length === 0 ? (
        <div className="rounded-lg border-[1.5px] border-dashed border-line bg-cream/40 py-10 text-center text-[13px] text-muted">
          No enquiries yet.
        </div>
      ) : (
        <div className="flex flex-col gap-2.5">
          {shown.map((e) => (
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
                    {e.promotion && <span className="badge badge-grape">📣 {e.promotion}</span>}
                    {e.eventTitle && e.eventTitle !== e.areaOfInterest && <span className="badge badge-warn">🎭 {e.eventTitle}</span>}
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
                {e.source !== "signup" && e.status && (
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
