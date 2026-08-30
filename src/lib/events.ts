import { db } from "@/lib/db";
import type { Event, EventStatus } from "@prisma/client";
import { sanitizeEventDescription } from "@/lib/sanitizeHtml";
import { createTicketType } from "@/lib/ticketTypes";

// The public event page's own default when an event doesn't set its own
// (see [eventSlug]/page.tsx) — kept here too so a freshly-created event's
// form field starts on the same text instead of blank, matching what the
// admin actually asked for.
export const DEFAULT_REGISTER_BUTTON_LABEL = "Registrarme GRATIS";

/** "Nail Fest Cali - 5 & 6 Septiembre" -> "nail-fest-cali-5-6-septiembre" —
 * same shape as the existing seeded slugs (e.g. "bogota-2026") so old and
 * new events sit in the same URL scheme, /[eventSlug]. */
function slugify(input: string): string {
  return input
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "") // strip accents (NFD splits é -> e + combining mark)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

/** Appends -2, -3, ... only if the plain slug is already taken — the
 * common case (a genuinely new event name) gets the clean slug, not
 * "-1" appended by default. */
async function uniqueSlug(base: string, excludeId?: string): Promise<string> {
  const root = slugify(base) || "evento";
  let candidate = root;
  let n = 2;
  while (await db.event.findFirst({ where: { slug: candidate, id: excludeId ? { not: excludeId } : undefined } })) {
    candidate = `${root}-${n}`;
    n += 1;
  }
  return candidate;
}

export interface EventInput {
  name: string;
  city: string;
  venueName: string;
  venueAddress: string;
  description: string;
  imageUrl: string | null;
  registerButtonLabel: string;
  startsAt: Date;
  endsAt: Date | null;
  capacity: number | null;
  status: EventStatus;
  // Only used on create when the admin wants a specific URL instead of
  // the auto-generated one (e.g. matching an already-promoted Ticket
  // Tailor link) — left blank, the name is slugified instead.
  slug?: string;
}

/** New events start as DRAFT — matches Ticket Tailor's own behavior
 * (see the EventStatus enum's own comment on why the DB-level default
 * is PUBLISHED instead: that one's a migration safety net, not this). */
export async function createEvent(input: EventInput): Promise<Event> {
  const slug = await uniqueSlug(input.slug?.trim() || input.name);
  return db.event.create({
    data: {
      slug,
      name: input.name,
      city: input.city,
      venueName: input.venueName || null,
      venueAddress: input.venueAddress || null,
      description: input.description ? sanitizeEventDescription(input.description) : null,
      imageUrl: input.imageUrl,
      registerButtonLabel: input.registerButtonLabel.trim() || null,
      startsAt: input.startsAt,
      endsAt: input.endsAt,
      capacity: input.capacity,
      status: input.status,
    },
  });
}

export async function updateEvent(id: string, input: EventInput): Promise<Event> {
  const existing = await db.event.findUniqueOrThrow({ where: { id } });
  const slug =
    input.slug?.trim() && input.slug.trim() !== existing.slug ? await uniqueSlug(input.slug, id) : existing.slug;
  return db.event.update({
    where: { id },
    data: {
      slug,
      name: input.name,
      city: input.city,
      venueName: input.venueName || null,
      venueAddress: input.venueAddress || null,
      description: input.description ? sanitizeEventDescription(input.description) : null,
      imageUrl: input.imageUrl,
      registerButtonLabel: input.registerButtonLabel.trim() || null,
      startsAt: input.startsAt,
      endsAt: input.endsAt,
      capacity: input.capacity,
      status: input.status,
    },
  });
}

export async function setEventStatus(id: string, status: EventStatus): Promise<Event> {
  return db.event.update({ where: { id }, data: { status } });
}

