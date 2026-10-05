import { formatDateInTz } from "@/lib/dateFormat";
import type { ForecastData, VelocityData } from "@/lib/eventReportData";
import {
  doorPattern,
  etaLabel,
  goalStatus,
  logistics,
  previousEdition,
  pushTiming,
  scenarios,
  weeklyMomentum,
  type Light,
  type Scenario,
} from "@/lib/eventDecisions";
import { Section, EmptyNote } from "../StatsUI";
import GoalsForm from "@/components/GoalsForm";

// The decision blocks of the event report — each one ends in an action,
// not a number: ¿vamos a llegar? (meta), ¿a qué nos parecemos? (escenarios),
// ¿cuándo empujar? (timing), ¿esta semana va bien? (momentum), ¿cuánto
// preparar? (logística). Methods in lib/eventDecisions.ts.

const fmt = (n: number) => Math.round(n).toLocaleString("es-CO");
const fmtRate = (n: number) => (n >= 10 ? fmt(n) : (Math.round(n * 10) / 10).toLocaleString("es-CO"));
const pct = (n: number) => `${Math.round(n * 100)} %`;
const LIGHT: Record<Light, { icon: string; color: string; bg: string }> = {
  green: { icon: "🟢", color: "#12966b", bg: "#eaf7f1" },
  yellow: { icon: "🟡", color: "#b25e00", bg: "#fff6e5" },
  red: { icon: "🔴", color: "#c2185b", bg: "#fdecf2" },
};
const cell: React.CSSProperties = { padding: "7px 12px", borderTop: "1px solid #f0efec" };
const num: React.CSSProperties = { ...cell, textAlign: "right", fontVariantNumeric: "tabular-nums", whiteSpace: "nowrap" };
const th: React.CSSProperties = { padding: "8px 12px", textAlign: "right" };

function Table({ head, children }: { head: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="admin-table-wrap" style={{ border: "1px solid #e3e1dc", borderRadius: 10, marginBottom: 10 }}>
      <table className="forecast-table" style={{ borderCollapse: "collapse", fontSize: 13, width: "100%" }}>
        <thead>
          <tr style={{ textAlign: "left", background: "#faf9f7" }}>{head}</tr>
        </thead>
        <tbody>{children}</tbody>
      </table>
    </div>
  );
}

function Verdict({ light, children }: { light: Light; children: React.ReactNode }) {
  return (
    <div style={{ background: LIGHT[light].bg, borderRadius: 10, padding: "12px 14px", fontSize: 14, marginBottom: 10, lineHeight: 1.5 }}>
      <span style={{ marginRight: 6 }}>{LIGHT[light].icon}</span>
      {children}
    </div>
  );
}

