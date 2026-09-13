import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";

// Per-broadcast engagement counts — built for the 49k reactivation
// campaign's own "olas": before this, /admin/crm/broadcasts' history
// showed only a raw "Enviados" count (EmailBroadcast._count.logs), with
// no way to see whether a wave actually landed (delivered/opened) or hurt
// the list (bounced/complained). Deliberately NOT counted from
// EmailLog.status alone — status is only "furthest stage reached" (see
// tracking.ts's own comment), so someone who opened AND later clicked
// would silently disappear from an "opened" count keyed off status alone.
// Each column here is its own independent "did this timestamp get set"
// count instead.
export interface BroadcastEmailStats {
  total: number;
  sent: number;
  delivered: number;
  opened: number;
  clicked: number;
  bounced: number;
  complained: number;
  failed: number;
}

const EMPTY_STATS: BroadcastEmailStats = {
  total: 0,
  sent: 0,
  delivered: 0,
  opened: 0,
  clicked: 0,
  bounced: 0,
  complained: 0,
  failed: 0,
};

/** One aggregate query for however many broadcasts are on the page —
 * never N+1 (a broadcast to a real Nail Fest segment can have thousands
 * of EmailLog rows; fetching those into Node to count in JS doesn't
 * scale the way a SQL COUNT(*) FILTER does). Returns a Map so callers can
 * look up by broadcast id and fall back to EMPTY_STATS for one with no
 * logs yet (still DRAFT, or send hasn't started). */
export async function getBroadcastEmailStats(broadcastIds: string[]): Promise<Map<string, BroadcastEmailStats>> {
  const map = new Map<string, BroadcastEmailStats>();
  if (broadcastIds.length === 0) return map;

  const rows = await db.$queryRaw<
    Array<{
      broadcastId: string;
      total: bigint;
      sent: bigint;
      delivered: bigint;
      opened: bigint;
      clicked: bigint;
      bounced: bigint;
      complained: bigint;
      failed: bigint;
    }>
  >(Prisma.sql`
    SELECT
      "broadcastId",
      COUNT(*) AS total,
      COUNT(*) FILTER (WHERE status != 'FAILED') AS sent,
      COUNT(*) FILTER (WHERE "deliveredAt" IS NOT NULL) AS delivered,
      COUNT(*) FILTER (WHERE "openedAt" IS NOT NULL) AS opened,
      COUNT(*) FILTER (WHERE "firstClickedAt" IS NOT NULL) AS clicked,
      COUNT(*) FILTER (WHERE "bouncedAt" IS NOT NULL) AS bounced,
      COUNT(*) FILTER (WHERE "complainedAt" IS NOT NULL) AS complained,
      COUNT(*) FILTER (WHERE status = 'FAILED') AS failed
    FROM "EmailLog"
    WHERE "broadcastId" IN (${Prisma.join(broadcastIds)})
    GROUP BY "broadcastId"
  `);

  for (const row of rows) {
    map.set(row.broadcastId, {
      total: Number(row.total),
      sent: Number(row.sent),
      delivered: Number(row.delivered),
      opened: Number(row.opened),
      clicked: Number(row.clicked),
      bounced: Number(row.bounced),
      complained: Number(row.complained),
      failed: Number(row.failed),
    });
  }
  return map;
}

export function statsFor(map: Map<string, BroadcastEmailStats>, broadcastId: string): BroadcastEmailStats {
  return map.get(broadcastId) ?? EMPTY_STATS;
}

/** Recipients whose EmailLog for this broadcast shows a bounce or spam
 * complaint — the actual "quién rebotó" list an admin needs to eyeball a
 * wave's list-hygiene result (see /admin/crm/broadcasts/[id]). Already
 * excluded from every future send automatically (see
 * lib/email/tracking.ts's auto-suppression) — this is visibility, not the
 * mechanism that protects future sends. */
export async function getBouncedRecipients(broadcastId: string) {
  const logs = await db.emailLog.findMany({
    where: { broadcastId, OR: [{ bouncedAt: { not: null } }, { complainedAt: { not: null } }] },
    select: { personId: true, toEmail: true, bouncedAt: true, complainedAt: true },
    orderBy: { createdAt: "asc" },
  });
  const personIds = [...new Set(logs.map((l) => l.personId).filter((id): id is string => Boolean(id)))];
  const people = await db.person.findMany({
    where: { id: { in: personIds } },
    select: { id: true, firstName: true, lastName: true, city: true },
  });
  const byId = new Map(people.map((p) => [p.id, p]));

  return logs.map((log) => {
    const person = log.personId ? byId.get(log.personId) : undefined;
    return {
      email: log.toEmail,
      name: person ? [person.firstName, person.lastName].filter(Boolean).join(" ") || null : null,
      city: person?.city ?? null,
      bouncedAt: log.bouncedAt,
      complainedAt: log.complainedAt,
    };
  });
}
