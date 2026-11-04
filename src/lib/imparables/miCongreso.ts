import { createHmac, timingSafeEqual } from "crypto";
import type { Event, Person, Registration } from "@prisma/client";
import { db } from "@/lib/db";

// «Tu congreso» (the team, 2026-11-04): each buyer's own page for Manicuristas Imparables — her digital kit, the
// recording of every talk and her diploma (app/mi-congreso/[token]). How each one gets in: like «Asistiré»
// (asistire.ts), her link is her registration's id, signed — with a word of its own, so one link never opens the
// other page. No account and no password: the link is her key, it opens only her page, and only once her payment is
// confirmed. The team's sample opens the same page for an event, with no purchase behind it («Después del pago»).
// Nothing sends these links yet: they go out only when the team says so.

function signature(id: string): string {
  const secret = process.env.APP_SECRET_KEY;
  if (!secret) throw new Error("APP_SECRET_KEY is not set.");
  return createHmac("sha256", secret).update(`congreso:${id}`).digest("base64url");
}

export function congresoToken(registrationId: string): string {
  return `${registrationId}.${signature(registrationId)}`;
}

/** The registration (or the sample) a link's token is for; null for a token we didn't sign. */
export function congresoRegistrationId(token: string): string | null {
  const dot = token.lastIndexOf(".");
  if (dot <= 0) return null;
  const id = token.slice(0, dot);
  let wanted: Buffer;
  try {
    wanted = Buffer.from(signature(id));
  } catch {
    return null;
  }
  const given = Buffer.from(token.slice(dot + 1));
  return given.length === wanted.length && timingSafeEqual(given, wanted) ? id : null;
}

const baseUrl = () => (process.env.APP_BASE_URL || "https://nailfest.lat").replace(/\/+$/, "");

/** Her page, from this site: /mi-congreso/… */
export function congresoPath(registrationId: string): string {
  return `/mi-congreso/${congresoToken(registrationId)}`;
}

/** Her page's full address, for a message. */
export function congresoUrl(registrationId: string): string {
  return `${baseUrl()}${congresoPath(registrationId)}`;
}

/** Her diploma's PDF, for her page's token. */
export function diplomaPath(token: string): string {
  return `/api/diploma/${token}`;
}

// The team's sample, the same way as «Asistiré»'s.
const SAMPLE = "muestra-";

export function congresoSampleToken(eventId: string): string {
  return congresoToken(`${SAMPLE}${eventId}`);
}

export function congresoSamplePath(eventId: string): string {
  return congresoPath(`${SAMPLE}${eventId}`);
}

/** The event a sample link is for; null for a buyer's own link. */
export function congresoSampleEventId(id: string): string | null {
  return id.startsWith(SAMPLE) ? id.slice(SAMPLE.length) : null;
}

export type CongresoAccess =
  | { kind: "sample"; event: Event }
  | { kind: "buyer"; event: Event; registration: Registration & { person: Person }; waiting: boolean };

/** Whose page a link opens: the team's sample of an event, or a buyer's — hers once her payment is confirmed, a note
 * to come back while it's being confirmed; null for anything else (a link we didn't sign, another event, a purchase
 * cancelled or refunded). */
export async function findCongreso(token: string): Promise<CongresoAccess | null> {
  const id = congresoRegistrationId(token);
  if (!id) return null;
  const sampleEventId = congresoSampleEventId(id);
  if (sampleEventId) {
    const event = await db.event.findUnique({ where: { id: sampleEventId } });
    return event?.theme === "IMPARABLES" ? { kind: "sample", event } : null;
  }
  const registration = await db.registration.findUnique({ where: { id }, include: { event: true, person: true } });
  if (!registration || registration.event.theme !== "IMPARABLES") return null;
  const waiting = registration.status === "STARTED" || registration.status === "PENDING_PAYMENT";
  if (registration.status !== "CONFIRMED" && !waiting) return null;
  const { event, ...rest } = registration;
  return { kind: "buyer", event, registration: rest, waiting };
}
