import { db } from "@/lib/db";
import { getOrgSettings } from "@/lib/settings";
import { formatDateInTz } from "@/lib/dateFormat";
import { bucketHours } from "@/lib/eventStatsHelpers";
import { Section, EmptyNote, ScrollBox, BarList, StatCard } from "../StatsUI";

// The Dashboard tab's content, admin-only — see [eventId]/page.tsx, which
// redirects STAFF straight to Escanear instead of rendering this at all.
// Real numbers only, straight from the same tables the rest of the CRM
// reads — no separate/approximated counters.
//
// Deliberately OPERATIONAL only — numbers an admin checks live, parked at
// the door, the day of the event: check-in progress, hourly traffic,
// re-entries, the raw scan log. Planning numbers (growth curve, where
// registrations come from, sales funnel, audience) live instead in
// src/app/admin/events/EventDecisionStats.tsx, on the event's own admin
// page — those are pre/post-event decisions, not something you'd check
// standing in line at the door. See that file's own comment; this split
// was an explicit ask, not an oversight duplicating half the old panel.

const RESULT_LABEL: Record<string, string> = {
  VALID_FIRST: "Entrada válida",
  VALID_REENTRY: "Reingreso",
  WRONG_EVENT: "Boleto de otro evento",
  INVALID_TOKEN: "Código inválido",
  NOT_FOUND: "No existe",
};

