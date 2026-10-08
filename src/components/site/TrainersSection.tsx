"use client";

import { useEffect, useState } from "react";
import { asset, TRAINERS, type Trainer } from "@/lib/site/content";
import { SITE } from "./styles";

/** "**bold**" → <strong>. */
function Rich({ text }: { text: string }) {
  const parts = text.split(/\*\*(.+?)\*\*/g);
  return (
    <>
      {parts.map((p, i) => (i % 2 ? <strong key={i} className="text-[#1a1a1a]">{p}</strong> : <span key={i}>{p}</span>))}
    </>
  );
}

function Tags({ tags }: { tags: string[] }) {
  return (
    <div className="flex flex-wrap gap-2">
      {tags.map((t) => (
        <span key={t} className="rounded-[20px] bg-gradient-to-b from-[#ea3835] to-[#f89b46] px-[12.8px] py-[4.8px] text-[12.8px] font-semibold capitalize leading-[1.6] text-white">
          {t}
        </span>
      ))}
    </div>
  );
}

export function TrainersSection() {
  const [open, setOpen] = useState<Trainer | null>(null);
  const [zoom, setZoom] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && (zoom ? setZoom(null) : setOpen(null));
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [open, zoom]);

  return (
    <>
      {/* Two per row: photo left, text right — as on the original site. */}
      <div className="grid grid-cols-1 gap-6 min-[992px]:grid-cols-2">
        {TRAINERS.map((t) => (
          <article
            key={t.id}
            className="group grid grid-cols-1 overflow-hidden rounded-[15px] border border-white/10 bg-white/[0.08] transition hover:-translate-y-1 hover:border-[#ea3835]/40 sm:grid-cols-[5fr_7fr]"
          >
            <div className="relative h-[300px] overflow-hidden sm:h-auto sm:min-h-[265px]">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={asset(t.card)} alt={`${t.name} — ${t.tags.join(" and ")} instructor`} loading="lazy" className="absolute inset-0 h-full w-full object-cover object-top transition duration-500 group-hover:scale-105" />
            </div>
            <div className="flex flex-col p-6">
              <h3 className={`${SITE.display} mb-4 text-[20.8px] font-bold leading-[1.3] text-white`}>{t.name}</h3>
              <Tags tags={t.tags} />
              <p className="mt-4 text-[14.4px] leading-[1.6] text-white/80">{t.summary}</p>
              <button
                type="button"
                onClick={() => setOpen(t)}
                className="mt-[12.8px] self-start text-[14.4px] font-semibold leading-[1.5] text-[#ea3835] underline decoration-1 underline-offset-2 transition hover:text-[#f89b46]"
              >
                Know More
              </button>
            </div>
          </article>
        ))}
      </div>

      {open && (
        <div className="fixed inset-0 z-[80] flex items-end justify-center bg-black/60 p-0 backdrop-blur-sm md:items-center md:p-6" onClick={() => setOpen(null)}>
          <div
            role="dialog"
            aria-modal="true"
            aria-label={open.name}
            className="max-h-[92vh] w-full max-w-4xl overflow-y-auto rounded-t-[26px] bg-white md:rounded-[26px]"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-black/10 px-6 py-4">
              <h3 className={`${SITE.display} text-xl font-bold text-[#1a1a1a]`}>{open.name}</h3>
              <button type="button" onClick={() => setOpen(null)} aria-label="Close" className="rounded-full p-2 text-2xl leading-none text-[#666] hover:bg-black/5">
                ×
              </button>
            </div>
            <div className="grid gap-6 p-6 md:grid-cols-[260px_1fr]">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={asset(open.photo)} alt={open.name} className="w-full rounded-2xl object-cover" />
              <div>
                <Tags tags={open.tags} />
                <div className="mt-4 space-y-3 text-[15px] leading-relaxed text-[#4a4a4a]">
                  {open.bio.map((p, i) => (
                    <p key={i}>
                      <Rich text={p} />
                    </p>
                  ))}
                </div>
              </div>
            </div>
            <div className="px-6 pb-6">
              <h4 className={`${SITE.display} mb-3 text-[16px] font-bold text-[#1a1a1a]`}>Gallery</h4>
              <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
                {open.gallery.map((g, i) => (
                  <button key={g} type="button" onClick={() => setZoom(g)} className="overflow-hidden rounded-xl">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={asset(g)} alt={`${open.name} — photo ${i + 1}`} loading="lazy" className="aspect-square w-full object-cover transition hover:scale-105" />
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {zoom && (
        <div className="fixed inset-0 z-[90] flex items-center justify-center bg-black/85 p-4" onClick={() => setZoom(null)}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={asset(zoom)} alt="" className="max-h-[90vh] max-w-full rounded-xl object-contain" />
          <button type="button" aria-label="Close" className="absolute right-5 top-4 text-4xl leading-none text-white" onClick={() => setZoom(null)}>
            ×
          </button>
        </div>
      )}
    </>
  );
}
