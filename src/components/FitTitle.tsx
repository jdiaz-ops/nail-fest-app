"use client";

import { useLayoutEffect, useRef } from "react";

interface Props {
  text: string;
  maxPx?: number;
  minPx?: number;
}

// The event name as a single-line headline, at the biggest size that fits
// the column — asked for as "que quepa en una sola línea, que siga siendo
// protagonista". A fixed size can't do both for every event name, so this
// measures: start at maxPx (the size the h1 always had) and only shrink
// when the name would wrap. A name too long even at minPx wraps normally
// instead of getting cut off.
export default function FitTitle({ text, maxPx = 32, minPx = 18 }: Props) {
  const ref = useRef<HTMLHeadingElement>(null);

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;

    function fit() {
      if (!el) return;
      el.style.whiteSpace = "nowrap";
      el.style.fontSize = `${maxPx}px`;
      const available = el.clientWidth;
      const needed = el.scrollWidth;
      if (needed <= available) return;
      const size = Math.max(minPx, Math.floor((maxPx * available) / needed));
      el.style.fontSize = `${size}px`;
      if (el.scrollWidth > el.clientWidth) el.style.whiteSpace = "normal";
    }

    fit();
    const observer = new ResizeObserver(fit);
    observer.observe(el.parentElement ?? el);
    return () => observer.disconnect();
  }, [text, maxPx, minPx]);

  return (
    <h1 ref={ref} style={{ margin: "4px 0 8px", fontSize: maxPx, lineHeight: 1.15, whiteSpace: "nowrap" }}>
      {text}
    </h1>
  );
}
