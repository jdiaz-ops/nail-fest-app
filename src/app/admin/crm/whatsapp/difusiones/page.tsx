import { db } from "@/lib/db";
import { resolveSegment, type SegmentFilter } from "@/lib/segments/builder";
import { WHATSAPP_MERGE_TAGS } from "@/lib/whatsapp/mergeTags";
import { getBroadcastStats } from "@/lib/whatsapp/broadcasts";
import { whatsappProvider } from "@/lib/whatsapp";
import { getOrgSettings } from "@/lib/settings";
import { formatDateInTz } from "@/lib/dateFormat";
import { requirePageUser } from "@/lib/auth/guard";
import WhatsAppBroadcastComposer from "@/components/WhatsAppBroadcastComposer";
import WhatsAppBroadcastRowActions from "@/components/WhatsAppBroadcastRowActions";
import CrmPageHeader from "../../CrmPageHeader";

export const dynamic = "force-dynamic";

const STATUS_STYLE: Record<string, { bg: string; ink: string }> = {
  SENT: { bg: "#e8f6ef", ink: "#0e6b4c" },
  SENDING: { bg: "#fdf1e6", ink: "#8a5a1f" },
  QUEUED: { bg: "#e7edfb", ink: "#2f4ba8" },
  DRAFT: { bg: "#f6f5f2", ink: "#5b5f6b" },
};

// One horizontal bar, WhatChimp's own Processed/Delivered/Opened style —
// `count` out of `total`, with a fixed color per metric.
function Bar({ label, count, total, color }: { label: string; count: number; total: number; color: string }) {
  const pct = total > 0 ? Math.round((count / total) * 100) : 0;
  return (
    <div style={{ minWidth: 110 }}>
      <div style={{ fontSize: 11, color: "#8a8478" }}>
        {label} ({pct}%) {count}/{total}
      </div>
      <div style={{ height: 4, background: "#f0efec", borderRadius: 999, marginTop: 2 }}>
        <div style={{ height: "100%", width: `${pct}%`, background: color, borderRadius: 999 }} />
      </div>
    </div>
  );
}

// ADMIN-only — see WhatsAppConexionPage's own comment.
export default async function WhatsAppDifusionesPage() {
  await requirePageUser(["ADMIN"]);
  const [segmentRows, templates, broadcasts, connection, orgSettings] = await Promise.all([
    db.segmentDefinition.findMany({ orderBy: { createdAt: "desc" } }),
    db.whatsAppTemplate.findMany({ orderBy: { name: "asc" } }),
    db.whatsAppBroadcast.findMany({
      orderBy: { createdAt: "desc" },
      take: 20,
      include: { segment: true, template: true, _count: { select: { messages: true } } },
    }),
    db.whatsAppConnection.findFirst({ orderBy: { createdAt: "desc" } }),
    getOrgSettings(),
  ]);

  const segments = await Promise.all(
    segmentRows.map(async (s) => ({
      id: s.id,
      name: s.name,
      memberCount: (await resolveSegment(s.filter as unknown as SegmentFilter)).length,
    }))
  );

  const stats = await Promise.all(broadcasts.map((b) => getBroadcastStats(b.id)));
  const messagingLimitTier = connection ? (await whatsappProvider.getPhoneNumberStatus().catch(() => null))?.messagingLimitTier ?? null : null;

  return (
    <div>
      <CrmPageHeader title="Difusiones" subtitle="Envía una plantilla aprobada a un segmento ya guardado." />

      <WhatsAppBroadcastComposer
        segments={segments}
        templates={templates}
        mergeTags={WHATSAPP_MERGE_TAGS}
        messagingLimitTier={messagingLimitTier}
        orgTimezone={orgSettings.timezone}
      />

      <h2 style={{ fontSize: 16, marginTop: 40 }}>Historial</h2>
      <div className="admin-table-wrap" style={{ border: "1px solid #e3e1dc", borderRadius: 10 }}>
        <table style={{ borderCollapse: "collapse", fontSize: 14, width: "100%" }}>
          <thead>
            <tr style={{ textAlign: "left", background: "#faf9f7" }}>
              <th style={{ padding: "10px 12px" }}>Plantilla</th>
              <th style={{ padding: "10px 12px" }}>Segmento</th>
              <th style={{ padding: "10px 12px" }}>Estado</th>
              <th style={{ padding: "10px 12px" }}>Entrega</th>
              <th style={{ padding: "10px 12px" }}></th>
            </tr>
          </thead>
          <tbody>
            {broadcasts.map((b, i) => {
              const style = STATUS_STYLE[b.status] ?? { bg: "#f6f5f2", ink: "#5b5f6b" };
              const s = stats[i]!;
              return (
                <tr key={b.id} style={{ borderTop: "1px solid #f0efec" }}>
                  <td style={{ padding: "10px 12px" }}>{b.template.name}</td>
                  <td style={{ padding: "10px 12px", color: "#5b5f6b" }}>{b.segment?.name ?? "—"}</td>
                  <td style={{ padding: "10px 12px" }}>
                    <span style={{ display: "inline-flex", padding: "4px 12px", borderRadius: 999, fontSize: 12, fontWeight: 600, background: style.bg, color: style.ink }}>
                      {b.status}
                    </span>
                  </td>
                  <td style={{ padding: "10px 12px" }}>
                    {s.processed > 0 ? (
                      <div style={{ display: "flex", gap: 12 }}>
                        <Bar label="Entregados" count={s.delivered} total={s.processed} color="#12966b" />
                        <Bar label="Leídos" count={s.read} total={s.processed} color="#2f6fed" />
                        <Bar label="Fallidos" count={s.failed} total={s.processed} color="#c2185b" />
                      </div>
                    ) : b.status === "QUEUED" && b.scheduledAt ? (
                      <span style={{ color: "#2f4ba8" }}>
                        Programado para{" "}
                        {formatDateInTz(
                          b.scheduledAt,
                          { dateStyle: "short", timeStyle: "short" },
                          orgSettings.timezone,
                          orgSettings.language
                        )}
                      </span>
                    ) : (
                      <span style={{ color: "#8a8478" }}>—</span>
                    )}
                  </td>
                  <td style={{ padding: "10px 12px" }}>
                    <WhatsAppBroadcastRowActions id={b.id} hasFailed={s.failed > 0} />
                  </td>
                </tr>
              );
            })}
            {broadcasts.length === 0 && (
              <tr>
                <td colSpan={5} style={{ padding: "10px 12px", color: "#5b5f6b" }}>
                  Aún no se ha enviado ninguna difusión.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
