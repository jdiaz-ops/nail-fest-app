"use client";

import { useState } from "react";
import type { ReviewAggregate } from "@/lib/reviews";
import Stars from "./Stars";

// The average + distribution box at the top of the reviews block. On a
// desktop the five bars sit beside the number; on a phone they fold away
// behind "Ver desglose" so the first opinion is one scroll closer (the
// folding itself is CSS, keyed on .is-open — see globals.css).
export default function ReviewsScore({
  average,
  rating,
  count,
  distribution,
  numberClassName,
}: {
  average: string;
  rating: number;
  count: number;
  distribution: ReviewAggregate["distribution"];
  numberClassName?: string;
}) {
  const [open, setOpen] = useState(false);
  const pct = (n: number) => (count > 0 ? Math.round((n / count) * 100) : 0);

  return (
    <div className={`reviews-score${open ? " is-open" : ""}`}>
      <div className="reviews-score-main">
        <div className={`reviews-score-number ${numberClassName ?? ""}`}>{average}</div>
        <Stars rating={rating} size={18} />
        <div className="reviews-score-count">
          {count.toLocaleString("es-CO")} {count === 1 ? "reseña" : "reseñas"}
        </div>
      </div>
      <button type="button" className="reviews-score-toggle" aria-expanded={open} aria-controls="reviews-score-bars" onClick={() => setOpen((v) => !v)}>
        {open ? "Ocultar desglose" : "Ver desglose"}
        <svg aria-hidden="true" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" style={{ transform: open ? "rotate(180deg)" : undefined }}>
          <path d="m6 9 6 6 6-6" />
        </svg>
      </button>
      <div className="reviews-bars" id="reviews-score-bars">
        {([5, 4, 3, 2, 1] as const).map((n) => (
          <div className="reviews-bar" key={n}>
            <span className="reviews-bar-label">{n}</span>
            <div className="reviews-bar-track">
              <div className="reviews-bar-fill" style={{ width: `${pct(distribution[n])}%` }} />
            </div>
            <span className="reviews-bar-pct">{pct(distribution[n])} %</span>
          </div>
        ))}
      </div>
    </div>
  );
}
