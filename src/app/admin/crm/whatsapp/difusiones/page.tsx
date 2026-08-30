import { db } from "@/lib/db";
import { resolveSegment, type SegmentFilter } from "@/lib/segments/builder";
import { WHATSAPP_MERGE_TAGS } from "@/lib/whatsapp/mergeTags";
import WhatsAppBroadcastComposer from "@/components/WhatsAppBroadcastComposer";
import CrmPageHeader from "../../CrmPageHeader";

export const dynamic = "force-dynamic";

const STATUS_STYLE: Record<string, { bg: string; ink: string }> = {
  SENT: { bg: "#e8f6ef", ink: "#0e6b4c" },
  SENDING: { bg: "#fdf1e6", ink: "#8a5a1f" },
  DRAFT: { bg: "#f6f5f2", ink: "#5b5f6b" },
};

export default async function WhatsAppDifusionesPage() {
  const [segmentRows, templates, broadcasts] = await Promise.all([
    db.segmentDefinition.findMany({ orderBy: { createdAt: "desc" } }),
    db.whatsAppTemplate.findMany({ orderBy: { name: "asc" } }),
    db.whatsAppBroadcast.findMany({
      orderBy: { createdAt: "desc" },
      take: 20,
      include: { segment: true, template: true, _count: { select: { messages: true } } },
    }),
  ]);

  const segments = await Promise.all(
    segmentRows.map(async (s) => ({
      id: s.id,
      name: s.name,
      memberCount: (await resolveSegment(s.filter as unknown as SegmentFilter)).length,
    }))
  );

  return (
    <div>
      <CrmPageHeader title="Difusiones" subtitle="Envía una plantilla aprobada a un segmento ya guardado." />

      <WhatsAppBroadcastComposer segments={segments} templates={templates} mergeTags={WHATSAPP_MERGE_TAGS} />

      <h2 style={{ fontSize: 16, marginTop: 40 }}>Historial</h2>
      <div className="admin-table-wrap" style={{ border: "1px solid #e3e1dc", borderRadius: 10 }}>
        <table style={{ borderCollapse: "collapse", fontSize: 14, width: "100%" }}>
          <thead>
            <tr style={{ textAlign: "left", background: "#faf9f7" }}>
              <th style={{ padding: "10px 12px" }}>Plantilla</th>
              <th style={{ padding: "10px 12px" }}>Segmento</th>
              <th style={{ padding: "10px 12px" }}>Estado</th>
              <th style={{ padding: "10px 12px" }}>Enviados</th>
            </tr>
          </thead>
          <tbody>
            {broadcasts.map((b) => {
              const style = STATUS_STYLE[b.status] ?? { bg: "#f6f5f2", ink: "#5b5f6b" };
              return (
                <tr key={b.id} style={{ borderTop: "1px solid #f0efec" }}>
                  <td style={{ padding: "10px 12px" }}>{b.template.name}</td>
                  <td style={{ padding: "10px 12px", color: "#5b5f6b" }}>{b.segment?.name ?? "—"}</td>
                  <td style={{ padding: "10px 12px" }}>
                    <span style={{ display: "inline-flex", padding: "4px 12px", borderRadius: 999, fontSize: 12, fontWeight: 600, background: style.bg, color: style.ink }}>
                      {b.status}
                    </span>
                  </td>
                  <td style={{ padding: "10px 12px" }}>{b._count.messages}</td>
                </tr>
              );
            })}
            {broadcasts.length === 0 && (
              <tr>
                <td colSpan={4} style={{ padding: "10px 12px", color: "#5b5f6b" }}>
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
