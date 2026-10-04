import { db } from "@/lib/db";
import { forecastAttendance, SEGMENT_LABELS, type ForecastRegistration } from "@/lib/attendanceForecast";
import { Section, EmptyNote, StatCard } from "../StatsUI";

// "¿Cuánta gente va a llegar?" — see lib/attendanceForecast.ts for the
// method. Lives on the event's report page: for an upcoming event it's
// the door forecast with today's registrations; for a past event it shows
// what the forecast would have said next to what really happened.

const fmt = (n: number) => Math.round(n).toLocaleString("es-CO");
const pct = (n: number) => `${Math.round(n * 100)}%`;
// An event counts as "done" a day after it ends — so a Sunday-night scan
// session finishes before its numbers become someone else's history.
const doneAt = (e: { startsAt: Date; endsAt: Date | null }) => (e.endsAt ?? e.startsAt).getTime() + 24 * 60 * 60 * 1000;

function cedulaFrom(customFields: unknown): string | null {
  if (!customFields || typeof customFields !== "object" || Array.isArray(customFields)) return null;
  const raw = (customFields as Record<string, unknown>).cedula;
  const digits = typeof raw === "string" ? raw.replace(/\D/g, "").replace(/^0+/, "") : "";
  // Too short to be a real document number — a typo like "0" or "123"
  // would otherwise link strangers together.
  return digits.length >= 5 ? digits : null;
}

