import { Fraunces } from "next/font/google";
import { optimizedSrc } from "@/lib/optimizedImage";
import { listPublicReviews, resolveReviewScope, reviewAggregate, type ReviewScope } from "@/lib/reviews";
import { publicEventName } from "@/lib/eventDisplayName";
import Link from "next/link";
import Stars from "./Stars";

const fraunces = Fraunces({ subsets: ["latin"], weight: ["800", "900"] });

const MIN_REVIEWS_TO_SHOW = 3;

// The public "lo que dijeron" block — on an event landing (this event, or
// the previous edition in the same city) and on the home (every event).
// Async server component: it loads its own data, and renders nothing at
// all below MIN_REVIEWS_TO_SHOW approved reviews, so an empty block never
// shows an empty promise. Styles live in globals.css (.reviews-*).
export default async function ReviewsSection({
  scope,
  event,
  title,
  limit = 6,
}: {
  scope: ReviewScope;
  event?: { id: string; name: string; publicName: string | null; city: string; startsAt: Date } | null;
  title?: string;
  limit?: number;
}) {
  if (scope !== "global" && !event) return null;
  const resolved = scope === "global" || !event ? { eventIds: null as string[] | null, sourceEvent: null } : await resolveReviewScope(scope, event);
  const [aggregate, reviews] = await Promise.all([reviewAggregate(resolved.eventIds), listPublicReviews(resolved.eventIds, limit)]);
  if (aggregate.count < MIN_REVIEWS_TO_SHOW || aggregate.average == null) return null;

  const sourceName = resolved.sourceEvent ? publicEventName(resolved.sourceEvent) : event ? publicEventName(event) : null;
  const heading = title?.trim() || (scope === "global" ? "Lo que dicen las manicuristas" : sourceName ? `Lo que vivieron en ${sourceName}` : "Lo que dicen quienes fueron");
  const intro = scope === "global" ? "Reseñas de quienes entraron a alguna edición, verificadas en puerta y publicadas con nombre." : "Opiniones de manicuristas que entraron al evento. Cada una lleva el sello de asistencia y su nombre real.";
  const pct = (n: number) => (aggregate.count > 0 ? Math.round((n / aggregate.count) * 100) : 0);

  return (
    <section className="reviews-section" aria-label={heading}>
      <div className="reviews-head">
        <div className="reviews-head-text">
          <div className="reviews-eyebrow">Reseñas verificadas en puerta</div>
          <h2 className={`reviews-title ${fraunces.className}`}>{heading}</h2>
          <p className="reviews-intro">{intro}</p>
        </div>
        <div className="reviews-score">
          <div className="reviews-score-main">
            <div className={`reviews-score-number ${fraunces.className}`}>{aggregate.average.toLocaleString("es-CO", { minimumFractionDigits: 1, maximumFractionDigits: 1 })}</div>
            <Stars rating={Math.round(aggregate.average)} size={18} />
            <div className="reviews-score-count">{aggregate.count.toLocaleString("es-CO")} {aggregate.count === 1 ? "reseña" : "reseñas"}</div>
          </div>
          <div className="reviews-bars">
            {([5, 4, 3, 2, 1] as const).map((n) => (
              <div className="reviews-bar" key={n}>
                <span className="reviews-bar-label">{n}</span>
                <div className="reviews-bar-track">
                  <div className="reviews-bar-fill" style={{ width: `${pct(aggregate.distribution[n])}%` }} />
                </div>
                <span className="reviews-bar-pct">{pct(aggregate.distribution[n])} %</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {reviews.length > 0 && (
        <div className="reviews-grid">
          {reviews.map((r) => (
            <article className="review-card" key={r.id}>
              {r.photos[0] && (
                // eslint-disable-next-line @next/next/no-img-element -- attendee-uploaded Blob photo
                <img className="review-card-photo" src={optimizedSrc(r.photos[0], 640)} alt="" loading="lazy" decoding="async" />
              )}
              <div className="review-card-body">
                <Stars rating={r.rating} />
                {r.comment && <p className="review-card-text">“{r.comment}”</p>}
                <div className="review-card-meta">
                  <div className="review-card-name">
                    {r.name}
                    {r.city ? ` · ${r.city}` : ""}
                    {r.instagramHandle ? <span className="review-card-handle"> @{r.instagramHandle}</span> : null}
                  </div>
                  <span className="review-card-badge">
                    <svg aria-hidden="true" width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6 9 17l-5-5" /></svg>
                    Asistió a {r.eventName}
                  </span>
                </div>
              </div>
            </article>
          ))}
        </div>
      )}
      <div className="reviews-all-link">
        <Link href="/resenas">Leer todas las reseñas</Link>
      </div>
    </section>
  );
}
