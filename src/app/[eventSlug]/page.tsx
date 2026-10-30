import { notFound, redirect } from "next/navigation";
import { headers } from "next/headers";
import { Suspense, cache } from "react";
import type { Metadata } from "next";
import { Fraunces } from "next/font/google";
import { db } from "@/lib/db";
import { probeImageDimensions } from "@/lib/imageDimensions";
import { getOrderedProfessionOptions } from "@/lib/professions";
import { getOrgSettings } from "@/lib/settings";
import { formatDateInTz } from "@/lib/dateFormat";
import { formatHeroDate, formatHeroHours } from "@/lib/eventHeroDate";
import { formatEventScheduleLines } from "@/lib/eventSchedule";
import { getCheckoutQuestions } from "@/lib/checkoutForm";
import { getPublicTicketTypes } from "@/lib/ticketTypes";
import { type QuestionView } from "@/components/RegistrationForm";
import EventRegistration from "@/components/EventRegistration";
import FitTitle from "@/components/FitTitle";
import ClickableHero from "@/components/ClickableHero";
import MetaPixelScript from "@/components/MetaPixelScript";
import SalesPageHero from "@/components/salesPage/SalesPageHero";
import SalesPageContent from "@/components/salesPage/SalesPageContent";
import { parseSalesPageContent } from "@/lib/salesPage/types";
import LandingBlocksContent from "@/components/landingBlocks/LandingBlocksContent";
import { parseLandingBlocks } from "@/lib/landingBlocks/types";
import { publicEventName } from "@/lib/eventDisplayName";
import { getCurrentUser } from "@/lib/auth/session";
import { zonedTimeToUtc } from "@/lib/dateFormat";
import ImparablesPage from "@/components/imparables/ImparablesPage";
import { imparablesPageData } from "@/lib/imparables/page";
import { asistireShortTarget, SHORT_PATH } from "@/lib/imparables/asistire";

export const dynamic = "force-dynamic";

// One lookup per request, shared by the page and its metadata.
const findEvent = cache((slug: string) => db.event.findUnique({ where: { slug } }));

// Manicuristas Imparables' page (EventTheme IMPARABLES) names itself in the
// tab and in a shared link's preview; every other event keeps the site's.
// The preview's picture says the date (one day since 2026-10-29: a new file,
// so WhatsApp and Facebook don't keep showing the one with two days).
export async function generateMetadata({ params }: { params: { eventSlug: string } }): Promise<Metadata> {
  const event = await findEvent(params.eventSlug);
  if (!event || event.theme !== "IMPARABLES") return {};
  const name = publicEventName(event);
  const description = (event.subtitle ?? "").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim() || `${name}: un congreso de Nail Fest.`;
  const base = process.env.APP_BASE_URL;
  return {
    title: `${name} · Nail Fest`,
    description,
    ...(base ? { metadataBase: new URL(base) } : {}),
    openGraph: { title: name, description, images: [{ url: "/imparables/og-27-junio.jpg", width: 1200, height: 630 }] },
  };
}

// The brand's own display face for the hero's name and date numbers —
// same one EventRegistration.tsx already loads on this page for the
// confirmation screen, so no extra font request.
const fraunces = Fraunces({ subsets: ["latin"], weight: ["900"] });