/** "Copiar a nuevo evento" — the explicit ask behind this: opening a new
 * city shouldn't mean rebuilding everything from zero. Copies the event's
 * own configuration (name/venue/description/image/button label/capacity,
 * and every TicketType row) into a brand-new Event with its own id, slug,
 * landing URL, and — since nothing here touches Registration/ScanLog —
 * its own empty registration history and stats, same as any other event.
 * Always lands as DRAFT regardless of the source event's status, same
 * reasoning as createEvent: a copy is a starting point to edit (new
 * dates, maybe a new city), not something that should go live immediately
 * under the old event's name. Dates are NOT copied (the one field an
 * admin always has to set for a new city) — startsAt defaults to 7 days
 * out so the record is valid until edited, not a silent copy of a date
 * that's already passed.
 *
 * NOTE for future maintainers: when a per-event field is added elsewhere
 * (e.g. a stored Event confirmation template override), decide there
 * whether it belongs in this copy too — this function won't pick it up
 * automatically.
 */
export async function duplicateEvent(sourceId: string): Promise<Event> {
  const source = await db.event.findUniqueOrThrow({ where: { id: sourceId }, include: { ticketTypes: true } });
  const slug = await uniqueSlug(`${source.name} copia`);
  const copy = await db.event.create({
    data: {
      slug,
      name: `${source.name} (copia)`,
      city: source.city,
      venueName: source.venueName,
      venueAddress: source.venueAddress,
      description: source.description,
      imageUrl: source.imageUrl,
      registerButtonLabel: source.registerButtonLabel,
      startsAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      endsAt: null,
      capacity: source.capacity,
      status: "DRAFT",
    },
  });
  for (const tt of source.ticketTypes.sort((a, b) => a.order - b.order)) {
    await createTicketType(copy.id, {
      name: tt.name,
      quantity: tt.quantity,
      price: tt.price,
      bookingFee: tt.bookingFee,
      description: tt.description ?? "",
      status: tt.status,
      minPerOrder: tt.minPerOrder,
      maxPerOrder: tt.maxPerOrder,
      issuance: tt.issuance,
      hideUntil: tt.hideUntil,
      hideAfter: tt.hideAfter,
      hideWhenSoldOut: tt.hideWhenSoldOut,
      showRemainingOnPage: tt.showRemainingOnPage,
      excludeFromLowestPrice: tt.excludeFromLowestPrice,
    });
  }
  return copy;
}

/** Thrown by deleteEvent when the event has real people attached to it —
 * the caller (the API route) turns this into a 409 with a message the
 * admin actually understands, instead of a raw DB foreign-key error. */
export class EventHasRegistrationsError extends Error {
  constructor(public count: number) {
    super(`event has ${count} registration(s), refusing to delete`);
  }
}

/** "Borrar evento" — deliberately narrow: only ever deletes an event that
 * has NEVER had a real person register for it (CONFIRMED or even just
 * STARTED an abandoned cart) — Registration has no onDelete cascade in
 * the schema on purpose (see prisma/schema.prisma), so this is the one
 * real safety net against a click wiping out attendee/check-in history.
 * An event with people should be set to Draft (hides it, keeps the
 * data) instead — see setEventStatus above — not deleted.
 *
 * TicketType and EmailBroadcast rows DO cascade automatically (schema-
 * level onDelete: Cascade) since they carry no person data of their own.
 * ScanLog doesn't cascade (nullable scannedForEventId, not owned by the
 * event the way ticket types are) but with zero registrations there's
 * nothing meaningful left in it for this event besides invalid-scan
 * noise (WRONG_EVENT/NOT_FOUND rows logged while a scanner happened to
 * be set to this event) — cleared explicitly so the delete doesn't fail
 * on a leftover FK reference to rows nobody would ever look at again. */
export async function deleteEvent(id: string): Promise<void> {
  const registrationCount = await db.registration.count({ where: { eventId: id } });
  if (registrationCount > 0) throw new EventHasRegistrationsError(registrationCount);

  await db.$transaction([
    db.scanLog.deleteMany({ where: { scannedForEventId: id } }),
    db.event.delete({ where: { id } }),
  ]);
}
