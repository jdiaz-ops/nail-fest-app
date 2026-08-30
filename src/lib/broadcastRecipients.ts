import { db } from "@/lib/db";
import type { Person } from "@prisma/client";

// Registration fields needed to build a personalized entrada PDF for a
// recipient (see broadcasts.ts's use of renderTicketPdfBuffer) — kept to
// exactly what that needs, not the whole Registration row.
export interface RecipientRegistration {
  id: string;
  qrToken: string | null;
  ticketTypeId: string | null;
  ticketCount: number;
}

export interface EventBroadcastRecipient {
  person: Person;
  registration: RecipientRegistration;
}

// Recipients for an event-scoped broadcast — "All ticket buyers" or
// "Ticket buyers who bought a specific ticket type", Ticket Tailor's own
// two real options (the others it shows — waitlist sign-ups — don't apply
// here, this app has no waitlist feature). Deliberately resolved directly
// from real registrations rather than requiring a named SegmentDefinition
// first, unlike the original /admin/crm/broadcasts flow — "everyone
// registered for this event" is a mechanical, obviously-scoped audience,
// not something that benefits from the general segment builder.
//
// Returns one entry per Registration (not deduped to one per Person) — a
// Person can only have one CONFIRMED registration per event (unique
// (personId, eventId) constraint), so this is a 1:1 mapping either way,
// but keeping the registration attached is what lets a broadcast attach a
// real, personalized entrada PDF (needs that registration's own qrToken)
// instead of only the person's contact info.
export async function resolveEventBroadcastRecipients(eventId: string, ticketTypeId?: string | null): Promise<EventBroadcastRecipient[]> {
  const registrations = await db.registration.findMany({
    where: { eventId, status: "CONFIRMED", ...(ticketTypeId ? { ticketTypeId } : {}) },
    include: { person: true },
  });
  return registrations.map((r) => ({
    person: r.person,
    registration: { id: r.id, qrToken: r.qrToken, ticketTypeId: r.ticketTypeId, ticketCount: r.ticketCount },
  }));
}

export async function countEventBroadcastRecipients(eventId: string, ticketTypeId?: string | null): Promise<number> {
  return db.registration.count({ where: { eventId, status: "CONFIRMED", ...(ticketTypeId ? { ticketTypeId } : {}) } });
}
