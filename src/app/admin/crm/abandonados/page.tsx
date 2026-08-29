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

  const [abandoned, stillFilling] = await Promise.all([
    db.registration.findMany({
      where: { status: "STARTED", createdAt: { lt: cutoff } },
      orderBy: { createdAt: "desc" },
      take: 200,
      include: { person: true, event: true, ticketType: true },
    }),
    db.registration.count({ where: { status: "STARTED", createdAt: { gte: cutoff } } }),
  ]);

  return (
    <div>
      <CrmPageHeader
        title={`Carritos abandonados (${abandoned.length})`}
        subtitle={`Alguien llegó a escribir su correo en el formulario de registro pero nunca lo envió — ${ABANDONED_AFTER_MINUTES} minutos o más sin completar. No incluye a quien está llenando el formulario ahora mismo.`}
      />

      <div style={{ display: "flex", gap: 16, flexWrap: "wrap", marginBottom: 24 }}>
        <StatCard label="Abandonados" value={String(abandoned.length)} />
        <StatCard label="Llenando el formulario ahora" value={String(stillFilling)} />
      </div>

      {/* Deliberately no "recuperar" / send-reminder button here. Estas
          personas nunca llegaron al envío real del formulario, que es
          donde vive hoy TODO el consentimiento (logística, marketing y
          publicidad quedan implícitos en esa acción — ver
          RegistrationForm.tsx). No autorizaron nada todavía, así que la
          Ley 1581 (habeas data) no permite tratarlos como si lo hubieran
          hecho. Esta lista es para que un humano decida manualmente si
          vale la pena contactarlos por un canal fuera de este flujo de
          consentimiento automático — no es un botón de "enviar correo de
          recuperación" automatizado. */}
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
