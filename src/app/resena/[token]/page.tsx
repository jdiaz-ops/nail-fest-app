import type { Metadata } from "next";
import { Fraunces } from "next/font/google";
import { getOrgSettings } from "@/lib/settings";
import { formatDateInTz } from "@/lib/dateFormat";
import { publicEventName } from "@/lib/eventDisplayName";
import { reviewEligibilityForToken } from "@/lib/reviews";
import { fillReviewText, getReviewPageTexts, type ReviewPageTexts } from "@/lib/reviewPageTexts";
import { viewerCanSeeSamples } from "@/lib/reviewsViewer";
import ReviewForm from "./ReviewForm";
import ReviewThanks from "./ReviewThanks";
import ReviewPageHeader from "./ReviewPageHeader";

const fraunces = Fraunces({ subsets: ["latin"], weight: ["800", "900"] });

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
export default async function ReviewPage({ params, searchParams }: { params: { token: string }; searchParams: { vista?: string } }) {
  const [eligibility, orgSettings, rawTexts] = await Promise.all([reviewEligibilityForToken(params.token), getOrgSettings(), getReviewPageTexts()]);
  const wanted = searchParams.vista === "formulario" || searchParams.vista === "gracias" ? searchParams.vista : null;
  const preview = wanted && (await viewerCanSeeSamples()) ? wanted : null;
  const brand = { brandName: orgSettings.name, displayClassName: fraunces.className };

  if (!eligibility.ok) {
    const text = eligibility.reason === "not_attended" ? rawTexts.notAttended : eligibility.reason === "not_confirmed" ? rawTexts.notConfirmed : rawTexts.invalidLink;
    return (
      <main style={{ maxWidth: 480, margin: "0 auto", padding: "18px 20px 48px", display: "flex", flexDirection: "column", gap: 14 }}>
        <ReviewPageHeader {...brand} eyebrow={rawTexts.formEyebrow} />
        <h1 className={fraunces.className} style={{ margin: "10px 0 0", fontSize: 28, lineHeight: 1.1, fontWeight: 800, letterSpacing: "-0.02em" }}>
          Tu reseña
        </h1>
        <p style={{ margin: 0, color: "#5b5f6b", lineHeight: 1.5 }}>{text}</p>
      </main>
    );
  }

  const eventName = publicEventName(eligibility.event);
  const raffle = eligibility.raffle
    ? {
        prizeCount: eligibility.raffle.prizeCount,
        prizeLabel: eligibility.raffle.prizeLabel,
        closesLabel: formatDateInTz(eligibility.raffle.closesAt, { day: "numeric", month: "long" }, orgSettings.timezone, orgSettings.language),
        open: eligibility.raffle.open,
      }
    : null;
  // The placeholders filled for this attendee, once, server-side.
  const vars = { nombre: eligibility.person.firstName, evento: eventName, premios: raffle ? `${raffle.prizeCount} ${raffle.prizeLabel}` : "", fecha: raffle?.closesLabel ?? "" };
  const texts = Object.fromEntries(Object.entries(rawTexts).map(([k, v]) => [k, fillReviewText(v, vars)])) as ReviewPageTexts;
  const firstName = eligibility.person.firstName ?? "";

  if (preview) {
    const base = `/resena/${encodeURIComponent(params.token)}`;
    const tab = (vista: "formulario" | "gracias", label: string) => (
      <a href={`${base}?vista=${vista}`} style={{ padding: "5px 10px", borderRadius: 999, background: preview === vista ? "#fff" : "transparent", color: preview === vista ? "#0b2e2c" : "#fff", textDecoration: "none", fontWeight: 700 }}>
        {label}
      </a>
    );
    return (
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
          <a href={`/admin/events/${eligibility.event.id}/resenas`} style={{ color: "#fff", fontWeight: 700 }}>
            Volver al admin
          </a>
        </div>
        {preview === "gracias" ? (
          <ReviewThanks {...brand} texts={texts} eventName={eventName} token={params.token} raffleOptIn={eligibility.existing?.raffleOptIn ?? Boolean(raffle?.open)} raffle={raffle} hasPhoto={eligibility.existing ? eligibility.existing.photos.length > 0 : true} />
        ) : (
          <ReviewForm {...brand} texts={texts} token={params.token} firstName={firstName} eventName={eventName} raffle={raffle} preview />
        )}
      </>
    );
  }

  if (eligibility.existing) {
    return <ReviewThanks {...brand} texts={texts} eventName={eventName} token={params.token} raffleOptIn={eligibility.existing.raffleOptIn} raffle={raffle} hasPhoto={eligibility.existing.photos.length > 0} />;
  }

  return <ReviewForm {...brand} texts={texts} token={params.token} firstName={firstName} eventName={eventName} raffle={raffle} />;
}
