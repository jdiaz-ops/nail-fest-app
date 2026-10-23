import { db } from "@/lib/db";
import type { Person, Prisma } from "@prisma/client";

// Registration fields needed to build a personalized entrada PDF for a
// recipient (see broadcasts.ts's use of renderTicketPdfBuffer), plus
// zoomJoinUrl — this registrant's own personal Zoom link, so an admin
// can insert {{ZOOM_LINK}} into a "Correo del evento" (see
// sendEventBroadcast's own comment on why this is opt-in, admin-timed,
// unlike the automatic ZOOM_ACCESS_REMINDER).
export interface RecipientRegistration {
  id: string;
  qrToken: string | null;
  ticketTypeId: string | null;
  ticketCount: number;
  zoomJoinUrl: string | null;
}

export interface EventBroadcastRecipient {
  person: Person;
  registration: RecipientRegistration;
}

// Recipients for an event-scoped broadcast — "All ticket buyers" or
// "Ticket buyers who bought a specific ticket type", our previous
// ticketing platform's own two real options (the others it shows —
// waitlist sign-ups — don't apply
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
//
// Either audience can be narrowed by attendance (EventBroadcastCheckIn).

/** Who among the buyers: everyone, only those already scanned at the door
 * (checkedInCount > 0 — the review ask), or only those nobody has scanned
 * yet (checkedInCount = 0 — "te estamos esperando", asked on 2026-10-23). */
export type EventBroadcastCheckIn = "all" | "checkedIn" | "notCheckedIn";

/** A broadcast's (or a form's) two flags as one audience. */
export function checkInOf(flags: { onlyCheckedIn: boolean; onlyNotCheckedIn: boolean }): EventBroadcastCheckIn {
  return flags.onlyCheckedIn ? "checkedIn" : flags.onlyNotCheckedIn ? "notCheckedIn" : "all";
}

export function eventBroadcastRecipientWhere(eventId: string, ticketTypeId: string | null | undefined, checkIn: EventBroadcastCheckIn): Prisma.RegistrationWhereInput {
  return {
    eventId,
    status: "CONFIRMED",
    ...(ticketTypeId ? { ticketTypeId } : {}),
    ...(checkIn === "checkedIn" ? { checkedInCount: { gt: 0 } } : checkIn === "notCheckedIn" ? { checkedInCount: 0 } : {}),
  };
}

export async function resolveEventBroadcastRecipients(eventId: string, ticketTypeId?: string | null, checkIn: EventBroadcastCheckIn = "all"): Promise<EventBroadcastRecipient[]> {
  const registrations = await db.registration.findMany({
    where: eventBroadcastRecipientWhere(eventId, ticketTypeId, checkIn),
    include: { person: true },
  });
  return registrations.map((r) => ({
    person: r.person,
    registration: { id: r.id, qrToken: r.qrToken, ticketTypeId: r.ticketTypeId, ticketCount: r.ticketCount, zoomJoinUrl: r.zoomJoinUrl },
  }));
}

export async function countEventBroadcastRecipients(eventId: string, ticketTypeId?: string | null, checkIn: EventBroadcastCheckIn = "all"): Promise<number> {
  return db.registration.count({ where: eventBroadcastRecipientWhere(eventId, ticketTypeId, checkIn) });
}

export interface AudienceCount {
  count: number;
  /** Already scanned at the door; the ones not scanned yet are the rest. */
  checkedIn: number;
}

/** The composer's numbers: for all buyers and per ticket type, how many
 * there are and how many were already scanned — two queries, not one per
 * type and audience. */
export async function eventBroadcastAudienceCounts(eventId: string): Promise<{ all: AudienceCount; byTicketType: Map<string, AudienceCount> }> {
  const [everyone, scanned] = await Promise.all([
    db.registration.groupBy({ by: ["ticketTypeId"], where: eventBroadcastRecipientWhere(eventId, null, "all"), _count: { _all: true } }),
    db.registration.groupBy({ by: ["ticketTypeId"], where: eventBroadcastRecipientWhere(eventId, null, "checkedIn"), _count: { _all: true } }),
  ]);
  const all: AudienceCount = { count: 0, checkedIn: 0 };
  const byTicketType = new Map<string, AudienceCount>();
  for (const row of everyone) {
    all.count += row._count._all;
    if (row.ticketTypeId) byTicketType.set(row.ticketTypeId, { count: row._count._all, checkedIn: 0 });
  }
  for (const row of scanned) {
    all.checkedIn += row._count._all;
    const entry = row.ticketTypeId ? byTicketType.get(row.ticketTypeId) : undefined;
    if (entry) entry.checkedIn = row._count._all;
  }
  return { all, byTicketType };
}
