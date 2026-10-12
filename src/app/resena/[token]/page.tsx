import type { Metadata } from "next";
import { getOrgSettings } from "@/lib/settings";
import { formatDateInTz } from "@/lib/dateFormat";
import { publicEventName } from "@/lib/eventDisplayName";
import { reviewEligibilityForToken } from "@/lib/reviews";
import { viewerCanSeeSamples } from "@/lib/reviewsViewer";
import ReviewForm from "./ReviewForm";
import ReviewThanks from "./ReviewThanks";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Tu reseña · Nail Fest", robots: { index: false, follow: false } };

// /resena/<token> — the personal review link (see lib/reviews.ts). The
// token is the registration's signed qrToken, the same one the ticket
// link carries, so the WhatsApp "Ver mi entrada" button mechanism and the
// {{LINK_RESENA}} email tag both reach here with no login.
//
// ?vista=formulario | ?vista=gracias: for a logged-in ADMIN/COORDINADOR
// only, renders that state whatever the registration's real one, with a
// banner, so the team can see the page as an attendee does. The form in
// that mode sends nothing (ReviewForm `preview`).
export default async function ReviewPage({ params, searchParams }: { params: { token: string }; searchParams: { vista?: string } }) {
  const [eligibility, orgSettings] = await Promise.all([reviewEligibilityForToken(params.token), getOrgSettings()]);
  const wanted = searchParams.vista === "formulario" || searchParams.vista === "gracias" ? searchParams.vista : null;
  const preview = wanted && (await viewerCanSeeSamples()) ? wanted : null;

  if (!eligibility.ok) {
    const text =
      eligibility.reason === "not_attended"
        ? "Las reseñas son solo para quienes entraron al evento con su entrada escaneada. Si fuiste y ves este mensaje, escríbenos por WhatsApp y lo revisamos."
        : eligibility.reason === "not_confirmed"
          ? "Tu inscripción no aparece confirmada, así que todavía no puedes dejar una reseña."
          : "Este enlace no es válido. Abre el enlace exactamente como te llegó por WhatsApp o correo.";
    return (
      <main style={{ maxWidth: 480, margin: "0 auto", padding: "40px 20px" }}>
        <h1 style={{ fontSize: 22 }}>Tu reseña</h1>
        <p style={{ color: "#5b5f6b", lineHeight: 1.5 }}>{text}</p>
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
          <a href={`/admin/events/${eligibility.event.id}/resenas`} style={{ color: "#fff", fontWeight: 700 }}>
            Volver al admin
          </a>
        </div>
        {preview === "gracias" ? (
          <ReviewThanks
            firstName={eligibility.person.firstName ?? ""}
            eventName={eventName}
            token={params.token}
            raffleOptIn={eligibility.existing?.raffleOptIn ?? Boolean(raffle?.open)}
            raffle={raffle}
            hasPhoto={eligibility.existing ? eligibility.existing.photos.length > 0 : true}
          />
        ) : (
          <ReviewForm token={params.token} firstName={eligibility.person.firstName ?? ""} eventName={eventName} raffle={raffle} preview />
        )}
      </>
    );
  }

  if (eligibility.existing) {
    return (
      <ReviewThanks
        firstName={eligibility.person.firstName ?? ""}
        eventName={eventName}
        token={params.token}
        raffleOptIn={eligibility.existing.raffleOptIn}
        raffle={raffle}
        hasPhoto={eligibility.existing.photos.length > 0}
      />
    );
  }

  return <ReviewForm token={params.token} firstName={eligibility.person.firstName ?? ""} eventName={eventName} raffle={raffle} />;
}
