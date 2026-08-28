import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

export default async function RegistrationsPage() {
  const registrations = await db.registration.findMany({
    orderBy: { createdAt: "desc" },
    take: 200,
    include: { person: true, event: true },
  });

  return (
    <div>
      <h1>Inscritos ({registrations.length})</h1>
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
