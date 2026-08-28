import { db } from "@/lib/db";
import { getOrderedProfessionOptions } from "@/lib/professions";
import SegmentComposer from "@/components/SegmentComposer";
import DeleteSegmentButton from "@/components/DeleteSegmentButton";

export const dynamic = "force-dynamic";

const STATUS_LABEL: Record<string, string> = {
  PENDING: "⏳ pendiente (aún no corrió el cron)",
  OK: "✅ sincronizado",
  ERROR: "⚠️ error",
};

export default async function SegmentsPage() {
  const [events, professionOptions, segments] = await Promise.all([
    db.event.findMany({ orderBy: { startsAt: "asc" } }),
    getOrderedProfessionOptions(),
    db.segmentDefinition.findMany({
      orderBy: { createdAt: "desc" },
      include: { metaSync: true },
    }),
  ]);

  return (
    <div>
      <h1>Segmentos</h1>
      <p style={{ color: "#5b5f6b" }}>
        Cada segmento que guardes aquí se sincroniza automáticamente con una Custom Audience en
        Meta (mismo nombre) — un cron corre en segundo plano, no hay paso manual. Útil para
        audiencias por evento específico, ej. &quot;registrados solo a Pereira 2026&quot;, que
        luego puedes usar para retargeting o para excluirla de campañas de otros eventos.
      </p>

      <SegmentComposer events={events} professionOptions={professionOptions} />

      <h2 style={{ marginTop: 40 }}>Segmentos guardados</h2>
      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 14 }}>
        <thead>
          <tr style={{ textAlign: "left", borderBottom: "1px solid #e3e1dc" }}>
            <th style={{ padding: 8 }}>Nombre</th>
            <th style={{ padding: 8 }}>Sync con Meta</th>
            <th style={{ padding: 8 }}>Última sincronización</th>
            <th style={{ padding: 8 }}></th>
          </tr>
        </thead>
        <tbody>
          {segments.map((s) => (
            <tr key={s.id} style={{ borderBottom: "1px solid #f0efec" }}>
              <td style={{ padding: 8 }}>{s.name}</td>
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
              <td colSpan={4} style={{ padding: 8, color: "#5b5f6b" }}>
                Aún no hay segmentos guardados.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
