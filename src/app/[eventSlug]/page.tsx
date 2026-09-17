import { notFound } from "next/navigation";
import Image from "next/image";
import { Suspense } from "react";
import { db } from "@/lib/db";
import { probeImageDimensions } from "@/lib/imageDimensions";
import { getOrderedProfessionOptions } from "@/lib/professions";
import { getOrgSettings } from "@/lib/settings";
import { formatDateInTz } from "@/lib/dateFormat";
import { getCheckoutQuestions } from "@/lib/checkoutForm";
import { getPublicTicketTypes } from "@/lib/ticketTypes";
import { type QuestionView } from "@/components/RegistrationForm";
import EventRegistration from "@/components/EventRegistration";
import MetaPixelScript from "@/components/MetaPixelScript";
import SalesPageHero from "@/components/salesPage/SalesPageHero";
import SalesPageContent from "@/components/salesPage/SalesPageContent";
import { parseSalesPageContent } from "@/lib/salesPage/types";
import LandingBlocksContent from "@/components/landingBlocks/LandingBlocksContent";
import { parseLandingBlocks } from "@/lib/landingBlocks/types";

export const dynamic = "force-dynamic";

export default async function EventLandingPage({ params }: { params: { eventSlug: string } }) {
  const event = await db.event.findUnique({ where: { slug: params.eventSlug } });
  if (!event) notFound();

  // Draft events (/admin/events) aren't live yet — same gate as our
  // previous ticketing platform's own Draft status. A plain 404 here would be confusing for an
  // admin double-checking a link before publishing (it looks like the
  // event doesn't exist at all instead of "not published yet"), so this
  // shows a clear message and no registration form instead of notFound().
  if (event.status === "DRAFT") {
    return (
      <main style={{ maxWidth: 480, margin: "0 auto", padding: "40px 20px", textAlign: "center" }}>
        <h1>{event.name}</h1>
        <p style={{ color: "#5b5f6b" }}>Este evento todavía no está publicado.</p>
      </main>
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

  const salesPage = parseSalesPageContent(event.salesPageContent);
  // See Event.useLandingBlocks's own schema comment — only parsed/passed
  // down when the admin actually turned this on for THIS event; every
  // other event's landingBlocksContent stays undefined and
  // EventRegistration.tsx falls through to descriptionHtml exactly as
  // before.
  const landingBlocks = event.useLandingBlocks ? parseLandingBlocks(event.landingBlocks) : null;

  return (
    // .event-page: 480px column on mobile (unchanged — already optimized,
    // see globals.css) widening to a real two-column layout with a sticky
    // sidebar (see EventRegistration.tsx's own comment) past ~900px,
    // closer to how established ticketing platforms' own event pages read
    // on desktop instead of the same narrow mobile column just centered
    // on a wide screen.
    <main className="event-page">
      <MetaPixelScript pixelId={metaConnection?.pixelId ?? null} />

      {event.imageUrl && imageDimensions && (
        // next/image, not a plain <img> — this is the single most-loaded
        // page in the app (the public landing page), and an admin can
        // upload up to 5MB (see uploads/event-image/route.ts's
        // MAX_BYTES) that used to go out at full size to every visitor on
        // every connection. Next resizes/re-encodes per device and serves
        // through Vercel's image CDN instead.
        //
        // fill + aspect-ratio on the WRAPPING div, not width/height on
        // the <img> itself — verified directly (see globals.css's own
        // comment) that an <img> with object-fit and only max-height (no
        // explicit height) always renders at max-height regardless of
        // its real intrinsic ratio, in every browser tested; passing the
        // real width/height as Image props doesn't change that, because
        // the img's OWN computed aspect-ratio gets overridden by that
        // same quirk. Setting aspect-ratio on this plain div instead
        // (not a replaced/object-fit element, not subject to the quirk)
        // is what actually makes a wide banner shrink to its own real
        // shape instead of getting cropped to fill a fixed box — Nail
        // Fest's own event images are wide banner graphics with
        // edge-to-edge headline text, nowhere near 16:9, and that
        // cropping (worse the narrower the screen) is what broke mobile.
        // priority since this is almost always the page's LCP element.
        <div
          className="event-page-hero"
          style={{ aspectRatio: `${imageDimensions.width} / ${imageDimensions.height}` }}
        >
          <Image
            src={event.imageUrl}
            alt={event.name}
            fill
            sizes="(min-width: 900px) 1080px, 100vw"
            priority
            style={{ objectFit: "cover" }}
          />
        </div>
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
          <h1 style={{ margin: "4px 0 8px" }}>{event.name}</h1>
          {eventVenue && (
            <p className="event-page-meta">
              {event.format === "VIRTUAL" ? "🌐" : "📍"} {eventVenue}
            </p>
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
          eventName={event.name}
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
          landingBlocksContent={landingBlocks ? <LandingBlocksContent blocks={landingBlocks} /> : undefined}
        />
      </Suspense>

      {orgSettings.selfServeResendEnabled && (
        <p style={{ fontSize: 12, color: "#5b5f6b", marginTop: 24, textAlign: "center" }}>
          ¿Ya te registraste y perdiste el correo? <a href="/reenviar">Reenviar mi entrada</a>
        </p>
      )}
    </main>
  );
}
