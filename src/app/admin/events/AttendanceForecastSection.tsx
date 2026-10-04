import { SEGMENT_LABELS } from "@/lib/attendanceForecast";
import type { ForecastData } from "@/lib/eventReportData";
import { Section, EmptyNote } from "../StatsUI";

// "¿Cuánta gente va a llegar?" — the detail behind the report's
// "Llegarían a puerta" summary card: which groups the forecast is made of
// (see lib/attendanceForecast.ts for the method, lib/eventReportData.ts for
// the loading). The headline numbers live in the summary row above, not
// repeated here.

const fmt = (n: number) => Math.round(n).toLocaleString("es-CO");
const pct = (n: number) => `${Math.round(n * 100)}%`;

export default function AttendanceForecastSection({ data }: { data: ForecastData | null }) {
  if (!data) return null;
  const title = data.status === "ok" && data.targetIsPast ? "Pronóstico de asistencia (antes del evento)" : "Pronóstico de asistencia";
  if (data.status === "no_history") {
    return (
      <Section title={title} note="Cuánta gente llegaría a puerta, aprendido de eventos anteriores.">
        <EmptyNote text="Todavía no hay eventos pasados con datos de puerta (escaneos o asistencia importada) para aprender." />
      </Section>
    );
  }
  if (data.status === "no_registrations") {
    return (
      <Section title={title} note="Cuánta gente llegaría a puerta, aprendido de eventos anteriores.">
        <EmptyNote text="Aún no hay inscripciones confirmadas para pronosticar." />
      </Section>
    );
  }
  const { result, targetIsPast } = data;
  const { forecast, historyEvents } = result;

  const expectedRate = forecast.tickets > 0 ? forecast.expectedTickets / forecast.tickets : 0;
  // Someone here answered «Sí voy»/«No puedo» but no past event has
  // answers yet — say so, since those rows fall back to the general rate.
  const intentNoHistory = forecast.rows.some((r) => !r.key.endsWith(":none") && r.registrations > 0 && r.rate.historyRegistrations === 0);
  const cell: React.CSSProperties = { padding: "7px 12px", borderTop: "1px solid #f0efec" };
  const num: React.CSSProperties = { ...cell, textAlign: "right", fontVariantNumeric: "tabular-nums", whiteSpace: "nowrap" };

  return (
    <Section
      title={title}
      note={`${targetIsPast ? "Lo que el modelo pronosticaba antes del evento" : "Cuánta gente llegaría a puerta con los inscritos de hoy"}, por grupo — aprendido de ${historyEvents.length} ${
        historyEvents.length === 1 ? "evento anterior" : "eventos anteriores"
      }. Cada inscrito pesa según si ya asistió antes y lo que respondió al «¿vienes?».`}
    >
      <div className="admin-table-wrap" style={{ border: "1px solid #e3e1dc", borderRadius: 10, marginBottom: 12 }}>
        <table className="forecast-table" style={{ borderCollapse: "collapse", fontSize: 13, width: "100%" }}>
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
