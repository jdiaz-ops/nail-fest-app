import type { Metadata } from "next";
import { getOrgSettings } from "@/lib/settings";
import { formatDateInTz } from "@/lib/dateFormat";
import { publicEventName } from "@/lib/eventDisplayName";
import { reviewEligibilityForToken } from "@/lib/reviews";
import ReviewForm from "./ReviewForm";
import ReviewThanks from "./ReviewThanks";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Tu reseña · Nail Fest", robots: { index: false, follow: false } };

// /resena/<token> — the personal review link (see lib/reviews.ts). The
// token is the registration's signed qrToken, the same one the ticket
// link carries, so the WhatsApp "Ver mi entrada" button mechanism and the
// {{LINK_RESENA}} email tag both reach here with no login.
export default async function ReviewPage({ params }: { params: { token: string } }) {
  const [eligibility, orgSettings] = await Promise.all([reviewEligibilityForToken(params.token), getOrgSettings()]);

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
