// Five stars, `rating` of them filled — shared by the public blocks and
// the admin list. Inline SVG so it needs no icon font and prints fine.
export default function Stars({ rating, size = 16 }: { rating: number; size?: number }) {
  return (
    <span style={{ display: "inline-flex", gap: 2 }} role="img" aria-label={`${rating} de 5 estrellas`}>
      {[1, 2, 3, 4, 5].map((n) => (
        <svg key={n} aria-hidden="true" width={size} height={size} viewBox="0 0 24 24">
          <path fill={n <= rating ? "#f2b01e" : "none"} stroke={n <= rating ? "none" : "#c9b58a"} strokeWidth="1.6" d="M12 2.5l2.9 6.2 6.8.8-5 4.6 1.3 6.7L12 17.5l-6 3.3 1.3-6.7-5-4.6 6.8-.8z" />
        </svg>
      ))}
    </span>
  );
}
