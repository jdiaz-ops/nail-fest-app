import { db } from "@/lib/db";
import { getOrgSettings } from "@/lib/settings";
import { formatDateInTz } from "@/lib/dateFormat";

export const dynamic = "force-dynamic";

function daysUntil(date: Date): number {
  return Math.max(0, Math.ceil((date.getTime() - Date.now()) / 86_400_000));
}

export default async function OverviewPage() {
  const [nextEvent, totalRegistrations, checkedInAgg, recentRegistrations, events, aforo, orgSettings] = await Promise.all([
    db.event.findFirst({ where: { startsAt: { gt: new Date() } }, orderBy: { startsAt: "asc" } }),
    db.registration.count(),
    db.registration.aggregate({ _sum: { checkedInCount: true } }),
    db.registration.findMany({
      orderBy: { createdAt: "desc" },
      take: 15,
      include: { person: true, event: true },
    }),
    db.event.findMany({ orderBy: { startsAt: "desc" } }),
    db.registration.groupBy({
      by: ["eventId"],
      _sum: { ticketCount: true, checkedInCount: true },
    }),
    getOrgSettings(),
  ]);

  const aforoByEvent = new Map(aforo.map((a) => [a.eventId, a]));

  return (
    <div>
      <h1 style={{ fontSize: 24, marginBottom: 4 }}>Resumen</h1>
      <p style={{ color: "#5b5f6b", marginTop: 0 }}>Resumen de toda la operación, todos los eventos.</p>

      <div style={{ display: "flex", gap: 16, flexWrap: "wrap", margin: "24px 0" }}>
        <StatCard label="Próximo evento en" value={nextEvent ? `${daysUntil(nextEvent.startsAt)} días` : "—"} sub={nextEvent?.name} />
        <StatCard label="Inscritos (total)" value={String(totalRegistrations)} />
        <StatCard label="Boletas escaneadas (total)" value={String(checkedInAgg._sum.checkedInCount ?? 0)} />
      </div>

      <div style={{ display: "flex", gap: 24, alignItems: "flex-start", flexWrap: "wrap" }}>
        <section style={{ flex: "1 1 420px", minWidth: 0 }}>
          <h2 style={{ fontSize: 16 }}>Actividad reciente</h2>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 14 }}>
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
        </section>

        <section style={{ flex: "1 1 380px", minWidth: 0 }}>
          <h2 style={{ fontSize: 16 }}>Eventos</h2>
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
