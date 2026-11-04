import type { Metadata } from "next";
import type { Event } from "@prisma/client";
import { fraunces800and900 as fraunces } from "@/fonts";
import { db } from "@/lib/db";
import { getOrgSettings } from "@/lib/settings";
import { formatDateInTz } from "@/lib/dateFormat";
import { publicEventName } from "@/lib/eventDisplayName";
import { reviewEligibilityForToken } from "@/lib/reviews";
import { fillReviewText, getReviewPageTexts, type ReviewPageTexts } from "@/lib/reviewPageTexts";
import { viewerCanSeeSamples } from "@/lib/reviewsViewer";
import { congressTimes, dayWords, readRecordings } from "@/lib/imparables/grabaciones";
import { congresoRegistrationId, congresoSampleEventId } from "@/lib/imparables/miCongreso";
import { IMPARABLES_REVIEW_TEXTS, reviewNotYet, starsFrom } from "@/lib/imparables/resena";
import { coverName } from "@/lib/imparables/schedule";
import { cinzel, manrope } from "@/components/imparables/fonts";
import { ImpLogo } from "@/components/imparables/ImpArt";
import ReviewForm from "./ReviewForm";
import ReviewThanks from "./ReviewThanks";
import ReviewHero from "./ReviewHero";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Tu reseña · Nail Fest", robots: { index: false, follow: false } };

