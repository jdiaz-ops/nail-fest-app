import { db } from "@/lib/db";
import { StatCard, Section, EmptyNote } from "../../../StatsUI";
import LiveRefresh from "./LiveRefresh";

export const dynamic = "force-dynamic";

// El equivalente virtual del panel en vivo del escáner de puerta
// (/admin/scan) — mientras el evento está pasando, no un reporte para
// después. Lee directo de ZoomAttendanceLog, que el webhook
// /api/webhooks/zoom llena en tiempo real. Vacío hasta que: (a) el
// evento sea VIRTUAL/HYBRID con un zoomMeetingId configurado, y (b) la
// suscripción de eventos de Zoom (Feature -> Event Subscriptions) esté
// activa apuntando a ese webhook — ver docs/PAYMENTS_SETUP.md.
export default async function LiveVirtualPage({ params }: { params: { id: string } }) {
  const [connectedNow, uniqueJoinedGroups, totalJoins, event] = await Promise.all([
    db.zoomAttendanceLog.findMany({
      where: { eventId: params.id, leftAt: null },
      orderBy: { joinedAt: "asc" },
      include: { registration: { include: { person: true } } },
    }),
    db.zoomAttendanceLog.groupBy({ by: ["registrationId", "participantEmail"], where: { eventId: params.id } }),
    db.zoomAttendanceLog.count({ where: { eventId: params.id } }),
    db.event.findUnique({ where: { id: params.id }, select: { zoomMeetingId: true, format: true } }),
  ]);

  const uniquePeople = uniqueJoinedGroups.length;

  if (!event?.zoomMeetingId) {
    return (
      <div>
        <LiveRefresh />
        <h2 style={{ fontSize: 18, marginTop: 0 }}>En vivo (Zoom)</h2>
        <EmptyNote text="Este evento todavía no tiene un ID de reunión de Zoom configurado (Editar evento → Acceso virtual) — sin eso no hay nada que mostrar aquí." />
      </div>
    );
  }

  return (
    <div>
      <LiveRefresh />
      <h2 style={{ fontSize: 18, marginTop: 0 }}>En vivo (Zoom)</h2>
      <p style={{ fontSize: 13, color: "#5b5f6b", marginTop: 0 }}>
        Se actualiza solo cada 15 segundos mientras esta página esté abierta — no hace falta recargar.
      </p>

      <div style={{ display: "flex", gap: 16, flexWrap: "wrap", marginBottom: 24 }}>
        <StatCard label="Conectados ahora" value={String(connectedNow.length)} />
        <StatCard label="Personas distintas que han entrado" value={String(uniquePeople)} />
        <StatCard label="Conexiones totales (incluye reingresos)" value={String(totalJoins)} />
      </div>

      <Section title="Quién está conectado ahora mismo" note="Se cierra la fila apenas la persona sale de la reunión (o se cae la conexión).">
        {connectedNow.length === 0 ? (
          <EmptyNote text="Nadie conectado en este momento." />
        ) : (
          <div className="admin-table-wrap" style={{ border: "1px solid #e3e1dc", borderRadius: 10 }}>
            <table style={{ borderCollapse: "collapse", fontSize: 14, width: "100%" }}>
              <thead>
                <tr style={{ textAlign: "left", background: "#faf9f7" }}>
                  <th style={{ padding: "8px 12px" }}>Nombre</th>
                  <th style={{ padding: "8px 12px" }}>Correo</th>
                  <th style={{ padding: "8px 12px" }}>Conectado desde</th>
                </tr>
              </thead>
              <tbody>
                {connectedNow.map((row) => (
                  <tr key={row.id} style={{ borderTop: "1px solid #f0efec" }}>
                    <td style={{ padding: "8px 12px", fontWeight: 500 }}>
                      {[row.registration?.person.firstName, row.registration?.person.lastName].filter(Boolean).join(" ") || "—"}
                    </td>
                    <td style={{ padding: "8px 12px", color: "#5b5f6b" }}>{row.participantEmail ?? "—"}</td>
                    <td style={{ padding: "8px 12px", color: "#5b5f6b" }}>
                      {row.joinedAt.toLocaleTimeString("es-CO", { hour: "2-digit", minute: "2-digit" })}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Section>
    </div>
  );
}
