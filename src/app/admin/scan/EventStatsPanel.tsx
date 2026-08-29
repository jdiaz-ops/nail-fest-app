import { db } from "@/lib/db";

// The Dashboard tab's content, admin-only — see [eventId]/page.tsx, which
// redirects STAFF straight to Escanear instead of rendering this at all.
// Real numbers only, straight from the same tables the rest of the CRM
// reads — no separate/approximated counters.

const RESULT_LABEL: Record<string, string> = {
  VALID_FIRST: "Entrada válida",
  VALID_REENTRY: "Reingreso",
  WRONG_EVENT: "Boleto de otro evento",
  INVALID_TOKEN: "Código inválido",
  NOT_FOUND: "No existe",
};

export default async function EventStatsPanel({ eventId }: { eventId: string }) {
  const [event, ticketAgg, byTicketType, checkedInAgg, scanCounts, recentScans, abandonedCount] = await Promise.all([
    db.event.findUnique({ where: { id: eventId } }),
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
    db.registration.count({ where: { eventId, status: "STARTED" } }),
  ]);

  if (!event) return null;

  const issued = ticketAgg._sum.ticketCount ?? 0;
  const checkedIn = checkedInAgg._sum.checkedInCount ?? 0;
  const remaining = event.capacity != null ? Math.max(0, event.capacity - issued) : null;
  const checkInRate = issued > 0 ? Math.round((checkedIn / issued) * 100) : 0;
  const scansByResult = new Map(scanCounts.map((s) => [s.result, s._count._all]));

  return (
    <div>
      <div style={{ display: "flex", gap: 16, flexWrap: "wrap", marginBottom: 24 }}>
        <StatCard label="Boletas emitidas" value={String(issued)} sub={event.capacity != null ? `de ${event.capacity} cupos` : undefined} />
        <StatCard label="Escaneadas (entraron)" value={String(checkedIn)} sub={`${checkInRate}% de las emitidas`} />
        <StatCard label="Restantes" value={remaining != null ? String(remaining) : "—"} />
        <StatCard label="Carritos abandonados" value={String(abandonedCount)} />
      </div>

      {byTicketType.length > 0 && (
        <>
          <h2 style={{ fontSize: 15 }}>Por tipo de entrada</h2>
          <div style={{ border: "1px solid #e3e1dc", borderRadius: 10, overflow: "hidden", marginBottom: 24 }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
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

      <h2 style={{ fontSize: 15 }}>Escaneos en la puerta</h2>
      <p style={{ fontSize: 12, color: "#5b5f6b", marginTop: -8 }}>
        {(["VALID_FIRST", "VALID_REENTRY", "WRONG_EVENT", "INVALID_TOKEN", "NOT_FOUND"] as const)
          .map((r) => `${RESULT_LABEL[r]}: ${scansByResult.get(r) ?? 0}`)
          .join(" · ")}
      </p>
      <div style={{ border: "1px solid #e3e1dc", borderRadius: 10, overflow: "hidden" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
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
        en la puerta.
      </p>
    </div>
  );
}

function StatCard({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div style={{ border: "1px solid #e3e1dc", borderRadius: 10, padding: "14px 16px", minWidth: 140, flex: "1 1 140px" }}>
      <div style={{ fontSize: 11, color: "#5b5f6b", textTransform: "uppercase", letterSpacing: "0.04em" }}>{label}</div>
      <div style={{ fontSize: 22, fontWeight: 700, marginTop: 4 }}>{value}</div>
      {sub && <div style={{ fontSize: 12, color: "#5b5f6b", marginTop: 2 }}>{sub}</div>}
    </div>
  );
}
