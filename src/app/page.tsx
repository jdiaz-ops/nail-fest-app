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

  // Venue only, no city — the city's already in the event name itself
  // (see EventForm's own "Nombre del evento" convention, e.g. "Nail Fest
  // Cúcuta"), so repeating it here just duplicated the h1 right above.
  const eventPlace = nextEvent?.venueName ?? "";
  // Video takes priority if somehow both are set (shouldn't happen from
  // the editor form, which keeps them mutually exclusive — see
  // OrgSettings.homepageVideoUrl's own schema comment). A GIF needs no
  // special case here at all: it's still homepageImageUrl, rendered by
  // the same <img> as any static photo, animating on its own.
  const hasMedia = Boolean(orgSettings.homepageVideoUrl || orgSettings.homepageImageUrl);

  return (
    <main
      style={{
        position: "relative",
        minHeight: "100vh",
        display: "flex",
        flexDirection: "column",
        // Nothing uploaded yet → the brand teal solid, same accent/ink
        // pairing used everywhere else in this app (see globals.css's own
        // comment on why --accent-ink, not white, is the readable choice
        // on top of --accent).
        background: hasMedia ? "#0b2e2c" : "var(--accent)",
        color: hasMedia ? "#fff" : "var(--accent-ink)",
      }}
    >
      {hasMedia && (
        <>
          {orgSettings.homepageVideoUrl ? (
            <video
              src={orgSettings.homepageVideoUrl}
              autoPlay
              muted
              loop
              playsInline
              style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover", zIndex: 0 }}
            />
          ) : (
            // eslint-disable-next-line @next/next/no-img-element -- full-bleed hero background from an admin-uploaded URL (photo or animated GIF), not a known-size asset
            <img
              src={orgSettings.homepageImageUrl!}
              alt=""
              style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover", zIndex: 0 }}
            />
          )}
          {/* Dark scrim so white text stays legible over any photo/video —
              same reasoning as the Lollapalooza reference. Multi-stop, not
              flat: stays light up top so the photo/video itself still
              reads (that's the point of uploading one), then ramps up
              hard through the bottom third where the h1/venue/CTA sit —
              real contrast exactly where it's needed instead of dimming
              the whole frame evenly. */}
          <div
            style={{
              position: "absolute",
              inset: 0,
              background:
                "linear-gradient(180deg, rgba(11,46,44,0.12) 0%, rgba(11,46,44,0.22) 38%, rgba(11,46,44,0.58) 68%, rgba(11,46,44,0.94) 100%)",
              zIndex: 0,
            }}
          />
        </>
      )}

      <div style={{ position: "relative", zIndex: 1, padding: "32px 24px 20px", textAlign: "center" }}>
        {/* eslint-disable-next-line @next/next/no-img-element -- fixed logo mark, not worth next/image's overhead here */}
        <img src="/logo.png" alt="Nail Fest" style={{ height: 72, width: "auto", margin: "0 auto", display: "block" }} />
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
            <h1
              style={{
                fontSize: "clamp(32px, 8vw, 56px)",
                lineHeight: 1.05,
                margin: "0 0 12px",
                fontWeight: 800,
                // A little lift off a busy photo — subtle on purpose, this
                // is backup for the gradient above, not doing the work
                // itself.
                textShadow: hasMedia ? "0 2px 16px rgba(0,0,0,0.35)" : "none",
              }}
            >
              {nextEvent.name}
            </h1>
            {eventPlace && (
              <p style={{ fontSize: 16, margin: "0 0 20px", fontWeight: 600, textShadow: hasMedia ? "0 1px 8px rgba(0,0,0,0.35)" : "none" }}>
                {eventPlace}
              </p>
            )}
            {orgSettings.homepageTagline && (
              <p style={{ fontSize: 15, margin: "0 0 24px", opacity: 0.85, maxWidth: 460 }}>{orgSettings.homepageTagline}</p>
            )}
            <div>
              <Link
                href={`/${nextEvent.slug}`}
                style={{
                  display: "inline-block",
                  textDecoration: "none",
                  padding: "16px 34px",
                  fontSize: 16,
                  fontWeight: 700,
                  borderRadius: 999,
                  // The button always needs to read as a distinct, tappable
                  // surface against whichever background is active — the
                  // solid-teal state would make an accent-colored button
                  // vanish into it, so that state flips to the dark ink
                  // fill (still the brand palette, just the other half of
                  // the pairing) while the photo state uses the bright
                  // accent, same as the reference screenshot's cyan button
                  // on a dark photo. The shadow only earns its keep over a
                  // photo/video — floating a pill button off a busy image
                  // reads as designed; the same shadow on the flat teal
                  // solid state would just look like a smudge.
                  background: hasMedia ? "var(--accent)" : "var(--accent-ink)",
                  color: hasMedia ? "var(--accent-ink)" : "#fff",
                  boxShadow: hasMedia ? "0 10px 28px -10px rgba(0,0,0,0.55)" : "none",
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
