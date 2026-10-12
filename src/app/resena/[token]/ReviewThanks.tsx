import Link from "next/link";

// What an attendee sees once their review is in (or when they reopen the
// link later): the reward, the raffle status and their Instagram card.
export default function ReviewThanks({
  firstName,
  eventName,
  token,
  raffleOptIn,
  raffle,
  hasPhoto,
}: {
  firstName: string;
  eventName: string;
  token: string;
  raffleOptIn: boolean;
  raffle: { prizeCount: number; prizeLabel: string; closesLabel: string; open: boolean } | null;
  hasPhoto: boolean;
}) {
  return (
    <main style={{ maxWidth: 480, margin: "0 auto", padding: "32px 20px 48px", display: "flex", flexDirection: "column", gap: 16 }}>
      <div style={{ width: 56, height: 56, borderRadius: "50%", background: "var(--accent)", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <svg aria-hidden="true" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#0b2e2c" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6 9 17l-5-5" /></svg>
      </div>
      <h1 style={{ fontSize: 30, lineHeight: 1.1, margin: 0 }}>{firstName ? `¡Gracias, ${firstName}!` : "¡Gracias!"}</h1>
      <p style={{ margin: 0, color: "#5b5f6b", lineHeight: 1.5 }}>
        Tu reseña quedó registrada con el sello <strong style={{ color: "var(--ink)" }}>Asistió a {eventName}</strong>. La revisamos y la publicamos en los próximos días.
      </p>

      <section style={{ background: "#fff", border: "1px solid var(--border)", borderRadius: 14, padding: "14px 16px", display: "flex", flexDirection: "column", gap: 4 }}>
        <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase", color: "var(--link)" }}>Tu recompensa</div>
        <div style={{ fontSize: 15, fontWeight: 800 }}>Acceso anticipado a la próxima edición</div>
        <p style={{ margin: 0, fontSize: 13, color: "#5b5f6b", lineHeight: 1.45 }}>Te avisamos por WhatsApp antes de abrir las inscripciones al público, para que tengas tu cupo asegurado.</p>
      </section>

      {raffle && (
        <section style={{ background: "#fff", border: "1px solid var(--border)", borderRadius: 14, padding: "14px 16px", display: "flex", flexDirection: "column", gap: 4 }}>
          <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase", color: "var(--link)" }}>Sorteo · {eventName}</div>
          <div style={{ fontSize: 15, fontWeight: 800 }}>{raffleOptIn ? "Estás participando" : "No estás participando"}</div>
          <p style={{ margin: 0, fontSize: 13, color: "#5b5f6b", lineHeight: 1.45 }}>
            {raffle.prizeCount} {raffle.prizeLabel} entre las reseñas recibidas hasta el {raffle.closesLabel}. Las ganadoras se anuncian por WhatsApp e Instagram.
          </p>
        </section>
      )}

      <section style={{ background: "var(--accent-secondary)", borderRadius: 14, padding: "14px 16px", display: "flex", flexDirection: "column", gap: 8 }}>
        <div style={{ fontSize: 15, fontWeight: 800, color: "#1c1310" }}>Comparte tu reseña en Instagram</div>
        <p style={{ margin: 0, fontSize: 13, color: "#1c1310", opacity: 0.85, lineHeight: 1.4 }}>
          {hasPhoto ? "Tarjeta lista para tu historia, con tu foto, tu @ y tu calificación." : "Tarjeta lista para tu historia, con tu @ y tu calificación."}
        </p>
        <a href={`/api/resenas/${encodeURIComponent(token)}/tarjeta`} style={{ alignSelf: "flex-start", display: "inline-flex", alignItems: "center", height: 40, padding: "0 14px", borderRadius: 10, background: "#1c1310", color: "#fff", fontSize: 13, fontWeight: 700, textDecoration: "none" }}>
          Descargar tarjeta
        </a>
      </section>

      <Link href="/" style={{ textAlign: "center", fontSize: 13, fontWeight: 700 }}>
        Volver a nailfest.lat
      </Link>
    </main>
  );
}
