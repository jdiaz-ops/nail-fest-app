import Link from "next/link";
import { Fraunces } from "next/font/google";
import { optimizedSrc, optimizedSrcSet } from "@/lib/optimizedImage";
import { getOrgSettings } from "@/lib/settings";
import { getNextEvent } from "@/lib/nextEvent";
import { publicEventName } from "@/lib/eventDisplayName";
import { formatHeroDate } from "@/lib/eventHeroDate";

const fraunces = Fraunces({ subsets: ["latin"], weight: ["900"] });
import ReviewsSection from "@/components/reviews/ReviewsSection";
import ReviewsBadge from "@/components/reviews/ReviewsBadge";
import CommunityHub from "@/components/community/CommunityHub";
import SiteMenu from "@/components/community/SiteMenu";
import { viewerCanSeeSamples } from "@/lib/reviewsViewer";
import { getLibraryViewer } from "@/lib/library/data";
import { communityAccountLink, communityMenuLinks, getCommunityHome, partsOf } from "@/lib/community/home";
import { getConsultorioIdentity } from "@/lib/community/auth";

export const dynamic = "force-dynamic";

// nailfest.co's homepage — the account-wide hero, not any one event's own
// landing page (those stay at /[eventSlug], reachable from either domain
// once tiquete.nailfest.co is connected). Editable via /admin/homepage —
// see OrgSettings.homepageImageUrl's schema comment for exactly which
// parts are admin-authored vs. computed live from real Event data.
export default async function HomePage({ searchParams }: { searchParams: Record<string, string | string[] | undefined> }) {
  const [orgSettings, nextEvent, staff] = await Promise.all([getOrgSettings(), getNextEvent(), viewerCanSeeSamples()]);

  // The community's home (OrgSettings.homepageCommunity): the hub under the
  // hero, and a menu over it. The team previews it at /?vista=comunidad.
  const community = orgSettings.homepageCommunity || (staff && searchParams.vista === "comunidad");
  const [viewer, identity] = community ? await Promise.all([getLibraryViewer(), getConsultorioIdentity()]) : [null, null];
  const hub = viewer ? await getCommunityHome(viewer, nextEvent?.id ?? null) : null;
  const menuLinks = hub ? communityMenuLinks(partsOf(hub), nextEvent, orgSettings.homepageCommunity ? "/" : "/?vista=comunidad") : [];
  const account = hub ? communityAccountLink(identity, hub.consultorio.show) : null;

  // Venue only, no city — the city's already in the event name itself
  // (see EventForm's own "Nombre del evento" convention, e.g. "Nail Fest
  // Cúcuta"), so repeating it here just duplicated the h1 right above.
  const eventPlace = nextEvent?.venueName ?? "";
  // The date, derived from startsAt/endsAt exactly as the event's own
  // landing does (lib/eventHeroDate.ts), so the two can never disagree.
  const heroDate = nextEvent ? formatHeroDate(nextEvent.startsAt, nextEvent.endsAt, orgSettings.timezone, orgSettings.language) : null;
  // Video takes priority if somehow both are set (shouldn't happen from
  // the editor form, which keeps them mutually exclusive — see
  // OrgSettings.homepageVideoUrl's own schema comment). A GIF needs no
  // special case here at all: it's still homepageImageUrl, rendered by
  // the same <img> as any static photo, animating on its own.
  const hasMedia = Boolean(orgSettings.homepageVideoUrl || orgSettings.homepageImageUrl);

  return (
    <>
    {hub && !orgSettings.homepageCommunity && (
      <div className="bib-preview">
        <span>
          <b>Vista previa del equipo.</b> Así se verá la portada de la comunidad; el público todavía ve la portada de siempre.
        </span>
        <Link href="/admin/homepage">Ir a Editar homepage</Link>
      </div>
    )}
    <main
      style={{
        position: "relative",
        // 100dvh, not 100vh — same fix already used in ScanAppShell.tsx.
        // 100vh is the LARGEST possible mobile viewport (as if the
        // browser's address bar were hidden); on a real phone with the
        // bar showing, a bottom-anchored flex block sized against 100vh
        // sits partly below the visible fold, reading as a gap under the
        // button until you scroll — 100dvh tracks the actual visible
        // height instead.
        minHeight: "100dvh",
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

      {hub && (
        <div className={hasMedia ? "hub-menu" : "hub-menu hub-menu--solid"}>
          <SiteMenu links={menuLinks} account={account} />
        </div>
      )}
      <div style={{ position: "relative", zIndex: 1, padding: "32px 24px 20px", textAlign: "center" }}>
        {/* eslint-disable-next-line @next/next/no-img-element -- fixed logo mark, not worth next/image's overhead here */}
        <img src="/logo.png" alt="Nail Fest" style={{ height: 72, width: "auto", margin: "0 auto", display: "block" }} />
        {orgSettings.homepageTagline && (
          <p
            style={{
              margin: "14px 0 0",
              fontSize: 13,
              fontWeight: 500,
              letterSpacing: "0.08em",
              textTransform: "uppercase",
              opacity: 0.8,
              textShadow: hasMedia ? "0 1px 6px rgba(0,0,0,0.35)" : "none",
            }}
          >
            {orgSettings.homepageTagline}
          </p>
        )}
      </div>

      <div
        className="home-hero-block"
        style={{
          position: "relative",
          zIndex: 1,
          flex: 1,
          display: "flex",
          flexDirection: "column",
          justifyContent: "flex-end",
          maxWidth: 640,
        }}
      >
        {nextEvent ? (
          <>
            {/* The same title / big date / venue card the event landing
                has ([eventSlug]/page.tsx, .event-hero-*), in white over
                the photo — so the home and the landing feel like one
                site. The venue card names the place only: the city is
                in the event name right above it. */}
            <h1 className={`home-hero-title ${fraunces.className}`} style={{ textShadow: hasMedia ? "0 2px 16px rgba(0,0,0,0.35)" : "none" }}>
              {publicEventName(nextEvent)}
            </h1>
            {heroDate && (
              <p className="home-hero-date" style={{ textShadow: hasMedia ? "0 1px 8px rgba(0,0,0,0.35)" : "none" }}>
                <span className={`home-hero-days ${fraunces.className}`} style={{ color: hasMedia ? "var(--accent)" : "#fff" }}>
                  {heroDate.days}
                </span>
                <span className="home-hero-date-rest">
                  <span className="home-hero-month">{heroDate.month}</span>
                  <span className="home-hero-detail">{heroDate.detail}</span>
                </span>
              </p>
            )}
            <div className="home-hero-actions">
              {eventPlace && (
                <div className="home-hero-venue">
                  <span className="home-hero-venue-icon" aria-hidden="true">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M21 10c0 7-9 13-9 13S3 17 3 10a9 9 0 0 1 18 0Z" />
                      <circle cx="12" cy="10" r="3" />
                    </svg>
                  </span>
                  <strong>{eventPlace}</strong>
                </div>
              )}
              <Link
                href={`/${nextEvent.slug}`}
                className="home-hero-cta"
                style={{
                  // Against a photo the bright accent, against the solid
                  // teal fallback the dark ink fill (an accent button would
                  // vanish into it); the shadow only earns its keep over a
                  // photo.
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
      {hub && (
        <a href="#comunidad" className="hub-cue" style={{ textShadow: hasMedia ? "0 1px 6px rgba(0,0,0,0.35)" : "none" }}>
          Descubre tu lugar Nail Fest
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M6 9l6 6 6-6" />
          </svg>
        </a>
      )}
    </main>

    {hub && <CommunityHub home={hub} titleClass={fraunces.className} events={hub.moreEvents} />}

    {/* Photo gallery — square tiles, already fully designed by whoever
        made them (photo + caption baked in); this just lays them out.
        Empty array = section doesn't render, same as the hero above. */}
    {/* Reseñas, right under the hero — see OrgSettings.homepageReviews. */}
    {orgSettings.homepageReviewsPosition === "after_hero" && orgSettings.homepageReviews === "block" && (
      <div className="homepage-reviews">
        <ReviewsSection scope="global" />
      </div>
    )}
    {orgSettings.homepageReviewsPosition === "after_hero" && orgSettings.homepageReviews === "badge" && (
      <div className="homepage-reviews-badge">
        <ReviewsBadge scope="global" />
      </div>
    )}

    {orgSettings.homepageGalleryImageUrls.length > 0 && (
      <section className="homepage-gallery-grid">
        {orgSettings.homepageGalleryImageUrls.map((url, i) => (
          <div className="homepage-gallery-tile" key={url + i}>
            {/* eslint-disable-next-line @next/next/no-img-element -- admin-uploaded gallery photo, arbitrary Blob URL */}
            <img
              src={optimizedSrc(url, 640)}
              srcSet={optimizedSrcSet(url, [384, 640, 828])}
              sizes="(min-width: 900px) 25vw, 50vw"
              alt=""
              loading="lazy"
              decoding="async"
            />
          </div>
        ))}
      </section>
    )}

    {/* Brand/sponsor logo wall — plain white tiles, logo centered via
        object-fit: contain (unlike the gallery above, these vary in
        aspect ratio and must never crop). */}
    {/* Reseñas above the brand wall — see OrgSettings.homepageReviews.
        Either form renders nothing below three approved reviews. */}
    {orgSettings.homepageReviewsPosition === "before_logos" && orgSettings.homepageReviews === "block" && (
      <div className="homepage-reviews">
        <ReviewsSection scope="global" />
      </div>
    )}
    {orgSettings.homepageReviewsPosition === "before_logos" && orgSettings.homepageReviews === "badge" && (
      <div className="homepage-reviews-badge">
        <ReviewsBadge scope="global" />
      </div>
    )}

    {orgSettings.homepageBrandLogos.length > 0 && (
      <>
        {orgSettings.homepageBrandLogosTitle && (
          <h2 className="homepage-brand-logo-title">{orgSettings.homepageBrandLogosTitle}</h2>
        )}
        <section className="homepage-brand-logo-grid">
          {orgSettings.homepageBrandLogos.map((logo, i) => (
            <div className="homepage-brand-logo-tile" key={logo.url + i}>
              {/* eslint-disable-next-line @next/next/no-img-element -- admin-uploaded brand logo, arbitrary Blob URL */}
              <img src={logo.url} alt={logo.name} />
            </div>
          ))}
        </section>
      </>
    )}

    {/* Closing text — the very last thing on the page, below the brand
        logo wall. Plain text, no rich formatting; line breaks are
        preserved via CSS (white-space: pre-line) instead of a markdown
        renderer. */}
    {orgSettings.homepageClosingText && (
      <p className="homepage-closing-text">{orgSettings.homepageClosingText}</p>
    )}
    </>
  );
}