export default function DecisionSections({
  velocityData,
  forecastData,
  issued,
  uniqueRegs,
  timezone,
  language,
  briefingEmails,
}: {
  velocityData: VelocityData | null;
  forecastData: ForecastData | null;
  issued: number;
  uniqueRegs: number;
  timezone: string;
  language: string;
  briefingEmails: string[];
}) {
  if (!velocityData || !velocityData.targetIsUpcoming) return null;
  const { result: v, target, pastEvents } = velocityData;
  const now = new Date();
  const forecast = forecastData?.status === "ok" ? forecastData.result : null;
  const expectedTickets = forecast?.forecast.expectedTickets ?? null;
  const attendanceShare = forecast && forecast.forecast.tickets > 0 ? forecast.forecast.expectedTickets / forecast.forecast.tickets : null;
  const ticketsPerReg = uniqueRegs > 0 ? issued / uniqueRegs : 1;
  const compById = new Map(v.comparisons.map((c) => [c.curve.id, c]));

  // ── Meta ──
  const regGoal = target.goalRegistrations ? goalStatus(target.goalRegistrations, v.current, v.daysBefore, v.rhythm7) : null;
  // Door goal → how many registrations that takes at the expected rate.
  const doorGoalAsRegs = target.goalAttendance && attendanceShare && attendanceShare > 0 ? target.goalAttendance / attendanceShare / ticketsPerReg : null;
  const doorGoal = target.goalAttendance && doorGoalAsRegs ? goalStatus(Math.round(doorGoalAsRegs), v.current, v.daysBefore, v.rhythm7) : null;

  // ── Escenarios ──
  const scenarioInputs = pastEvents
    .filter((p) => compById.has(p.id))
    .map((p) => {
      const c = compById.get(p.id)!;
      return { id: p.id, name: p.name, city: p.city, total: c.curve.total, shareAtSameDaysBefore: c.curve.total > 0 ? c.atSameDaysBefore / c.curve.total : 0, attendanceRate: p.attendanceRate, atSameDaysBefore: c.atSameDaysBefore, startsAt: p.startsAt };
    });
  const scen = scenarios(v.current, ticketsPerReg, scenarioInputs, target.referenceEventId);
  const prev = previousEdition({ city: target.city, current: v.current }, scenarioInputs);

  // ── Timing / momentum ──
  const pastCurves = v.comparisons.map((c) => c.curve);
  const timing = pushTiming(pastCurves);
  const weeks = weeklyMomentum(v.target, v.daysBefore, pastCurves);

  // ── Logística ──
  const eventDays = Math.max(1, Math.round(((target.endsAt ?? target.startsAt).getTime() - target.startsAt.getTime()) / 86400000) + 1);
  const dayLabels = Array.from({ length: eventDays }, (_, i) => {
    const d = new Date(target.startsAt.getTime() + i * 86400000);
    const s = formatDateInTz(d, { weekday: "long" }, timezone, language);
    return s.charAt(0).toUpperCase() + s.slice(1);
  });
  const pattern = velocityData.doorRows.length > 0 ? doorPattern(velocityData.doorRows) : null;
  const logi =
    expectedTickets != null && forecast
      ? logistics({ expectedTickets, margin: forecast.margin, expectedPeople: forecast.forecast.expectedPeople, companionTickets: Math.max(0, issued - uniqueRegs), pattern, dayLabels })
      : null;

  const roleLabel: Record<Scenario["role"], string> = { low: "bajo", base: "base ★", high: "alto", other: "" };
  const eventDateLabel = formatDateInTz(target.startsAt, { day: "numeric", month: "long" }, timezone, language);

  return (
    <>
      <GoalsForm
        eventId={target.id}
        goalRegistrations={target.goalRegistrations}
        goalAttendance={target.goalAttendance}
        referenceEventId={target.referenceEventId}
        referenceOptions={pastEvents.filter((p) => compById.has(p.id)).map((p) => ({ id: p.id, name: p.name }))}
        briefingEmails={briefingEmails}
      />

      <Section title="¿Vamos a llegar?" note="Tu meta contra el ritmo real de los últimos 7 días. Verde = a este ritmo llegas antes del evento; amarillo = te falta hasta un 15 %; rojo = no alcanza.">
        {!regGoal && !doorGoal ? (
          <EmptyNote text="Pon una meta arriba (inscritos o personas en puerta) y aquí te digo si el ritmo alcanza, cuánto necesitas por día y qué día llegarías." />
        ) : (
          <>
            {regGoal && (
              <Verdict light={regGoal.light}>
                <strong>Meta {fmt(regGoal.goal)} inscritos</strong> · llevas {fmt(regGoal.current)} ({pct(regGoal.progress)}) · faltan {fmt(regGoal.remaining)}.
                {regGoal.remaining === 0 ? (
                  <> ¡Meta cumplida! Todo lo que entre de aquí al {eventDateLabel} es ganancia — revisa que la logística aguante (abajo).</>
                ) : regGoal.requiredPerDay != null ? (
                  <>
                    {" "}
                    Necesitas <strong>{fmtRate(regGoal.requiredPerDay)}/día</strong>; vas a <strong>{fmtRate(regGoal.currentPerDay)}/día</strong>.
                    {regGoal.etaDays != null && regGoal.etaMarginDays != null && regGoal.etaMarginDays >= 0 ? (
                      <>
                        {" "}
                        A este ritmo llegas el <strong>{etaLabel(now, regGoal.etaDays, timezone, language)}</strong>, {regGoal.etaMarginDays} días antes del evento.
                        {regGoal.light === "green" && " → Puedes mover presupuesto de awareness a retargeting o subir la meta."}
                      </>
                    ) : regGoal.etaDays != null ? (
                      <>
                        {" "}
                        A este ritmo llegarías {Math.abs(regGoal.etaMarginDays!)} días <strong>después</strong> del evento → hace falta subir el ritmo un{" "}
                        {pct(regGoal.requiredPerDay / Math.max(1, regGoal.currentPerDay) - 1)}: más pauta, un envío a la base anterior, o bajar la meta.
                      </>
                    ) : (
                      <> Sin inscripciones esta semana — revisa si la pauta está activa.</>
                    )}
                    {timing && regGoal.light !== "green" && timing.shareLast14 > 0.25 && (
                      <> Ojo: en tus eventos el {pct(timing.shareLast14)} entra en los últimos 14 días, así que el ritmo de hoy subestima el final.</>
                    )}
                  </>
                ) : null}
              </Verdict>
            )}
            {doorGoal && target.goalAttendance && (
              <Verdict light={doorGoal.light}>
                <strong>Meta {fmt(target.goalAttendance)} en puerta</strong> · con la tasa esperada ({attendanceShare ? pct(attendanceShare) : "—"} de las entradas) eso son ~
                {fmt(doorGoal.goal)} inscritos.{" "}
                {doorGoal.remaining === 0
                  ? "Ya los tienes."
                  : doorGoal.etaDays != null && doorGoal.etaMarginDays != null && doorGoal.etaMarginDays >= 0
                    ? `A este ritmo los tienes el ${etaLabel(now, doorGoal.etaDays, timezone, language)}.`
                    : `Faltan ${fmt(doorGoal.remaining)} inscritos y el ritmo no alcanza — o subes inscritos, o subes la tasa de llegada (recordatorios, encuesta «¿vienes?»).`}
              </Verdict>
            )}
          </>
        )}
      </Section>

      <Section
        title="Escenarios: ¿a qué evento nos parecemos?"
        note="Si Cúcuta sigue la forma de cada evento anterior desde este mismo punto. Elige arriba el de referencia; sin elegir, el base es el del medio."
      >
        {scen.length === 0 ? (
          <EmptyNote text="Todavía no hay eventos anteriores comparables en este punto." />
        ) : (
          <Table
            head={
              <>
                <th style={{ padding: "8px 12px" }}>Si se comporta como…</th>
                <th style={th}>Inscritos finales</th>
                <th style={th}>Entradas</th>
                <th style={th}>En puerta</th>
              </>
            }
          >
            {scen.map((s) => (
              <tr key={s.id} style={s.role === "base" ? { background: "#eaf7f1", fontWeight: 700 } : undefined}>
                <td style={cell}>
                  {s.name}
                  {s.role !== "other" && <span style={{ marginLeft: 8, fontSize: 11, color: "#5b5f6b", fontWeight: 400 }}>{roleLabel[s.role]}</span>}
                </td>
                <td style={num}>~{fmt(s.finalRegistrations)}</td>
                <td style={num}>~{fmt(s.finalTickets)}</td>
                <td style={num}>{s.atDoor != null ? `~${fmt(s.atDoor)}` : "—"}</td>
              </tr>
            ))}
          </Table>
        )}
        {prev && (
          <p style={{ fontSize: 13, margin: "0 0 4px" }}>
            <strong>Edición anterior en {target.city}:</strong> {prev.name} cerró con {fmt(prev.total)} inscritos y a {v.daysBefore} días llevaba {fmt(prev.atSameDaysBefore)} — hoy vas{" "}
            {prev.diffAtSamePoint != null ? (
              <strong style={{ color: prev.diffAtSamePoint >= 0 ? "#12966b" : "#c2185b" }}>
                {prev.diffAtSamePoint >= 0 ? "+" : "−"}
                {pct(Math.abs(prev.diffAtSamePoint))}
              </strong>
            ) : (
              "—"
            )}{" "}
            frente a ese punto.
          </p>
        )}
        <p style={{ fontSize: 12, color: "#5b5f6b", margin: 0 }}>
          Para logística, planea con el <strong>base</strong> y ten margen para el <strong>alto</strong>; para pauta, el <strong>bajo</strong> es el que te dice cuánto riesgo hay.
        </p>
      </Section>

      <Section title="¿Cuándo empujar?" note="Lo que pasó en tus eventos anteriores, puesto sobre los días que faltan para este.">
        {!timing ? (
          <EmptyNote text="Hace falta al menos un evento anterior con 3+ semanas de inscripciones." />
        ) : (
          <>
            <PushTimeline daysBefore={v.daysBefore} timing={timing} eventDateLabel={eventDateLabel} />
            <p style={{ fontSize: 13, margin: "8px 0 0", lineHeight: 1.5 }}>
              En {timing.events} eventos anteriores, el <strong>{pct(timing.shareLast14)}</strong> de los inscritos entró en los últimos 14 días y el{" "}
              <strong>{pct(timing.shareLast7)}</strong> en la última semana (el {pct(timing.shareEventDay)} el mismo día del evento).
              {timing.reboundDaysBefore != null && (
                <>
                  {" "}
                  El ritmo toca fondo y empieza a repuntar alrededor de <strong>{Math.round(timing.reboundDaysBefore)} días antes</strong>
                  {v.daysBefore > timing.reboundDaysBefore
                    ? ` — para este evento, en ${Math.round(v.daysBefore - timing.reboundDaysBefore)} días.`
                    : " — ya estás en la zona de repunte."}
                </>
              )}{" "}
              <strong>Sugerido:</strong> reserva ~{pct(timing.shareLast14)} del presupuesto de pauta y el envío más fuerte (WhatsApp + correo) para los últimos 14 días; una
              semana floja antes de eso es normal, no una alarma.
            </p>
          </>
        )}
      </Section>

      <Section title="Semana contra semana" note="Inscritos por semana desde la apertura, frente a la mediana de los otros eventos en su misma semana. La curva acumulada esconde una semana floja; esto no.">
        {weeks.length === 0 ? (
          <EmptyNote text="Aún no hay una semana completa." />
        ) : (
          <Table
            head={
              <>
                <th style={{ padding: "8px 12px" }}>Semana</th>
                <th style={th}>Este evento</th>
                <th style={th}>Otros (mediana)</th>
                <th style={th}>Diferencia</th>
              </>
            }
          >
            {weeks.map((w) => (
              <tr key={w.week}>
                <td style={cell}>
                  Semana {w.week}
                  {w.targetDays < 7 && <span style={{ marginLeft: 6, fontSize: 11, color: "#5b5f6b" }}>(en curso, {w.targetDays} {w.targetDays === 1 ? "día" : "días"})</span>}
                </td>
                <td style={{ ...num, fontWeight: 600 }}>{fmt(w.target)}</td>
                <td style={num}>{w.othersMedian != null ? fmt(w.othersMedian) : "—"}</td>
                <td style={{ ...num, color: w.diff == null ? "#5b5f6b" : w.diff >= 0 ? "#12966b" : "#c2185b", fontWeight: 600 }}>
                  {w.diff == null ? (w.targetDays < 7 ? "esperar" : "—") : `${w.diff >= 0 ? "▲ +" : "▼ −"}${pct(Math.abs(w.diff))}`}
                </td>
              </tr>
            ))}
          </Table>
        )}
      </Section>

      <Section title="Logística de puerta" note="El pronóstico de asistencia traducido a cosas que se compran y se programan.">
        {!logi ? (
          <EmptyNote text="Sin pronóstico de asistencia todavía (hace falta un evento anterior con datos de puerta)." />
        ) : (
          <Table
            head={
              <>
                <th style={{ padding: "8px 12px" }}>Qué</th>
                <th style={th}>Cuánto</th>
                <th style={{ padding: "8px 12px" }}>Por qué</th>
              </>
            }
          >
            <tr>
              <td style={cell}>Entradas esperadas en puerta</td>
              <td style={{ ...num, fontWeight: 700 }}>≈ {fmt(logi.expectedTickets)}</td>
              <td style={{ ...cell, color: "#5b5f6b" }}>hasta ~{fmt(logi.highTickets)} en el escenario alto · ≈ {fmt(logi.expectedPeople)} personas distintas</td>
            </tr>
            <tr>
              <td style={cell}>Kits / bolsas a pedir</td>
              <td style={{ ...num, fontWeight: 700 }}>{fmt(logi.bagsToOrder)}</td>
              <td style={{ ...cell, color: "#5b5f6b" }}>escenario alto redondeado a 50 — quedarse corto cuesta más que sobrar</td>
            </tr>
            {logi.perDay ? (
              logi.perDay.map((d) => (
                <tr key={d.label}>
                  <td style={cell}>{d.label}</td>
                  <td style={num}>≈ {fmt(d.tickets)}</td>
                  <td style={{ ...cell, color: "#5b5f6b" }}>reparto por día según {logi.patternEvents} {logi.patternEvents === 1 ? "evento escaneado" : "eventos escaneados"} con la app</td>
                </tr>
              ))
            ) : (
              <tr>
                <td style={cell}>Reparto {dayLabels.join(" / ")}</td>
                <td style={num}>—</td>
                <td style={{ ...cell, color: "#5b5f6b" }}>sale del primer evento escaneado con la app (las listas importadas no traen hora)</td>
              </tr>
            )}
            {logi.peakHours.length > 0 && (
              <tr>
                <td style={cell}>Hora pico de entrada</td>
                <td style={num}>{logi.peakHours[0]!.label}</td>
                <td style={{ ...cell, color: "#5b5f6b" }}>
                  {pct(logi.peakHours[0]!.share)} de las entradas{logi.peakHours[1] && `; luego ${logi.peakHours[1].label} (${pct(logi.peakHours[1].share)})`} → refuerza puertas y personal ahí
                </td>
              </tr>
            )}
            <tr>
              <td style={cell}>Acompañantes (+1)</td>
              <td style={num}>{fmt(logi.companionTickets)}</td>
              <td style={{ ...cell, color: "#5b5f6b" }}>entradas de acompañante entre los inscritos de hoy — las que menos llegan; un recordatorio dirigido a ellos sube la tasa</td>
            </tr>
          </Table>
        )}
      </Section>
    </>
  );
}

