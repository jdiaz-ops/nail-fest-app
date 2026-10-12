import Link from "next/link";
import { resolveReviewScope, reviewAggregate, type ReviewScope } from "@/lib/reviews";
import { publicEventName } from "@/lib/eventDisplayName";
import { viewerCanSeeSamples } from "@/lib/reviewsViewer";
import Stars from "./Stars";

const MIN_REVIEWS_TO_SHOW = 3;

// The rating pill, two lines: what it is ("Lo que dicen las que visitaron
// Nail Fest", or the edition on an event landing), then the stars,
// "4,6 de 5", "12 reseñas" and "Leer ›" — the whole pill is one link to
// /resenas (an event's to its city's reviews). Used on the home, the
// links page and as the "Insignia de reseñas" landing block. Async
// server component; like the full block it renders nothing below three
// approved reviews. `variant` "dark" is for a dark ground (the links page).
export default async function ReviewsBadge({
  scope = "global",
  event,
  variant = "light",
}: {
  scope?: ReviewScope;
  event?: { id: string; name: string; publicName: string | null; city: string; startsAt: Date } | null;
  variant?: "light" | "dark";
}) {
  if (scope !== "global" && !event) return null;
  const opts = { includeSamples: await viewerCanSeeSamples() };
  const resolved = scope === "global" || !event ? { eventIds: null as string[] | null, sourceEvent: null } : await resolveReviewScope(scope, event, opts);
  const aggregate = await reviewAggregate(resolved.eventIds, opts);
  if (aggregate.count < MIN_REVIEWS_TO_SHOW || aggregate.average == null) return null;
  const average = aggregate.average.toLocaleString("es-CO", { minimumFractionDigits: 1, maximumFractionDigits: 1 });
  const count = `${aggregate.count.toLocaleString("es-CO")} ${aggregate.count === 1 ? "reseña" : "reseñas"}`;
  const sourceName = scope === "global" || !event ? null : publicEventName(resolved.sourceEvent ?? event);
  const eyebrow = sourceName ? `Lo que dicen las que visitaron ${sourceName}` : "Lo que dicen las que visitaron Nail Fest";
  const href = scope === "global" || !event ? "/resenas" : `/resenas?ciudad=${encodeURIComponent(event.city.toLowerCase())}`;
  return (
    <Link href={href} className={`reviews-badge reviews-badge-${variant}`} aria-label={`${eyebrow}: ${average} de 5 según ${count}. Leer las reseñas.`}>
      <span className="reviews-badge-eyebrow">{eyebrow}</span>
      <span className="reviews-badge-row">
        <Stars rating={Math.round(aggregate.average)} size={15} />
        <span className="reviews-badge-score">{average} de 5</span>
        <span className="reviews-badge-count">{count}</span>
        <span className="reviews-badge-link">Leer ›</span>
      </span>
    </Link>
  );
}
