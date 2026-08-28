import { db } from "@/lib/db";
import { getOrderedProfessionOptions } from "@/lib/professions";
import { resolveSegment, type SegmentFilter } from "@/lib/segments/builder";
import SegmentComposer from "@/components/SegmentComposer";
import DeleteSegmentButton from "@/components/DeleteSegmentButton";

export const dynamic = "force-dynamic";

const STATUS_LABEL: Record<string, string> = {
  PENDING: "⏳ pendiente (aún no corrió el cron)",
  OK: "✅ sincronizado",
  ERROR: "⚠️ error",
};

export default async function SegmentsPage() {
  const [events, professionOptions, segmentRows] = await Promise.all([
    db.event.findMany({ orderBy: { startsAt: "asc" } }),
    getOrderedProfessionOptions(),
    db.segmentDefinition.findMany({
      orderBy: { createdAt: "desc" },
      include: { metaSync: true },
    }),
  ]);

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

  return (
    <div>
      <h1>Segmentos</h1>
      <p style={{ color: "#5b5f6b" }}>
        Cada segmento que guardes aquí se sincroniza con una Custom Audience en Meta (mismo
        nombre) de inmediato al guardar, y luego se mantiene solo — nuevos registros entran casi
        al instante, sin paso manual. Útil para audiencias por evento específico, ej.
        &quot;registrados solo a Pereira 2026&quot;, que
        luego puedes usar para retargeting o para excluirla de campañas de otros eventos.
      </p>

      <SegmentComposer events={events} professionOptions={professionOptions} />

      <h2 style={{ marginTop: 40 }}>Segmentos guardados</h2>
      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 14 }}>
        <thead>
          <tr style={{ textAlign: "left", borderBottom: "1px solid #e3e1dc" }}>
            <th style={{ padding: 8 }}>Nombre</th>
            <th style={{ padding: 8 }}>Personas</th>
            <th style={{ padding: 8 }}>Sync con Meta</th>
            <th style={{ padding: 8 }}>Última sincronización</th>
            <th style={{ padding: 8 }}></th>
          </tr>
        </thead>
        <tbody>
          {segments.map((s) => (
            <tr key={s.id} style={{ borderBottom: "1px solid #f0efec" }}>
              <td style={{ padding: 8 }}>{s.name}</td>
              <td style={{ padding: 8 }}>{s.memberCount}</td>
              <td style={{ padding: 8 }}>
                {s.metaSync ? STATUS_LABEL[s.metaSync.status] : "—"}
                {s.metaSync?.lastError && (
                  <div style={{ color: "#c2185b", fontSize: 12, marginTop: 4 }}>
                    {s.metaSync.lastError}
                  </div>
                )}
              </td>
              <td style={{ padding: 8 }}>
                {s.metaSync?.lastSyncedAt ? s.metaSync.lastSyncedAt.toLocaleString("es-CO") : "—"}
              </td>
              <td style={{ padding: 8 }}>
                <DeleteSegmentButton id={s.id} />
              </td>
            </tr>
          ))}
          {segments.length === 0 && (
            <tr>
              <td colSpan={5} style={{ padding: 8, color: "#5b5f6b" }}>
                Aún no hay segmentos guardados.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
