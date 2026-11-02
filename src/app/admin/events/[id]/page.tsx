import Link from "next/link";
import { db } from "@/lib/db";
import { asistireCounts } from "@/lib/asistireUse";
import { hasNailFestAsistire } from "@/lib/nailfest/asistire";
import { formatPesos, formatUsd, paidTotal } from "@/lib/payments/paidTotal";
import { Section, StatCard } from "../../StatsUI";

export const dynamic = "force-dynamic";

// Event summary — the landing page when you open an event, same role as
// our previous ticketing platform's own "Event summary": a fast glance that combines BOTH
// halves the user explicitly asked to see together here — "cómo vamos
// hacia el evento" (momentum: boletas emitidas, restantes, días para el
// evento) and "qué pasó durante el evento" (escaneadas/entraron) — in one
// view, with links out to the deeper pages for anyone who wants to dig in.
// Deliberately NOT the deep sections (growth curve, attribution, hourly
// check-ins, ...) — those live one click away, on Reportes and on the
// scanner's own Dashboard respectively; a glance page that's also a full
// report stops being a glance.
export default async function EventSummaryPage({ params }: { params: { id: string } }) {
  const [event, ticketAgg, checkedInAgg, abandonedCount, uniqueRegs, multiTicketRegs, payments] = await Promise.all([
    db.event.findUnique({ where: { id: params.id } }),
    db.registration.aggregate({ where: { eventId: params.id, status: "CONFIRMED" }, _sum: { ticketCount: true } }),
    db.registration.aggregate({ where: { eventId: params.id, status: "CONFIRMED" }, _sum: { checkedInCount: true } }),
    db.registration.count({ where: { eventId: params.id, status: "STARTED" } }),
    // "Registros únicos" — cuántas inscripciones reales hay detrás de
    // "Boletas emitidas" (que suma ticketCount, no filas — ver esa
    // consulta arriba). La diferencia entre las dos son personas que
    // pidieron 2+ boletas en una sola inscripción, no gente distinta.
    db.registration.count({ where: { eventId: params.id, status: "CONFIRMED" } }),
    db.registration.count({ where: { eventId: params.id, status: "CONFIRMED", ticketCount: { gt: 1 } } }),
    // «Ventas» (2026-11-02): what the confirmed tickets' buyers paid, net of partial refunds — lib/payments/paidTotal.ts.
    db.payment.findMany({
      where: { status: "APPROVED", registration: { eventId: params.id, status: "CONFIRMED" } },
      select: { status: true, amountInCents: true, refundedCents: true, currency: true },
    }),
  ]);

  if (!event) return null;
  // «Asistiré» (2026-11-01, the team): on the events that have the image.
  const asistire = event.theme === "IMPARABLES" || hasNailFestAsistire(event) ? await asistireCounts(event.id) : null;

  const issued = ticketAgg._sum.ticketCount ?? 0;
  const checkedIn = checkedInAgg._sum.checkedInCount ?? 0;
  const checkInRate = issued > 0 ? Math.round((checkedIn / issued) * 100) : 0;
  const remaining = event.capacity != null ? Math.max(0, event.capacity - issued) : null;
  const daysToGo = Math.ceil((event.startsAt.getTime() - Date.now()) / (24 * 60 * 60 * 1000));
  // Pesos first; dollars (PayPal) under them, or alone when there are no pesos yet.
  const sales = paidTotal(payments);
  const salesValue = sales.pesos > 0 || sales.usdCents === 0 ? formatPesos(sales.pesos) : formatUsd(sales.usdCents);
  const salesSub = sales.pesos > 0 && sales.usdCents > 0 ? `+ ${formatUsd(sales.usdCents)} por PayPal` : undefined;

  return (
    <div>
      <div style={{ display: "flex", gap: 16, flexWrap: "wrap", marginBottom: 32 }}>
        <StatCard label="Boletas emitidas" value={String(issued)} sub={event.capacity != null ? `de ${event.capacity} cupos` : undefined} />
        <StatCard label="Ventas" value={salesValue} sub={salesSub} />
        <StatCard
          label="Registros únicos"
          value={String(uniqueRegs)}
          sub={multiTicketRegs > 0 ? `${multiTicketRegs} con 2+ boletas` : undefined}
        />
        <StatCard label="Restantes" value={remaining != null ? String(remaining) : "—"} />
        <StatCard label="Días para el evento" value={daysToGo >= 0 ? String(daysToGo) : "Ya pasó"} />
        <StatCard label="Escaneadas (entraron)" value={String(checkedIn)} sub={issued > 0 ? `${checkInRate}% de las emitidas` : undefined} />
        <StatCard label="Carritos abandonados" value={String(abandonedCount)} />
      </div>

      {asistire && <AsistireCounts counts={asistire} />}

      <div style={{ display: "flex", gap: 16, flexWrap: "wrap" }}>
        <Link href={`/admin/events/${event.id}/reports`} className="secondary" style={{ padding: "10px 18px", fontSize: 14 }}>
          Ver reportes completos →
        </Link>
        <Link href={`/admin/scan/${event.id}`} className="secondary" style={{ padding: "10px 18px", fontSize: 14 }}>
          Ver Dashboard del escáner →
        </Link>
      </div>
    </div>
  );
}

/** How many people made their «¡Asistiré!» image and how many took it, by link. */
function AsistireCounts({ counts }: { counts: Awaited<ReturnType<typeof asistireCounts>> }) {
  const created = counts.created.personal + counts.created.public;
  const downloaded = counts.downloaded.personal + counts.downloaded.public;
  return (
    <Section
      title="Imagen «¡Asistiré!»"
      note="Personas, contadas desde el 1 de noviembre de 2026. «Su enlace» es el del correo de cada una; el «enlace público», el de las historias y las pruebas del equipo. En iPhone, quien guarda la imagen manteniendo el dedo sobre ella no cuenta como descarga."
    >
      <div style={{ display: "flex", gap: 16, flexWrap: "wrap", marginBottom: 8 }}>
        <StatCard label="Crearon su imagen" value={String(created)} sub={`${counts.created.personal} con su enlace · ${counts.created.public} con el enlace público`} />
        <StatCard
          label="La descargaron o compartieron"
          value={String(downloaded)}
          sub={created > 0 ? `${Math.min(100, Math.round((downloaded / created) * 100))}% de las que la crearon` : undefined}
        />
      </div>
    </Section>
  );
}
