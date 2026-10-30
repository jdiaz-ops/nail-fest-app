import type { Event, Person } from "@prisma/client";
import { formatDateInTz } from "@/lib/dateFormat";
import { publicEventName } from "@/lib/eventDisplayName";
import { coverName } from "@/lib/imparables/schedule";
import { broadcastEmailHtml } from "@/lib/email/templates";
import { slugifyForCampaign, tagOwnLinksInHtml } from "@/lib/outboundLinkTagging";
import { resolveMergeTag } from "@/lib/whatsapp/mergeTags";
import type { LinkTarget } from "./shared";

// What one step of a sequence says to one person (lib/sequences/engine.ts):
// its email with her name and the event's links, or its WhatsApp template's
// {{1}}, {{2}}… filled in.

export interface SequenceContext {
  person: Pick<Person, "firstName" | "lastName" | "city">;
  event: Event | null;
  /** The sequence's name, as its links' utm_campaign. */
  sequenceName: string;
  timezone: string;
  language: string;
}

const baseUrl = () => (process.env.APP_BASE_URL || "https://nailfest.lat").replace(/\/+$/, "");

/** The event's page and checkout, bare — an email's own links get their tags with every other link of the app in it. */
export function eventLinks(event: Pick<Event, "slug"> | null): Record<LinkTarget, string> | null {
  if (!event) return null;
  return { event: `${baseUrl()}/${event.slug}`, checkout: `${baseUrl()}/${event.slug}/checkout` };
}

/** The event's name in a message — the congress's as its own confirmation says it, «Manicuristas Imparables». */
function eventTitle(event: Event | null): string {
  if (!event) return "";
  return event.theme === "IMPARABLES" ? coverName(publicEventName(event)) : publicEventName(event);
}

const campaign = (ctx: SequenceContext) => slugifyForCampaign(ctx.sequenceName);

function withTags(url: string, ctx: SequenceContext): string {
  const u = new URL(url);
  u.searchParams.set("utm_source", "whatsapp");
  u.searchParams.set("utm_medium", "secuencia");
  u.searchParams.set("utm_campaign", campaign(ctx));
  return u.toString();
}

const escapeHtml = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

/** Each {{TAG}} of the text with her value; HTML-escaped inside an email's body. */
export function fillTags(text: string, values: Record<string, string>, html: boolean): string {
  return text.replace(/\{\{\s*([A-Z_]+)\s*\}\}/g, (whole, key: string) => {
    if (!(key in values)) return whole;
    return html ? escapeHtml(values[key]!) : values[key]!;
  });
}

function emailValues(ctx: SequenceContext): Record<string, string> {
  const links = eventLinks(ctx.event);
  return {
    NOMBRE: ctx.person.firstName ?? "",
    NOMBRE_COMPLETO: [ctx.person.firstName, ctx.person.lastName].filter(Boolean).join(" "),
    EVENTO_NOMBRE: eventTitle(ctx.event),
    EVENTO_FECHA: ctx.event ? formatDateInTz(ctx.event.startsAt, { weekday: "long", day: "numeric", month: "long" }, ctx.timezone, ctx.language) : "",
    ENLACE_CHECKOUT: links?.checkout ?? "",
    ENLACE_EVENTO: links?.event ?? "",
  };
}

/** One email step for her: subject and text with her tags, the button to the event, the unsubscribe line. */
export function renderSequenceEmail(
  step: { subject: string; bodyHtml: string; buttonText: string | null; buttonTarget: string | null },
  ctx: SequenceContext,
  unsubscribeUrl: string
): { subject: string; text: string; html: string } {
  const values = emailValues(ctx);
  const subject = fillTags(step.subject, values, false);
  let body = fillTags(step.bodyHtml, values, true);
  const href = eventLinks(ctx.event)?.[step.buttonTarget as LinkTarget];
  if (step.buttonText?.trim() && href) {
    const imparables = ctx.event?.theme === "IMPARABLES";
    const colors = imparables ? "background:#c9a46a;color:#141414;" : "background:#17181c;color:#ffffff;";
    body += `<p style="margin:28px 0;text-align:center;"><a href="${href}" style="display:inline-block;padding:14px 26px;border-radius:999px;${colors}font-weight:700;font-size:16px;text-decoration:none;">${escapeHtml(fillTags(step.buttonText.trim(), values, false))}</a></p>`;
  }
  body = tagOwnLinksInHtml(body, { source: "email", medium: "secuencia", campaign: campaign(ctx) });
  return broadcastEmailHtml({ subject, bodyHtml: body, unsubscribeUrl });
}

/** One WhatsApp step's {{1}}, {{2}}… for her: the app's merge tags, and the event's links tagged as this sequence's. */
export function sequenceWhatsAppVariables(variableCount: number, mapping: Record<string, string>, ctx: SequenceContext): string[] {
  const links = eventLinks(ctx.event);
  return Array.from({ length: variableCount }, (_, i) => {
    const key = mapping[String(i + 1)] ?? "";
    if (key === "ENLACE_CHECKOUT") return links ? withTags(links.checkout, ctx) : "";
    if (key === "ENLACE_EVENTO") return links ? withTags(links.event, ctx) : "";
    if (key === "EVENTO_NOMBRE") return eventTitle(ctx.event);
    return resolveMergeTag(key, { person: ctx.person, event: ctx.event, timezone: ctx.timezone, language: ctx.language });
  });
}

/** What a template's link button carries after nailfest.lat/ — the event's checkout or page. */
export function whatsappButtonPath(event: Pick<Event, "slug"> | null, target: string | null): string | null {
  if (!event) return null;
  return target === "event" ? event.slug : `${event.slug}/checkout`;
}
