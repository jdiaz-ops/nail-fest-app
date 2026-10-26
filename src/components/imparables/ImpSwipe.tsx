"use client";

import { Children, useRef, useState } from "react";

// A row of cards that slides with a finger (the results, the doubts): one
// card at a time with the next one peeking, and dots that follow along —
// tapping one goes to its card. On a computer the cards simply sit side by
// side (globals.css).
export default function ImpSwipe({ children }: { children: React.ReactNode }) {
  const rowRef = useRef<HTMLDivElement>(null);
  const [active, setActive] = useState(0);
  const count = Children.count(children);

  const cardsOf = (row: HTMLDivElement) => Array.from(row.children) as HTMLElement[];

  function onScroll() {
    const row = rowRef.current;
    if (!row) return;
    const cards = cardsOf(row);
    if (cards.length < 2) return;
    const atEnd = row.scrollLeft >= row.scrollWidth - row.clientWidth - 2;
    const step = cards[1]!.offsetLeft - cards[0]!.offsetLeft;
    setActive(atEnd ? cards.length - 1 : Math.max(0, Math.min(cards.length - 1, Math.round(row.scrollLeft / step))));
  }

  function go(i: number) {
    const row = rowRef.current;
    if (!row) return;
    const cards = cardsOf(row);
    if (!cards[i]) return;
    const smooth = !window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    row.scrollTo({ left: cards[i]!.offsetLeft - cards[0]!.offsetLeft, behavior: smooth ? "smooth" : "auto" });
  }

  return (
    <div className="imp-swipe-wrap">
      <div className="imp-swipe" ref={rowRef} onScroll={onScroll}>
        {children}
      </div>
      {count > 1 && (
        <div className="imp-dots">
          {Array.from({ length: count }, (_, i) => (
            <button
              key={i}
              type="button"
              className={i === active ? "is-on" : undefined}
              aria-label={`Ver la tarjeta ${i + 1} de ${count}`}
              aria-current={i === active ? "true" : undefined}
              onClick={() => go(i)}
            />
          ))}
        </div>
      )}
    </div>
  );
}
