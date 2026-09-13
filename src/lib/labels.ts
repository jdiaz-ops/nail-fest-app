import { db } from "@/lib/db";

/** Case-sensitive exact match, created on first use — same "type a name
 * and hit enter to create" UX as WhatChimp's own Labels field. Reused
 * everywhere a label gets attached (broadcast "assign after send",
 * conversation/person labeling) so two different call sites typing the
 * same name never end up with two rows. */
export async function getOrCreateLabel(name: string) {
  const trimmed = name.trim();
  if (!trimmed) throw new Error("Label name cannot be empty");
  return db.label.upsert({
    where: { name: trimmed },
    create: { name: trimmed },
    update: {},
  });
}

export async function listLabels() {
  return db.label.findMany({ orderBy: { name: "asc" } });
}

// How many person ids one Label.update's `connect` call takes at once —
// same reasoning as lib/broadcasts.ts's own CHUNK_SIZE: a real Nail Fest
// segment runs in the thousands, and one query trying to connect all of
// them at once is worth avoiding even though Prisma could technically do
// it in one call.
const CONNECT_CHUNK_SIZE = 500;

/** Upserts a Label by name (via getOrCreateLabel above) and connects
 * every given person to it — idempotent (connecting an already-connected
 * Person↔Label pair is a no-op, the join table's own composite key), so
 * calling this again later with an overlapping list only ever grows the
 * label's membership, never duplicates anything. Built for bulk
 * "turn a list of person ids into something the segment builder can
 * target" moves — an external engagement/suppression-list import
 * (/admin/crm/etiquetar), or tagging everyone who opened one broadcast
 * (tag-engagement route) — where connecting one at a time would mean a
 * round trip per person. */
export async function addPeopleToLabel(labelName: string, personIds: string[]): Promise<{ labelId: string }> {
  const label = await getOrCreateLabel(labelName);
  for (let i = 0; i < personIds.length; i += CONNECT_CHUNK_SIZE) {
    const chunk = personIds.slice(i, i + CONNECT_CHUNK_SIZE);
    await db.label.update({
      where: { id: label.id },
      data: { people: { connect: chunk.map((id) => ({ id })) } },
    });
  }
  return { labelId: label.id };
}
