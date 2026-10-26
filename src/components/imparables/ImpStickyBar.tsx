"use client";

import { useEffect, useState } from "react";

// The bar fixed at the bottom of Manicuristas Imparables' page. It only
// comes up once the cover's own button has scrolled out of sight above
// (2026-10-26): while that button is on screen, a second one below it says
// the same thing twice. Without a button on the cover, it follows the cover
// itself. Hidden, it's out of the way of taps and screen readers too.
export default function ImpStickyBar({ children }: { children: React.ReactNode }) {
  const [on, setOn] = useState(false);

  useEffect(() => {
    const target = document.querySelector(".imp-hero .imp-cta") ?? document.querySelector(".imp-hero");
    if (!target || typeof IntersectionObserver === "undefined") {
      setOn(true);
      return;
    }
    const observer = new IntersectionObserver(([entry]) => {
      if (entry) setOn(!entry.isIntersecting && entry.boundingClientRect.top < 0);
    });
    observer.observe(target);
    return () => observer.disconnect();
  }, []);

  return <div className={`imp-sticky${on ? " is-on" : ""}`}>{children}</div>;
}
