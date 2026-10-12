import type { Metadata } from "next";
import Link from "next/link";
import { Fraunces } from "next/font/google";
import { listPublicReviews, publicReviewCities, reviewAggregate } from "@/lib/reviews";
import Stars from "@/components/reviews/Stars";
import ReviewCard from "@/components/reviews/ReviewCard";
import { viewerCanSeeSamples } from "@/lib/reviewsViewer";

const fraunces = Fraunces({ subsets: ["latin"], weight: ["800", "900"] });

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Reseñas · Nail Fest", description: "Lo que dicen las que visitaron Nail Fest." };

const PAGE_SIZE = 48;

// nailfest.lat/resenas — every approved, consented review, with a city
// filter (?ciudad=). Where the badge and "Leer todas las reseñas" land.
export default async function ReviewsIndexPage({ searchParams }: { searchParams: { ciudad?: string } }) {
  const opts = { includeSamples: await viewerCanSeeSamples() };
  const cities = await publicReviewCities(opts);
  const selected = (searchParams.ciudad ?? "").trim().toLowerCase();
  const city = cities.find((c) => c.city.toLowerCase() === selected) ?? null;
  const eventIds = city ? city.eventIds : null;
  const [aggregate, reviews] = await Promise.all([reviewAggregate(eventIds, opts), listPublicReviews(eventIds, PAGE_SIZE, opts)]);
  const average = aggregate.average?.toLocaleString("es-CO", { minimumFractionDigits: 1, maximumFractionDigits: 1 }) ?? null;

  return (
    <main style={{ maxWidth: 1100, margin: "0 auto", padding: "40px 20px 64px" }}>
      <div style={{ display: "flex", flexDirection: "column", gap: 10, maxWidth: 680 }}>
        <div className="reviews-eyebrow">Reseñas</div>
        <h1 className={`reviews-title ${fraunces.className}`}>{city ? `Lo que dicen las que visitaron Nail Fest en ${city.city}` : "Lo que dicen las que visitaron Nail Fest"}</h1>
        <p className="reviews-intro">Opiniones de asistentes a nuestras ediciones, publicadas con su nombre y con su permiso.</p>
      </div>

      {average && (
        <div style={{ display: "flex", alignItems: "center", gap: 12, margin: "20px 0", flexWrap: "wrap" }}>
          <span className={`reviews-score-number ${fraunces.className}`} style={{ fontSize: 44 }}>{average}</span>
          <Stars rating={Math.round(aggregate.average ?? 0)} size={20} />
          <span style={{ fontSize: 14, color: "#5b5f6b", fontWeight: 600 }}>
            {aggregate.count.toLocaleString("es-CO")} {aggregate.count === 1 ? "reseña" : "reseñas"}
          </span>
        </div>
      )}

      {cities.length > 1 && (
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 24 }}>
          <Link href="/resenas" style={{ fontSize: 13, fontWeight: 700, padding: "8px 14px", borderRadius: 999, border: "1px solid var(--border)", background: city ? "#fff" : "var(--accent-ink)", color: city ? "var(--ink)" : "#fff", textDecoration: "none" }}>
            Todas
          </Link>
          {cities.map((c) => (
            <Link key={c.city} href={`/resenas?ciudad=${encodeURIComponent(c.city.toLowerCase())}`} style={{ fontSize: 13, fontWeight: 700, padding: "8px 14px", borderRadius: 999, border: "1px solid var(--border)", background: city?.city === c.city ? "var(--accent-ink)" : "#fff", color: city?.city === c.city ? "#fff" : "var(--ink)", textDecoration: "none" }}>
              {c.city} · {c.count}
            </Link>
          ))}
        </div>
      )}

      {reviews.length === 0 ? (
        <p style={{ color: "#5b5f6b" }}>Todavía no hay reseñas publicadas{city ? ` de ${city.city}` : ""}.</p>
      ) : (
        <div className="reviews-grid">
          {reviews.map((r) => (
            <ReviewCard review={r} key={r.id} />
          ))}
        </div>
      )}
    </main>
  );
}
