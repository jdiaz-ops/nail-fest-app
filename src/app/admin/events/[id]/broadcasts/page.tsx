import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { getOrgSettings } from "@/lib/settings";
import { formatDateInTz } from "@/lib/dateFormat";
import { resolveDueAt } from "@/lib/broadcastSchedule";
import { getEmailBroadcastStats } from "@/lib/broadcasts";
import { requirePageUser } from "@/lib/auth/guard";

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

// Same "WhatChimp Broadcast Center"-style bar as the WhatsApp Difusiones
// list's own Bar (crm/whatsapp/difusiones/page.tsx) — duplicated rather
// than shared since the two pages already keep their own STATUS_STYLE
// maps separately too; `total` is `sent` (attempted minus FAILED, see
// getEmailBroadcastStats's own comment), not the raw attempted count, so
// a send that never left the building doesn't drag every rate down.
function Bar({ label, count, total, color, title }: { label: string; count: number; total: number; color: string; title?: string }) {
  const pct = total > 0 ? Math.round((count / total) * 100) : 0;
  return (
    <div style={{ minWidth: 92 }} title={title}>
      <div style={{ fontSize: 11, color: "#8a8478" }}>
        {label} ({pct}%) {count}/{total}
      </div>
      <div style={{ height: 4, background: "#f0efec", borderRadius: 999, marginTop: 2 }}>
        <div style={{ height: "100%", width: `${pct}%`, background: color, borderRadius: 999 }} />
      </div>
    </div>
  );
}

// Correos del evento — el mismo concepto de "Email broadcasts" de la
// plataforma de tickets anterior: correos específicos para los inscritos de ESTE evento (recordatorios, avisos de
// cambio de fecha, agradecimiento post-evento), no la lista global de
// marketing que ya existe en /admin/crm/broadcasts.
// ADMIN-only — see EventModuleShell's own comment on why this is gated
// again here, not just hidden from its nav.
export default async function EventBroadcastsPage({ params }: { params: { id: string } }) {
  await requirePageUser(["ADMIN"]);
  const [event, orgSettings, broadcasts] = await Promise.all([
    db.event.findUnique({ where: { id: params.id } }),
    getOrgSettings(),
    db.emailBroadcast.findMany({
      where: { eventId: params.id },
      orderBy: { createdAt: "desc" },
      include: { ticketType: true },
    }),
  ]);
  if (!event) notFound();

  const stats = await Promise.all(broadcasts.map((b) => getEmailBroadcastStats(b.id)));

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
              <th style={{ padding: "8px 12px" }}>Entrega</th>
              <th style={{ padding: "8px 12px" }}></th>
            </tr>
          </thead>
          <tbody>
            {broadcasts.map((b, i) => {
              const style = STATUS_STYLE[b.status] ?? { bg: "#f6f5f2", ink: "#5b5f6b", label: b.status };
              const dueAt = b.status === "QUEUED" ? resolveDueAt(b, event) : null;
              const s = stats[i]!;
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
                  <td style={{ padding: "10px 12px" }}>
                    {s.sent > 0 ? (
                      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                        <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
                          <Bar label="Entregados" count={s.delivered} total={s.sent} color="#12966b" />
                          <Bar
                            label="Abiertos"
                            count={s.opened}
                            total={s.sent}
                            color="#2f6fed"
                            title="Puede incluir aperturas falsas de Apple Mail Privacy Protection — los clics son la señal más confiable"
                          />
                          <Bar label="Clics" count={s.clicked} total={s.sent} color="#5b3fa8" />
                          <Bar label="Rebotes" count={s.bounced} total={s.sent} color="var(--danger)" />
                        </div>
                        {s.failed > 0 && (
                          <span style={{ fontSize: 11, color: "var(--danger)" }}>
                            {s.failed} {s.failed === 1 ? "envío falló" : "envíos fallaron"} antes de salir (no se cuentan arriba)
                          </span>
                        )}
                        {s.complained > 0 && (
                          <span style={{ fontSize: 11, color: "var(--danger)", fontWeight: 600 }}>
                            ⚠ {s.complained} {s.complained === 1 ? "queja de spam" : "quejas de spam"}
                          </span>
                        )}
                      </div>
                    ) : (
                      <span style={{ color: "#8a8478" }}>—</span>
                    )}
                  </td>
                  <td style={{ padding: "10px 12px", whiteSpace: "nowrap", display: "flex", gap: 12 }}>
                    {/* Only a still-QUEUED broadcast can change — one that already
                        sent (or is sending) has content that's already out, so
                        editing it here would be misleading. See
                        [broadcastId]/route.ts's own comment for the matching
                        server-side guard (this link alone isn't the real gate). */}
                    {b.status === "QUEUED" && (
                      <Link href={`/admin/events/${event.id}/broadcasts/${b.id}/edit`} style={{ fontSize: 13 }}>
                        Editar
                      </Link>
                    )}
                    {/* Opens "Nuevo correo" pre-filled with this one's content — see
                        new/page.tsx's own comment. A plain link, no client JS needed
                        here since the prefill itself happens server-side on that page. */}
                    <Link href={`/admin/events/${event.id}/broadcasts/new?duplicate=${b.id}`} style={{ fontSize: 13 }}>
                      Duplicar
                    </Link>
                  </td>
                </tr>
              );
            })}
            {broadcasts.length === 0 && (
              <tr>
                <td colSpan={6} style={{ padding: "10px 12px", color: "#5b5f6b" }}>
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