export default async function EventStatsPanel({ eventId }: { eventId: string }) {
  const [event, orgSettings, ticketAgg, byTicketType, checkedInAgg, scanCounts, recentScans, checkInScans] = await Promise.all([
    db.event.findUnique({ where: { id: eventId } }),
    getOrgSettings(),
    db.registration.aggregate({ where: { eventId, status: "CONFIRMED" }, _sum: { ticketCount: true } }),
    db.ticketType.findMany({
      where: { eventId },
      orderBy: { order: "asc" },
      include: {
        registrations: { where: { status: "CONFIRMED" }, select: { ticketCount: true, checkedInCount: true } },
      },
    }),
    db.registration.aggregate({ where: { eventId, status: "CONFIRMED" }, _sum: { checkedInCount: true } }),
    db.scanLog.groupBy({ by: ["result"], where: { scannedForEventId: eventId }, _count: { _all: true } }),
    db.scanLog.findMany({
      where: { scannedForEventId: eventId },
      orderBy: { scannedAt: "desc" },
      take: 20,
      include: { registration: { include: { person: true } } },
    }),
    // Backs the hour-of-day breakdown — both first entries and re-entries
    // count as real door traffic for staffing purposes, so both are
    // included (unlike the reentry stat card below, which cares about
    // re-entries specifically).
    db.scanLog.findMany({
      where: { scannedForEventId: eventId, result: { in: ["VALID_FIRST", "VALID_REENTRY"] } },
      select: { scannedAt: true },
    }),
  ]);

  if (!event) return null;

  const { timezone, language } = orgSettings;

  const issued = ticketAgg._sum.ticketCount ?? 0;
  const checkedIn = checkedInAgg._sum.checkedInCount ?? 0;
  const checkInRate = issued > 0 ? Math.round((checkedIn / issued) * 100) : 0;
  const scansByResult = new Map(scanCounts.map((s) => [s.result, s._count._all]));

  // Reingresos — cuánta gente sale y vuelve a entrar. Alto = probablemente
  // hay food trucks/zona de fumadores afuera y conviene una fila rápida de
  // reingreso en la puerta; casi cero = la gente entra y se queda.
  const reentryCount = scansByResult.get("VALID_REENTRY") ?? 0;
  const reentryRate = checkedIn > 0 ? Math.round((reentryCount / checkedIn) * 100) : 0;

  // Check-ins por franja horaria — cuándo llega la gente el día del
  // evento, para saber si hace falta abrir puertas antes o poner más
  // personal escaneando a cierta hora.
  const hourBuckets = bucketHours(
    checkInScans.map((s) => s.scannedAt),
    timezone
  );
  const hourRows = hourBuckets.map((h) => ({
    label: formatDateInTz(new Date(`${h.key}:00:00Z`), { day: "2-digit", month: "short", hour: "2-digit" }, timezone, language),
    count: h.count,
  }));
  const hourMax = Math.max(1, ...hourRows.map((h) => h.count));

  return (
    <div>
      <div style={{ display: "flex", gap: 16, flexWrap: "wrap", marginBottom: 24 }}>
        <StatCard label="Escaneadas (entraron)" value={String(checkedIn)} sub={`${checkInRate}% de las emitidas`} />
        <StatCard label="Reingresos" value={String(reentryCount)} sub={checkedIn > 0 ? `${reentryRate} por cada 100 entradas` : undefined} />
      </div>

      {byTicketType.length > 0 && (
        <>
          <h2 style={{ fontSize: 15 }}>Por tipo de entrada</h2>
          <div className="admin-table-wrap" style={{ border: "1px solid #e3e1dc", borderRadius: 10, marginBottom: 24 }}>
            <table style={{ borderCollapse: "collapse", fontSize: 13 }}>
              <thead>
                <tr style={{ textAlign: "left", background: "#faf9f7" }}>
                  <th style={{ padding: "8px 12px" }}>Tipo</th>
                  <th style={{ padding: "8px 12px" }}>Emitidas</th>
                  <th style={{ padding: "8px 12px" }}>Escaneadas</th>
                </tr>
              </thead>
              <tbody>
                {byTicketType.map((tt) => {
                  const emitted = tt.registrations.reduce((sum, r) => sum + r.ticketCount, 0);
                  const scanned = tt.registrations.reduce((sum, r) => sum + r.checkedInCount, 0);
                  return (
                    <tr key={tt.id} style={{ borderTop: "1px solid #f0efec" }}>
                      <td style={{ padding: "8px 12px" }}>{tt.name}</td>
                      <td style={{ padding: "8px 12px" }}>{emitted}</td>
                      <td style={{ padding: "8px 12px" }}>{scanned}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </>
      )}

      <Section title="Check-ins por franja horaria" note="Para decidir si hace falta abrir puertas antes o poner más personal escaneando a cierta hora. Incluye entradas y reingresos.">
        {hourRows.length === 0 ? (
          <EmptyNote text="Aún no hay escaneos válidos para este evento." />
        ) : (
          <ScrollBox>
            <BarList rows={hourRows} max={hourMax} />
          </ScrollBox>
        )}
      </Section>

      <h2 style={{ fontSize: 15 }}>Escaneos en la puerta</h2>
      <p style={{ fontSize: 12, color: "#5b5f6b", marginTop: -8 }}>
        {(["VALID_FIRST", "VALID_REENTRY", "WRONG_EVENT", "INVALID_TOKEN", "NOT_FOUND"] as const)
          .map((r) => `${RESULT_LABEL[r]}: ${scansByResult.get(r) ?? 0}`)
          .join(" · ")}
      </p>
      <div className="admin-table-wrap" style={{ border: "1px solid #e3e1dc", borderRadius: 10 }}>
        <table style={{ borderCollapse: "collapse", fontSize: 13 }}>
          <thead>
            <tr style={{ textAlign: "left", background: "#faf9f7" }}>
              <th style={{ padding: "8px 12px" }}>Hora</th>
              <th style={{ padding: "8px 12px" }}>Resultado</th>
              <th style={{ padding: "8px 12px" }}>Persona</th>
              <th style={{ padding: "8px 12px" }}>Dispositivo</th>
            </tr>
          </thead>
          <tbody>
            {recentScans.map((s) => (
              <tr key={s.id} style={{ borderTop: "1px solid #f0efec" }}>
                <td style={{ padding: "8px 12px", color: "#5b5f6b" }}>
                  {s.scannedAt.toLocaleTimeString("es-CO", { hour: "2-digit", minute: "2-digit" })}
                </td>
                <td style={{ padding: "8px 12px" }}>{RESULT_LABEL[s.result] ?? s.result}</td>
                <td style={{ padding: "8px 12px" }}>
                  {s.registration
                    ? [s.registration.person.firstName, s.registration.person.lastName].filter(Boolean).join(" ") ||
                      s.registration.person.email
                    : "—"}
                </td>
                <td style={{ padding: "8px 12px", color: "#5b5f6b" }}>{s.scannerLabel ?? "—"}</td>
              </tr>
            ))}
            {recentScans.length === 0 && (
              <tr>
                <td colSpan={4} style={{ padding: "8px 12px", color: "#5b5f6b" }}>
                  Aún no hay escaneos para este evento.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <p style={{ marginTop: 24, fontSize: 12, color: "#5b5f6b" }}>
        Respaldo de emergencia — si el celular o la app fallan por completo (no solo la conexión):{" "}
        <a href={`/api/admin/scan/export?eventId=${eventId}`}>descargar lista en CSV</a> para verificar manualmente
        en la puerta. ¿Buscas boletas emitidas, restantes, carritos abandonados, de dónde vienen las inscripciones,
        ciudad o profesión? Eso ahora vive en la página del evento en <strong>Eventos</strong>, no aquí — son
        números para decidir antes/después del evento, no para consultar parado en la puerta.
      </p>
    </div>
  );
}
