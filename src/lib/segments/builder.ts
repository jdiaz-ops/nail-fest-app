import { db } from "@/lib/db";
import type { Person } from "@prisma/client";

/**
 * One shared segment engine, two consumers: Meta/TikTok/Google audience
 * sync, and the email broadcast composer. See docs/PLAN.md.
 *
 * `event` = registered (CONFIRMED), regardless of whether they actually
 * showed up — the original proxy for "went" before check-in data existed.
 * `attended` = real door check-in (Registration.checkedInCount > 0), from
 * the scanning app once that ships, or backfilled on historical import
 * (see /admin/import — checkedInCount is per-ticket, not a re-entry log;
 * see docs/IMPORT.md). Use `attended` for "no asistió a X" segments —
 * `event` still answers "registrado a X" regardless of attendance.
 *
 * Each condition holds a LIST of values, not one — "Bogotá y Pereira" is
 * still one `city` condition. Within a condition the values are OR'd
 * (real SQL IN); across DIFFERENT conditions in `include` they're AND'd
 * (unchanged from before this multi-select feature — SegmentComposer.tsx
 * only ever builds at most one condition per field, so "ciudad = Bogotá o
 * Pereira, Y profesión = Manicurista o Estudiante" is exactly one `city`
 * condition intersected with one `profession` condition). `exclude` stays
 * a flat union across every condition regardless of field, same as
 * before — an exclude list is a blocklist: match ANY of it and you're out.
 */

export type SegmentCondition =
  | { field: "event"; eventSlugs: string[] }
  | { field: "attended"; eventSlugs: string[] }
  | { field: "city"; cities: string[] }
  | { field: "profession"; professions: string[] };

export interface SegmentFilter {
  include: SegmentCondition[];
  exclude: SegmentCondition[];
}

/**
 * Segments saved before multi-select existed are still sitting in the DB
 * with the old shape — one scalar value per condition (`eventSlug`/
 * `city`/`profession`, singular). Normalizing on every read here means
 * every consumer (resolveSegment below, and the Meta fast-path in
 * lib/meta/audiences.ts) keeps working on old AND new segments forever,
 * with no migration script and no risk of one silently mis-rewriting a
 * real saved filter. `raw` is deliberately untyped — it's whatever shape
 * actually landed in the JSON column, old or new.
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

async function matchingPersonIds(condition: SegmentCondition): Promise<Set<string>> {
  switch (condition.field) {
    case "event": {
      if (condition.eventSlugs.length === 0) return new Set();
      const rows = await db.registration.findMany({
        where: { status: "CONFIRMED", event: { slug: { in: condition.eventSlugs } } },
        select: { personId: true },
      });
      return new Set(rows.map((r) => r.personId));
    }
    case "attended": {
      if (condition.eventSlugs.length === 0) return new Set();
      const rows = await db.registration.findMany({
        where: { checkedInCount: { gt: 0 }, event: { slug: { in: condition.eventSlugs } } },
        select: { personId: true },
      });
      return new Set(rows.map((r) => r.personId));
    }
    case "city": {
      if (condition.cities.length === 0) return new Set();
      const rows = await db.person.findMany({
        where: { city: { in: condition.cities } },
        select: { id: true },
      });
      return new Set(rows.map((r) => r.id));
    }
    case "profession": {
      if (condition.professions.length === 0) return new Set();
      const rows = await db.person.findMany({
        where: { profession: { in: condition.professions } },
        select: { id: true },
      });
      return new Set(rows.map((r) => r.id));
    }
  }
}

function intersect(sets: Set<string>[]): Set<string> {
  if (sets.length === 0) return new Set();
  return sets.reduce((acc, s) => new Set([...acc].filter((id) => s.has(id))));
}

function union(sets: Set<string>[]): Set<string> {
  return new Set(sets.flatMap((s) => [...s]));
}

export async function resolveSegment(rawFilter: SegmentFilter): Promise<Person[]> {
  const filter = normalizeFilter(rawFilter);

  const includeSets = await Promise.all(filter.include.map(matchingPersonIds));
  // No include conditions = "everyone" (all people with at least one
  // registration) rather than an empty set, so an all-registrants broadcast
  // doesn't require a dummy condition.
  const included =
    includeSets.length > 0
      ? intersect(includeSets)
      : new Set((await db.person.findMany({ select: { id: true } })).map((p) => p.id));

  const excludeSets = await Promise.all(filter.exclude.map(matchingPersonIds));
  const excluded = union(excludeSets);

  const finalIds = [...included].filter((id) => !excluded.has(id));
  if (finalIds.length === 0) return [];

  return db.person.findMany({ where: { id: { in: finalIds } } });
}
