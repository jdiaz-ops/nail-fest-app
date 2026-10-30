import { createHmac, timingSafeEqual } from "crypto";
import { db } from "@/lib/db";

// «Asistiré» (2026-10-30): the page where someone who bought Manicuristas
// Imparables makes her image to share — her photo in the congress's cover,
// «¡ASISTIRÉ!», the day and where to book (app/asistire/[token]). Her link
// is her registration's id, signed: only someone who bought gets one (in her
// confirmation email and on the payment's page), and it opens nothing else.
// The images print the short link below, which goes to the congress's page
// tagged so the sales it brings show where they came from (the page's
// buttons carry the tags to the checkout).

function signature(registrationId: string): string {
  const secret = process.env.APP_SECRET_KEY;
  if (!secret) throw new Error("APP_SECRET_KEY is not set.");
  return createHmac("sha256", secret).update(`asistire:${registrationId}`).digest("base64url");
}

export function asistireToken(registrationId: string): string {
  return `${registrationId}.${signature(registrationId)}`;
}

/** The registration a link's token is for; null for a token we didn't sign. */
export function asistireRegistrationId(token: string): string | null {
  const dot = token.lastIndexOf(".");
  if (dot <= 0) return null;
  const registrationId = token.slice(0, dot);
  let wanted: Buffer;
  try {
    wanted = Buffer.from(signature(registrationId));
  } catch {
    return null;
  }
  const given = Buffer.from(token.slice(dot + 1));
  return given.length === wanted.length && timingSafeEqual(given, wanted) ? registrationId : null;
}

const baseUrl = () => (process.env.APP_BASE_URL || "https://nailfest.lat").replace(/\/+$/, "");

/** Her page to make her image. */
export function asistireUrl(registrationId: string): string {
  return `${baseUrl()}/asistire/${asistireToken(registrationId)}`;
}

/** Where the short link's visits say they came from. */
export const ASISTIRE_UTM = { utm_source: "asistire", utm_medium: "referido", utm_campaign: "imagen" } as const;

/** The short link's path, nailfest.lat/imparables: answered by the events' page ([eventSlug]) while no event has that name. */
export const SHORT_PATH = "imparables";

/** The short link the images print: «nailfest.lat/imparables», and the address it is. */
export function asistireShortLink(): { text: string; href: string } {
  const base = baseUrl();
  return { text: `${new URL(base).host.replace(/^www\./, "")}/${SHORT_PATH}`, href: `${base}/${SHORT_PATH}` };
}

/** Where the short link goes: Manicuristas Imparables' page — the next one, or else the last one — tagged as the images' visits; home, without one. */
export async function asistireShortTarget(): Promise<string> {
  const published = { theme: "IMPARABLES" as const, status: "PUBLISHED" as const };
  const event =
    (await db.event.findFirst({ where: { ...published, startsAt: { gte: new Date() } }, orderBy: { startsAt: "asc" }, select: { slug: true } })) ??
    (await db.event.findFirst({ where: published, orderBy: { startsAt: "desc" }, select: { slug: true } }));
  return event ? `/${event.slug}?${new URLSearchParams(ASISTIRE_UTM).toString()}` : "/";
}
