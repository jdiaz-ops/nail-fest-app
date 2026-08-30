import { db } from "@/lib/db";
import { getOrderedProfessionOptions } from "@/lib/professions";
import { listLabels } from "@/lib/labels";
import { resolveSegment, type SegmentFilter } from "@/lib/segments/builder";
import SegmentsAdminClient from "@/components/SegmentsAdminClient";
import CrmPageHeader from "../CrmPageHeader";
import StatCard from "../StatCard";

export const dynamic = "force-dynamic";

export default async function SegmentsPage() {
  const [events, professionOptions, cityRows, labels, segmentRows] = await Promise.all([
    db.event.findMany({ orderBy: { startsAt: "asc" } }),
    getOrderedProfessionOptions(),
    // Real distinct city values already on file, not a free-text guess —
    // avoids the typo mismatch a free-text multi-value input would have
    // ("Bogota" vs "Bogotá" silently matching nobody).
    db.person.findMany({ where: { city: { not: null } }, select: { city: true }, distinct: ["city"] }),
    listLabels(),
    db.segmentDefinition.findMany({
      orderBy: { createdAt: "desc" },
      include: { metaSync: true },
    }),
  ]);
  const labelOptions = labels.map((l) => l.name);
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

      <SegmentsAdminClient
        events={events}
        professionOptions={professionOptions}
        cityOptions={cityOptions}
        labelOptions={labelOptions}
        segments={segments}
      />
    </div>
  );
}
