import type { Person } from "@prisma/client";
import { db } from "@/lib/db";
import { normalizeFilter, resolveSegment, type SegmentFilter } from "@/lib/segments/builder";
import { broadcastOutcomes } from "./broadcasts";

// The ones a difusión didn't reach (the team, 2026-11-07: «domingo_cucuta»
// went out a day early and was stopped — tomorrow, the rest, never twice to
// a number that already got it). Everyone its segment holds today, each
// with how it went for their number; and a segment of the ones it didn't
// reach: its own conditions, minus the people it did reach as «personas
// específicas» (no label: the team, 2026-11-07), so it reads and edits like
// any other — and whoever joins its conditions later is in it too.

export interface NotReachedPerson {
  person: Pick<Person, "id" | "firstName" | "lastName" | "phone" | "email">;
  outcome: "received" | "failed" | "none";
}

export class NotReachedError extends Error {}

async function loadBroadcast(broadcastId: string) {
  const broadcast = await db.whatsAppBroadcast.findUnique({ where: { id: broadcastId }, include: { segment: true, template: true } });
  if (!broadcast) throw new NotReachedError("Esa difusión no existe.");
  if (!broadcast.segment) throw new NotReachedError("Esto es para difusiones enviadas a un segmento.");
  return { ...broadcast, segment: broadcast.segment };
}

/** Its segment's people today, each with how the difusión went for their number. */
export async function difusionOutcomes(broadcastId: string): Promise<{ people: NotReachedPerson[]; template: string; segment: string }> {
  const broadcast = await loadBroadcast(broadcastId);
  const [people, outcomeOf] = await Promise.all([
    resolveSegment(broadcast.segment.filter as unknown as SegmentFilter),
    broadcastOutcomes(broadcast.id),
  ]);
  return { people: people.map((person) => ({ person, outcome: outcomeOf(person) })), template: broadcast.template.name, segment: broadcast.segment.name };
}

/** A segment of the ones it didn't reach — made again (not twice) if asked again. */
export async function segmentOfNotReached(
  broadcastId: string,
): Promise<{ segmentId: string; segmentName: string; audience: number; received: number; failed: number; none: number }> {
  const broadcast = await loadBroadcast(broadcastId);
  const { people } = await difusionOutcomes(broadcastId);
  const reached = people.filter((p) => p.outcome === "received").map((p) => p.person.id);

  const original = normalizeFilter(broadcast.segment.filter as unknown as SegmentFilter);
  const filter: SegmentFilter = {
    include: original.include,
    exclude: [...original.exclude, ...(reached.length ? [{ field: "person" as const, personIds: reached }] : [])],
  };
  const segmentName = `${broadcast.segment.name} · sin ${broadcast.template.name}`;
  const segment = await saveSegment(segmentName, filter);

  const count = (o: NotReachedPerson["outcome"]) => people.filter((p) => p.outcome === o).length;
  return { segmentId: segment.id, segmentName, audience: people.length, received: reached.length, failed: count("failed"), none: count("none") };
}

/** A segment of the ones it did reach (the team, 2026-11-07): exactly those people, as «personas específicas» —
 * made again (not twice) if asked again. */
export async function segmentOfReached(broadcastId: string): Promise<{ segmentId: string; segmentName: string; audience: number; received: number }> {
  const broadcast = await loadBroadcast(broadcastId);
  const { people } = await difusionOutcomes(broadcastId);
  const reached = people.filter((p) => p.outcome === "received").map((p) => p.person.id);
  if (reached.length === 0) throw new NotReachedError("Nadie de su segmento la recibió todavía.");
  const segmentName = `${broadcast.segment.name} · recibieron ${broadcast.template.name}`;
  const segment = await saveSegment(segmentName, { include: [{ field: "person", personIds: reached }], exclude: [] });
  return { segmentId: segment.id, segmentName, audience: people.length, received: reached.length };
}

/** Saved under its name: the one already there is updated, never a second one. */
async function saveSegment(name: string, filter: SegmentFilter) {
  const existing = await db.segmentDefinition.findFirst({ where: { name } });
  return existing
    ? db.segmentDefinition.update({ where: { id: existing.id }, data: { filter: filter as never } })
    : db.segmentDefinition.create({ data: { name, filter: filter as never } });
}
