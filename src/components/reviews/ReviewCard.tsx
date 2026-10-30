import { fraunces900 as fraunces } from "@/fonts";
import type { PublicReview } from "@/lib/reviews";
import Stars from "./Stars";
import ReviewPhotoThumb from "./ReviewPhotoThumb";


/** "Karen M." → "KM", "Asistente" → "A". */
export function reviewerInitials(name: string): string {
  const letters = name
    .split(/\s+/)
    .map((part) => part.replace(/[^\p{L}]/gu, "").charAt(0))
    .filter(Boolean);
  return letters.slice(0, 2).join("").toUpperCase() || "·";
}

// One public review card, the same on the home/landing slider and on the
// /resenas grid: the quote first, then who said it, with the photo as a
// thumbnail beside the name (tap for the lightbox) or the reviewer's
// initials when there is none — so cards with and without photos read
// the same. Styles: globals.css (.review-card-*).
export default function ReviewCard({ review: r }: { review: PublicReview }) {
  return (
    <article className="review-card">
      <div className="review-card-top">
        <Stars rating={r.rating} size={14} />
        <span className={`review-card-quote-mark ${fraunces.className}`} aria-hidden="true">
          “
        </span>
      </div>
      {r.comment && <p className="review-card-text">“{r.comment}”</p>}
      <div className="review-card-foot">
        {r.photos.length > 0 ? (
          <ReviewPhotoThumb photos={r.photos} name={r.name} />
        ) : (
          <div className="review-card-avatar" aria-hidden="true">
            {reviewerInitials(r.name)}
          </div>
        )}
        <div className="review-card-meta">
          <div className="review-card-name">
            {r.name}
            {r.city ? ` · ${r.city}` : ""}
            {r.instagramHandle ? <span className="review-card-handle"> @{r.instagramHandle}</span> : null}
          </div>
          <span className="review-card-badge">
            <svg aria-hidden="true" width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
              <path d="M20 6 9 17l-5-5" />
            </svg>
            Asistió a {r.eventName}
          </span>
        </div>
      </div>
    </article>
  );
}