// /resena/<token> — the personal review link (see lib/reviews.ts). The
// token is the registration's signed qrToken, the same one the ticket
// link carries, so the WhatsApp "Ver mi entrada" button mechanism and the
// {{LINK_RESENA}} email tag both reach here with no login. Every line of
// copy comes from lib/reviewPageTexts.ts (edited at /admin/resenas/textos).
//
// ?vista=formulario | ?vista=gracias: for a logged-in ADMIN/COORDINADOR
// only, renders that state whatever the registration's real one, with a
// banner, so the team can see the page as an attendee does. The form in
// that mode sends nothing (ReviewForm `preview`).
//
// Manicuristas Imparables (2026-11-04, lib/imparables/resena.ts): the same
// page in the congress's colors and faces (globals.css .rv-imp), a few lines
// said for a virtual congress, no Instagram card; ?estrellas=1…5 (the closing
// email's stars) starts the form rated; and the team's sample link (the
// event's signed «muestra», from its closing email's sample and «Después del
// pago») shows the form — or ?vista=gracias, the thanks — with sample data,
// sending nothing, for anyone who has it.
export default async function ReviewPage({ params, searchParams }: { params: { token: string }; searchParams: { vista?: string; estrellas?: string } }) {
  const [orgSettings, rawTexts] = await Promise.all([getOrgSettings(), getReviewPageTexts()]);
  const initialRating = starsFrom(searchParams.estrellas);

  // The congress's colors around whatever the page shows for its event.
  const themed = (event: Pick<Event, "theme"> | null | undefined, page: React.ReactNode) =>
    event?.theme === "IMPARABLES" ? <div className={`rv-imp ${cinzel.variable} ${manrope.variable}`}>{page}</div> : page;
  const textsFor = (event: Pick<Event, "theme"> | null | undefined, vars: Record<string, string | null>) => {
    const raw = event?.theme === "IMPARABLES" ? { ...rawTexts, ...IMPARABLES_REVIEW_TEXTS } : rawTexts;
    return Object.fromEntries(Object.entries(raw).map(([k, v]) => [k, fillReviewText(v, vars)])) as ReviewPageTexts;
  };

  // The congress's name as its cover says it: «Manicuristas Imparables», without the day its admin name carries.
  const nameOf = (event: Event) => (event.theme === "IMPARABLES" ? coverName(publicEventName(event)) : publicEventName(event));
  // Its own mark in the header, in place of Nail Fest's (the team, 2026-11-04).
  const logoOf = (event: Event | null | undefined) => {
    if (event?.theme !== "IMPARABLES") return undefined;
    const words = nameOf(event).split(/\s+/);
    const big = words.pop() ?? "";
    return <ImpLogo pre={words.join(" ")} big={big} className="rv-imp-logo" />;
  };

  const sampleEventId = (() => {
    const id = congresoRegistrationId(params.token);
    return id ? congresoSampleEventId(id) : null;
  })();
  if (sampleEventId) {
    const event = await db.event.findUnique({ where: { id: sampleEventId } });
    if (event?.theme === "IMPARABLES") {
      const texts = textsFor(event, { nombre: "Laura", evento: nameOf(event), premios: "", fecha: "" });
      const brand = { brandName: orgSettings.name, displayClassName: cinzel.className, eventImageUrl: event.imageUrl ?? null, logo: logoOf(event) };
      return themed(
        event,
        searchParams.vista === "gracias" ? (
          <ReviewThanks {...brand} texts={texts} token={params.token} raffleOptIn={false} raffle={null} hasPhoto={false} instagramCard={false} />
        ) : (
          <ReviewForm {...brand} texts={texts} token={params.token} raffle={null} preview initialRating={initialRating} />
        )
      );
    }
  }

  const eligibility = await reviewEligibilityForToken(params.token);
  const wanted = searchParams.vista === "formulario" || searchParams.vista === "gracias" ? searchParams.vista : null;
  const preview = wanted && (await viewerCanSeeSamples()) ? wanted : null;

  if (!eligibility.ok) {
    let text = eligibility.reason === "not_attended" ? rawTexts.notAttended : eligibility.reason === "not_confirmed" ? rawTexts.notConfirmed : rawTexts.invalidLink;
    if (eligibility.reason === "not_yet" && eligibility.event) {
      text = reviewNotYet(dayWords(congressTimes(eligibility.event, readRecordings(eligibility.event.recordings), orgSettings.timezone).lastDay));
    }
    const imp = eligibility.event?.theme === "IMPARABLES";
    return themed(
      eligibility.event,
      <div className="rv-page">
        <ReviewHero brandName={orgSettings.name} eyebrow={rawTexts.formEyebrow} imageUrl={imp ? (eligibility.event?.imageUrl ?? null) : null} logo={logoOf(eligibility.event)}>
          <h1 className={`rv-title ${imp ? cinzel.className : fraunces.className}`}>Tu reseña</h1>
          <p className="rv-intro">{text}</p>
        </ReviewHero>
      </div>
    );
  }

  const event = eligibility.event;
  const imp = event.theme === "IMPARABLES";
  const eventName = nameOf(event);
  const raffle = eligibility.raffle
    ? {
        prizeCount: eligibility.raffle.prizeCount,
        prizeLabel: eligibility.raffle.prizeLabel,
        closesLabel: formatDateInTz(eligibility.raffle.closesAt, { day: "numeric", month: "long" }, orgSettings.timezone, orgSettings.language),
        open: eligibility.raffle.open,
      }
    : null;
  // The placeholders filled for this attendee, once, server-side.
  const texts = textsFor(event, { nombre: eligibility.person.firstName, evento: eventName, premios: raffle ? `${raffle.prizeCount} ${raffle.prizeLabel}` : "", fecha: raffle?.closesLabel ?? "" });
  const brand = { brandName: orgSettings.name, displayClassName: imp ? cinzel.className : fraunces.className, eventImageUrl: event.imageUrl ?? null, logo: logoOf(event) };

  if (preview) {
    const base = `/resena/${encodeURIComponent(params.token)}`;
    const tab = (vista: "formulario" | "gracias", label: string) => (
      <a href={`${base}?vista=${vista}`} style={{ padding: "5px 10px", borderRadius: 999, background: preview === vista ? "#fff" : "transparent", color: preview === vista ? "#0b2e2c" : "#fff", textDecoration: "none", fontWeight: 700 }}>
        {label}
      </a>
    );
    return themed(
      event,
      <>
        <div style={{ background: "#0b2e2c", color: "#fff", padding: "10px 16px", display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap", fontSize: 12.5 }}>
          <span style={{ fontWeight: 800 }}>Vista previa del equipo</span>
          <span style={{ opacity: 0.85 }}>Así la ve la asistente. Aquí no se envía nada.</span>
          <span style={{ display: "flex", gap: 4, marginLeft: "auto", background: "rgba(255,255,255,0.14)", borderRadius: 999, padding: 3 }}>
            {tab("formulario", "Formulario")}
            {tab("gracias", "Gracias")}
          </span>
          <a href="/admin/resenas/textos" style={{ color: "#fff", fontWeight: 700 }}>
            Editar los textos
          </a>
          <a href={`/admin/events/${event.id}/resenas`} style={{ color: "#fff", fontWeight: 700 }}>
            Volver al admin
          </a>
        </div>
        {preview === "gracias" ? (
          <ReviewThanks
            {...brand}
            texts={texts}
            token={params.token}
            raffleOptIn={eligibility.existing?.raffleOptIn ?? Boolean(raffle?.open)}
            raffle={raffle}
            hasPhoto={eligibility.existing ? eligibility.existing.photos.length > 0 : true}
            instagramCard={!imp}
          />
        ) : (
          <ReviewForm {...brand} texts={texts} token={params.token} raffle={raffle} preview initialRating={initialRating} />
        )}
      </>
    );
  }

  if (eligibility.existing) {
    return themed(
      event,
      <ReviewThanks
        {...brand}
        texts={texts}
        token={params.token}
        raffleOptIn={eligibility.existing.raffleOptIn}
        raffle={raffle}
        hasPhoto={eligibility.existing.photos.length > 0}
        instagramCard={!imp}
      />
    );
  }

  return themed(event, <ReviewForm {...brand} texts={texts} token={params.token} raffle={raffle} initialRating={initialRating} />);
}
