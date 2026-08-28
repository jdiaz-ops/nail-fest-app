import { db } from "@/lib/db";
import type { Event, EventStatus } from "@prisma/client";

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
      description: input.description || null,
      imageUrl: input.imageUrl,
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
      description: input.description || null,
      imageUrl: input.imageUrl,
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