export default async function AttendanceForecastSection({ eventId }: { eventId: string }) {
  const now = Date.now();
  const [target, events, doorTotals] = await Promise.all([
    db.event.findUnique({ where: { id: eventId }, select: { id: true, format: true, startsAt: true, endsAt: true } }),
    // Virtual events are left out entirely — "attending" a Zoom isn't the
    // same behavior as showing up at a venue.
    db.event.findMany({ where: { format: { not: "VIRTUAL" } }, select: { id: true, name: true, startsAt: true, endsAt: true } }),
    db.registration.groupBy({ by: ["eventId"], where: { status: "CONFIRMED", checkedInCount: { gt: 0 } }, _sum: { checkedInCount: true } }),
  ]);
  if (!target || target.format === "VIRTUAL") return null;

  const scannedByEvent = new Map(doorTotals.map((d) => [d.eventId, d._sum.checkedInCount ?? 0]));
  // History = finished in-person events that actually have door data.
  const historyEventIds = events.filter((e) => e.id !== eventId && doneAt(e) < now && (scannedByEvent.get(e.id) ?? 0) > 0).map((e) => e.id);
  const targetIsPast = doneAt(target) < now && (scannedByEvent.get(eventId) ?? 0) > 0;

  const title = targetIsPast ? "Pronóstico de asistencia vs. lo que pasó" : "Pronóstico de asistencia";
  if (historyEventIds.length === 0) {
    return (
      <Section title={title} note="Cuánta gente llegaría a puerta, aprendido de eventos anteriores.">
        <EmptyNote text="Todavía no hay eventos pasados con datos de puerta (escaneos o asistencia importada) para aprender." />
      </Section>
    );
  }

  const rows = await db.registration.findMany({
    where: { status: "CONFIRMED", eventId: { in: [...historyEventIds, eventId] } },
    select: { eventId: true, personId: true, ticketCount: true, checkedInCount: true, attendanceIntent: true, customFields: true },
  });
  const registrations: ForecastRegistration[] = rows.map((r) => ({
    eventId: r.eventId,
    personId: r.personId,
    cedula: cedulaFrom(r.customFields),
    ticketCount: Math.max(1, r.ticketCount),
    checkedInCount: r.checkedInCount,
    intent: r.attendanceIntent,
  }));

  const result = forecastAttendance({ events, registrations, historyEventIds, targetEventId: eventId });
  const { forecast, margin, backtest, historyEvents } = result;

  if (forecast.registrations === 0) {
    return (
      <Section title={title} note="Cuánta gente llegaría a puerta, aprendido de eventos anteriores.">
        <EmptyNote text="Aún no hay inscripciones confirmadas para pronosticar." />
      </Section>
    );
  }

  const expectedRate = forecast.tickets > 0 ? forecast.expectedTickets / forecast.tickets : 0;
  const rangeSub =
    margin != null
      ? `entre ${fmt(forecast.expectedTickets * (1 - margin))} y ${fmt(forecast.expectedTickets * (1 + margin))} · margen histórico ±${pct(margin)}`
      : "sin margen todavía — hace falta más de un evento pasado para medirlo";
  const actual = targetIsPast ? (scannedByEvent.get(eventId) ?? 0) : null;
  // Someone here answered «Sí voy»/«No puedo» but no past event has
  // answers yet — say so, since those rows fall back to the general rate.
  const intentNoHistory = forecast.rows.some((r) => !r.key.endsWith(":none") && r.registrations > 0 && r.rate.historyRegistrations === 0);
  const cell: React.CSSProperties = { padding: "7px 12px", borderTop: "1px solid #f0efec" };
  const num: React.CSSProperties = { ...cell, textAlign: "right", fontVariantNumeric: "tabular-nums", whiteSpace: "nowrap" };

  return (
    <Section
      title={title}
      note={`${
        targetIsPast ? "Lo que el modelo habría pronosticado antes del evento, al lado de lo que realmente llegó" : "Cuánta gente llegaría a puerta con los inscritos de hoy"
      } — aprendido de ${historyEvents.length} ${historyEvents.length === 1 ? "evento anterior" : "eventos anteriores"} (${historyEvents.map((e) => e.name).join(", ")}). Cada inscrito pesa según si ya asistió antes y lo que respondió al «¿vienes?».`}
    >
      <div style={{ display: "flex", gap: 16, flexWrap: "wrap", marginBottom: 14 }}>
        <StatCard label="Entradas emitidas" value={fmt(forecast.tickets)} sub={`${fmt(forecast.registrations)} inscripciones`} />
        <StatCard label={targetIsPast ? "Pronóstico (entradas)" : "Llegarían a puerta"} value={`≈ ${fmt(forecast.expectedTickets)}`} sub={rangeSub} />
        {actual != null ? (
          <StatCard
            label="Llegaron de verdad"
            value={fmt(actual)}
            sub={`${forecast.expectedTickets >= actual ? "+" : "−"}${pct(Math.abs(forecast.expectedTickets - actual) / Math.max(1, actual))} de diferencia`}
          />
        ) : (
          <StatCard label="Personas distintas" value={`≈ ${fmt(forecast.expectedPeople)}`} sub="sin contar acompañantes" />
        )}
        <StatCard label="Tasa esperada" value={pct(expectedRate)} sub="de las entradas emitidas" />
      </div>

      <div className="admin-table-wrap" style={{ border: "1px solid #e3e1dc", borderRadius: 10, marginBottom: 12 }}>
        <table style={{ borderCollapse: "collapse", fontSize: 13, width: "100%" }}>
          <thead>
            <tr style={{ textAlign: "left", background: "#faf9f7" }}>
              <th style={{ padding: "8px 12px" }}>De dónde sale</th>
              <th style={{ padding: "8px 12px", textAlign: "right" }}>Inscritos</th>
              <th style={{ padding: "8px 12px", textAlign: "right" }}>Entradas</th>
              <th style={{ padding: "8px 12px", textAlign: "right" }}>Prob. de llegar</th>
              <th style={{ padding: "8px 12px", textAlign: "right" }}>Esperadas</th>
            </tr>
          </thead>
          <tbody>
            {forecast.rows
              .filter((r) => r.registrations > 0)
              .map((r) => (
                <tr key={r.key}>
                  <td style={cell}>
                    {SEGMENT_LABELS[r.key]}
                    {r.rate.historyRegistrations === 0 ? (
                      <span style={{ marginLeft: 8, fontSize: 11, color: "#b25e00" }}>sin historia — usa la tasa general del grupo</span>
                    ) : r.rate.historyRegistrations < 30 ? (
                      <span style={{ marginLeft: 8, fontSize: 11, color: "#b25e00" }}>poca historia ({r.rate.historyRegistrations})</span>
                    ) : null}
                  </td>
                  <td style={num}>{fmt(r.registrations)}</td>
                  <td style={num}>{fmt(r.tickets)}</td>
                  <td style={num}>{pct(r.rate.ticketRate)}</td>
                  <td style={{ ...num, fontWeight: 600 }}>{fmt(r.expectedTickets)}</td>
                </tr>
              ))}
            <tr style={{ background: "#faf9f7", fontWeight: 700 }}>
              <td style={cell}>Total</td>
              <td style={num}>{fmt(forecast.registrations)}</td>
              <td style={num}>{fmt(forecast.tickets)}</td>
              <td style={num}>{pct(expectedRate)}</td>
              <td style={num}>{fmt(forecast.expectedTickets)}</td>
            </tr>
          </tbody>
        </table>
      </div>

      {backtest.length > 0 && (
        <>
          <h3 style={{ fontSize: 13, margin: "16px 0 4px" }}>¿Qué tan bien acierta?</h3>
          <p style={{ fontSize: 12, color: "#5b5f6b", margin: "0 0 8px" }}>
            Cada evento pasado pronosticado solo con los demás, como si todavía no hubiera pasado, comparado con lo que llegó.
          </p>
          <div className="admin-table-wrap" style={{ border: "1px solid #e3e1dc", borderRadius: 10, marginBottom: 12 }}>
            <table style={{ borderCollapse: "collapse", fontSize: 13, width: "100%" }}>
              <thead>
                <tr style={{ textAlign: "left", background: "#faf9f7" }}>
                  <th style={{ padding: "8px 12px" }}>Evento</th>
                  <th style={{ padding: "8px 12px", textAlign: "right" }}>Entradas</th>
                  <th style={{ padding: "8px 12px", textAlign: "right" }}>Pronóstico</th>
                  <th style={{ padding: "8px 12px", textAlign: "right" }}>Llegaron</th>
                  <th style={{ padding: "8px 12px", textAlign: "right" }}>Diferencia</th>
                </tr>
              </thead>
              <tbody>
                {backtest.map((b) => (
                  <tr key={b.eventId}>
                    <td style={cell}>{b.name}</td>
                    <td style={num}>{fmt(b.tickets)}</td>
                    <td style={num}>{fmt(b.predictedTickets)}</td>
                    <td style={num}>{fmt(b.actualTickets)}</td>
                    <td style={{ ...num, color: Math.abs(b.error) <= 0.1 ? "#12966b" : Math.abs(b.error) <= 0.2 ? "#b25e00" : "#c2185b" }}>
                      {b.error >= 0 ? "+" : "−"}
                      {pct(Math.abs(b.error))}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      <p style={{ fontSize: 12, color: "#5b5f6b", margin: 0 }}>
        Se cuenta en entradas: una inscripción con acompañante son 2. «Ya asistió antes» une a la misma persona por correo o
        cédula.
        {intentNoHistory &&
          " Los eventos pasados todavía no tienen respuestas al «¿vienes?», así que «Sí voy» y «No puedo» usan la tasa general hasta que haya historia."}
        {!targetIsPast && " Con los inscritos de hoy — el número sube a medida que entra más gente."}
      </p>
    </Section>
  );
}
