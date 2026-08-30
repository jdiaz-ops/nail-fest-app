// Pure segment-filter types + normalization — deliberately split out of
// builder.ts (which imports `db` and can't be pulled into a client
// component) so SegmentComposer.tsx can normalize a stored filter for its
// edit mode without bundling Prisma into the browser. builder.ts
// re-exports everything here for backward compatibility — every existing
// `from "@/lib/segments/builder"` import keeps working unchanged.

export type SegmentCondition =
  | { field: "event"; eventSlugs: string[] }
  | { field: "attended"; eventSlugs: string[] }
  | { field: "city"; cities: string[] }
  | { field: "profession"; professions: string[] }
  | { field: "label"; labels: string[] };

export interface SegmentFilter {
  include: SegmentCondition[];
  exclude: SegmentCondition[];
}

/**
 * Segments saved before multi-select existed are still sitting in the DB
 * with the old shape — one scalar value per condition (`eventSlug`/
 * `city`/`profession`, singular). Normalizing on every read here means
 * every consumer (resolveSegment in builder.ts, the Meta fast-path in
 * lib/meta/audiences.ts, and SegmentComposer's own edit-mode pre-fill)
 * keeps working on old AND new segments forever, with no migration
 * script and no risk of one silently mis-rewriting a real saved filter.
 * `raw` is deliberately untyped — it's whatever shape actually landed in
 * the JSON column, old or new.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function normalizeCondition(raw: any): SegmentCondition {
  switch (raw?.field) {
    case "event":
      return { field: "event", eventSlugs: raw.eventSlugs ?? (raw.eventSlug ? [raw.eventSlug] : []) };
    case "attended":
      return { field: "attended", eventSlugs: raw.eventSlugs ?? (raw.eventSlug ? [raw.eventSlug] : []) };
    case "city":
      return { field: "city", cities: raw.cities ?? (raw.city ? [raw.city] : []) };
    case "profession":
      return { field: "profession", professions: raw.professions ?? (raw.profession ? [raw.profession] : []) };
    case "label":
      return { field: "label", labels: raw.labels ?? [] };
    default:
      throw new Error(`Unknown segment condition field: ${raw?.field}`);
  }
}

export function normalizeFilter(raw: SegmentFilter): SegmentFilter {
  return {
    include: raw.include.map(normalizeCondition),
    exclude: raw.exclude.map(normalizeCondition),
  };
}
