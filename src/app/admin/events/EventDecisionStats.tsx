import { db } from "@/lib/db";
import { getOrgSettings } from "@/lib/settings";
import { formatDateInTz } from "@/lib/dateFormat";
import { bucketDates, fillDayRange, bucketHours, channelKey, capitalize, topN } from "@/lib/eventStatsHelpers";
import { findCountry } from "@/lib/worldCountries";
import { Section, EmptyNote, ScrollBox, BarList, StatCard } from "../StatsUI";

// Planning numbers for THIS event — before it happens (¿va bien la venta?
// ¿en qué canal seguir invirtiendo?) and after it happens (¿a quién le
// llegó realmente, para el pitch del próximo?). Originally kept strictly
// separate from src/app/admin/scan/EventStatsPanel.tsx (operational-only —
// numbers an admin checks live, parked at the door), but the door-day
// summary numbers below (check-ins, franja horaria de llegada, tipo de
// entrada) were asked to also show up HERE — just as useful for a
// post-event report as for standing at the door. See that other file's
// own comment for what's still door-side-only (the live per-scan log,
// the emergency CSV export).
export default async function EventDecisionStats({ eventId }: { eventId: string }) {
  const [event, orgSettings, ticketAgg, abandonedCount, confirmedRegs, checkedInAgg, scanCounts, byTicketType, checkInScans, reachedEmailStep, pickedTicketType, landingViewsByCountry, landingSinceAgg] = await Promise.all([
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
        ticketCount: true,
        person: { select: { city: true, profession: true, country: true } },
      },
    }),
    // Everything below mirrors EventStatsPanel.tsx's own queries — same
    // source tables, same math, so these numbers always agree with what
    // was shown live at the door instead of a second, slightly different
    // computation.
    db.registration.aggregate({ where: { eventId, status: "CONFIRMED" }, _sum: { checkedInCount: true } }),
    db.scanLog.groupBy({ by: ["result"], where: { scannedForEventId: eventId }, _count: { _all: true } }),
    db.ticketType.findMany({
      where: { eventId },
      orderBy: { order: "asc" },
      include: {
        registrations: { where: { status: "CONFIRMED" }, select: { ticketCount: true, checkedInCount: true } },
      },
    }),
    db.scanLog.findMany({
      where: { scannedForEventId: eventId, result: { in: ["VALID_FIRST", "VALID_REENTRY"] } },
      select: { scannedAt: true },
    }),
    // Embudo de registro — every row ever created for this event counts,
    // regardless of current status (STARTED that never converted, or
    // CONFIRMED whether or not it ever passed through a STARTED draft
    // first) — @@unique([personId, eventId]) means this is exactly "how
    // many distinct people got at least as far as typing their email."
    db.registration.count({ where: { eventId, status: { not: "CANCELLED" } } }),
    db.registration.count({ where: { eventId, status: { not: "CANCELLED" }, ticketTypeId: { not: null } } }),
    // Our own, Meta-independent "who's actually landing here" count, by
    // country — see LandingView's own schema comment. Compared against
    // confirmedRegs' own person.country below to get a
    // aterrizajes-vs-inscripciones ratio per country without needing an
    // Ads Manager export.
    db.landingView.groupBy({ by: ["country"], where: { eventId }, _count: { _all: true } }),
    // LandingView tracking only started existing at a point in this
    // event's life — comparing it against EVERY registration ever (days/
    // weeks of campaign) produced nonsense like "1617% conversion" the
    // first time this shipped. Only registrations from the same window
    // LandingView has actually been counting are a fair comparison; see
    // countryFunnelRows below.
    db.landingView.aggregate({ where: { eventId }, _min: { createdAt: true } }),
  ]);

  // Proyección de asistencia real — respuestas al poll de WhatsApp
  // "¿vienes?" (ver AttendanceIntent y lib/whatsapp/inbox.ts's
  // resolveAttendancePollReply), sobre la gente que ya confirmó su
  // registro (a nadie más se le pregunta si "viene" a algo que ni
  // completó). Solo tiene contenido real una vez que se envía ese poll —
  // antes de eso, las tres cuentan como "sin respuesta", que es correcto.
  const [attendanceConfirmed, attendanceDeclined] = await Promise.all([
    db.registration.count({ where: { eventId, status: "CONFIRMED", attendanceIntent: "CONFIRMED" } }),
    db.registration.count({ where: { eventId, status: "CONFIRMED", attendanceIntent: "DECLINED" } }),
  ]);
  const attendanceNoReply = confirmedRegs.length - attendanceConfirmed - attendanceDeclined;

  if (!event) return null;

  const { timezone, language } = orgSettings;

  const issued = ticketAgg._sum.ticketCount ?? 0;
  const remaining = event.capacity != null ? Math.max(0, event.capacity - issued) : null;
  // "Registros únicos" — Boletas emitidas suma ticketCount (una
  // inscripción con 2 boletas cuenta 2 ahí); esto es la cuenta de
  // inscripciones reales detrás de ese número, para que se vea cuánta
  // gente pidió más de una.
  const uniqueRegs = confirmedRegs.length;
  const multiTicketRegs = confirmedRegs.filter((r) => r.ticketCount > 1).length;

  // Check-ins reales del día del evento — mismos cálculos que
  // EventStatsPanel.tsx (ver comentario arriba).
  const checkedIn = checkedInAgg._sum.checkedInCount ?? 0;
  const checkInRate = issued > 0 ? Math.round((checkedIn / issued) * 100) : 0;
  const scansByResult = new Map(scanCounts.map((s) => [s.result, s._count._all]));
  const reentryCount = scansByResult.get("VALID_REENTRY") ?? 0;
  const reentryRate = checkedIn > 0 ? Math.round((reentryCount / checkedIn) * 100) : 0;

  // A qué hora llega la gente — para ver si hubo picos y a qué hora, de
  // cara al próximo evento (¿abrir puertas antes? ¿más personal a cierta
  // hora?).
  const hourBuckets = bucketHours(
    checkInScans.map((s) => s.scannedAt),
    timezone
  );
  const hourRows = hourBuckets.map((h) => ({
    label: formatDateInTz(new Date(`${h.key}:00:00Z`), { day: "2-digit", month: "short", hour: "2-digit" }, timezone, language),
    count: h.count,
  }));
  const hourMax = Math.max(1, ...hourRows.map((h) => h.count));

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

  // País, ciudad y profesión de los inscritos — de dónde viene el público
  // real y a qué se dedica, para decidir próxima sede y armar el pitch a
  // patrocinadores. País antes que ciudad porque es el primer corte que
  // importa para un evento con pauta fuera de Colombia (¿vale la pena
  // seguir invirtiendo en ese país, o toda esa audiencia es local?) —
  // mapeado a nombre legible (Person.country es ISO2), mismo helper que
  // ya usa el selector de país en /admin/crm/personas.
  const countryRows = topN(
    confirmedRegs.map((r) => (r.person.country ? findCountry(r.person.country)?.name ?? r.person.country : null)),
    8
  );

  // Aterrizajes vs inscripciones por país — mismo corte que Ads Manager's
  // own country breakdown, pero de nuestros propios datos: cuántos
  // realmente ABREN la página (LandingView, ver [eventSlug]/page.tsx) vs
  // cuántos de esos terminan inscribiéndose. Joined by ISO2 (both sides
  // store the raw code), name resolved only for display.
  //
  // Only counts registrations from the SAME window LandingView has been
  // tracking (landingSince onward) — comparing a few hours of landings
  // against weeks of total registrations is exactly what produced
  // "1617% conversion" the first time this shipped. Before landingSince
  // exists (no landing views yet), this is empty rather than misleading.
  const landingSince = landingSinceAgg._min.createdAt;
  const landingCountByIso = new Map<string, number>();
  for (const row of landingViewsByCountry) {
    if (row.country) landingCountByIso.set(row.country, row._count._all);
  }
  const regCountByIso = new Map<string, number>();
  if (landingSince) {
    for (const r of confirmedRegs) {
      if (r.person.country && r.createdAt >= landingSince) {
        regCountByIso.set(r.person.country, (regCountByIso.get(r.person.country) ?? 0) + 1);
      }
    }
  }
  const countryFunnelRows = Array.from(new Set([...landingCountByIso.keys(), ...regCountByIso.keys()]))
    .map((iso) => {
      const landings = landingCountByIso.get(iso) ?? 0;
      const regs = regCountByIso.get(iso) ?? 0;
      return {
        iso,
        label: findCountry(iso)?.name ?? iso,
        landings,
        regs,
        pct: landings > 0 ? Math.round((regs / landings) * 100) : null,
      };
    })
    .sort((a, b) => b.landings - a.landings)
    .slice(0, 8);
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
        <StatCard
          label="Registros únicos"
          value={String(uniqueRegs)}
          sub={multiTicketRegs > 0 ? `${multiTicketRegs} con 2+ boletas` : undefined}
        />
        <StatCard label="Restantes" value={remaining != null ? String(remaining) : "—"} />
        <StatCard label="Carritos abandonados" value={String(abandonedCount)} />
        <StatCard label="Escaneadas (entraron)" value={String(checkedIn)} sub={`${checkInRate}% de las emitidas`} />
        <StatCard label="Reingresos" value={String(reentryCount)} sub={checkedIn > 0 ? `${reentryRate} por cada 100 entradas` : undefined} />
      </div>

      <Section
        title="Embudo de registro"
        note="En qué punto del formulario se cae la gente — no solo si se registró o no. 'Abrió el formulario' solo cuenta desde que esta métrica existe, así que un evento viejo puede verse incompleto ahí."
      >
        {event.checkoutOpenedCount === 0 && reachedEmailStep === 0 ? (
          <EmptyNote text="Aún no hay datos de embudo para este evento." />
        ) : (
          (() => {
            const funnelTop = Math.max(1, event.checkoutOpenedCount, reachedEmailStep);
            const withPct = (count: number) => ({ count, pct: Math.round((count / funnelTop) * 100) });
            return (
              <BarList
                rows={[
                  { label: "Abrió el formulario", ...withPct(event.checkoutOpenedCount) },
                  { label: "Escribió su correo", ...withPct(reachedEmailStep) },
                  ...(byTicketType.length > 0 ? [{ label: "Eligió tipo de entrada", ...withPct(pickedTicketType) }] : []),
                  { label: "Confirmó", ...withPct(confirmedRegs.length) },
                ]}
                max={funnelTop}
                showPct
              />
            );
          })()
        )}
      </Section>

      {(attendanceConfirmed > 0 || attendanceDeclined > 0) && (
        <Section
          title="Confirmación de asistencia (encuesta de WhatsApp)"
          note="Respuestas al recordatorio '¿vienes este fin de semana?' — para proyectar aforo real, no solo boletas emitidas. No bloquea el check-in: alguien que respondió 'No puedo' y aparece igual entra sin problema."
        >
          <BarList
            rows={[
              { label: "Sí voy", count: attendanceConfirmed, pct: Math.round((attendanceConfirmed / totalConfirmed) * 100) },
              { label: "No puedo", count: attendanceDeclined, pct: Math.round((attendanceDeclined / totalConfirmed) * 100) },
              { label: "Sin respuesta", count: attendanceNoReply, pct: Math.round((attendanceNoReply / totalConfirmed) * 100) },
            ]}
            max={totalConfirmed}
            showPct
          />
        </Section>
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

      <Section title="Check-ins por franja horaria" note="A qué hora llegó la gente el día del evento — para saber si hubo picos y planear personal/puertas para el próximo.">
        {hourRows.length === 0 ? (
          <EmptyNote text="Aún no hay escaneos válidos para este evento." />
        ) : (
          <ScrollBox>
            <BarList rows={hourRows} max={hourMax} />
          </ScrollBox>
        )}
      </Section>

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

      <Section title="De dónde vienen las inscripciones" note="Basado en los parámetros UTM y de clic (Meta/TikTok/Google) que trae cada registro.">
        {channelRows.length === 0 ? (
          <EmptyNote text="Aún no hay inscripciones confirmadas." />
        ) : (
          <BarList rows={channelRows.map((r) => ({ label: r.label, count: r.count, pct: Math.round((r.count / totalConfirmed) * 100) }))} max={totalConfirmed} showPct />
        )}
      </Section>

      <Section
        title="Aterrizajes vs inscripciones por país"
        note={
          landingSince
            ? `Cuántos abren la página vs cuántos de esos se inscriben, por país — nuestra propia versión del desglose por país de Ads Manager, sin depender de exportarlo. Solo compara desde el ${formatDateInTz(landingSince, { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" }, timezone, language)} (cuando empezó a existir esta métrica) — inscripciones de antes no cuentan aquí, para que la conversión no salga inflada.`
            : "Cuántos abren la página vs cuántos de esos se inscriben, por país — nuestra propia versión del desglose por país de Ads Manager, sin depender de exportarlo. Aún no hay suficiente historial."
        }
      >
        {countryFunnelRows.length === 0 ? (
          <EmptyNote text="Aún no hay aterrizajes registrados para este evento." />
        ) : (
          <div className="admin-table-wrap" style={{ border: "1px solid #e3e1dc", borderRadius: 10 }}>
            <table style={{ borderCollapse: "collapse", fontSize: 13, width: "100%" }}>
              <thead>
                <tr style={{ textAlign: "left", background: "#faf9f7" }}>
                  <th style={{ padding: "8px 12px" }}>País</th>
                  <th style={{ padding: "8px 12px" }}>Aterrizajes</th>
                  <th style={{ padding: "8px 12px" }}>Inscripciones</th>
                  <th style={{ padding: "8px 12px" }}>Conversión</th>
                </tr>
              </thead>
              <tbody>
                {countryFunnelRows.map((r) => (
                  <tr key={r.iso} style={{ borderTop: "1px solid #f0efec" }}>
                    <td style={{ padding: "8px 12px" }}>{r.label}</td>
                    <td style={{ padding: "8px 12px" }}>{r.landings}</td>
                    <td style={{ padding: "8px 12px" }}>{r.regs}</td>
                    <td style={{ padding: "8px 12px" }}>{r.pct != null ? `${r.pct}%` : "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Section>

      <div style={{ display: "flex", gap: 24, flexWrap: "wrap" }}>
        <div style={{ flex: "1 1 260px", minWidth: 240 }}>
          <Section title="País" note="Para decidir en qué países seguir invirtiendo en pauta.">
            {countryRows.length === 0 ? (
              <EmptyNote text="Sin datos de país todavía." />
            ) : (
              <BarList rows={countryRows.map((r) => ({ label: r.label, count: r.count, pct: Math.round((r.count / totalConfirmed) * 100) }))} max={totalConfirmed} showPct />
            )}
          </Section>
        </div>
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
        ¿Buscas el registro de escaneos en vivo (persona por persona, con hora y dispositivo) o el respaldo en CSV
        para la puerta? Eso vive en el <a href={`/admin/scan/${eventId}`}>Dashboard del escáner</a> — para consultar
        parado en la puerta el día del evento, no para planear antes/después.
      </p>
    </div>
  );
}
