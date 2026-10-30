import type { Event } from "@prisma/client";
import { db } from "@/lib/db";
import { getOrgSettings } from "@/lib/settings";
import { publicEventName } from "@/lib/eventDisplayName";
import { INSTAGRAM_HANDLE, INSTAGRAM_URL } from "@/lib/brand";
import { sanitizeEventDescription } from "@/lib/sanitizeHtml";
import { REVIEW_LINK_TAG } from "@/lib/reviews";
import { longDates, NAIL_FEST_DESIGN } from "./confirmation";
import { hasNailFestAsistire } from "./asistire";
import { nailFestEventEmail, type NailFestEventEmailFrame } from "./eventEmail";

// The event's part of Nail Fest's design for its emails (2026-10-30,
// lib/nailfest/eventEmail.ts): its city, days and place, the team's
// WhatsApp, the Instagram — the same for each of its emails and each person.

const baseUrl = () => (process.env.APP_BASE_URL || "https://nailfest.lat").replace(/\/+$/, "");

/** Whether an event's emails go in Nail Fest's design: it chose it, and it's one of Nail Fest's at a place. */
export function usesNailFestEventEmail(event: Pick<Event, "broadcastDesign" | "theme" | "format">): boolean {
  return event.broadcastDesign === NAIL_FEST_DESIGN && hasNailFestAsistire(event);
}

export async function nailFestEventEmailFrame(event: Event): Promise<NailFestEventEmailFrame> {
  const [orgSettings, whatsapp] = await Promise.all([
    getOrgSettings(),
    db.whatsAppConnection.findFirst({ orderBy: { createdAt: "desc" }, select: { displayPhoneNumber: true } }),
  ]);
  const base = baseUrl();
  const digits = whatsapp?.displayPhoneNumber?.replace(/\D/g, "") ?? "";
  return {
    eventName: publicEventName(event),
    city: event.city?.trim() || publicEventName(event),
    dates: longDates(event, orgSettings.timezone),
    venue: event.venueName?.trim() || null,
    helpUrl: digits.length >= 8 ? `https://wa.me/${digits}` : null,
    instagram: { handle: INSTAGRAM_HANDLE, url: INSTAGRAM_URL },
    logo: `${base}/logo.png`,
    site: { url: base, host: new URL(base).host.replace(/^www\./, "") },
  };
}

/** One of its emails in the design with sample data — its personal links as examples —, for the composer's
 * preview, the list's «Ver con el diseño» and its test emails. */
export async function nailFestEventEmailSample(
  event: Event,
  mail: { subject: string; bodyHtml: string; band: string | null; attachTicketPdf: boolean }
): Promise<{ subject: string; text: string; html: string }> {
  const frame = await nailFestEventEmailFrame(event);
  const body = mail.bodyHtml
    .split("{{ZOOM_LINK}}")
    .join("https://zoom.us/j/000000000")
    .split(REVIEW_LINK_TAG)
    .join(`${baseUrl()}/resena/ejemplo`);
  return nailFestEventEmail(frame, { subject: mail.subject, bodyHtml: sanitizeEventDescription(body), band: mail.band, pdfAttached: mail.attachTicketPdf });
}
