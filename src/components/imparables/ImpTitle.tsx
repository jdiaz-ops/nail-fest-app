"use client";

import { useLayoutEffect, useRef } from "react";

// The event's name on the cover: the first words small ("MANICURISTAS"),
// the last one huge and gold ("IMPARABLES"), as big as fits the width on a
// single line — measured, since no fixed size fits every name and screen.
export default function ImpTitle({ pre, big }: { pre: string; big: string }) {
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

  return (
    <h1 className="imp-name">
      {pre && <span className="imp-pre">{pre}</span>}
      <span ref={ref} className="imp-title imp-gold">
        {big}
      </span>
    </h1>
  );
}
