import { db } from "@/lib/db";
import { getOrderedProfessionOptions } from "@/lib/professions";
import { resolveSegment, type SegmentFilter } from "@/lib/segments/builder";
import SegmentComposer from "@/components/SegmentComposer";
import DeleteSegmentButton from "@/components/DeleteSegmentButton";
import CrmPageHeader from "../CrmPageHeader";
import StatCard from "../StatCard";

export const dynamic = "force-dynamic";

// Same status-pill convention as everywhere else in the CRM (StageBadge,
// registration Estado, broadcast Estado) — no emoji, a colored pill.
const SYNC_STYLE: Record<string, { bg: string; ink: string; label: string }> = {
  PENDING: { bg: "#f6f5f2", ink: "#5b5f6b", label: "Pendiente" },
  OK: { bg: "#e8f6ef", ink: "#0e6b4c", label: "Sincronizado" },
  ERROR: { bg: "#fbe9ea", ink: "#a3212b", label: "Error" },
};

export default async function SegmentsPage() {
  const [events, professionOptions, cityRows, segmentRows] = await Promise.all([
    db.event.findMany({ orderBy: { startsAt: "asc" } }),
    getOrderedProfessionOptions(),
    // Real distinct city values already on file, not a free-text guess —
    // avoids the typo mismatch a free-text multi-value input would have
    // ("Bogota" vs "Bogotá" silently matching nobody).
    db.person.findMany({ where: { city: { not: null } }, select: { city: true }, distinct: ["city"] }),
    db.segmentDefinition.findMany({
      orderBy: { createdAt: "desc" },
      include: { metaSync: true },
    }),
  ]);
  const cityOptions = cityRows
    .map((r) => r.city)
    .filter((c): c is string => !!c && c.trim().length > 0)
    .sort((a, b) => a.localeCompare(b, "es"));

  // Current CRM match count per segment — not the same as "how many are in
  // the Meta audience right now" (that's ADVERTISING-consent-filtered and
  // as-of-last-sync; see the Sync column), this is "how many people in the
  // CRM match this filter today", like Klaviyo's "Members" column.
  const segments = await Promise.all(
    segmentRows.map(async (s) => ({
      ...s,
      memberCount: (await resolveSegment(s.filter as unknown as SegmentFilter)).length,
    }))
  );
  const syncedCount = segments.filter((s) => s.metaSync?.status === "OK").length;

  return (
    <div>
      <CrmPageHeader
        title="Segmentos"
        subtitle={
          'Cada segmento que guardes aquí se sincroniza con una Custom Audience en Meta (mismo nombre) de inmediato al guardar, y luego se mantiene solo — nuevos registros entran casi al instante, sin paso manual. Útil para audiencias por evento específico, ej. "registrados solo a Pereira 2026", que luego puedes usar para retargeting o para excluirla de campañas de otros eventos. Los broadcasts (ver esa sección) siempre envían a uno de estos segmentos.'
        }
      />

      <div style={{ display: "flex", gap: 16, flexWrap: "wrap", marginBottom: 24 }}>
        <StatCard label="Segmentos guardados" value={String(segments.length)} />
        <StatCard label="Sincronizados con Meta" value={String(syncedCount)} />
      </div>

      <SegmentComposer events={events} professionOptions={professionOptions} cityOptions={cityOptions} />

      <h2 style={{ fontSize: 16, marginTop: 40 }}>Segmentos guardados</h2>
      <div className="admin-table-wrap" style={{ border: "1px solid #e3e1dc", borderRadius: 10 }}>
        <table style={{ borderCollapse: "collapse", fontSize: 14 }}>
          <thead>
            <tr style={{ textAlign: "left", background: "#faf9f7" }}>
              <th style={{ padding: "10px 12px" }}>Nombre</th>
              <th style={{ padding: "10px 12px" }}>Personas</th>
              <th style={{ padding: "10px 12px" }}>Sync con Meta</th>
              <th style={{ padding: "10px 12px" }}>Última sincronización</th>
              <th style={{ padding: "10px 12px" }}></th>
            </tr>
          </thead>
          <tbody>
            {segments.map((s) => {
              const syncStyle = s.metaSync ? SYNC_STYLE[s.metaSync.status] : null;
              return (
                <tr key={s.id} style={{ borderTop: "1px solid #f0efec" }}>
                  <td style={{ padding: "10px 12px", fontWeight: 600 }}>{s.name}</td>
                  <td style={{ padding: "10px 12px" }}>{s.memberCount}</td>
                  <td style={{ padding: "10px 12px" }}>
                    {syncStyle ? (
                      <span
                        style={{
                          display: "inline-flex",
                          padding: "4px 12px",
                          borderRadius: 999,
                          fontSize: 12,
                          fontWeight: 600,
                          background: syncStyle.bg,
                          color: syncStyle.ink,
                        }}
                      >
                        {syncStyle.label}
                      </span>
                    ) : (
                      <span style={{ color: "#5b5f6b" }}>—</span>
                    )}
                    {s.metaSync?.lastError && (
                      <div style={{ color: "#a3212b", fontSize: 12, marginTop: 4 }}>{s.metaSync.lastError}</div>
                    )}
                  </td>
                  <td style={{ padding: "10px 12px", color: "#5b5f6b" }}>
                    {s.metaSync?.lastSyncedAt ? s.metaSync.lastSyncedAt.toLocaleString("es-CO") : "—"}
                  </td>
                  <td style={{ padding: "10px 12px" }}>
                    <DeleteSegmentButton id={s.id} />
                  </td>
                </tr>
              );
            })}
            {segments.length === 0 && (
              <tr>
                <td colSpan={5} style={{ padding: "10px 12px", color: "#5b5f6b" }}>
                  Aún no hay segmentos guardados.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
