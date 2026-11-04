"use client";

import { useLayoutEffect, useRef } from "react";

// The event's name on the cover: the first words small ("MANICURISTAS"),
// the last one huge and gold ("IMPARABLES"), as big as fits the width on a
// single line — measured, since no fixed size fits every name and screen.
// Under it, its pillars («Mentalidad · Dinero · Marketing»), part of the name
// since 2026-11-04 (the team: no longer under the group photo).
export default function ImpTitle({ pre, big, pillars }: { pre: string; big: string; /** Its paragraph, as the event's tagline keeps it (sanitized HTML). */ pillars?: string | null }) {
  const ref = useRef<HTMLSpanElement>(null);

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    function fit() {
      if (!el) return;
      el.style.fontSize = "";
      const size = parseFloat(getComputedStyle(el).fontSize);
      if (el.scrollWidth > el.clientWidth) el.style.fontSize = `${Math.max(26, Math.floor((size * el.clientWidth) / el.scrollWidth))}px`;
    }
    fit();
    // Once the display face arrives the word gets wider than its fallback.
    document.fonts?.ready.then(fit).catch(() => {});
    const observer = new ResizeObserver(fit);
    observer.observe(el);
    return () => observer.disconnect();
  }, [big]);

  // The paragraph's words, without the paragraph: a line of the name.
  const words = pillars?.replace(/^\s*<p\b[^>]*>/i, "").replace(/<\/p>\s*$/i, "").trim();
  return (
    <div className="imp-name">
      <h1 className="imp-name-h">
        {pre && <span className="imp-pre">{pre}</span>}
        <span ref={ref} className="imp-title imp-gold">
          {big}
        </span>
      </h1>
      {words && <p className="imp-name-pillars" dangerouslySetInnerHTML={{ __html: words }} />}
    </div>
  );
}
