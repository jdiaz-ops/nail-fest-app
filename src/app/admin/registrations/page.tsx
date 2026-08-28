import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

export default async function RegistrationsPage() {
  const [registrations, events, aforo] = await Promise.all([
    db.registration.findMany({
      orderBy: { createdAt: "desc" },
      take: 200,
      include: { person: true, event: true },
    }),
    db.event.findMany({ select: { id: true, name: true } }),
    db.registration.groupBy({
      by: ["eventId"],
      _count: { _all: true },
      _sum: { ticketCount: true, checkedInCount: true },
    }),
  ]);
  const eventNameById = new Map(events.map((e) => [e.id, e.name]));

  return (
    <div>
      <h1>Inscritos ({registrations.length})</h1>

      <h2 style={{ fontSize: 16, marginTop: 0 }}>Aforo por evento</h2>
      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 14, marginBottom: 32 }}>
        <thead>
          <tr style={{ textAlign: "left", borderBottom: "1px solid #e3e1dc" }}>
            <th style={{ padding: 8 }}>Evento</th>
            <th style={{ padding: 8 }}>Contactos registrados</th>
            <th style={{ padding: 8 }}>Boletas emitidas</th>
            <th style={{ padding: 8 }}>Entraron (aforo real)</th>
          </tr>
        </thead>
        <tbody>
          {aforo.map((row) => (
            <tr key={row.eventId} style={{ borderBottom: "1px solid #f0efec" }}>
              <td style={{ padding: 8 }}>{eventNameById.get(row.eventId) ?? row.eventId}</td>
              <td style={{ padding: 8 }}>{row._count._all}</td>
              <td style={{ padding: 8 }}>{row._sum.ticketCount ?? 0}</td>
              <td style={{ padding: 8 }}>{row._sum.checkedInCount ?? 0}</td>
            </tr>
          ))}
          {aforo.length === 0 && (
            <tr>
              <td colSpan={4} style={{ padding: 8, color: "#5b5f6b" }}>
                Aún no hay registros.
              </td>
            </tr>
          )}
        </tbody>
      </table>
      <p style={{ fontSize: 12, color: "#5b5f6b", marginTop: -20, marginBottom: 32 }}>
        &quot;Entraron&quot; cuenta boletas escaneadas (incluye acompañantes sin datos propios), no
        solo contactos identificados — es el número real de personas que pasaron por la puerta.
      </p>

      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 14 }}>
        <thead>
          <tr style={{ textAlign: "left", borderBottom: "1px solid #e3e1dc" }}>
            <th style={{ padding: 8 }}>Nombre</th>
            <th style={{ padding: 8 }}>Correo</th>
            <th style={{ padding: 8 }}>Ciudad</th>
            <th style={{ padding: 8 }}>Profesión</th>
            <th style={{ padding: 8 }}>Evento</th>
            <th style={{ padding: 8 }}>Fuente</th>
            <th style={{ padding: 8 }}>Estado</th>
          </tr>
        </thead>
        <tbody>
          {registrations.map((r) => (
            <tr key={r.id} style={{ borderBottom: "1px solid #f0efec" }}>
              <td style={{ padding: 8 }}>
                {r.person.firstName} {r.person.lastName}
              </td>
              <td style={{ padding: 8 }}>{r.person.email}</td>
              <td style={{ padding: 8 }}>{r.person.city}</td>
              <td style={{ padding: 8 }}>{r.person.profession ?? "—"}</td>
              <td style={{ padding: 8 }}>{r.event.name}</td>
              <td style={{ padding: 8 }}>{r.utmSource ?? "orgánico"}</td>
              <td style={{ padding: 8 }}>{r.status}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