function PushTimeline({ daysBefore, timing, eventDateLabel }: { daysBefore: number; timing: NonNullable<ReturnType<typeof pushTiming>>; eventDateLabel: string }) {
  const W = 720;
  const H = 86;
  const padL = 90;
  const padR = 120;
  const span = Math.max(daysBefore, 21);
  const x = (d: number) => padL + ((span - d) / span) * (W - padL - padR);
  const marks = [
    { d: 14, label: `últimos 14 d · ${Math.round(timing.shareLast14 * 100)} %` },
    { d: 7, label: `última semana · ${Math.round(timing.shareLast7 * 100)} %` },
    ...(timing.reboundDaysBefore != null && timing.reboundDaysBefore < span ? [{ d: timing.reboundDaysBefore, label: "arranca el repunte" }] : []),
  ].filter((m) => m.d <= span);
  // On a phone the scaled-down SVG is unreadable (tiny, overlapping
  // labels) — the same milestones go in a short list instead; globals.css
  // swaps the two under 600px.
  const listItems = [
    `Hoy: faltan ${daysBefore} días`,
    ...(timing.reboundDaysBefore != null ? [`Arranca el repunte: ~${Math.round(timing.reboundDaysBefore)} días antes`] : []),
    `Últimos 14 días: ${Math.round(timing.shareLast14 * 100)} % de los inscritos`,
    `Última semana: ${Math.round(timing.shareLast7 * 100)} %`,
    `Evento: ${eventDateLabel}`,
  ];
  return (
    <div style={{ border: "1px solid #e3e1dc", borderRadius: 10, background: "#fff", padding: "6px 8px" }}>
      <ol className="push-timeline-list" style={{ margin: 0, padding: "4px 4px 4px 20px", fontSize: 13, lineHeight: 1.7 }}>
        {listItems.map((t) => (
          <li key={t}>{t}</li>
        ))}
      </ol>
      <svg className="push-timeline-svg" viewBox={`0 0 ${W} ${H}`} width="100%" role="img" aria-label="Línea de tiempo hasta el evento con los momentos de empuje">
        <line x1={x(span)} x2={x(0)} y1={50} y2={50} stroke="#e3e1dc" strokeWidth={2} />
        {daysBefore <= span && (
          <>
            <rect x={x(14)} y={44} width={x(0) - x(14)} height={12} fill="#00beb5" opacity={0.18} rx={3} />
            <rect x={x(7)} y={44} width={x(0) - x(7)} height={12} fill="#00beb5" opacity={0.3} rx={3} />
          </>
        )}
        {marks.map((m) => (
          <g key={m.label}>
            <line x1={x(m.d)} x2={x(m.d)} y1={38} y2={62} stroke="#8a8478" strokeWidth={1} />
            <text x={x(m.d)} y={74} textAnchor="middle" fontSize={11} fill="#5b5f6b">
              {m.label}
            </text>
          </g>
        ))}
        <circle cx={x(daysBefore)} cy={50} r={6} fill="#1c1310" />
        <text x={x(daysBefore)} y={28} textAnchor={x(daysBefore) < 110 ? "start" : "middle"} fontSize={12} fontWeight={700} fill="#1c1310">
          Hoy · faltan {daysBefore} d
        </text>
        <circle cx={x(0)} cy={50} r={6} fill="#00beb5" />
        <text x={x(0) + 10} y={54} fontSize={12} fontWeight={700} fill="#1c1310">
          Evento
        </text>
        <text x={x(0) + 10} y={68} fontSize={10} fill="#5b5f6b">
          {eventDateLabel}
        </text>
      </svg>
    </div>
  );
}
