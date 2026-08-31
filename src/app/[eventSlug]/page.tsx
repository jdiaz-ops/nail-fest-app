import { notFound } from "next/navigation";
import { Suspense } from "react";
import { db } from "@/lib/db";
import { getOrderedProfessionOptions } from "@/lib/professions";
import { getOrgSettings } from "@/lib/settings";
import { formatDateInTz } from "@/lib/dateFormat";
import { getCheckoutQuestions } from "@/lib/checkoutForm";
import { getPublicTicketTypes } from "@/lib/ticketTypes";
import { type QuestionView } from "@/components/RegistrationForm";
import EventRegistration from "@/components/EventRegistration";
import MetaPixelScript from "@/components/MetaPixelScript";

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

  const [professionOptions, metaConnection, orgSettings, checkoutQuestions, ticketTypes] = await Promise.all([
    getOrderedProfessionOptions(),
    db.metaConnection.findFirst({ orderBy: { createdAt: "desc" }, select: { pixelId: true } }),
    getOrgSettings(),
    getCheckoutQuestions(),
    getPublicTicketTypes(event.id),
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
  const eventVenue = [event.venueName, event.venueAddress].filter(Boolean).join(" — ");

  return (
    // .event-page: 480px column on mobile (unchanged — already optimized,
    // see globals.css) widening to a real two-column layout with a sticky
    // sidebar (see EventRegistration.tsx's own comment) past ~900px,
    // closer to how established ticketing platforms' own event pages read
    // on desktop instead of the same narrow mobile column just centered
    // on a wide screen.
    <main className="event-page">
      <MetaPixelScript pixelId={metaConnection?.pixelId ?? null} />

      {event.imageUrl && (
        // eslint-disable-next-line @next/next/no-img-element -- admin-uploaded Blob URL, not a build-time-known asset
        <img src={event.imageUrl} alt={event.name} className="event-page-hero" />
      )}

      <h1 style={{ marginTop: 4 }}>{event.name}</h1>
      {eventWhen && (
        <p className="event-page-meta">
          🕐 {eventWhen}
        </p>
      )}
      {eventVenue && (
        <p className="event-page-meta">
          📍 {eventVenue}
        </p>
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
          supportEmail={orgSettings.replyToEmail}
          descriptionHtml={event.description}
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
