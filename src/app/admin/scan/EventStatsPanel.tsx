import { db } from "@/lib/db";
import { getOrgSettings } from "@/lib/settings";
import { formatDateInTz, utcToZonedInputValue } from "@/lib/dateFormat";

// The Dashboard tab's content, admin-only — see [eventId]/page.tsx, which
// redirects STAFF straight to Escanear instead of rendering this at all.
// Real numbers only, straight from the same tables the rest of the CRM
// reads — no separate/approximated counters.
//
// Every section below exists to answer one concrete question an organizer
// actually has to decide, not just "a chart because charts look good" —
// see each section's own comment for which decision it maps to.

const RESULT_LABEL: Record<string, string> = {
  VALID_FIRST: "Entrada válida",
  VALID_REENTRY: "Reingreso",
  WRONG_EVENT: "Boleto de otro evento",
  INVALID_TOKEN: "Código inválido",
  NOT_FOUND: "No existe",
};

const ACCENT = "#00beb5";

export default async function EventStatsPanel({ eventId }: { eventId: string }) {
  const [
    event,
    orgSettings,
    ticketAgg,
    byTicketType,
    checkedInAgg,
    scanCounts,
    recentScans,
    abandonedCount,
    confirmedRegs,
    checkInScans,
  ] = await Promise.all([
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
    db.registration.count({ where: { eventId, status: "STARTED" } }),
    // Backs the growth curve, the attribution breakdown, and the
    // city/profession breakdown below — CONFIRMED only, same as "Boletas
    // emitidas" above, so every number on this page agrees with the others
    // instead of one section quietly counting abandoned carts as real people.
    db.registration.findMany({
      where: { eventId, status: "CONFIRMED" },
      select: {
        createdAt: true,
        utmSource: true,
        fbclid: true,
        ttclid: true,
        gclid: true,
        person: { select: { city: true, profession: true } },
      },
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
  const remaining = event.capacity != null ? Math.max(0, event.capacity - issued) : null;
  const checkInRate = issued > 0 ? Math.round((checkedIn / issued) * 100) : 0;
  const scansByResult = new Map(scanCounts.map((s) => [s.result, s._count._all]));

  // Reingresos — cuánta gente sale y vuelve a entrar. Alto = probablemente
  // hay food trucks/zona de fumadores afuera y conviene una fila rápida de
  // reingreso en la puerta; casi cero = la gente entra y se queda.
  const reentryCount = scansByResult.get("VALID_REENTRY") ?? 0;
  const reentryRate = checkedIn > 0 ? Math.round((reentryCount / checkedIn) * 100) : 0;

  // Curva de inscripciones por día — para ver si el ritmo se está enfriando
  // (¿hace falta empujar más pauta/correo?) o si hay un pico después de
  // cierta acción. Días sin ninguna inscripción SÍ se muestran en 0 — un
  // hueco en la curva es información, no ruido.
  const dayBuckets = bucketDates(
    confirmedRegs.map((r) => r.createdAt),
    timezone
  );
  const dayRows = fillDayRange(dayBuckets).map((d) => ({
    label: formatDateInTz(new Date(`${d.key}T12:00:00Z`), { day: "2-digit", month: "short" }, timezone, language),
    count: d.count,
  }));
  const dayMax = Math.max(1, ...dayRows.map((d) => d.count));

  // Todas las secciones de "cuánto % del total" comparten el mismo universo
  // — las mismas inscripciones confirmadas — así que comparten un único
  // denominador en vez de cada una calculando el suyo.
  const totalConfirmed = confirmedRegs.length || 1;

  // De dónde vienen las inscripciones — plata real: en qué canal seguir
  // invirtiendo pauta y en cuál no, en vez de adivinar.
  const channelRows = topN(
    confirmedRegs.map((r) => channelKey(r)),
    100
  ).map((r) => ({ ...r, label: capitalize(r.label) }));

  // Ciudad y profesión de los inscritos — de dónde viene el público real y
  // a qué se dedica, para decidir próxima sede y armar el pitch a
  // patrocinadores.
  const cityRows = topN(
    confirmedRegs.map((r) => r.person.city),
    8
  );
  const professionRows = topN(
    confirmedRegs.map((r) => r.person.profession),
    8
  );

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
        <StatCard label="Boletas emitidas" value={String(issued)} sub={event.capacity != null ? `de ${event.capacity} cupos` : undefined} />
        <StatCard label="Escaneadas (entraron)" value={String(checkedIn)} sub={`${checkInRate}% de las emitidas`} />
        <StatCard label="Restantes" value={remaining != null ? String(remaining) : "—"} />
        <StatCard label="Carritos abandonados" value={String(abandonedCount)} />
        <StatCard label="Reingresos" value={String(reentryCount)} sub={checkedIn > 0 ? `${reentryRate} por cada 100 entradas` : undefined} />
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

      <Section
        title="Inscripciones por día"
        note="Un hueco en la curva es información: ¿bajó el ritmo, o simplemente no hubo pauta activa esos días?"
      >
        {dayRows.length === 0 ? (
          <EmptyNote text="Aún no hay inscripciones confirmadas." />
        ) : (
          <ScrollBox>
            <BarList rows={dayRows} max={dayMax} />
          </ScrollBox>
        )}
      </Section>

      <Section title="De dónde vienen las inscripciones" note="Basado en los parámetros UTM y de clic (Meta/TikTok/Google) que trae cada registro.">
        {channelRows.length === 0 ? (
          <EmptyNote text="Aún no hay inscripciones confirmadas." />
        ) : (
          <BarList rows={channelRows.map((r) => ({ label: r.label, count: r.count, pct: Math.round((r.count / totalConfirmed) * 100) }))} max={totalConfirmed} showPct />
        )}
      </Section>

      <div style={{ display: "flex", gap: 24, flexWrap: "wrap", marginBottom: 8 }}>
        <div style={{ flex: "1 1 260px", minWidth: 240 }}>
          <Section title="Ciudad" note="Para decidir la próxima sede o a dónde dirigir la pauta.">
            {cityRows.length === 0 ? (
              <EmptyNote text="Sin datos de ciudad todavía." />
            ) : (
              <BarList rows={cityRows.map((r) => ({ label: r.label, count: r.count, pct: Math.round((r.count / totalConfirmed) * 100) }))} max={totalConfirmed} showPct />
            )}
          </Section>
        </div>
        <div style={{ flex: "1 1 260px", minWidth: 240 }}>
          <Section title="Profesión" note="Útil para el pitch a patrocinadores y para el contenido del programa.">
            {professionRows.length === 0 ? (
              <EmptyNote text="Sin datos de profesión todavía." />
            ) : (
              <BarList rows={professionRows.map((r) => ({ label: r.label, count: r.count, pct: Math.round((r.count / totalConfirmed) * 100) }))} max={totalConfirmed} showPct />
            )}
          </Section>
        </div>
      </div>

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

function Section({ title, note, children }: { title: string; note: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 24 }}>
      <h2 style={{ fontSize: 15, marginBottom: 2 }}>{title}</h2>
      <p style={{ fontSize: 12, color: "#5b5f6b", marginTop: 0, marginBottom: 10 }}>{note}</p>
      {children}
    </div>
  );
}

function EmptyNote({ text }: { text: string }) {
  return <p style={{ fontSize: 12, color: "#5b5f6b" }}>{text}</p>;
}

function ScrollBox({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ maxHeight: 280, overflowY: "auto", border: "1px solid #e3e1dc", borderRadius: 10, padding: "10px 12px" }}>
      {children}
    </div>
  );
}

function BarList({ rows, max, showPct }: { rows: { label: string; count: number; pct?: number }[]; max: number; showPct?: boolean }) {
  return (
    <div>
      {rows.map((r, i) => (
        <div key={`${r.label}-${i}`} style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 5, fontSize: 12 }}>
          <div
            style={{
              width: 120,
              flexShrink: 0,
              color: "#5b5f6b",
              whiteSpace: "nowrap",
              overflow: "hidden",
              textOverflow: "ellipsis",
            }}
            title={r.label}
          >
            {r.label}
          </div>
          <div style={{ flex: 1, background: "#f0efec", borderRadius: 4, height: 14, position: "relative" }}>
            <div
              style={{
                width: `${max > 0 ? Math.max(r.count > 0 ? 2 : 0, (r.count / max) * 100) : 0}%`,
                background: ACCENT,
                height: "100%",
                borderRadius: 4,
              }}
            />
          </div>
          <div style={{ width: showPct ? 56 : 32, textAlign: "right", flexShrink: 0 }}>
            <span style={{ fontWeight: 600 }}>{r.count}</span>
            {showPct && r.pct != null && <span style={{ color: "#5b5f6b" }}> · {r.pct}%</span>}
          </div>
        </div>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Data shaping helpers — plain JS, no charting library. Event-sized data
// (hundreds to a few thousand rows) makes bucketing in memory the simplest
// correct option instead of a raw-SQL date_trunc query.
// ---------------------------------------------------------------------------

// "day key" = the YYYY-MM-DD prefix of the zoned wall-clock string, so two
// timestamps on the same calendar day in the org's own timezone group
// together even though their UTC instants differ.
function dayKey(date: Date, timezone: string): string {
  return utcToZonedInputValue(date, timezone).slice(0, 10);
}

function hourKey(date: Date, timezone: string): string {
  return utcToZonedInputValue(date, timezone).slice(0, 13);
}

function bucketDates(dates: Date[], timezone: string): Map<string, number> {
  const map = new Map<string, number>();
  for (const d of dates) {
    const key = dayKey(d, timezone);
    map.set(key, (map.get(key) ?? 0) + 1);
  }
  return map;
}

// Fills every day between the earliest and latest bucket with 0 where
// nothing happened — a missing day in a growth curve should read as "no
// activity that day", not silently vanish from the list.
function fillDayRange(buckets: Map<string, number>): { key: string; count: number }[] {
  const keys = [...buckets.keys()].sort();
  if (keys.length === 0) return [];
  const out: { key: string; count: number }[] = [];
  let cursor = new Date(`${keys[0]}T00:00:00Z`);
  const end = new Date(`${keys[keys.length - 1]}T00:00:00Z`);
  while (cursor.getTime() <= end.getTime()) {
    const key = cursor.toISOString().slice(0, 10);
    out.push({ key, count: buckets.get(key) ?? 0 });
    cursor = new Date(cursor.getTime() + 24 * 60 * 60 * 1000);
  }
  return out;
}

function bucketHours(dates: Date[], timezone: string): { key: string; count: number }[] {
  const map = new Map<string, number>();
  for (const d of dates) {
    const key = hourKey(d, timezone);
    map.set(key, (map.get(key) ?? 0) + 1);
  }
  return [...map.entries()].sort((a, b) => a[0].localeCompare(b[0])).map(([key, count]) => ({ key, count }));
}

// Only the first letter — channelKey lowercases the whole string for
// stable grouping (so "Instagram" and "instagram" count as the same
// channel), this just makes the DISPLAYED label read naturally without
// CSS text-transform, which would also wrongly capitalize "utm" to "Utm".
function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function channelKey(r: { utmSource: string | null; fbclid: string | null; ttclid: string | null; gclid: string | null }): string {
  const src = r.utmSource?.trim();
  if (src) return src.toLowerCase();
  if (r.fbclid) return "meta ads (sin utm)";
  if (r.ttclid) return "tiktok ads (sin utm)";
  if (r.gclid) return "google ads (sin utm)";
  return "directo / sin datos";
}

function topN(values: (string | null)[], n: number, fallback = "sin especificar"): { label: string; count: number }[] {
  const map = new Map<string, number>();
  for (const raw of values) {
    const key = raw?.trim() || fallback;
    map.set(key, (map.get(key) ?? 0) + 1);
  }
  const sorted = [...map.entries()].sort((a, b) => b[1] - a[1]);
  if (sorted.length <= n) return sorted.map(([label, count]) => ({ label, count }));
  const top = sorted.slice(0, n - 1);
  const restCount = sorted.slice(n - 1).reduce((sum, [, c]) => sum + c, 0);
  return [...top.map(([label, count]) => ({ label, count })), { label: "otros", count: restCount }];
}
