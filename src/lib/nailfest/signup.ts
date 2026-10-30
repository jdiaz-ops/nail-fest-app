import type { Event, Person, Registration } from "@prisma/client";
import { db } from "@/lib/db";
import { confirmationCodeFor, issueQrToken, ticketHolderName, ticketsFor } from "@/lib/ticket";
import { asistireSampleUrl, asistireUrl } from "@/lib/imparables/asistire";
import type { NailFestSignupResult, NailFestSignupScreen } from "@/components/nailfest/SignedUp";
import { defaultNailFestShareText, eventDays, longDates, mapsUrl, NAIL_FEST_DESIGN } from "./confirmation";
import { hasNailFestAsistire } from "./asistire";

// Nail Fest's screen right after signing up (2026-10-30, components/nailfest/
// SignedUp.tsx), for an event that switched it on in «Después de la
// inscripción» (Event.signupScreenDesign): the event's part, built with the
// page, and hers, in /api/register's answer.

const baseUrl = () => (process.env.APP_BASE_URL || "https://nailfest.lat").replace(/\/+$/, "");

/** Whether an event shows it. */
export function showsNailFestSignup(event: Pick<Event, "signupScreenDesign" | "theme" | "format">): boolean {
  return event.signupScreenDesign === NAIL_FEST_DESIGN && hasNailFestAsistire(event);
}

/** The event's part: its days and hours, its place, the invitation for a colleague. */
export async function nailFestSignupScreen(event: Event, timezone: string): Promise<NailFestSignupScreen> {
  const days = eventDays(event, timezone);
  const sameHours = days.every(([, hours]) => hours === days[0]?.[1]);
  const page = new URL(`${baseUrl()}/${event.slug}`);
  page.searchParams.set("utm_source", "whatsapp");
  page.searchParams.set("utm_medium", "referido");
  page.searchParams.set("utm_campaign", "inscripcion");
  const shareText = event.shareText?.trim() || defaultNailFestShareText(event, timezone);
  const paid = await db.ticketType.count({ where: { eventId: event.id, status: "ON_SALE", price: { gt: 0 } } });
  return {
    city: event.city?.trim() || event.name,
    dates: longDates(event, timezone),
    hours: sameHours ? days.slice(0, 1).map(([, hours]) => hours) : days.map(([day, hours]) => `${day}: ${hours.charAt(0).toLowerCase()}${hours.slice(1)}`),
    venue: {
      name: event.venueName?.trim() || null,
      address: [event.venueAddress?.trim(), event.city?.trim()].filter(Boolean).join(", ") || null,
      mapsUrl: mapsUrl(event),
    },
    shareUrl: `https://wa.me/?text=${encodeURIComponent(`${shareText} ${page.toString()}`)}`,
    free: paid === 0,
  };
}

/** Hers: her ticket(s), as in her email — unless she was already signed up (who typed her email gets nothing of hers) — and her «Asistiré». */
export async function nailFestSignupResult(
  registration: Pick<Registration, "id" | "ticketTypeId" | "ticketCount">,
  person: Pick<Person, "firstName" | "lastName" | "email">,
  qrToken: string,
  showTickets: boolean
): Promise<NailFestSignupResult> {
  if (!showTickets) return { tickets: [], asistire: asistireUrl(registration.id) };
  const type = registration.ticketTypeId ? await db.ticketType.findUnique({ where: { id: registration.ticketTypeId }, select: { name: true } }) : null;
  const count = registration.ticketCount ?? 1;
  const holder = [person.firstName, person.lastName].filter(Boolean).join(" ").trim() || person.email;
  const tickets =
    count > 1
      ? ticketsFor(registration.id, count).map((t) => ({
          qr: `/api/ticket-qr/${t.ticketNumber === 1 ? qrToken : t.qrToken}`,
          holder: ticketHolderName(holder, t.ticketNumber),
          label: `${type?.name ?? "Entrada"} · ${t.ticketNumber} de ${count}`,
          code: t.confirmationCode,
        }))
      : [{ qr: `/api/ticket-qr/${qrToken}`, holder, label: type?.name ?? "Entrada general", code: confirmationCodeFor(registration.id) }];
  return { tickets, asistire: asistireUrl(registration.id) };
}

/** Laura's, for the team's preview: a sample ticket (its QR opens nothing) and the sample «Asistiré». */
export async function nailFestSignupSample(event: Pick<Event, "id">): Promise<NailFestSignupResult> {
  const type = await db.ticketType.findFirst({ where: { eventId: event.id, status: "ON_SALE" }, orderBy: { order: "asc" }, select: { name: true } });
  return {
    tickets: [{ qr: `/api/ticket-qr/${issueQrToken("EJEMPLO")}`, holder: "Laura Gómez", label: type?.name ?? "Entrada general", code: "EJEMPLO1" }],
    asistire: asistireSampleUrl(event.id),
  };
}
