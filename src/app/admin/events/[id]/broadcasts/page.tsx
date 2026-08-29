import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { getOrgSettings } from "@/lib/settings";
import { formatDateInTz } from "@/lib/dateFormat";
import { resolveDueAt } from "@/lib/broadcastSchedule";

export const dynamic = "force-dynamic";

const STATUS_STYLE: Record<string, { bg: string; ink: string; label: string }> = {
  SENT: { bg: "#e8f6ef", ink: "#0e6b4c", label: "Enviado" },
  SENDING: { bg: "#fdf1e6", ink: "#8a5a1f", label: "Enviando…" },
  QUEUED: { bg: "#e6f9f7", ink: "#0b2e2c", label: "Programado" },
  DRAFT: { bg: "#f6f5f2", ink: "#5b5f6b", label: "Borrador" },
  CANCELLED: { bg: "#fbe9ea", ink: "#a3212b", label: "Cancelado" },
};

const SCHEDULE_LABEL: Record<string, string> = {
  IMMEDIATE: "Inmediato",
  AT_DATETIME: "Fecha programada",
  BEFORE_EVENT_START: "Antes del evento",
  AFTER_EVENT_END: "Después del evento",
};

// Correos del evento — Ticket Tailor's own "Email broadcasts": correos
// específicos para los inscritos de ESTE evento (recordatorios, avisos de
// cambio de fecha, agradecimiento post-evento), no la lista global de
// marketing que ya existe en /admin/crm/broadcasts.
export default async function EventBroadcastsPage({ params }: { params: { id: string } }) {
  const [event, orgSettings, broadcasts] = await Promise.all([
    db.event.findUnique({ where: { id: params.id } }),
    getOrgSettings(),
    db.emailBroadcast.findMany({
      where: { eventId: params.id },
      orderBy: { createdAt: "desc" },
      include: { ticketType: true, _count: { select: { logs: true } } },
    }),
  ]);
  if (!event) notFound();

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
        <h2 style={{ fontSize: 18, margin: 0 }}>Correos del evento</h2>
        <Link href={`/admin/events/${event.id}/broadcasts/new`} className="primary" style={{ padding: "8px 16px", fontSize: 14, textDecoration: "none" }}>
          + Nuevo correo
        </Link>
      </div>
      <p style={{ fontSize: 13, color: "#5b5f6b", marginTop: -8, marginBottom: 20 }}>
        Correos solo para quien se inscribió a este evento — recordatorios, avisos de cambios, agradecimiento
        post-evento. Para correos generales a toda la base, ve a CRM → Broadcasts.
      </p>

      <div className="admin-table-wrap" style={{ border: "1px solid #e3e1dc", borderRadius: 10 }}>
        <table style={{ borderCollapse: "collapse", fontSize: 13 }}>
          <thead>
            <tr style={{ textAlign: "left", background: "#faf9f7" }}>
              <th style={{ padding: "8px 12px" }}>Asunto</th>
              <th style={{ padding: "8px 12px" }}>Destinatarios</th>
              <th style={{ padding: "8px 12px" }}>Envío</th>
              <th style={{ padding: "8px 12px" }}>Estado</th>
              <th style={{ padding: "8px 12px" }}>Enviados</th>
            </tr>
          </thead>
          <tbody>
            {broadcasts.map((b) => {
              const style = STATUS_STYLE[b.status] ?? { bg: "#f6f5f2", ink: "#5b5f6b", label: b.status };
              const dueAt = b.status === "QUEUED" ? resolveDueAt(b, event) : null;
              return (
                <tr key={b.id} style={{ borderTop: "1px solid #f0efec" }}>
                  <td style={{ padding: "10px 12px" }}>{b.subject}</td>
                  <td style={{ padding: "10px 12px", color: "#5b5f6b" }}>{b.ticketType ? b.ticketType.name : "Todos"}</td>
                  <td style={{ padding: "10px 12px", color: "#5b5f6b" }}>
                    {SCHEDULE_LABEL[b.scheduleKind] ?? b.scheduleKind}
                    {dueAt && ` — ${formatDateInTz(dueAt, { dateStyle: "medium", timeStyle: "short" }, orgSettings.timezone, orgSettings.language)}`}
                  </td>
                  <td style={{ padding: "10px 12px" }}>
                    <span style={{ padding: "3px 10px", borderRadius: 999, fontSize: 12, fontWeight: 600, background: style.bg, color: style.ink }}>
                      {style.label}
                    </span>
                  </td>
                  <td style={{ padding: "10px 12px" }}>{b._count.logs}</td>
                </tr>
              );
            })}
            {broadcasts.length === 0 && (
              <tr>
                <td colSpan={5} style={{ padding: "10px 12px", color: "#5b5f6b" }}>
                  Aún no se ha enviado ningún correo para este evento.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
