import type { Event } from "@prisma/client";
import { db } from "@/lib/db";
import { getOrgSettings } from "@/lib/settings";
import { publicEventName } from "@/lib/eventDisplayName";
import { formatDateInTz } from "@/lib/dateFormat";
import { parseScheduleDays } from "@/lib/eventSchedule";
import { INSTAGRAM_HANDLE, INSTAGRAM_URL } from "@/lib/brand";
import { sayName } from "@/lib/mesa/email";
import { issueQrToken } from "@/lib/ticket";
import { asistireSampleUrl, asistireUrl } from "@/lib/imparables/asistire";
import { googleCalendarUrl, type CalendarEvent } from "@/lib/imparables/confirmationEmail";
import { defaultInvite, nailFestConfirmationEmail, type NailFestConfirmation, type NailFestTicket } from "./confirmationEmail";
import { eventHeadingOf } from "./titleLettering";

// What Nail Fest's own confirmation email for its in-person events says
// (lib/nailfest/confirmationEmail.ts, 2026-10-30), from the database: the
// event's days and place, her ticket(s), the event's message for a colleague,
// her «Asistiré» link, the team's WhatsApp. Used by
// sendTicketEmail when the event chose this design in «Confirmación del
// evento» (Event.confirmationEmailDesign), and for that page's preview.

export const NAIL_FEST_DESIGN = "NAIL_FEST";

