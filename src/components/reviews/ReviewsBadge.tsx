import Link from "next/link";
import { resolveReviewScope, reviewAggregate, type ReviewScope } from "@/lib/reviews";
import { viewerCanSeeSamples } from "@/lib/reviewsViewer";
import Stars from "./Stars";

const MIN_REVIEWS_TO_SHOW = 3;

// The rating pill: stars, "4,8 de 5" and "312 reseñas verificadas en
// puerta", linking to /resenas. Used on the home, the links page and as
// the "Insignia de reseñas" landing block. Async server component; like
// the full block it renders nothing below three approved reviews.
// `variant` "dark" is for a dark ground (the links page).
export default async function ReviewsBadge({
  scope = "global",
  event,
  variant = "light",
}: {
  scope?: ReviewScope;
  event?: { id: string; city: string; startsAt: Date } | null;
  variant?: "light" | "dark";
}) {
  if (scope !== "global" && !event) return null;
  const opts = { includeSamples: await viewerCanSeeSamples() };
  const resolved = scope === "global" || !event ? { eventIds: null as string[] | null } : await resolveReviewScope(scope, event, opts);
  const aggregate = await reviewAggregate(resolved.eventIds, opts);
  if (aggregate.count < MIN_REVIEWS_TO_SHOW || aggregate.average == null) return null;
  const average = aggregate.average.toLocaleString("es-CO", { minimumFractionDigits: 1, maximumFractionDigits: 1 });
  return (
    <Link href="/resenas" className={`reviews-badge reviews-badge-${variant}`} aria-label={`Calificación ${average} de 5 según ${aggregate.count} reseñas. Ver todas las reseñas.`}>
      <Stars rating={Math.round(aggregate.average)} size={15} />
      <span className="reviews-badge-score">{average} de 5</span>
      <span className="reviews-badge-count">{aggregate.count.toLocaleString("es-CO")} {aggregate.count === 1 ? "reseña" : "reseñas"}</span>
    </Link>
  );
}
