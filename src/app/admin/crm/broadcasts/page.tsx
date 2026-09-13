import Link from "next/link";
import { db } from "@/lib/db";
import { countSegment, type SegmentFilter } from "@/lib/segments/builder";
import { requirePageUser } from "@/lib/auth/guard";
import { getBroadcastEmailStats, statsFor } from "@/lib/email/broadcastStats";
import BroadcastComposer from "@/components/BroadcastComposer";
import CrmPageHeader from "../CrmPageHeader";

export const dynamic = "force-dynamic";

const STATUS_STYLE: Record<string, { bg: string; ink: string }> = {
  SENT: { bg: "#e8f6ef", ink: "#0e6b4c" },
  SENDING: { bg: "#fdf1e6", ink: "#8a5a1f" },
  DRAFT: { bg: "#f6f5f2", ink: "#5b5f6b" },
};

// ADMIN-only — see ImportPage's own comment on why this is gated again
// here, not just hidden from CrmLayout's nav.
export default async function BroadcastsPage() {
  await requirePageUser(["ADMIN"]);
  const [segmentRows, broadcasts] = await Promise.all([
    db.segmentDefinition.findMany({ orderBy: { createdAt: "desc" } }),
    // segmentId: not null — event-scoped broadcasts (see
    // /admin/events/[id]/broadcasts) have their own history under their
    // own event, they don't belong mixed into this global list.
    db.emailBroadcast.findMany({
      where: { segmentId: { not: null } },
      orderBy: { createdAt: "desc" },
      take: 20,
      include: { segment: true, _count: { select: { logs: true } } },
    }),
  ]);

  // Live member count per segment, same as Segmentos' own list — a
  // broadcast should show the audience size it'd actually send to today,
  // not a stale number. countSegment, not resolveSegment(...).length —
  // see that function's own comment (this page had the same "fetch every
  // full Person row for every segment just to count them" bug Difusiones
  // did).
  const segments = await Promise.all(
    segmentRows.map(async (s) => ({
      id: s.id,
      name: s.name,
      memberCount: await countSegment(s.filter as unknown as SegmentFilter),
    }))
  );

  // One aggregate query for the whole page — see getBroadcastEmailStats's
  // own comment on why this can't be N+1 or a raw-row fetch.
  const statsByBroadcast = await getBroadcastEmailStats(broadcasts.map((b) => b.id));

  return (
    <div>
      <CrmPageHeader title="Broadcasts" subtitle="Envía un correo a un segmento ya guardado — nunca a un filtro improvisado." />

      <BroadcastComposer segments={segments} />

      <h2 style={{ fontSize: 16, marginTop: 40 }}>Historial</h2>
      <div className="admin-table-wrap" style={{ border: "1px solid #e3e1dc", borderRadius: 10 }}>
        <table style={{ borderCollapse: "collapse", fontSize: 14 }}>
          <thead>
            <tr style={{ textAlign: "left", background: "#faf9f7" }}>
              <th style={{ padding: "10px 12px" }}>Asunto</th>
              <th style={{ padding: "10px 12px" }}>Segmento</th>
              <th style={{ padding: "10px 12px" }}>Estado</th>
              <th style={{ padding: "10px 12px" }}>Enviados</th>
              <th style={{ padding: "10px 12px" }}>Abiertos</th>
              <th style={{ padding: "10px 12px" }}>Rebotados</th>
              <th style={{ padding: "10px 12px" }}>Quejas</th>
            </tr>
          </thead>
          <tbody>
            {broadcasts.map((b) => {
              const style = STATUS_STYLE[b.status] ?? { bg: "#f6f5f2", ink: "#5b5f6b" };
              const stats = statsFor(statsByBroadcast, b.id);
              // % sobre entregados, no sobre enviados — un correo que
              // nunca se entregó no pudo haberse abierto, así que
              // dividir sobre enviados subestima la tasa real de
              // apertura de lo que sí llegó.
              const openRate = stats.delivered > 0 ? Math.round((stats.opened / stats.delivered) * 100) : null;
              const bounceRate = stats.sent > 0 ? Math.round((stats.bounced / stats.sent) * 100) : null;
              return (
                <tr key={b.id} style={{ borderTop: "1px solid #f0efec" }}>
                  <td style={{ padding: "10px 12px" }}>
                    <Link href={`/admin/crm/broadcasts/${b.id}`} style={{ color: "inherit", textDecoration: "none", fontWeight: 600 }}>
                      {b.subject}
                    </Link>
                  </td>
                  <td style={{ padding: "10px 12px", color: "#5b5f6b" }}>{b.segment?.name ?? "—"}</td>
                  <td style={{ padding: "10px 12px" }}>
                    <span
                      style={{
                        display: "inline-flex",
                        padding: "4px 12px",
                        borderRadius: 999,
                        fontSize: 12,
                        fontWeight: 600,
                        background: style.bg,
                        color: style.ink,
                      }}
                    >
                      {b.status}
                    </span>
                  </td>
                  <td style={{ padding: "10px 12px" }}>{b._count.logs}</td>
                  <td style={{ padding: "10px 12px" }}>
                    {stats.opened}
                    {openRate !== null && <span style={{ color: "#5b5f6b" }}> ({openRate}%)</span>}
                  </td>
                  <td style={{ padding: "10px 12px", color: stats.bounced > 0 ? "#a3251f" : undefined }}>
                    {stats.bounced}
                    {bounceRate !== null && bounceRate > 0 && <span style={{ color: "#5b5f6b" }}> ({bounceRate}%)</span>}
                  </td>
                  <td style={{ padding: "10px 12px", color: stats.complained > 0 ? "#a3251f" : undefined }}>{stats.complained}</td>
                </tr>
              );
            })}
            {broadcasts.length === 0 && (
              <tr>
                <td colSpan={7} style={{ padding: "10px 12px", color: "#5b5f6b" }}>
                  Aún no se ha enviado ningún broadcast.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
