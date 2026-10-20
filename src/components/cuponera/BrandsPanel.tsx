"use client";

import { useEffect, useRef, useState } from "react";
import BrandLink, { BrandLogo } from "./BrandLink";
import { formatPercent, type CuponeraBrandCard } from "@/lib/cuponera/shared";

// The brands' discounts in the hero (Student Beans' "deals of the day"),
// sliding sideways: "rows" packs three brands per column — title, name and
// code, always whole —; "coupons" shows small coupons three per row, two
// rows — logo, name, the % big, "con el código" and the code — with the next
// column peeking in and "Desliza para ver más marcas" until the first slide,
// so it's clear there's more. Each brand goes to its store; the arrows are
// for a mouse, the dots say where you are. While there are few brands, the
// empty places show the team's examples (`examples`, staff only, never a
// real offer) or, for visitors, "muy pronto" (`soon`).
export default function BrandsPanel({
  brands,
  title,
  variant = "rows",
  examples = [],
  soon = 0,
  displayClassName,
}: {
  brands: CuponeraBrandCard[];
  title: string;
  variant?: "rows" | "coupons";
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
  }, [brands.length, examples.length, soon, variant]);

  const go = (direction: 1 | -1) => trackRef.current?.scrollBy({ left: direction * step(), behavior: "smooth" });

  return (
    <div className={`cup-panel cup-panel--${variant}`}>
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
        {variant === "coupons" ? (
          <>
            {brands.map((b) => (
              <MiniCoupon key={b.id} brand={b} />
            ))}
            {examples.map((b) => (
              <MiniCoupon key={b.id} brand={b} example />
            ))}
            {Array.from({ length: soon }, (_, i) => (
              <span key={`pronto-${i}`} className="cup-mini cup-mini--soon" aria-hidden="true">
                <span className="cup-mini-ghost" />
                <span className="cup-mini-name">Nueva marca</span>
                <span className="cup-mini-soon">Muy pronto</span>
              </span>
            ))}
          </>
        ) : (
          brands.map((b) => (
            <BrandLink key={b.id} brand={b} className="cup-panel-row">
              <BrandLogo brand={b} />
              <span className="cup-panel-text">
                <span className="cup-panel-offer">
                  {b.title}
                  {b.exclusive && <span className="cup-exclusive">Exclusivo</span>}
                </span>
                <span className="cup-panel-brand">{b.name}</span>
                <span className="cup-panel-code">
                  con el código <code className="cup-code-chip">{b.code}</code>
                </span>
              </span>
            </BrandLink>
          ))
        )}
      </div>
      {pages > 1 && (
        <div className="cup-pager" aria-hidden="true">
          {Array.from({ length: pages }, (_, i) => (
            <i key={i} className={i === page ? "is-on" : undefined} />
          ))}
        </div>
      )}
      {pages > 1 && variant === "coupons" && (
        <p className={page === 0 ? "cup-panel-hint" : "cup-panel-hint is-gone"} aria-hidden="true">
          Desliza para ver más marcas
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
            <path d="M5 12h14M13 6l6 6-6 6" />
          </svg>
        </p>
      )}
    </div>
  );
}

// A brand as a small coupon: logo, name, the discount big, then "con el
// código" and the code. An
// example (invented, staff only) says so and opens no store.
function MiniCoupon({ brand, example = false }: { brand: CuponeraBrandCard; example?: boolean }) {
  return (
    <BrandLink brand={brand} className={example ? "cup-mini cup-mini--example" : "cup-mini"}>
      {example && <span className="cup-mini-tag">Ejemplo</span>}
      <BrandLogo brand={brand} size="sm" />
      <span className="cup-mini-name">{brand.name}</span>
      <span className="cup-mini-off">{formatPercent(brand.discountPercent)}</span>
      <span className="cup-mini-with">con el código</span>
      <code className="cup-mini-code">{brand.code}</code>
    </BrandLink>
  );
}
