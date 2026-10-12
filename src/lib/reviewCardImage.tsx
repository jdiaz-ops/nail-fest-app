import { ImageResponse } from "next/og";
import type { ReviewCardData } from "@/lib/reviews";

// The 1080×1920 "historia de Instagram" card for one review — the same
// picture whether the attendee downloads it from the thank-you screen or
// an admin from the moderation page. Rendered by next/og (satori): plain
// flex layouts and absolute image URLs only, no CSS grid, no web fonts
// (satori ships its own sans; the brand serif is not worth a runtime
// font download on every card).
export function reviewCardImage(card: ReviewCardData): ImageResponse {
  const stars = Array.from({ length: 5 }, (_, i) => i < card.rating);
  const quote = (card.comment ?? "").trim();
  const shortQuote = quote.length > 220 ? `${quote.slice(0, 217).trimEnd()}…` : quote;
  return new ImageResponse(
    (
      <div style={{ width: 1080, height: 1920, display: "flex", flexDirection: "column", justifyContent: "space-between", background: "#1c1310", color: "#ffffff", padding: "112px 88px", fontFamily: "sans-serif" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ display: "flex", alignItems: "center", fontSize: 52, fontWeight: 800, letterSpacing: -1 }}>
            <span>Nail Fest</span>
            <span style={{ width: 20, height: 20, borderRadius: 10, background: "#00beb5", marginLeft: 16 }} />
          </div>
          <div style={{ fontSize: 26, fontWeight: 700, letterSpacing: 4, textTransform: "uppercase", color: "#ffc5a8" }}>{card.eventName}</div>
        </div>

        <div style={{ display: "flex", flexDirection: "column" }}>
          {card.photo ? (
            // eslint-disable-next-line @next/next/no-img-element -- satori needs a plain img
            <img src={card.photo} width={904} height={600} style={{ width: 904, height: 600, objectFit: "cover", borderRadius: 40 }} alt="" />
          ) : (
            <div style={{ width: 904, height: 600, borderRadius: 40, background: "#ffc5a8" }} />
          )}
          <div style={{ display: "flex", marginTop: 52 }}>
            {stars.map((filled, i) => (
              <svg key={i} width="68" height="68" viewBox="0 0 24 24">
                <path fill={filled ? "#f2b01e" : "none"} stroke={filled ? "none" : "#c9b58a"} strokeWidth="1.6" d="M12 2.5l2.9 6.2 6.8.8-5 4.6 1.3 6.7L12 17.5l-6 3.3 1.3-6.7-5-4.6 6.8-.8z" />
              </svg>
            ))}
          </div>
          {shortQuote ? <div style={{ display: "flex", marginTop: 44, fontSize: 60, lineHeight: 1.15, fontWeight: 800, letterSpacing: -1 }}>{`"${shortQuote}"`}</div> : null}
          <div style={{ display: "flex", flexDirection: "column", marginTop: 48 }}>
            <div style={{ fontSize: 40, fontWeight: 800 }}>{card.city ? `${card.name} · ${card.city}` : card.name}</div>
            {card.instagramHandle ? <div style={{ fontSize: 32, fontWeight: 700, color: "#ffc5a8", marginTop: 10 }}>{`@${card.instagramHandle}`}</div> : null}
          </div>
        </div>

        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", borderTop: "2px solid rgba(255,255,255,0.18)", paddingTop: 44 }}>
          <div style={{ display: "flex", alignItems: "center", background: "#00beb5", color: "#0b2e2c", borderRadius: 999, padding: "16px 28px", fontSize: 28, fontWeight: 800 }}>{`Asistió a ${card.eventName}`}</div>
          <div style={{ fontSize: 30, fontWeight: 700, color: "rgba(255,255,255,0.75)" }}>nailfest.lat</div>
        </div>
      </div>
    ),
    { width: 1080, height: 1920 }
  );
}
