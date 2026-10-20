"use client";

import { useEffect, useRef, useState } from "react";
import BrandLink, { BrandLogo } from "./BrandLink";
import type { CuponeraBrandCard } from "@/lib/cuponera/shared";

// "Descuentos de las marcas", in the hero (Student Beans' "deals of the
// day"): three brands per column, sliding sideways, the next column peeking
// in. Each row is its coupon — title and code — and goes to the store.
export default function BrandsPanel({ brands, displayClassName }: { brands: CuponeraBrandCard[]; displayClassName: string }) {
  const trackRef = useRef<HTMLDivElement>(null);
  const [pages, setPages] = useState(1);
  const [page, setPage] = useState(0);

  // The dots follow the scroll: one per column the track can stop at.
  useEffect(() => {
    const track = trackRef.current;
    if (!track) return;
    const measure = () => {
      const first = track.firstElementChild as HTMLElement | null;
      const step = first ? first.offsetWidth + parseFloat(getComputedStyle(track).columnGap || "0") : track.clientWidth;
      const stops = step > 0 ? Math.round((track.scrollWidth - track.clientWidth) / step) + 1 : 1;
      setPages(Math.max(1, stops));
      setPage(step > 0 ? Math.round(track.scrollLeft / step) : 0);
    };
    measure();
    track.addEventListener("scroll", measure, { passive: true });
    window.addEventListener("resize", measure);
    return () => {
      track.removeEventListener("scroll", measure);
      window.removeEventListener("resize", measure);
    };
  }, [brands.length]);

  return (
    <div className="cup-panel">
      <h2 className={`cup-panel-title ${displayClassName}`}>Descuentos de las marcas</h2>
      <div className="cup-panel-track" ref={trackRef}>
        {brands.map((b) => (
          <BrandLink key={b.id} brand={b} className="cup-panel-row">
            <BrandLogo brand={b} />
            <span className="cup-panel-text">
              <span className="cup-panel-offer">
                {b.title}
                {b.exclusive && <span className="cup-exclusive">Exclusivo</span>}
              </span>
              <span className="cup-panel-brand">
                {b.name} · <code className="cup-code-chip">{b.code}</code>
              </span>
            </span>
          </BrandLink>
        ))}
      </div>
      {pages > 1 && (
        <div className="cup-pager" aria-hidden="true">
          {Array.from({ length: pages }, (_, i) => (
            <i key={i} className={i === page ? "is-on" : undefined} />
          ))}
        </div>
      )}
    </div>
  );
}
