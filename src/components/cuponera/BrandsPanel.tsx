"use client";

import { useEffect, useRef, useState } from "react";
import BrandLink, { BrandLogo } from "./BrandLink";
import BrandCoupon from "./BrandCoupon";
import type { CuponeraBrandCard } from "@/lib/cuponera/shared";

// The brands' discounts in the hero (Student Beans' "deals of the day"),
// sliding sideways with the next ones peeking in: "rows" packs three brands
// per column — title, name and code, always whole —, "coupons" shows each brand as a
// coupon (BrandCoupon). Either way each brand goes to its store; the arrows
// are for a mouse, the dots say where you are.
export default function BrandsPanel({
  brands,
  title,
  variant = "rows",
  displayClassName,
}: {
  brands: CuponeraBrandCard[];
  title: string;
  variant?: "rows" | "coupons";
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
  }, [brands.length, variant]);

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
      <div className={brands.length === 1 ? "cup-panel-track is-single" : "cup-panel-track"} ref={trackRef}>
        {variant === "coupons"
          ? brands.map((b) => <BrandCoupon key={b.id} brand={b} className="cup-ticket--slide" />)
          : brands.map((b) => (
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
