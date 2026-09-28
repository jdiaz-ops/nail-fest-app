"use client";

import { Children, useEffect, useRef, useState, type ReactNode } from "react";

// A horizontally-scrollable, swipe-to-snap row of whatever cards it's
// given, with position dots below — the event page's photo carousel
// (EventGalleryCarousel.tsx) and the "people" landing block both use it.
// Each child is one card; give it its own width and scroll-snap-align.
export default function ScrollCarousel({ children }: { children: ReactNode }) {
  const items = Children.toArray(children);
  const trackRef = useRef<HTMLDivElement>(null);
  const [activeIndex, setActiveIndex] = useState(0);

  useEffect(() => {
    const track = trackRef.current;
    if (!track) return;
    let frame = 0;
    function onScroll() {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        if (!track) return;
        const cards = Array.from(track.children) as HTMLElement[];
        const center = track.scrollLeft + track.clientWidth / 2;
        let closest = 0;
        let closestDist = Infinity;
        cards.forEach((card, i) => {
          const dist = Math.abs(card.offsetLeft + card.offsetWidth / 2 - center);
          if (dist < closestDist) {
            closestDist = dist;
            closest = i;
          }
        });
        setActiveIndex(closest);
      });
    }
    track.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      track.removeEventListener("scroll", onScroll);
      cancelAnimationFrame(frame);
    };
  }, []);

  return (
    <div className="scroll-carousel">
      <div className="scroll-carousel-track" ref={trackRef}>
        {items}
      </div>
      {items.length > 1 && (
        <div className="scroll-carousel-dots">
          {items.map((_, i) => (
            <span key={i} className={`scroll-carousel-dot${i === activeIndex ? " is-active" : ""}`} />
          ))}
        </div>
      )}
    </div>
  );
}
