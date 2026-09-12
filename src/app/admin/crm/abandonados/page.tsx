import { db } from "@/lib/db";
import CrmPageHeader from "../CrmPageHeader";
import StatCard from "../StatCard";

export const dynamic = "force-dynamic";

// A draft only counts as genuinely "abandoned" once enough time has passed
// that they're unlikely to just be mid-form right now — otherwise this
// list would show literally everyone currently filling out the form. Real
// threshold, not a placeholder; revisit with real data once there's a
// sense of how long people actually take.
const ABANDONED_AFTER_MINUTES = 20;

export default async function AbandonedCartsPage() {
  const cutoff = new Date(Date.now() - ABANDONED_AFTER_MINUTES * 60_000);

  const [abandoned, stillFilling, email1Sent, email2Sent, remindedCount, remindedThenConfirmed] = await Promise.all([
    db.registration.findMany({
      where: { status: "STARTED", createdAt: { lt: cutoff } },
      orderBy: { createdAt: "desc" },
      take: 200,
      include: { person: true, event: true, ticketType: true },
    }),
    db.registration.count({ where: { status: "STARTED", createdAt: { gte: cutoff } } }),
    db.registration.count({ where: { cartEmail1SentAt: { not: null } } }),
    db.registration.count({ where: { cartEmail2SentAt: { not: null } } }),
    // Denominator for the conversion stat below: everyone who ever got at
    // least the first reminder — not everyone who ever abandoned, since
    // someone who converts inside the first 15 minutes never gets one at
    // all, and counting them would understate how well the reminders work.
    db.registration.count({ where: { cartEmail1SentAt: { not: null } } }),
    db.registration.count({ where: { cartEmail1SentAt: { not: null }, status: "CONFIRMED" } }),
  ]);
  const reminderConversionRate = remindedCount > 0 ? Math.round((remindedThenConfirmed / remindedCount) * 100) : 0;

  return (
    <div>
      <CrmPageHeader
        title={`Carritos abandonados (${abandoned.length})`}
        subtitle={`Alguien llegó a escribir su correo en el formulario de registro pero nunca lo envió — ${ABANDONED_AFTER_MINUTES} minutos o más sin completar. No incluye a quien está llenando el formulario ahora mismo.`}
      />

      <div style={{ display: "flex", gap: 16, flexWrap: "wrap", marginBottom: 24 }}>
        <StatCard label="Abandonados" value={String(abandoned.length)} />
        <StatCard label="Llenando el formulario ahora" value={String(stillFilling)} />
        <StatCard label="Correo de 15 min enviado" value={String(email1Sent)} />
        <StatCard label="Correo de 2h enviado" value={String(email2Sent)} />
        <StatCard label="Confirmaron tras recordatorio" value={`${reminderConversionRate}%`} sub={`de ${remindedCount} que recibieron el primer correo`} />
      </div>

      {/* COMPLIANCE NOTE — this comment used to say this list was
          deliberately passive: someone who abandons the form never gave
          any real consent (Ley 1581/habeas data), so nothing here should
          treat them as if they had. That reasoning still holds for
          WhatsApp — there is still no automated WhatsApp send to anyone
          on this list. It no longer holds for email: there is now an
          automated send (see lib/abandonedCart.ts), exactly 2 reminders
          (~15 min and ~2h after they type their email), explicitly
          requested by the business with that specific cap after the same
          consent question was raised and discussed. The position taken:
          continuing an interaction the PERSON THEMSELVES already started
          (they typed their email intending to register) is treated as
          different from marketing to a purchased list — but it rests on
          the same Ley 1581 ground this comment used to flag as
          insufficient for WhatsApp, so this is a real, open compliance
          question worth a genuine legal review, not a settled one. */}
      <div className="admin-table-wrap" style={{ border: "1px solid #e3e1dc", borderRadius: 10 }}>
        <table style={{ borderCollapse: "collapse", fontSize: 14 }}>
          <thead>
            <tr style={{ textAlign: "left", background: "#faf9f7" }}>
              <th style={{ padding: "10px 12px" }}>Correo</th>
              <th style={{ padding: "10px 12px" }}>Nombre</th>
              <th style={{ padding: "10px 12px" }}>Evento</th>
              <th style={{ padding: "10px 12px" }}>Tipo de entrada</th>
              <th style={{ padding: "10px 12px" }}>Fuente</th>
              <th style={{ padding: "10px 12px" }}>Iniciado</th>
            </tr>
          </thead>
          <tbody>
            {abandoned.map((r) => (
              <tr key={r.id} style={{ borderTop: "1px solid #f0efec" }}>
                <td style={{ padding: "10px 12px", fontWeight: 600 }}>{r.person.email}</td>
                <td style={{ padding: "10px 12px" }}>
                  {[r.person.firstName, r.person.lastName].filter(Boolean).join(" ") || "—"}
                </td>
                <td style={{ padding: "10px 12px" }}>{r.event.name}</td>
                <td style={{ padding: "10px 12px", color: "#5b5f6b" }}>{r.ticketType?.name ?? "—"}</td>
                <td style={{ padding: "10px 12px", color: "#5b5f6b" }}>{r.utmSource ?? "orgánico"}</td>
                <td style={{ padding: "10px 12px", color: "#5b5f6b" }}>
                  {r.createdAt.toLocaleString("es-CO", { dateStyle: "medium", timeStyle: "short" })}
                </td>
              </tr>
            ))}
            {abandoned.length === 0 && (
              <tr>
                <td colSpan={6} style={{ padding: "10px 12px", color: "#5b5f6b" }}>
                  Ningún carrito abandonado por ahora.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
