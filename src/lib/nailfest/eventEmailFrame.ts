import type { Event } from "@prisma/client";
import { db } from "@/lib/db";
import { getOrgSettings } from "@/lib/settings";
import { publicEventName } from "@/lib/eventDisplayName";
import { INSTAGRAM_HANDLE, INSTAGRAM_URL } from "@/lib/brand";
import { sanitizeEventDescription } from "@/lib/sanitizeHtml";
import { REVIEW_LINK_TAG } from "@/lib/reviews";
import { probeImageDimensions } from "@/lib/imageDimensions";
import { asistireSampleUrl, asistireUrl } from "@/lib/imparables/asistire";
import { defaultNailFestShareText, NAIL_FEST_DESIGN } from "./confirmation";
import { hasNailFestAsistire } from "./asistire";
import { eventHeadingOf } from "./titleLettering";
import { sampleTickets, TICKET_TAG } from "./eventTickets";
import { nailFestEventEmail, topBlocks, type NailFestEventEmailFrame } from "./eventEmail";

// The event's part of Nail Fest's design for its emails (2026-10-30,
// lib/nailfest/eventEmail.ts): its name, days and place, the invitation for
// a colleague, the team's WhatsApp, the Instagram — the same for each of its
// emails and each person —, and each email's banner to leave out.

const baseUrl = () => (process.env.APP_BASE_URL || "https://nailfest.lat").replace(/\/+$/, "");

/** Whether an event's emails go in Nail Fest's design: it chose it, and it's one of Nail Fest's at a place. */
export function usesNailFestEventEmail(event: Pick<Event, "broadcastDesign" | "theme" | "format">): boolean {
  return event.broadcastDesign === NAIL_FEST_DESIGN && hasNailFestAsistire(event);
}

export async function nailFestEventEmailFrame(event: Event): Promise<NailFestEventEmailFrame> {
  const [orgSettings, whatsapp, paid] = await Promise.all([
    getOrgSettings(),
    db.whatsAppConnection.findFirst({ orderBy: { createdAt: "desc" }, select: { displayPhoneNumber: true } }),
    db.ticketType.count({ where: { eventId: event.id, status: "ON_SALE", price: { gt: 0 } } }),
  ]);
  const base = baseUrl();
  const digits = whatsapp?.displayPhoneNumber?.replace(/\D/g, "") ?? "";
  const page = new URL(`${base}/${event.slug}`);
  page.searchParams.set("utm_source", "whatsapp");
  page.searchParams.set("utm_medium", "referido");
  page.searchParams.set("utm_campaign", "correo_evento");
  const shareText = event.shareText?.trim() || defaultNailFestShareText(event, orgSettings.timezone);
  return {
    eventName: publicEventName(event),
    heading: eventHeadingOf(base, { name: publicEventName(event), startsAt: event.startsAt, endsAt: event.endsAt }, orgSettings.timezone, orgSettings.language),
    venue: event.venueName?.trim() || null,
    share: { url: `https://wa.me/?text=${encodeURIComponent(`${shareText} ${page.toString()}`)}`, free: paid === 0 },
    helpUrl: digits.length >= 8 ? `https://wa.me/${digits}` : null,
    instagram: { handle: INSTAGRAM_HANDLE, url: INSTAGRAM_URL },
    logo: `${base}/logo.png`,
    asistireImage: `${base}/nailfest/asistire-muestra.jpg`,
    site: { url: base, host: new URL(base).host.replace(/^www\./, "") },
  };
}

/** The email's banner: the image it opens with, when it's wide (twice as wide as tall or more) — the frame's header
 * says what it says. A photo it opens with stays; so does any image whose size can't be read. */
export async function bannerOf(bodyHtml: string): Promise<string | null> {
  const first = topBlocks(bodyHtml).find((b) => b.tag !== "p" || b.inner.replace(/<[^>]+>|&nbsp;|\s/g, "") || /<img\b/i.test(b.inner));
  if (!first || !/^(figure|img|p)$/.test(first.tag)) return null;
  const html = first.tag === "img" ? first.outer : first.inner;
  if (html.replace(/<figcaption[\s\S]*?<\/figcaption>/i, "").replace(/<[^>]+>|&nbsp;|\s/g, "")) return null;
  const src = /<img\b[^>]*\bsrc\s*=\s*"([^"]+)"/i.exec(html)?.[1];
  if (!src) return null;
  const size = await probeImageDimensions(src.replace(/&amp;/g, "&")).catch(() => null);
  // probeImageDimensions answers 1600×900 when it can't tell: under 2:1, so that image stays.
  return size && size.width >= 2 * size.height ? src : null;
}

/** Her «Asistiré» link for an email, or none if it can't be signed. */
export function asistireFor(registrationId: string): string | null {
  try {
    return asistireUrl(registrationId);
  } catch {
    return null;
  }
}

/** One of its emails in the design with sample data — its personal links and Laura's ticket as examples —, for the
 * composer's preview, the list's «Ver con el diseño» and its test emails. */
export async function nailFestEventEmailSample(
  event: Event,
  mail: { subject: string; bodyHtml: string; band: string | null; asistire?: boolean; colega?: boolean; pdf?: boolean }
): Promise<{ subject: string; text: string; html: string }> {
  const frame = await nailFestEventEmailFrame(event);
  const body = sanitizeEventDescription(
    mail.bodyHtml
      .split("{{ZOOM_LINK}}")
      .join("https://zoom.us/j/000000000")
      .split(REVIEW_LINK_TAG)
      .join(`${baseUrl()}/resena/ejemplo`)
  );
  const type = body.includes(TICKET_TAG)
    ? await db.ticketType.findFirst({ where: { eventId: event.id, status: "ON_SALE" }, orderBy: { order: "asc" }, select: { name: true } })
    : null;
  return nailFestEventEmail(frame, {
    subject: mail.subject,
    bodyHtml: body,
    band: mail.band,
    asistire: mail.asistire === false ? null : asistireSampleUrl(event.id),
    colega: mail.colega !== false,
    tickets: sampleTickets(baseUrl(), type?.name ?? null, Boolean(mail.pdf)),
    banner: await bannerOf(body),
  });
}
