import type { Event } from "@prisma/client";
import { db } from "@/lib/db";
import { getOrgSettings } from "@/lib/settings";
import { publicEventName } from "@/lib/eventDisplayName";
import { utcToZonedInputValue } from "@/lib/dateFormat";
import { parseLandingBlocks } from "@/lib/landingBlocks/types";
import { sayName } from "@/lib/mesa/email";
import { ZOOM_ACCESS_REMINDER_MINUTES_BEFORE } from "@/lib/zoomAccessReminder";
import { asistireSampleUrl, asistireUrl } from "./asistire";
import { castOf } from "./blocks";
import { getActiveStage, purchaseOf } from "./pricing";
import { clock, coverName, eventWhen } from "./schedule";
import { pesos, type SalesState } from "./stages";
import { versionLive } from "./versions";
import { TIER_EMAIL, tierBySlug, tiersAbove } from "./tiers";
import { paidLabel, upgradeUrl } from "./tiersServer";
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

/** «Compartir por WhatsApp»'s message when the event has none of its own: «Mira este congreso para manicuristas: Manicuristas Imparables, 27 de junio, 100% en vivo.» */
export function defaultShareText(event: Event, timezone: string): string {
  return `Mira este congreso para manicuristas: ${coverName(publicEventName(event))}, ${eventWhen(event, timezone).short}, 100% en vivo.`;
}

async function confirmationOf(
  event: Event,
  her: {
    firstName: string | null;
    code: string;
    purchase: { stage: string; paid: string } | null;
    asistire: string;
    level?: ImparablesConfirmation["level"];
  },
  sales: SalesState,
  shareText: string | null = event.shareText
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
  const { speakers } = castOf(parseLandingBlocks(event.landingBlocks).filter((b) => !b.hidden));
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
    purchase: her.purchase,
    level: her.level ?? null,
    code: her.code,
    calendar: { google: googleCalendarUrl(calendar), ics: `${base}/${event.slug}/calendario` },
    share: {
      line: shareLine(sales.current ? pesos(sales.current.price) : null, sales.current && sales.next ? pesos(sales.next.price) : null),
      // The event's own message («Confirmación del evento»), else the default; the page's link after it.
      url: `https://wa.me/?text=${encodeURIComponent(`${shareText?.trim() || defaultShareText(event, tz)} ${page.toString()}`)}`,
    },
    asistire: { url: her.asistire, image: `${base}/imparables/asistire-muestra.jpg` },
    helpUrl: digits.length >= 8 ? `https://wa.me/${digits}` : null,
    speakers: speakers.filter((p) => p.photoUrl).map((p) => ({ name: p.name.trim().split(/\s+/)[0]!, photoUrl: absolute(p.photoUrl) })),
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
  // Her level (lib/imparables/tiers.ts): Imparable says its stage too; Círculo and Élite, what she paid.
  const tier = tierBySlug(registration.tierSlug);
  const data = await confirmationOf(
    registration.event,
    {
      firstName: her.firstName,
      code: her.code,
      purchase: purchase ? { stage: purchase.stage.name, paid: purchase.paid } : tier ? { stage: tier.name, paid: await paidLabel(registrationId) } : null,
      asistire: asistireUrl(registrationId),
      level: tier
        ? {
            name: tier.name,
            next: TIER_EMAIL.next[tier.slug] ?? null,
            upgrade: tiersAbove(tier.slug).length > 0 ? { url: upgradeUrl(registrationId), line: TIER_EMAIL.upgradeLine } : null,
          }
        : null,
    },
    sales
  );
  return imparablesConfirmationEmail(data);
}

/** What the payment's page shows a buyer of Manicuristas Imparables
 * (2026-10-30, components/imparables/ImpPaymentResult.tsx): her confirmation's
 * own data — her name, the steps' day and hour, the colleague's message, the
 * team's WhatsApp — her email, and her image's page. "muestra": the team's
 * preview, for Laura; a purchase not found (or another event's): no name, no
 * email, no image — and the image only once it's paid. `retry`: where trying
 * again goes — the checkout of the version she came through while it shows
 * (2026-10-30, lib/imparables/versions.ts), else the event's. */
export async function imparablesAfterPayment(
  event: Event,
  her: { registrationId: string } | "muestra" | null
): Promise<{ c: ImparablesConfirmation; email: string | null; asistire: string | null; retry: string }> {
  const registration =
    her && her !== "muestra"
      ? await db.registration.findUnique({ where: { id: her.registrationId }, include: { person: true, landingVersion: true } })
      : null;
  const mine = registration?.eventId === event.id ? registration : null;
  const asistire = her === "muestra" ? asistireSampleUrl(event.id) : mine?.status === "CONFIRMED" ? asistireUrl(mine.id) : null;
  const c = await confirmationOf(
    event,
    { firstName: her === "muestra" ? "Laura" : (mine?.person.firstName ?? null), code: "", purchase: null, asistire: asistire ?? "" },
    await getActiveStage(event)
  );
  const version = mine?.landingVersion;
  const retry = version && versionLive(version, new Date()) ? `/v/${version.slug}/checkout` : `/${event.slug}/checkout`;
  return { c, email: her === "muestra" ? "laura@correo.com" : (mine?.person.email ?? null), asistire, retry };
}

/** The design as a buyer at today's price would get it — «Laura», a sample code — for «Confirmación del evento»; with the editor's share message, unsaved, when given. */
export async function imparablesConfirmationPreview(eventId: string, unsaved: { shareText?: string | null } = {}): Promise<{ html: string; text: string } | null> {
  const event = await db.event.findUnique({ where: { id: eventId } });
  if (!event) return null;
  const sales = await getActiveStage(event);
  const stage = sales.current ?? sales.active;
  return imparablesConfirmationEmail(
    await confirmationOf(
      event,
      // No purchase behind the sample: its «Crear mi imagen» opens the team's sample of the image maker.
      { firstName: "Laura", code: "EJEMPLO1", purchase: stage ? { stage: stage.name, paid: pesos(stage.price) } : null, asistire: asistireSampleUrl(event.id) },
      sales,
      unsaved.shareText !== undefined ? unsaved.shareText : event.shareText
    )
  );
}
