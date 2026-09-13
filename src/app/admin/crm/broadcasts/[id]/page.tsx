import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { requirePageUser } from "@/lib/auth/guard";
import { getBroadcastEmailStats, getBouncedRecipients, statsFor } from "@/lib/email/broadcastStats";
import CrmPageHeader from "../../CrmPageHeader";
import TagEngagementButton from "@/components/admin/TagEngagementButton";

export const dynamic = "force-dynamic";

const STAT_TILES: Array<{ key: "sent" | "delivered" | "opened" | "clicked" | "bounced" | "complained" | "failed"; label: string; bad?: boolean }> = [
  { key: "sent", label: "Enviados" },
  { key: "delivered", label: "Entregados" },
  { key: "opened", label: "Abiertos" },
  { key: "clicked", label: "Con clic" },
  { key: "bounced", label: "Rebotados", bad: true },
  { key: "complained", label: "Quejas", bad: true },
  { key: "failed", label: "Fallidos", bad: true },
];

// Drill-down for one broadcast — the "ver los correos falsos/bounces" a
// wave of the reactivation campaign needs after every send, before
// deciding whether to widen to the next wave. Stats + the actual list of
// who bounced/complained (already excluded from every future send by
// lib/email/tracking.ts's auto-suppression — this page is visibility into
// that, not the mechanism itself).
export default async function BroadcastDetailPage({ params }: { params: { id: string } }) {
  await requirePageUser(["ADMIN"]);

  const broadcast = await db.emailBroadcast.findUnique({
    where: { id: params.id },
    include: { segment: true },
  });
  if (!broadcast) notFound();

  const [statsMap, bounced] = await Promise.all([
    getBroadcastEmailStats([broadcast.id]),
    getBouncedRecipients(broadcast.id),
  ]);
  const stats = statsFor(statsMap, broadcast.id);
  const openRate = stats.delivered > 0 ? Math.round((stats.opened / stats.delivered) * 100) : null;
  const bounceRate = stats.sent > 0 ? Math.round((stats.bounced / stats.sent) * 100) : null;

  return (
    <div>
      <Link href="/admin/crm/broadcasts" style={{ fontSize: 13, color: "#5b5f6b" }}>
        ← Broadcasts
      </Link>
      <CrmPageHeader title={broadcast.subject} subtitle={`Segmento: ${broadcast.segment?.name ?? "—"} · Estado: ${broadcast.status}`} />

      <div style={{ display: "flex", flexWrap: "wrap", gap: 12, marginBottom: 28 }}>
        {STAT_TILES.map((tile) => (
          <div
            key={tile.key}
            style={{
              flex: "1 1 120px",
              border: "1px solid #e3e1dc",
              borderRadius: 10,
              padding: "12px 14px",
              background: tile.bad && stats[tile.key] > 0 ? "#fdeaea" : "#fff",
            }}
          >
            <p style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.04em", textTransform: "uppercase", color: "#5b5f6b", margin: "0 0 4px" }}>
              {tile.label}
            </p>
            <p style={{ fontSize: 22, fontWeight: 800, margin: 0, color: tile.bad && stats[tile.key] > 0 ? "#a3251f" : undefined }}>
              {stats[tile.key]}
            </p>
          </div>
        ))}
      </div>

      {(openRate !== null || bounceRate !== null) && (
        <p style={{ fontSize: 13, color: "#5b5f6b", marginBottom: 28 }}>
          {openRate !== null && <>Tasa de apertura (sobre entregados): <strong>{openRate}%</strong></>}
          {openRate !== null && bounceRate !== null && " · "}
          {bounceRate !== null && (
            <>
              Tasa de rebote (sobre enviados): <strong style={{ color: bounceRate > 2 ? "#a3251f" : undefined }}>{bounceRate}%</strong>
              {bounceRate > 2 && " — alto, revisa antes de ampliar la siguiente ola"}
            </>
          )}
        </p>
      )}

      <TagEngagementButton broadcastId={broadcast.id} />

      <h2 style={{ fontSize: 16 }}>Rebotados / marcaron como spam ({bounced.length})</h2>
      <p style={{ fontSize: 12.5, color: "#5b5f6b", margin: "0 0 12px" }}>
        Ya quedaron excluidos automáticamente de cualquier envío futuro (se revoca su consentimiento de marketing en
        cuanto llega el evento del proveedor) — esta es solo la lista para que la revises.
      </p>
      <div className="admin-table-wrap" style={{ border: "1px solid #e3e1dc", borderRadius: 10 }}>
        <table style={{ borderCollapse: "collapse", fontSize: 14, width: "100%" }}>
          <thead>
            <tr style={{ textAlign: "left", background: "#faf9f7" }}>
              <th style={{ padding: "10px 12px" }}>Correo</th>
              <th style={{ padding: "10px 12px" }}>Nombre</th>
              <th style={{ padding: "10px 12px" }}>Ciudad</th>
              <th style={{ padding: "10px 12px" }}>Motivo</th>
            </tr>
          </thead>
          <tbody>
            {bounced.map((r) => (
              <tr key={r.email} style={{ borderTop: "1px solid #f0efec" }}>
                <td style={{ padding: "10px 12px" }}>{r.email}</td>
                <td style={{ padding: "10px 12px", color: "#5b5f6b" }}>{r.name ?? "—"}</td>
                <td style={{ padding: "10px 12px", color: "#5b5f6b" }}>{r.city ?? "—"}</td>
                <td style={{ padding: "10px 12px" }}>
                  {r.complainedAt && <span style={{ color: "#a3251f" }}>Queja de spam</span>}
                  {r.complainedAt && r.bouncedAt && " · "}
                  {r.bouncedAt && <span>Rebote</span>}
                </td>
              </tr>
            ))}
            {bounced.length === 0 && (
              <tr>
                <td colSpan={4} style={{ padding: "10px 12px", color: "#5b5f6b" }}>
                  Nadie rebotó ni se quejó en este envío.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
