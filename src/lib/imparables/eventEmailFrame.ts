import type { Event } from "@prisma/client";
import { db } from "@/lib/db";
import { getOrgSettings } from "@/lib/settings";
import { publicEventName } from "@/lib/eventDisplayName";
import { sanitizeEventDescription } from "@/lib/sanitizeHtml";
import { REVIEW_LINK_TAG } from "@/lib/reviews";
import { bannerOf } from "@/lib/nailfest/eventEmailFrame";
import { asistireSampleUrl, asistireUrl, marcoUrl } from "./asistire";
import { defaultShareText } from "./confirmation";
import { shareLine } from "./confirmationEmail";
import { imparablesEventEmail, type ImparablesEventEmailFrame } from "./eventEmail";
import { KIT } from "./kit";
import { congresoSampleToken } from "./miCongreso";
import { getActiveStage } from "./pricing";
import { coverName, eventWhen } from "./schedule";
import { pesos } from "./stages";

// The event's part of Manicuristas Imparables' design for its emails (eventEmail.ts, 2026-11-04): its name and day under
// the cover, the line and the link to invite a colleague (today's price and the next one), the team's WhatsApp, the
// «Asistiré» picture and the kit's files — the same for each of its emails and each person.

const baseUrl = () => (process.env.APP_BASE_URL || "https://nailfest.lat").replace(/\/+$/, "");

export async function imparablesEventEmailFrame(event: Event): Promise<ImparablesEventEmailFrame> {
  const [orgSettings, whatsapp, sales] = await Promise.all([
    getOrgSettings(),
    db.whatsAppConnection.findFirst({ orderBy: { createdAt: "desc" }, select: { displayPhoneNumber: true } }),
    getActiveStage(event),
  ]);
  const base = baseUrl();
  const digits = whatsapp?.displayPhoneNumber?.replace(/\D/g, "") ?? "";
  const page = new URL(`${base}/${event.slug}`);
  page.searchParams.set("utm_source", "whatsapp");
  page.searchParams.set("utm_medium", "referido");
  page.searchParams.set("utm_campaign", "correo_evento");
  const shareText = event.shareText?.trim() || defaultShareText(event, orgSettings.timezone);
  const absolute = (url: string) => (/^https?:\/\//.test(url) ? url : `${base}${url.startsWith("/") ? "" : "/"}${url}`);
  const link = (f: { name: string; file: string; mini: string }) => ({ name: f.name, file: absolute(f.file), mini: absolute(f.mini) });
  return {
    eventName: coverName(publicEventName(event)),
    headerLine: `${eventWhen(event, orgSettings.timezone).dates} · En vivo por Zoom`,
    share: {
      // Today's price and the next one, when there are; the gift alone otherwise.
      line: shareLine(sales.current?.price ? pesos(sales.current.price) : null, sales.current?.price && sales.next?.price ? pesos(sales.next.price) : null),
      url: `https://wa.me/?text=${encodeURIComponent(`${shareText} ${page.toString()}`)}`,
    },
    helpUrl: digits.length >= 8 ? `https://wa.me/${digits}` : null,
    images: { header: `${base}/imparables/correo-cabecera.png`, logo: `${base}/logo.png`, asistire: `${base}/imparables/asistire-muestra-4-julio.jpg` },
    kit: { wallpapers: KIT.wallpapers.map(link), stories: KIT.stories.map(link) },
    site: { url: base, host: new URL(base).host.replace(/^www\./, "") },
  };
}

/** Her «Asistiré» link and her kit's, for one of these emails, as its blocks ask; none if it can't be signed. */
export function imparablesBlocksFor(registrationId: string, blocks: { asistire: boolean; kit: boolean }): { asistire: string | null; kit: { frameUrl: string } | null } {
  let link: string | null = null;
  try {
    link = asistireUrl(registrationId);
  } catch {
    link = null;
  }
  return { asistire: blocks.asistire ? link : null, kit: blocks.kit && link ? { frameUrl: marcoUrl(link) } : null };
}

/** One of its emails in the design with sample data — the event's sample links —, for the composer's preview, «Ver con
 * el diseño» and its test emails. */
export async function imparablesEventEmailSample(
  event: Event,
  mail: { subject: string; bodyHtml: string; band: string | null; asistire?: boolean; kit?: boolean; colega?: boolean }
): Promise<{ subject: string; text: string; html: string }> {
  const frame = await imparablesEventEmailFrame(event);
  const sample = asistireSampleUrl(event.id);
  const body = sanitizeEventDescription(
    mail.bodyHtml
      .split("{{ZOOM_LINK}}")
      .join("https://zoom.us/j/000000000")
      .split(REVIEW_LINK_TAG)
      .join(`${baseUrl()}/resena/${congresoSampleToken(event.id)}`)
  );
  return imparablesEventEmail(frame, {
    subject: mail.subject,
    bodyHtml: body,
    band: mail.band,
    asistire: mail.asistire === false ? null : sample,
    kit: mail.kit === false ? null : { frameUrl: marcoUrl(sample) },
    colega: mail.colega !== false,
    banner: await bannerOf(body),
  });
}
