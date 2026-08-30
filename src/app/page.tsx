import Link from "next/link";
import { getOrgSettings } from "@/lib/settings";
import { getNextEvent } from "@/lib/nextEvent";

export const dynamic = "force-dynamic";

// nailfest.co's homepage — the account-wide hero, not any one event's own
// landing page (those stay at /[eventSlug], reachable from either domain
// once tiquete.nailfest.co is connected). Editable via /admin/homepage —
// see OrgSettings.homepageImageUrl's schema comment for exactly which
// parts are admin-authored vs. computed live from real Event data.
export default async function HomePage() {
  const [orgSettings, nextEvent] = await Promise.all([getOrgSettings(), getNextEvent()]);

  const eventPlace = nextEvent ? [nextEvent.city, nextEvent.venueName].filter(Boolean).join(" — ") : "";

  return (
    <main
      style={{
        position: "relative",
        minHeight: "100vh",
        display: "flex",
        flexDirection: "column",
        // No image yet (or none uploaded) → the brand teal solid, same
        // accent/ink pairing used everywhere else in this app (see
        // globals.css's own comment on why --accent-ink, not white, is
        // the readable choice on top of --accent).
        background: orgSettings.homepageImageUrl ? "#0b2e2c" : "var(--accent)",
        color: orgSettings.homepageImageUrl ? "#fff" : "var(--accent-ink)",
      }}
    >
      {orgSettings.homepageImageUrl && (
        <>
          {/* eslint-disable-next-line @next/next/no-img-element -- full-bleed hero background from an admin-uploaded URL, not a known-size asset */}
          <img
            src={orgSettings.homepageImageUrl}
            alt=""
            style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover", zIndex: 0 }}
          />
          {/* Dark scrim so white text stays legible over any photo — same
              reasoning as the Lollapalooza reference. */}
          <div style={{ position: "absolute", inset: 0, background: "linear-gradient(180deg, rgba(11,46,44,0.35) 0%, rgba(11,46,44,0.75) 100%)", zIndex: 0 }} />
        </>
      )}

      <div style={{ position: "relative", zIndex: 1, padding: "28px 24px", fontWeight: 800, fontSize: 20, letterSpacing: "-0.01em" }}>
        Nail Fest
      </div>

      <div
        style={{
          position: "relative",
          zIndex: 1,
          flex: 1,
          display: "flex",
          flexDirection: "column",
          justifyContent: "flex-end",
          padding: "40px 24px 64px",
          maxWidth: 640,
        }}
      >
        {nextEvent ? (
          <>
            <h1 style={{ fontSize: "clamp(32px, 8vw, 56px)", lineHeight: 1.05, margin: "0 0 12px", fontWeight: 800 }}>
              {nextEvent.name}
            </h1>
            <p style={{ fontSize: 16, margin: "0 0 20px", fontWeight: 600 }}>{eventPlace}</p>
            {orgSettings.homepageTagline && (
              <p style={{ fontSize: 15, margin: "0 0 24px", opacity: 0.85, maxWidth: 460 }}>{orgSettings.homepageTagline}</p>
            )}
            <div>
              <Link
                href={`/${nextEvent.slug}`}
                style={{
                  display: "inline-block",
                  textDecoration: "none",
                  padding: "16px 32px",
                  fontSize: 16,
                  fontWeight: 700,
                  borderRadius: 8,
                  // The button always needs to read as a distinct, tappable
                  // surface against whichever background is active — the
                  // solid-teal state would make an accent-colored button
                  // vanish into it, so that state flips to the dark ink
                  // fill (still the brand palette, just the other half of
                  // the pairing) while the photo state uses the bright
                  // accent, same as the reference screenshot's cyan button
                  // on a dark photo.
                  background: orgSettings.homepageImageUrl ? "var(--accent)" : "var(--accent-ink)",
                  color: orgSettings.homepageImageUrl ? "var(--accent-ink)" : "#fff",
                }}
              >
                {orgSettings.homepageCtaLabel}
              </Link>
            </div>
          </>
        ) : (
          <>
            <h1 style={{ fontSize: "clamp(28px, 7vw, 44px)", lineHeight: 1.1, margin: "0 0 12px", fontWeight: 800 }}>
              Próximamente
            </h1>
            <p style={{ fontSize: 16, margin: 0, opacity: 0.9, maxWidth: 460 }}>
              Todavía no hay una fecha anunciada — vuelve pronto.
            </p>
          </>
        )}
      </div>
    </main>
  );
}
