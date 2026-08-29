import { db } from "@/lib/db";
import { getOrgSettings } from "@/lib/settings";
import { formatDateInTz } from "@/lib/dateFormat";
import { bucketDates, fillDayRange, channelKey, capitalize, topN } from "@/lib/eventStatsHelpers";
import { Section, EmptyNote, ScrollBox, BarList, StatCard } from "../StatsUI";

// Planning numbers for THIS event — before it happens (¿va bien la venta?
// ¿en qué canal seguir invirtiendo?) and after it happens (¿a quién le
// llegó realmente, para el pitch del próximo?). Deliberately separate from
// src/app/admin/scan/EventStatsPanel.tsx, which stays operational-only —
// numbers an admin checks live, parked at the door, the day of the event
// (check-in progress, hourly traffic). This page is the desktop, sit-down,
// pre/post-event view — see that file's own comment for the other half.
export default async function EventDecisionStats({ eventId }: { eventId: string }) {
  const [event, orgSettings, ticketAgg, abandonedCount, confirmedRegs] = await Promise.all([
    db.event.findUnique({ where: { id: eventId } }),
    getOrgSettings(),
    db.registration.aggregate({ where: { eventId, status: "CONFIRMED" }, _sum: { ticketCount: true } }),
    db.registration.count({ where: { eventId, status: "STARTED" } }),
    // Backs the growth curve, the attribution breakdown, and the
    // city/profession breakdown below — CONFIRMED only, same as "Boletas
    // emitidas", so every number on this page agrees with the others
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
  ]);

  if (!event) return null;

  const { timezone, language } = orgSettings;

  const issued = ticketAgg._sum.ticketCount ?? 0;
  const remaining = event.capacity != null ? Math.max(0, event.capacity - issued) : null;

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

  return (
    <div>
      <div style={{ display: "flex", gap: 16, flexWrap: "wrap", marginBottom: 24 }}>
        <StatCard label="Boletas emitidas" value={String(issued)} sub={event.capacity != null ? `de ${event.capacity} cupos` : undefined} />
        <StatCard label="Restantes" value={remaining != null ? String(remaining) : "—"} />
        <StatCard label="Carritos abandonados" value={String(abandonedCount)} />
      </div>

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

      <div style={{ display: "flex", gap: 24, flexWrap: "wrap" }}>
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

      <p style={{ fontSize: 12, color: "#5b5f6b" }}>
        ¿Buscas check-ins en vivo, franja horaria de llegada, o reingresos el día del evento? Eso vive en el{" "}
        <a href={`/admin/scan/${eventId}`}>Dashboard del escáner</a> — números para consultar parado en la puerta,
        no para planear antes/después.
      </p>
    </div>
  );
}
