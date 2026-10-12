import { Fraunces } from "next/font/google";
import { listPublicReviews, resolveReviewScope, reviewAggregate, type ReviewScope } from "@/lib/reviews";
import { publicEventName } from "@/lib/eventDisplayName";
import { viewerCanSeeSamples } from "@/lib/reviewsViewer";
import Link from "next/link";
import ScrollCarousel from "@/components/ScrollCarousel";
import ReviewCard from "./ReviewCard";
import ReviewsScore from "./ReviewsScore";

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
  showAllLink = true,
}: {
  scope: ReviewScope;
  event?: { id: string; name: string; publicName: string | null; city: string; startsAt: Date } | null;
  title?: string;
  limit?: number;
  /** The "Leer todas las reseñas" button. Off on an event landing, where
   * every link out is a visitor who may not come back to register. */
  showAllLink?: boolean;
}) {
  if (scope !== "global" && !event) return null;
  const opts = { includeSamples: await viewerCanSeeSamples() };
  const resolved = scope === "global" || !event ? { eventIds: null as string[] | null, sourceEvent: null } : await resolveReviewScope(scope, event, opts);
  const [aggregate, reviews] = await Promise.all([reviewAggregate(resolved.eventIds, opts), listPublicReviews(resolved.eventIds, limit, opts)]);
  if (aggregate.count < MIN_REVIEWS_TO_SHOW || aggregate.average == null) return null;

  const sourceName = resolved.sourceEvent ? publicEventName(resolved.sourceEvent) : event ? publicEventName(event) : null;
  const heading = title?.trim() || (scope === "global" ? "Lo que dicen las que visitaron Nail Fest" : sourceName ? `Lo que dicen las que visitaron ${sourceName}` : "Lo que dicen las que visitaron Nail Fest");
  // An event block links to its city's reviews; the home block to all.
  const allHref = scope === "global" || !event ? "/resenas" : `/resenas?ciudad=${encodeURIComponent(event.city.toLowerCase())}`;

  return (
    <section className="reviews-section" aria-label={heading}>
      <div className="reviews-head">
        <div className="reviews-head-text">
          <div className="reviews-eyebrow">Reseñas</div>
          <h2 className={`reviews-title ${fraunces.className}`}>{heading}</h2>
        </div>
        <ReviewsScore
          average={aggregate.average.toLocaleString("es-CO", { minimumFractionDigits: 1, maximumFractionDigits: 1 })}
          rating={Math.round(aggregate.average)}
          count={aggregate.count}
          distribution={aggregate.distribution}
          numberClassName={fraunces.className}
        />
      </div>

      {reviews.length > 0 && (
        <ScrollCarousel>
          {reviews.map((r) => (
            <div className="review-slide" key={r.id}>
              <ReviewCard review={r} />
            </div>
          ))}
        </ScrollCarousel>
      )}
      {showAllLink && (
        <div className="reviews-all-link">
          <Link href={allHref} className="reviews-all-button">
            Leer todas las reseñas ({aggregate.count.toLocaleString("es-CO")})
          </Link>
        </div>
      )}
    </section>
  );
}
