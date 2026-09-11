import { db } from "@/lib/db";
import { getOrgSettings } from "@/lib/settings";
import { formatDateInTz } from "@/lib/dateFormat";
import { requirePageUser } from "@/lib/auth/guard";

export const dynamic = "force-dynamic";

function daysUntil(date: Date): number {
  return Math.max(0, Math.ceil((date.getTime() - Date.now()) / 86_400_000));
}

const DAY_MS = 86_400_000;

export default async function OverviewPage() {
  await requirePageUser(["ADMIN", "COORDINADOR"]);

  // Every count on this dashboard is scoped to CONFIRMED registrations —
  // a STARTED row is an abandoned-cart draft (see /api/register/draft),
  // not a real registration, and must not inflate "Inscritos", "Emitidas",
  // or the recent-activity feed. Drafts have their own view at
  // /admin/crm/abandonados.
  const [nextEvent, totalRegistrations, checkedInAgg, recentRegistrations, events, aforo, orgSettings] = await Promise.all([
    db.event.findFirst({ where: { startsAt: { gt: new Date() } }, orderBy: { startsAt: "asc" } }),
    db.registration.count({ where: { status: "CONFIRMED" } }),
    db.registration.aggregate({ where: { status: "CONFIRMED" }, _sum: { checkedInCount: true } }),
    db.registration.findMany({
      where: { status: "CONFIRMED" },
      orderBy: { createdAt: "desc" },
      take: 15,
      include: { person: true, event: true },
    }),
    db.event.findMany({ orderBy: { startsAt: "desc" } }),
    db.registration.groupBy({
      by: ["eventId"],
      where: { status: "CONFIRMED" },
      _sum: { ticketCount: true, checkedInCount: true },
    }),
    getOrgSettings(),
  ]);

  const aforoByEvent = new Map(aforo.map((a) => [a.eventId, a]));

  // Scoped to the próximo evento specifically — the three global
  // StatCards this page used to open with (Inscritos total, Boletas
  // escaneadas total) answered "how's the whole business done, ever",
  // not "how's THIS event going", which is what actually matters while
  // one is actively open for registration. "Boletas escaneadas" doesn't
  // even make sense here — check-in only happens the day of the event,
  // so it'd always read 0 for something that hasn't happened yet; the
  // "ritmo" pair below (24h/7d) is what replaces it as the thing worth
  // watching pre-evento. Only run these when there IS an upcoming event,
  // no point querying otherwise.
  const nextEventStats = nextEvent
    ? await (async () => {
        const now = new Date();
        const [confirmed, last24h, last7d] = await Promise.all([
          db.registration.count({ where: { eventId: nextEvent.id, status: "CONFIRMED" } }),
          db.registration.count({ where: { eventId: nextEvent.id, status: "CONFIRMED", createdAt: { gte: new Date(now.getTime() - DAY_MS) } } }),
          db.registration.count({ where: { eventId: nextEvent.id, status: "CONFIRMED", createdAt: { gte: new Date(now.getTime() - 7 * DAY_MS) } } }),
        ]);
        const agg = aforoByEvent.get(nextEvent.id);
        const issued = agg?._sum.ticketCount ?? 0;
        const remaining = nextEvent.capacity != null ? Math.max(0, nextEvent.capacity - issued) : null;
        const pct = nextEvent.capacity ? Math.min(100, (issued / nextEvent.capacity) * 100) : null;
        return { confirmed, last24h, last7d, issued, remaining, pct };
      })()
    : null;

  return (
    <div>
      <h1 style={{ fontSize: 24, marginBottom: 4 }}>Resumen</h1>
      <p style={{ color: "#5b5f6b", marginTop: 0 }}>Resumen de toda la operación, todos los eventos.</p>

      {nextEvent && nextEventStats && (
        <section style={{ border: "1px solid #12966b", background: "#f2faf7", borderRadius: 12, padding: 20, margin: "24px 0" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", flexWrap: "wrap", gap: 8, marginBottom: 14 }}>
            <h2 style={{ fontSize: 17, margin: 0 }}>Próximo evento: {nextEvent.name}</h2>
            <span style={{ fontSize: 13, color: "#5b5f6b" }}>
              {nextEvent.city} · en {daysUntil(nextEvent.startsAt)} días
            </span>
          </div>
          <div style={{ display: "flex", gap: 16, flexWrap: "wrap" }}>
            <StatCard label="Inscritos a este evento" value={String(nextEventStats.confirmed)} />
            <StatCard
              label="Cupos restantes"
              value={nextEventStats.remaining != null ? String(nextEventStats.remaining) : "sin límite"}
              sub={nextEventStats.pct != null ? `${Math.round(nextEventStats.pct)}% del aforo lleno` : undefined}
            />
            <StatCard label="Últimas 24h" value={`+${nextEventStats.last24h}`} sub="nuevos inscritos" />
            <StatCard label="Últimos 7 días" value={`+${nextEventStats.last7d}`} sub="nuevos inscritos" />
          </div>
        </section>
      )}

      <h2 style={{ fontSize: 15, color: "#5b5f6b", marginTop: 32, marginBottom: 4 }}>Histórico general</h2>
      <p style={{ fontSize: 13, color: "#5b5f6b", marginTop: 0, marginBottom: 12 }}>Toda la operación, todos los eventos, desde siempre — no solo el próximo.</p>
      <div style={{ display: "flex", gap: 16, flexWrap: "wrap", marginBottom: 24 }}>
        <StatCard label="Inscritos (total)" value={String(totalRegistrations)} />
        <StatCard label="Boletas escaneadas (total)" value={String(checkedInAgg._sum.checkedInCount ?? 0)} />
      </div>

      <div style={{ display: "flex", gap: 24, alignItems: "flex-start", flexWrap: "wrap" }}>
        <section style={{ flex: "1 1 420px", minWidth: 0 }}>
          <h2 style={{ fontSize: 16 }}>Actividad reciente</h2>
          <div className="admin-table-wrap">
          <table style={{ borderCollapse: "collapse", fontSize: 14 }}>
            <thead>
              <tr style={{ textAlign: "left", borderBottom: "1px solid #e3e1dc" }}>
                <th style={{ padding: 8 }}>Cuándo</th>
                <th style={{ padding: 8 }}>Nombre</th>
                <th style={{ padding: 8 }}>Evento</th>
              </tr>
            </thead>
            <tbody>
              {recentRegistrations.map((r) => (
                <tr key={r.id} style={{ borderBottom: "1px solid #f0efec" }}>
                  <td style={{ padding: 8, color: "#5b5f6b" }}>
                    {formatDateInTz(r.createdAt, { dateStyle: "short", timeStyle: "short" }, orgSettings.timezone, orgSettings.language)}
                  </td>
                  <td style={{ padding: 8 }}>
                    {[r.person.firstName, r.person.lastName].filter(Boolean).join(" ") || r.person.email}
                  </td>
                  <td style={{ padding: 8 }}>{r.event.name}</td>
                </tr>
              ))}
              {recentRegistrations.length === 0 && (
                <tr>
                  <td colSpan={3} style={{ padding: 8, color: "#5b5f6b" }}>
                    Aún no hay registros.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
          </div>
        </section>

        <section style={{ flex: "1 1 380px", minWidth: 0 }}>
          <h2 style={{ fontSize: 16 }}>Todos los eventos</h2>
          {events.map((ev) => {
            const agg = aforoByEvent.get(ev.id);
            const issued = agg?._sum.ticketCount ?? 0;
            const remaining = ev.capacity != null ? Math.max(0, ev.capacity - issued) : null;
            const pct = ev.capacity ? Math.min(100, (issued / ev.capacity) * 100) : 0;
            return (
              <div key={ev.id} style={{ border: "1px solid #e3e1dc", borderRadius: 10, padding: 16, marginBottom: 12 }}>
                <div style={{ fontWeight: 600 }}>{ev.name}</div>
                <div style={{ fontSize: 13, color: "#5b5f6b", marginBottom: 8 }}>{ev.city}</div>
                {ev.capacity != null && (
                  <div style={{ height: 6, background: "#f0efec", borderRadius: 999, marginBottom: 8 }}>
                    <div style={{ height: 6, width: `${pct}%`, background: "#12966b", borderRadius: 999 }} />
                  </div>
                )}
                <div style={{ display: "flex", gap: 16, fontSize: 13, color: "#5b5f6b" }}>
                  <span>Emitidas: {issued}</span>
                  <span>Restantes: {remaining ?? "—"}</span>
                  <span>Escaneadas: {agg?._sum.checkedInCount ?? 0}</span>
                </div>
              </div>
            );
          })}
          {events.length === 0 && <p style={{ color: "#5b5f6b" }}>Aún no hay eventos.</p>}
        </section>
      </div>
    </div>
  );
}

function StatCard({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div style={{ border: "1px solid #e3e1dc", borderRadius: 10, padding: "16px 20px", minWidth: 160 }}>
      <div style={{ fontSize: 12, color: "#5b5f6b", textTransform: "uppercase", letterSpacing: "0.04em" }}>{label}</div>
      <div style={{ fontSize: 26, fontWeight: 700, marginTop: 4 }}>{value}</div>
      {sub && <div style={{ fontSize: 13, color: "#5b5f6b", marginTop: 2 }}>{sub}</div>}
    </div>
  );
}
