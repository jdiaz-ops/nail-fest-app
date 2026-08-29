import { db } from "@/lib/db";
import CrmPageHeader from "../CrmPageHeader";
import StatCard from "../StatCard";

export const dynamic = "force-dynamic";

const STATUS_STYLE: Record<string, { bg: string; ink: string; label: string }> = {
  CONFIRMED: { bg: "#e8f6ef", ink: "#0e6b4c", label: "Confirmado" },
  STARTED: { bg: "#f6f5f2", ink: "#5b5f6b", label: "Iniciado" },
  CANCELLED: { bg: "#fbe9ea", ink: "#a3212b", label: "Cancelado" },
};

export default async function RegistrationsPage() {
  // STARTED rows are abandoned-cart drafts (someone typed their email and
  // left, see /api/register/draft) — they never reached a real submit, so
  // they don't belong in "Inscritos"; they have their own list at
  // /admin/crm/abandonados. CONFIRMED and CANCELLED both represent a real
  // completed registration attempt and stay here.
  const [registrations, distinctEvents] = await Promise.all([
    db.registration.findMany({
      where: { status: { not: "STARTED" } },
      orderBy: { createdAt: "desc" },
      take: 200,
      include: { person: true, event: true },
    }),
    db.registration.groupBy({ by: ["eventId"], where: { status: { not: "STARTED" } } }),
  ]);

  return (
    <div>
      <CrmPageHeader
        title={`Inscritos (${registrations.length})`}
        subtitle="Cada inscripción individual, con su fuente de tráfico — para el cupo/aforo por evento, ve a Eventos. Los carritos abandonados están en Abandonados."
      />

      <div style={{ display: "flex", gap: 16, flexWrap: "wrap", marginBottom: 24 }}>
        <StatCard label="Inscripciones (últimas 200)" value={String(registrations.length)} />
        <StatCard label="Eventos con inscritos" value={String(distinctEvents.length)} />
      </div>

      <div style={{ border: "1px solid #e3e1dc", borderRadius: 10, overflow: "hidden" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 14 }}>
          <thead>
            <tr style={{ textAlign: "left", background: "#faf9f7" }}>
              <th style={{ padding: "10px 12px" }}>Nombre</th>
              <th style={{ padding: "10px 12px" }}>Correo</th>
              <th style={{ padding: "10px 12px" }}>Ciudad</th>
              <th style={{ padding: "10px 12px" }}>Profesión</th>
              <th style={{ padding: "10px 12px" }}>Evento</th>
              <th style={{ padding: "10px 12px" }}>Fuente</th>
              <th style={{ padding: "10px 12px" }}>Estado</th>
            </tr>
          </thead>
          <tbody>
            {registrations.map((r) => {
              const statusStyle = STATUS_STYLE[r.status] ?? { bg: "#f6f5f2", ink: "#5b5f6b", label: r.status };
              return (
                <tr key={r.id} style={{ borderTop: "1px solid #f0efec" }}>
                  <td style={{ padding: "10px 12px" }}>
                    {r.person.firstName} {r.person.lastName}
                  </td>
                  <td style={{ padding: "10px 12px", color: "#5b5f6b" }}>{r.person.email}</td>
                  <td style={{ padding: "10px 12px" }}>{r.person.city}</td>
                  <td style={{ padding: "10px 12px" }}>{r.person.profession ?? "—"}</td>
                  <td style={{ padding: "10px 12px" }}>{r.event.name}</td>
                  <td style={{ padding: "10px 12px", color: "#5b5f6b" }}>{r.utmSource ?? "orgánico"}</td>
                  <td style={{ padding: "10px 12px" }}>
                    <span
                      style={{
                        display: "inline-flex",
                        padding: "4px 12px",
                        borderRadius: 999,
                        fontSize: 12,
                        fontWeight: 600,
                        background: statusStyle.bg,
                        color: statusStyle.ink,
                      }}
                    >
                      {statusStyle.label}
                    </span>
                  </td>
                </tr>
              );
            })}
            {registrations.length === 0 && (
              <tr>
                <td colSpan={7} style={{ padding: "10px 12px", color: "#5b5f6b" }}>
                  Aún no hay registros.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
