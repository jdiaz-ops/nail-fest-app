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
 */

export type SegmentCondition =
  | { field: "event"; eventSlug: string }
  | { field: "attended"; eventSlug: string }
  | { field: "city"; city: string }
  | { field: "profession"; profession: string };

export interface SegmentFilter {
  include: SegmentCondition[];
  exclude: SegmentCondition[];
}

async function matchingPersonIds(condition: SegmentCondition): Promise<Set<string>> {
  switch (condition.field) {
    case "event": {
      const rows = await db.registration.findMany({
        where: { status: "CONFIRMED", event: { slug: condition.eventSlug } },
        select: { personId: true },
      });
      return new Set(rows.map((r) => r.personId));
    }
    case "attended": {
      const rows = await db.registration.findMany({
        where: { checkedInCount: { gt: 0 }, event: { slug: condition.eventSlug } },
        select: { personId: true },
      });
      return new Set(rows.map((r) => r.personId));
    }
    case "city": {
      const rows = await db.person.findMany({
        where: { city: condition.city },
        select: { id: true },
      });
      return new Set(rows.map((r) => r.id));
    }
    case "profession": {
      const rows = await db.person.findMany({
        where: { profession: condition.profession },
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

export async function resolveSegment(filter: SegmentFilter): Promise<Person[]> {
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