export default async function EventLandingPage({
  params,
  searchParams,
}: {
  params: { eventSlug: string };
  searchParams: { fecha?: string | string[] };
}) {
  const event = await findEvent(params.eventSlug);
  if (!event) {
    // nailfest.lat/imparables, the «Asistiré» images' short link (2026-10-30):
    // to the congress's page, as long as no event has that name.
    if (params.eventSlug === SHORT_PATH) redirect(await asistireShortTarget());
    notFound();
  }

  // The team (anyone signed in to the admin) sees a draft as it will look,
  // with a band that says so; on Imparables' page they can also see it as of
  // another day (?fecha=2027-03-15: the waiting list, each price stage).
  const fecha = typeof searchParams.fecha === "string" && /^\d{4}-\d{2}-\d{2}$/.test(searchParams.fecha) ? searchParams.fecha : null;
  const staff = event.status === "DRAFT" || (event.theme === "IMPARABLES" && fecha) ? await getCurrentUser() : null;

  // Draft events (/admin/events) aren't live yet — same gate as our
  // previous ticketing platform's own Draft status. A plain 404 here would be confusing for an
  // admin double-checking a link before publishing (it looks like the
  // event doesn't exist at all instead of "not published yet"), so this
  // shows a clear message and no registration form instead of notFound().
  if (event.status === "DRAFT" && !staff) {
    return (
      <main style={{ maxWidth: 480, margin: "0 auto", padding: "40px 20px", textAlign: "center" }}>
        <h1>{publicEventName(event)}</h1>
        <p style={{ color: "#5b5f6b" }}>Este evento todavía no está publicado.</p>
      </main>
    );
  }

  const draftPreview = event.status === "DRAFT";
  // Manicuristas Imparables: its own page, and its own one-page checkout
  // (/[eventSlug]/checkout, where its buttons go).
  if (event.theme === "IMPARABLES") {
    const orgSettings = await getOrgSettings();
    const simulated = staff && fecha ? zonedTimeToUtc(`${fecha}T12:00`, orgSettings.timezone) : null;
    const now = simulated && !Number.isNaN(simulated.getTime()) ? simulated : new Date();
    const data = await imparablesPageData(event, orgSettings.timezone, now);
    if (!staff) {
      // Same landing count as every event page (see LandingView), never the team's own looks.
      await db.landingView.create({ data: { eventId: event.id, country: headers().get("x-vercel-ip-country") } }).catch(() => null);
    }
    return (
      <ImparablesPage
        event={{
          slug: event.slug,
          displayName: publicEventName(event),
          subtitle: event.subtitle,
          city: event.city,
          venueName: event.venueName,
          format: event.format,
          closingText: event.closingText,
          registerButtonLabel: event.registerButtonLabel,
          ctaNote: event.ctaNote,
        }}
        blocks={data.blocks}
        sales={data.sales}
        when={data.when}
        timezone={orgSettings.timezone}
        now={now}
        pixelId={data.pixelId}
        whatsappUrl={data.whatsappUrl}
        brandName={orgSettings.name}
        preview={staff ? { draft: draftPreview, simulated: now === simulated ? simulated : null, shortcuts: data.shortcuts } : null}
      />
    );
  }

  const [professionOptions, metaConnection, orgSettings, checkoutQuestions, ticketTypes, imageDimensions] = await Promise.all([
    getOrderedProfessionOptions(),
    db.metaConnection.findFirst({ orderBy: { createdAt: "desc" }, select: { pixelId: true } }),
    getOrgSettings(),
    getCheckoutQuestions(),
    getPublicTicketTypes(event.id),
    // Real aspect ratio of THIS event's own hero image — see
    // imageDimensions.ts's own comment for why a hardcoded guess broke
    // mobile. Skipped entirely when there's no image at all.
    event.imageUrl ? probeImageDimensions(event.imageUrl) : Promise.resolve(null),
    // Our own, Meta-independent landing count — see LandingView's own
    // schema comment. Country from Vercel's edge geolocation, free, no
    // external lookup. Never let a hiccup here break the actual page —
    // this is a nice-to-have stat, not something a visitor should ever
    // see fail as a 500. Not counted for the team's own look at a draft.
    draftPreview
      ? Promise.resolve(null)
      : db.landingView.create({ data: { eventId: event.id, country: headers().get("x-vercel-ip-country") } }).catch(() => null),
  ]);
  const questions: QuestionView[] = checkoutQuestions.map((q) => ({
    key: q.key,
    label: q.label,
    type: q.type,
    required: q.required,
    options: q.options,
    locked: q.locked,
    nameFormat: q.nameFormat,
    confirmEmail: q.confirmEmail,
  }));

  const eventWhen = [
    formatDateInTz(event.startsAt, { dateStyle: "full", timeStyle: "short" }, orgSettings.timezone, orgSettings.language),
    event.endsAt
      ? ` – ${formatDateInTz(event.endsAt, { dateStyle: "full", timeStyle: "short" }, orgSettings.timezone, orgSettings.language)}`
      : "",
  ].join("");
  // A VIRTUAL event never has a real physical venue line — swap it for a
  // short "evento virtual" note instead (the admin's own
  // virtualAccessInstructions, or a generic fallback so this never shows
  // blank). A HYBRID event shows BOTH: the real venue AND this same note,
  // since it's selling both an in-person and a virtual ticket at once.
  const physicalVenue = [event.venueName, event.venueAddress].filter(Boolean).join(" — ");
  const eventVenue =
    event.format === "VIRTUAL"
      ? event.virtualAccessInstructions || "Evento virtual — el acceso llega por correo antes del evento"
      : event.format === "HYBRID"
        ? [physicalVenue, event.virtualAccessInstructions || "también disponible de forma virtual"].filter(Boolean).join(" · ")
        : physicalVenue;

  // The hero's own big date block and venue card (see the markup below)
  // — derived from the same fields as eventWhen/eventVenue above, which
  // stay as-is for the sidebar, the floating CTA and the modal.
  const heroDate = formatHeroDate(event.startsAt, event.endsAt, orgSettings.timezone, orgSettings.language);
  // The hero's small line under the month is always the weekday/year line
  // ("Sábado y domingo · 2026") — the admin's choice over per-day hours
  // there. The real per-day hours still show in the "Dónde es" block.
  const heroHours = formatHeroHours(event.scheduleDays, orgSettings.timezone, orgSettings.language);
  const heroDetail = [heroDate.detail];
  const venueCardTitle = event.format === "VIRTUAL" ? "Evento virtual" : event.venueName;
  const venueCardDetail =
    event.format === "VIRTUAL"
      ? event.virtualAccessInstructions || "El acceso llega por correo antes del evento"
      : [event.venueAddress, event.format === "HYBRID" ? event.virtualAccessInstructions || "También disponible de forma virtual" : null]
          .filter(Boolean)
          .join(" · ");

  const salesPage = parseSalesPageContent(event.salesPageContent);
  // See Event.useLandingBlocks's own schema comment — only parsed/passed
  // down when the admin actually turned this on for THIS event; every
  // other event's landingBlocksContent stays undefined and
  // EventRegistration.tsx falls through to descriptionHtml exactly as
  // before.
  const landingBlocks = event.useLandingBlocks ? parseLandingBlocks(event.landingBlocks).filter((b) => !b.hidden) : null;

  return (
    // .event-page: 480px column on mobile (unchanged — already optimized,
    // see globals.css) widening to a real two-column layout with a sticky
    // sidebar (see EventRegistration.tsx's own comment) past ~900px,
    // closer to how established ticketing platforms' own event pages read
    // on desktop instead of the same narrow mobile column just centered
    // on a wide screen.
    <main className="event-page">
      <MetaPixelScript pixelId={metaConnection?.pixelId ?? null} />
      {draftPreview && <p className="event-draft-band">Vista previa: este evento está en borrador y solo lo ve el equipo.</p>}

      {event.imageUrl && imageDimensions && (
        // next/image, not a plain <img> — this is the single most-loaded
        // page in the app (the public landing page), and an admin can
        // upload up to 5MB (see uploads/event-image/route.ts's
        // MAX_BYTES) that used to go out at full size to every visitor on
        // every connection. Next resizes/re-encodes per device and serves
        // through Vercel's image CDN instead.
        //
        // fill + aspect-ratio on the WRAPPING element, not width/height on
        // the <img> itself — verified directly (see globals.css's own
        // comment) that an <img> with object-fit and only max-height (no
        // explicit height) always renders at max-height regardless of
        // its real intrinsic ratio, in every browser tested; passing the
        // real width/height as Image props doesn't change that, because
        // the img's OWN computed aspect-ratio gets overridden by that
        // same quirk. Setting aspect-ratio on this plain wrapper instead
        // (not a replaced/object-fit element, not subject to the quirk)
        // is what actually makes a wide banner shrink to its own real
        // shape instead of getting cropped to fill a fixed box — Nail
        // Fest's own event images are wide banner graphics with
        // edge-to-edge headline text, nowhere near 16:9, and that
        // cropping (worse the narrower the screen) is what broke mobile.
        // priority since this is almost always the page's LCP element.
        //
        // ClickableHero (not a plain div) — Clarity showed real taps
        // landing here expecting the registration modal to open, same
        // instinct as tapping a poster. See that component's own comment.
        <ClickableHero imageUrl={event.imageUrl} width={imageDimensions.width} height={imageDimensions.height} alt={publicEventName(event)} />
      )}

      {salesPage ? (
        // Bolder hero for an event with a real sales-script landing (see
        // Event.salesPageContent's own schema comment) — replaces the
        // plain h1/venue line ONLY here; every event without
        // salesPageContent falls through to the exact markup below,
        // unchanged.
        <SalesPageHero hero={salesPage.hero} />
      ) : (
        <>
          <FitTitle text={publicEventName(event)} className={`event-hero-title ${fraunces.className}`} />
          <p className="event-hero-date">
            <span className={`event-hero-date-days ${fraunces.className}`}>{heroDate.days}</span>
            <span className="event-hero-date-rest">
              <span className="event-hero-date-month">{heroDate.month}</span>
              {heroDetail.map((line) => (
                <span key={line} className="event-hero-date-detail">
                  {line}
                </span>
              ))}
            </span>
          </p>
          {event.subtitle && (
            // Sanitized server-side (lib/sanitizeHtml.ts) before storage,
            // same requirement as `description` right below — this also
            // renders on the public, unauthenticated page.
            <div className="event-page-subtitle" dangerouslySetInnerHTML={{ __html: event.subtitle }} />
          )}
          {(venueCardTitle || venueCardDetail) && (
            <div className="event-hero-venue">
              <span className="event-hero-venue-icon" aria-hidden="true">
                {event.format === "VIRTUAL" ? (
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="12" cy="12" r="10" />
                    <path d="M2 12h20M12 2a15 15 0 0 1 0 20M12 2a15 15 0 0 0 0 20" />
                  </svg>
                ) : (
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M21 10c0 7-9 13-9 13S3 17 3 10a9 9 0 0 1 18 0Z" />
                    <circle cx="12" cy="10" r="3" />
                  </svg>
                )}
              </span>
              <span className="event-hero-venue-text">
                {venueCardTitle && <strong>{venueCardTitle}</strong>}
                {venueCardDetail && <span>{venueCardDetail}</span>}
              </span>
            </div>
          )}
        </>
      )}

      {/* The registration flow — an inline "Registrarme GRATIS" button, the
          same button again as a floating one on mobile once that scrolls
          out of view (see EventRegistration.tsx's own IntersectionObserver),
          a sticky sidebar copy on desktop, the Entradas/Detalles/Resumen
          modal, AND the description below it — all one component now (see
          its own comment on why) so the description and sidebar can share
          one two-column grid. Wrapped in Suspense because it (via
          RegistrationForm) reads useSearchParams() for UTM attribution. */}
      <Suspense>
        <EventRegistration
          eventSlug={event.slug}
          eventName={publicEventName(event)}
          eventCity={event.city}
          eventWhen={eventWhen}
          eventVenue={eventVenue}
          professionOptions={professionOptions}
          questions={questions}
          ticketTypes={ticketTypes}
          registerButtonLabel={event.registerButtonLabel || "Registrarme GRATIS"}
          brandName={orgSettings.name}
          descriptionHtml={event.description}
          salesContent={salesPage ? <SalesPageContent content={salesPage} /> : undefined}
          landingBlocksContent={
            landingBlocks ? (
              <LandingBlocksContent
                blocks={landingBlocks}
                event={{ id: event.id, name: event.name, publicName: event.publicName, city: event.city, startsAt: event.startsAt }}
                venue={{
                  name: event.venueName ?? "",
                  address: event.venueAddress ?? "",
                  hours: heroHours ?? formatEventScheduleLines(event, orgSettings.timezone, orgSettings.language),
                }}
              />
            ) : undefined
          }
          galleryImageUrls={event.galleryImageUrls}
          galleryTitle={event.galleryTitle}
          ctaNote={event.ctaNote}
          closingText={event.closingText || `Nos vemos el ${heroDate.days} ${heroDate.month} en ${event.city}.`}
        />
      </Suspense>
    </main>
  );
}
