import Link from "next/link";
import { db } from "@/lib/db";
import { StatCard } from "../../StatsUI";

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
  const [event, ticketAgg, checkedInAgg, abandonedCount] = await Promise.all([
    db.event.findUnique({ where: { id: params.id } }),
    db.registration.aggregate({ where: { eventId: params.id, status: "CONFIRMED" }, _sum: { ticketCount: true } }),
    db.registration.aggregate({ where: { eventId: params.id, status: "CONFIRMED" }, _sum: { checkedInCount: true } }),
    db.registration.count({ where: { eventId: params.id, status: "STARTED" } }),
  ]);

  if (!event) return null;

  const issued = ticketAgg._sum.ticketCount ?? 0;
  const checkedIn = checkedInAgg._sum.checkedInCount ?? 0;
  const checkInRate = issued > 0 ? Math.round((checkedIn / issued) * 100) : 0;
  const remaining = event.capacity != null ? Math.max(0, event.capacity - issued) : null;
  const daysToGo = Math.ceil((event.startsAt.getTime() - Date.now()) / (24 * 60 * 60 * 1000));

  return (
    <div>
      <div style={{ display: "flex", gap: 16, flexWrap: "wrap", marginBottom: 32 }}>
        <StatCard label="Boletas emitidas" value={String(issued)} sub={event.capacity != null ? `de ${event.capacity} cupos` : undefined} />
        <StatCard label="Restantes" value={remaining != null ? String(remaining) : "—"} />
        <StatCard label="Días para el evento" value={daysToGo >= 0 ? String(daysToGo) : "Ya pasó"} />
        <StatCard label="Escaneadas (entraron)" value={String(checkedIn)} sub={issued > 0 ? `${checkInRate}% de las emitidas` : undefined} />
        <StatCard label="Carritos abandonados" value={String(abandonedCount)} />
      </div>

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
