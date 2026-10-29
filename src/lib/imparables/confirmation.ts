import type { Event } from "@prisma/client";
import { db } from "@/lib/db";
import { getOrgSettings } from "@/lib/settings";
import { publicEventName } from "@/lib/eventDisplayName";
import { utcToZonedInputValue } from "@/lib/dateFormat";
import { parseLandingBlocks } from "@/lib/landingBlocks/types";
import { sayName } from "@/lib/mesa/email";
import { ZOOM_ACCESS_REMINDER_MINUTES_BEFORE } from "@/lib/zoomAccessReminder";
import { castOf } from "./blocks";
import { getActiveStage, purchaseOf } from "./pricing";
import { clock, coverName, eventWhen } from "./schedule";
import { pesos, type SalesState } from "./stages";
import { googleCalendarUrl, imparablesConfirmationEmail, shareLine, type CalendarEvent, type ImparablesConfirmation } from "./confirmationEmail";

// What Manicuristas Imparables' own confirmation email says
// (lib/imparables/confirmationEmail.ts), from the database: the event, its
// speakers on its page, what she bought, the stages today, the team's
// WhatsApp. Used by sendTicketEmail when the event chose this design in
// «Confirmación del evento» (Event.confirmationEmailDesign), and for that
// page's preview.

export const IMPARABLES_DESIGN = "IMPARABLES";

const baseUrl = () => (process.env.APP_BASE_URL || "https://nailfest.lat").replace(/\/+$/, "");

/** The congress in a calendar: from its start to its end (or eleven hours later), with how she gets in. */
export function calendarEventOf(event: Pick<Event, "id" | "slug" | "name" | "publicName" | "startsAt" | "endsAt">): CalendarEvent {
  return {
    uid: `${event.id}@nailfest.lat`,
    title: coverName(publicEventName(event)),
    start: event.startsAt,
    end: event.endsAt ?? new Date(event.startsAt.getTime() + 11 * 3_600_000),
    description: `Congreso virtual 100% en vivo por Zoom. Tu enlace personal te llega por correo y WhatsApp ${ZOOM_ACCESS_REMINDER_MINUTES_BEFORE} minutos antes de empezar.`,
    location: "Zoom (tu enlace te llega por correo y WhatsApp)",
    url: `${baseUrl()}/${event.slug}`,
  };
}

async function confirmationOf(
  event: Event,
  her: { firstName: string | null; code: string; purchase: { stage: string; paid: string } | null },
  sales: SalesState
): Promise<ImparablesConfirmation> {
  const [orgSettings, whatsapp] = await Promise.all([
    getOrgSettings(),
    db.whatsAppConnection.findFirst({ orderBy: { createdAt: "desc" }, select: { displayPhoneNumber: true } }),
  ]);
  const tz = orgSettings.timezone;
  const base = baseUrl();
  const when = eventWhen(event, tz);
  const [hh, mm] = utcToZonedInputValue(event.startsAt, tz).slice(11, 16).split(":").map(Number);
  const name = coverName(publicEventName(event));
  const page = new URL(`${base}/${event.slug}`);
  page.searchParams.set("utm_source", "whatsapp");
  page.searchParams.set("utm_medium", "referido");
  page.searchParams.set("utm_campaign", "confirmacion");
  const { speakers, panels } = castOf(parseLandingBlocks(event.landingBlocks).filter((b) => !b.hidden));
  const absolute = (url: string) => (/^https?:\/\//.test(url) ? url : `${base}${url.startsWith("/") ? "" : "/"}${url}`);
  const digits = whatsapp?.displayPhoneNumber?.replace(/\D/g, "") ?? "";
  const calendar = calendarEventOf(event);
  return {
    firstName: sayName(her.firstName),
    eventName: name,
    date: when.dates,
    hours: when.hours,
    zone: tz === "America/Bogota" ? "hora Colombia" : `hora de ${tz.split("/").pop()?.replace(/_/g, " ")}`,
    day: when.short,
    start: Number.isFinite(hh) && Number.isFinite(mm) ? clock(hh!, mm!) : null,
    linkMinutesBefore: ZOOM_ACCESS_REMINDER_MINUTES_BEFORE,
    oneDay: when.days.length <= 1,
    purchase: her.purchase,
    code: her.code,
    calendar: { google: googleCalendarUrl(calendar), ics: `${base}/${event.slug}/calendario` },
    share: {
      line: shareLine(sales.current ? pesos(sales.current.price) : null, sales.current && sales.next ? pesos(sales.next.price) : null),
      url: `https://wa.me/?text=${encodeURIComponent(`Mira este congreso para manicuristas: ${name}, ${when.short}, 100% en vivo. ${page.toString()}`)}`,
    },
    helpUrl: digits.length >= 8 ? `https://wa.me/${digits}` : null,
    speakers: speakers.filter((p) => p.photoUrl).map((p) => ({ name: p.name.trim().split(/\s+/)[0]!, photoUrl: absolute(p.photoUrl) })),
    panel: panels > 0,
    images: { header: `${base}/imparables/correo-cabecera.png`, logo: `${base}/logo.png` },
    site: { url: base, host: new URL(base).host.replace(/^www\./, "") },
  };
}

/** Her confirmation in this design, when her event chose it; null otherwise (the usual template then). */
export async function imparablesConfirmationFor(
  registrationId: string,
  her: { firstName: string | null; code: string }
): Promise<{ html: string; text: string } | null> {
  const registration = await db.registration.findUnique({ where: { id: registrationId }, include: { event: true } });
  if (!registration || registration.event.confirmationEmailDesign !== IMPARABLES_DESIGN) return null;
  const purchase = await purchaseOf(registrationId);
  const sales = purchase?.sales ?? (await getActiveStage(registration.event));
  const data = await confirmationOf(
    registration.event,
    { firstName: her.firstName, code: her.code, purchase: purchase ? { stage: purchase.stage.name, paid: purchase.paid } : null },
    sales
  );
  return imparablesConfirmationEmail(data);
}

/** The design as a buyer at today's price would get it — «Laura», a sample code — for «Confirmación del evento». */
export async function imparablesConfirmationPreview(eventId: string): Promise<{ html: string; text: string } | null> {
  const event = await db.event.findUnique({ where: { id: eventId } });
  if (!event) return null;
  const sales = await getActiveStage(event);
  const stage = sales.current ?? sales.active;
  return imparablesConfirmationEmail(
    await confirmationOf(event, { firstName: "Laura", code: "EJEMPLO1", purchase: stage ? { stage: stage.name, paid: pesos(stage.price) } : null }, sales)
  );
}
