import { db } from "@/lib/db";
import type { Person } from "@prisma/client";

// Recipients for an event-scoped broadcast — "All ticket buyers" or
// "Ticket buyers who bought a specific ticket type", Ticket Tailor's own
// two real options (the others it shows — waitlist sign-ups — don't apply
// here, this app has no waitlist feature). Deliberately resolved directly
// from real registrations rather than requiring a named SegmentDefinition
// first, unlike the original /admin/crm/broadcasts flow — "everyone
// registered for this event" is a mechanical, obviously-scoped audience,
// not something that benefits from the general segment builder.
export async function resolveEventBroadcastRecipients(eventId: string, ticketTypeId?: string | null): Promise<Person[]> {
  const registrations = await db.registration.findMany({
    where: { eventId, status: "CONFIRMED", ...(ticketTypeId ? { ticketTypeId } : {}) },
    include: { person: true },
  });
  // One row per Person, not per registration — Registration has a unique
  // (personId, eventId) constraint already, so this is really just
  // deduping the include shape, not collapsing anything real.
  const byId = new Map(registrations.map((r) => [r.personId, r.person]));
  return [...byId.values()];
}

export async function countEventBroadcastRecipients(eventId: string, ticketTypeId?: string | null): Promise<number> {
  return db.registration.count({ where: { eventId, status: "CONFIRMED", ...(ticketTypeId ? { ticketTypeId } : {}) } });
}
