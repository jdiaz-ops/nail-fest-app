"use client";

import { useEffect, useRef, useState } from "react";
import BrandLink, { BrandLogo } from "./BrandLink";
import type { CuponeraBrandCard } from "@/lib/cuponera/shared";

// The brands' discounts in the hero, like Student Beans' "deals of the day":
// three brands per column — the logo, then the discount big, the brand and
// the code, always whole — sliding sideways, the next column peeking in and
// "Desliza para ver más marcas" until the first slide, so it's clear there's
// more. Each brand goes to its store; the arrows are for a mouse, the dots
// say where you are. While there are few brands, the empty places show the
// team's examples (`examples`, staff only, never a real offer, opening no
// store) or, for visitors, "muy pronto" (`soon`).
export default function BrandsPanel({
  brands,
  title,
  examples = [],
  soon = 0,
  displayClassName,
}: {
  brands: CuponeraBrandCard[];
  title: string;
  examples?: CuponeraBrandCard[];
  soon?: number;
  displayClassName: string;
}) {
  const trackRef = useRef<HTMLDivElement>(null);
  const [pages, setPages] = useState(1);
  const [page, setPage] = useState(0);

  const step = () => {
    const track = trackRef.current;
    if (!track) return 0;
    const first = track.firstElementChild as HTMLElement | null;
    return first ? first.offsetWidth + parseFloat(getComputedStyle(track).columnGap || "0") : track.clientWidth;
  };

  // The dots follow the scroll: one per column the track can stop at.
  useEffect(() => {
    const track = trackRef.current;
    if (!track) return;
    const measure = () => {
      const s = step();
      const stops = s > 0 ? Math.round((track.scrollWidth - track.clientWidth) / s) + 1 : 1;
      setPages(Math.max(1, stops));
      setPage(s > 0 ? Math.round(track.scrollLeft / s) : 0);
    };
    measure();
    track.addEventListener("scroll", measure, { passive: true });
    window.addEventListener("resize", measure);
    return () => {
      track.removeEventListener("scroll", measure);
      window.removeEventListener("resize", measure);
    };
  }, [brands.length, examples.length, soon]);

  const go = (direction: 1 | -1) => trackRef.current?.scrollBy({ left: direction * step(), behavior: "smooth" });

  return (
    <div className="cup-panel">
      <div className="cup-panel-head">
        <h2 className={`cup-panel-title ${displayClassName}`}>{title}</h2>
        {pages > 1 && (
          <div className="cup-panel-arrows">
            <button type="button" onClick={() => go(-1)} disabled={page === 0} aria-label="Marcas anteriores">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="m15 18-6-6 6-6" />
              </svg>
            </button>
            <button type="button" onClick={() => go(1)} disabled={page >= pages - 1} aria-label="Más marcas">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="m9 18 6-6-6-6" />
              </svg>
            </button>
          </div>
        )}
      </div>
      <div className="cup-panel-track" ref={trackRef}>
        {brands.map((b) => (
          <BrandRow key={b.id} brand={b} />
        ))}
        {examples.map((b) => (
          <BrandRow key={b.id} brand={b} example />
        ))}
        {Array.from({ length: soon }, (_, i) => (
          <span key={`pronto-${i}`} className="cup-panel-row cup-panel-row--soon" aria-hidden="true">
            <span className="cup-panel-ghost" />
            <span className="cup-panel-text">
              <span className="cup-panel-offer">Nueva marca</span>
              <span className="cup-panel-brand">Muy pronto</span>
            </span>
          </span>
        ))}
      </div>
      {pages > 1 && (
        <>
          <div className="cup-pager" aria-hidden="true">
            {Array.from({ length: pages }, (_, i) => (
              <i key={i} className={i === page ? "is-on" : undefined} />
            ))}
          </div>
          <p className={page === 0 ? "cup-panel-hint" : "cup-panel-hint is-gone"} aria-hidden="true">
            Desliza para ver más marcas
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
              <path d="M5 12h14M13 6l6 6-6 6" />
            </svg>
          </p>
        </>
      )}
    </div>
  );
}

// One brand of the panel: its logo, then its offer ("10 % de descuento" or
// the admin's title), its name and its code. An example looks the same and
// opens no store.
function BrandRow({ brand, example = false }: { brand: CuponeraBrandCard; example?: boolean }) {
  return (
    <BrandLink brand={brand} className={example ? "cup-panel-row cup-panel-row--example" : "cup-panel-row"}>
      <BrandLogo brand={brand} />
      <span className="cup-panel-text">
        <span className="cup-panel-offer">
          {brand.title}
          {brand.exclusive && <span className="cup-exclusive">Exclusivo</span>}
        </span>
        <span className="cup-panel-brand">{brand.name}</span>
        <span className="cup-panel-code">
          con el código <code className="cup-code-chip">{brand.code}</code>
        </span>
      </span>
    </BrandLink>
  );
}
