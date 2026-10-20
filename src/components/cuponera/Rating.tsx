import { formatRating } from "@/lib/cuponera/shared";

// "★ 4,8 (23)": the reviews the product has in its Marcolini store.
export default function Rating({ rating }: { rating: { average: number; count: number } }) {
  const reviews = rating.count === 1 ? "1 reseña" : `${rating.count} reseñas`;
  return (
    <span className="cup-rating" role="img" aria-label={`${formatRating(rating.average)} de 5 estrellas, ${reviews}`}>
      <span className="cup-rating-star" aria-hidden="true">
        ★
      </span>
      <span aria-hidden="true">{formatRating(rating.average)}</span>
      <span className="cup-rating-count" aria-hidden="true">
        ({rating.count})
      </span>
    </span>
  );
}