const baseUrl = () => (process.env.APP_BASE_URL || "https://nailfest.lat").replace(/\/+$/, "");
const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
const clock = (d: Date, tz: string) => formatDateInTz(d, { hour: "numeric", minute: "2-digit" }, tz, "es");
/** «2026-11-07»: the day it is there, from its parts (whatever order the locale writes them in). */
function dayKey(d: Date, tz: string): string {
  const parts = new Intl.DateTimeFormat("en-US", { timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(d);
  const part = (type: Intl.DateTimeFormatPartTypes) => parts.find((p) => p.type === type)?.value ?? "";
  return `${part("year")}-${part("month")}-${part("day")}`;
}

type When = Pick<Event, "startsAt" | "endsAt" | "scheduleDays">;

/** Each day with its hours — from the event's schedule, else from its start and end. */
export function eventDays(event: When, tz: string): [string, string][] {
  const label = (d: Date) => cap(formatDateInTz(d, { weekday: "long", day: "numeric" }, tz, "es").replace(",", ""));
  const days = parseScheduleDays(event.scheduleDays);
  if (days.length) {
    return [...days]
      .sort((a, b) => new Date(a.opensAt).getTime() - new Date(b.opensAt).getTime())
      .map((d) => [label(new Date(d.opensAt)), `${clock(new Date(d.opensAt), tz)} a ${clock(new Date(d.closesAt), tz)}`]);
  }
  const end = event.endsAt ?? null;
  if (!end || dayKey(end, tz) === dayKey(event.startsAt, tz)) {
    return [[label(event.startsAt), end ? `${clock(event.startsAt, tz)} a ${clock(end, tz)}` : `Desde las ${clock(event.startsAt, tz)}`]];
  }
  return [
    [label(event.startsAt), `Desde las ${clock(event.startsAt, tz)}`],
    [label(end), `Hasta las ${clock(end, tz)}`],
  ];
}

/** «Sábado 7 y domingo 8 de noviembre», «Sábado 7 de noviembre», «Del viernes 6 al domingo 8 de noviembre». */
export function longDates(event: When, tz: string): string {
  const days = parseScheduleDays(event.scheduleDays);
  const first = days.length ? new Date([...days].sort((a, b) => a.opensAt.localeCompare(b.opensAt))[0]!.opensAt) : event.startsAt;
  const last = days.length ? new Date([...days].sort((a, b) => a.closesAt.localeCompare(b.closesAt)).at(-1)!.closesAt) : (event.endsAt ?? event.startsAt);
  const wd = (d: Date) => formatDateInTz(d, { weekday: "long" }, tz, "es");
  const dm = (d: Date) => formatDateInTz(d, { day: "numeric", month: "long" }, tz, "es");
  const n = (d: Date) => formatDateInTz(d, { day: "numeric" }, tz, "es");
  const month = (d: Date) => formatDateInTz(d, { month: "long" }, tz, "es");
  if (dayKey(first, tz) === dayKey(last, tz)) return cap(`${wd(first)} ${dm(first)}`);
  const span = Math.round((new Date(dayKey(last, tz)).getTime() - new Date(dayKey(first, tz)).getTime()) / 86_400_000);
  if (month(first) === month(last)) return cap(span === 1 ? `${wd(first)} ${n(first)} y ${wd(last)} ${dm(last)}` : `del ${wd(first)} ${n(first)} al ${wd(last)} ${dm(last)}`);
  return cap(span === 1 ? `${wd(first)} ${dm(first)} y ${wd(last)} ${dm(last)}` : `del ${wd(first)} ${dm(first)} al ${wd(last)} ${dm(last)}`);
}

/** The event in a calendar, at its place: from its start to its end. */
export function inPersonCalendarEvent(event: Pick<Event, "id" | "slug" | "name" | "publicName" | "startsAt" | "endsAt" | "venueName" | "venueAddress" | "city">): CalendarEvent {
  return {
    uid: `${event.id}@nailfest.lat`,
    title: publicEventName(event),
    start: event.startsAt,
    end: event.endsAt ?? new Date(event.startsAt.getTime() + 8 * 3_600_000),
    description: "Presenta tu entrada (el código QR de tu correo) en la entrada.",
    location: [event.venueName, event.venueAddress, event.city].filter((s) => s?.trim()).join(", "),
    url: `${baseUrl()}/${event.slug}`,
  };
}

/** The colleague's message when the event has none of its own. */
export function defaultNailFestShareText(event: Event, timezone: string): string {
  return defaultInvite(publicEventName(event), longDates(event, timezone));
}

async function confirmationOf(
  event: Event,
  her: { firstName: string | null; tickets: NailFestTicket[]; people: number; asistire: string | null; pdfAttached: boolean },
  edits: { shareText?: string | null } = {}
): Promise<NailFestConfirmation> {
  const [orgSettings, whatsapp] = await Promise.all([
    getOrgSettings(),
    db.whatsAppConnection.findFirst({ orderBy: { createdAt: "desc" }, select: { displayPhoneNumber: true } }),
  ]);
  const tz = orgSettings.timezone;
  const base = baseUrl();
  const days = eventDays(event, tz);
  const page = new URL(`${base}/${event.slug}`);
  page.searchParams.set("utm_source", "whatsapp");
  page.searchParams.set("utm_medium", "referido");
  page.searchParams.set("utm_campaign", "confirmacion");
  const shareText = (edits.shareText !== undefined ? edits.shareText : event.shareText)?.trim() || defaultNailFestShareText(event, tz);
  const digits = whatsapp?.displayPhoneNumber?.replace(/\D/g, "") ?? "";
  return {
    firstName: sayName(her.firstName),
    eventName: publicEventName(event),
    heading: eventHeadingOf(base, { name: publicEventName(event), startsAt: event.startsAt, endsAt: event.endsAt }, tz, orgSettings.language),
    dates: longDates(event, tz),
    days,
    venue: { name: event.venueName?.trim() || null, address: event.venueAddress?.trim() || null },
    tickets: her.tickets,
    people: her.people,
    pdfAttached: her.pdfAttached,
    calendar: { google: googleCalendarUrl(inPersonCalendarEvent(event)), ics: `${base}/${event.slug}/calendario` },
    asistire: her.asistire ? { url: her.asistire, image: `${base}/nailfest/asistire-muestra.jpg` } : null,
    share: { url: `https://wa.me/?text=${encodeURIComponent(`${shareText} ${page.toString()}`)}` },
    helpUrl: digits.length >= 8 ? `https://wa.me/${digits}` : null,
    instagram: { handle: INSTAGRAM_HANDLE, url: INSTAGRAM_URL },
    images: { logo: `${base}/logo.png` },
    site: { url: base, host: new URL(base).host.replace(/^www\./, "") },
  };
}

/** Her confirmation in this design, when her event chose it; null otherwise (the usual template then). */
export async function nailFestConfirmationFor(
  registrationId: string,
  her: { firstName: string | null; tickets: NailFestTicket[]; people: number; pdfAttached: boolean }
): Promise<{ html: string; text: string } | null> {
  const registration = await db.registration.findUnique({ where: { id: registrationId }, include: { event: true } });
  if (!registration || registration.event.confirmationEmailDesign !== NAIL_FEST_DESIGN) return null;
  const c = await confirmationOf(registration.event, { ...her, asistire: asistireUrl(registration.id) });
  return nailFestConfirmationEmail(c);
}

/** The design as Laura would get it — a sample ticket, the sample «Asistiré» — for «Confirmación del evento» and «Después de la inscripción»;
 * with the editor's message, unsaved, when given. */
export async function nailFestConfirmationPreview(
  eventId: string,
  edits: { shareText?: string | null } = {}
): Promise<{ html: string; text: string } | null> {
  const event = await db.event.findUnique({ where: { id: eventId } });
  if (!event) return null;
  const type = await db.ticketType.findFirst({ where: { eventId, status: "ON_SALE" }, orderBy: { order: "asc" }, select: { name: true } });
  const { attachTicketPdf } = await getOrgSettings();
  const ticket: NailFestTicket = {
    qrImageUrl: `${baseUrl()}/api/ticket-qr/${issueQrToken("EJEMPLO")}`,
    holder: "Laura Gómez",
    label: type?.name ?? "Entrada general",
    code: "EJEMPLO1",
  };
  const c = await confirmationOf(
    event,
    { firstName: "Laura", tickets: [ticket], people: 1, asistire: asistireSampleUrl(event.id), pdfAttached: attachTicketPdf && event.format !== "VIRTUAL" },
    edits
  );
  return nailFestConfirmationEmail(c);
}
