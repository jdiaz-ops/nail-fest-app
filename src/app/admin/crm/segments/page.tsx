import { db } from "@/lib/db";
import { getOrderedProfessionOptions } from "@/lib/professions";
import { listLabels } from "@/lib/labels";
import { resolveSegment, type SegmentFilter } from "@/lib/segments/builder";
import { filterByActiveConsent } from "@/lib/meta/audiences";
import { requirePageUser } from "@/lib/auth/guard";
import SegmentsAdminClient from "@/components/SegmentsAdminClient";
import CrmPageHeader from "../CrmPageHeader";
import StatCard from "../StatCard";

export const dynamic = "force-dynamic";
// Extra headroom on Vercel's default function timeout — this page resolves
// every saved segment (each its own resolveSegment query set) plus one
// shared consent query, over CRMs with tens of thousands of people across
// events. Same reasoning as the chunked-broadcast routes' own maxDuration.
export const maxDuration = 60;

// ADMIN-only — see ImportPage's own comment on why this is gated again
// here, not just hidden from CrmLayout's nav.
export default async function SegmentsPage() {
  await requirePageUser(["ADMIN"]);
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
  //
  // advertisingConsentedCount is that other number, computed live (not
  // just as-of-last-sync) — the same filterByActiveConsent(..., "ADVERTISING")
  // gate syncSegmentAudience actually applies before uploading to Meta. A
  // segment can show a big "Personas" count and a tiny fraction of that
  // here — that's not a sync bug, it's imported/historical people with no
  // ADVERTISING consent on file (see docs/IMPORT.md) genuinely never
  // reaching Meta, on purpose (Ley 1581). Surfacing it here means that gap
  // is visible on this page instead of only showing up as a surprisingly
  // small "estimated audience size" in Meta Ads Manager.
  //
  // ONE shared consent query for the whole page, not one per segment: an
  // earlier version called filterByActiveConsent(people, "ADVERTISING")
  // inside this map, so every saved segment (there can be 10+, some with
  // thousands of members — see the real Bogotá/Cali/Bucaramanga sizes)
  // fired its own large `Consent` query, all in parallel via Promise.all.
  // Against Neon's pooled connection that many concurrent large queries
  // from one request pushed this page past its function timeout — a 500
  // where the page used to load. Deduplicating across every segment's
  // resolved members first means at most one extra query total, however
  // many segments this page has.
  const resolved = await Promise.all(
    segmentRows.map(async (s) => ({
      segment: s,
      people: await resolveSegment(s.filter as unknown as SegmentFilter),
    }))
  );
  const allPersonIds = Array.from(new Set(resolved.flatMap((r) => r.people.map((p) => p.id))));
  const consentedIds = new Set(
    (await filterByActiveConsent(allPersonIds.map((id) => ({ id })), "ADVERTISING")).map((p) => p.id)
  );
  const segments = resolved.map(({ segment, people }) => ({
    ...segment,
    memberCount: people.length,
    advertisingConsentedCount: people.filter((p) => consentedIds.has(p.id)).length,
  }));
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
