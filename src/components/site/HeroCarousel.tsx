"use client";

import { useEffect, useState } from "react";
import { asset } from "@/lib/site/content";

/** Rotating hero photos (every 3 s, pauses on hover), with dots to jump. */
export function HeroCarousel({ images }: { images: { src: string; alt: string }[] }) {
  const [i, setI] = useState(0);
  const [paused, setPaused] = useState(false);

  useEffect(() => {
    if (paused) return;
    const t = setInterval(() => setI((n) => (n + 1) % images.length), 3000);
    return () => clearInterval(t);
  }, [paused, images.length]);

  return (
    <div
      className="relative h-[320px] w-full overflow-hidden rounded-lg shadow-[0_8px_30px_rgba(0,0,0,0.2)] sm:h-[420px] min-[992px]:h-[500px]"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
    >
      {images.map((img, n) => (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          key={img.src}
          src={asset(img.src)}
          alt={img.alt}
          loading={n === 0 ? "eager" : "lazy"}
          className={`absolute inset-0 h-full w-full object-cover transition-opacity duration-700 ${n === i ? "opacity-100" : "opacity-0"}`}
        />
      ))}
      <div className="absolute bottom-9 left-[calc(65%-39px)] flex items-center gap-2.5">
        {images.map((img, n) => (
          <button
            key={img.src}
            type="button"
            aria-label={`Show photo ${n + 1}`}
            onClick={() => setI(n)}
            className={`h-3 w-3 rounded-full transition ${n === i ? "scale-125 bg-[#ea3835]" : "bg-white/50 hover:bg-white/80"}`}
          />
        ))}
      </div>
    </div>
  );
}
