import type { PaymentStatus, RegistrationStatus } from "@prisma/client";
import { db } from "@/lib/db";
import { getOrgSettings } from "@/lib/settings";
import type { CartStage } from "./normalize";

// Truly abandoned carts (2026-10-30), for the segments the team turns into
// audiences — a WhatsApp and an email sequence, Meta's and TikTok's ads.
// Someone whose email an event's checkout saved (/api/register/draft) and
// who hasn't bought it:
//   - "form": left the form without tapping «Pagar» (STARTED);
//   - "payment": went to pay and didn't finish — closed Wompi or PayPal, or
//     left PSE halfway (PENDING_PAYMENT, its last attempt with no answer);
//   - "declined": her last attempt was turned down (declined, voided, error).
// Only after an hour with no news: still filling in the form, or a PSE
// payment still confirming, isn't abandoning. And never someone who paid —
// an approved attempt takes her out, and so does a purchase of the same
// event under another of her records: the same WhatsApp, the same first and
// last name, or her email one letter off (the draft keeps the email as she
// first typed it, so «valeria@gmial.com» stays behind when she pays as
// «valeria@gmail.com»). Nor an email the account blocked.

export const ABANDONED_AFTER_MINUTES = 60;

const TURNED_DOWN: PaymentStatus[] = ["DECLINED", "VOIDED", "ERROR"];

interface Who {
  email: string;
  phone: string | null;
  firstName: string | null;
  lastName: string | null;
}

export interface CartRow {
  personId: string;
  eventId: string;
  status: RegistrationStatus;
  createdAt: Date;
  person: Who;
  /** Her attempts to pay, newest first. */
  payments: { status: PaymentStatus; updatedAt: Date }[];
}

/** Where she stopped, and since when; null when it isn't a cart (paid, refunded, confirmed or cancelled). */
export function cartStage(cart: Pick<CartRow, "status" | "createdAt" | "payments">): { stage: CartStage; since: Date } | null {
  if (cart.payments.some((p) => p.status === "APPROVED" || p.status === "REFUNDED")) return null;
  if (cart.status === "STARTED") return { stage: "form", since: cart.createdAt };
  if (cart.status !== "PENDING_PAYMENT") return null;
  const last = cart.payments[0];
  if (!last) return { stage: "payment", since: cart.createdAt };
  return { stage: TURNED_DOWN.includes(last.status) ? "declined" : "payment", since: last.updatedAt };
}

const plain = (s: string) =>
  s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();

/** Each spelling of a word with one letter left out: two words one typo apart (a letter missing, extra, changed or
 * swapped) share one of them — or one is the other. Digits stay put, so «laura01» and «laura02» stay two people. */
const oneLetterOut = (word: string) => [...word].flatMap((ch, i) => (/[a-z]/.test(ch) ? [word.slice(0, i) + word.slice(i + 1)] : []));

/** The ways she can be recognized under another of her records: two people sharing any one key are the same one. */
export function identityKeys(who: Who): string[] {
  const keys: string[] = [];
  const digits = (who.phone ?? "").replace(/\D/g, "");
  if (digits.length >= 8) keys.push(`tel:${digits.slice(-10)}`);
  const first = plain(who.firstName ?? "");
  const last = plain(who.lastName ?? "");
  if (first && last) keys.push(`nombre:${first} ${last}`);
  const email = who.email.trim().toLowerCase();
  const at = email.lastIndexOf("@");
  if (at > 0) {
    const local = email.slice(0, at);
    const domain = email.slice(at + 1);
    // A typo before the @, at the same domain.
    if (local.length >= 6) for (const v of [local, ...oneLetterOut(local)]) keys.push(`usuario:${v}@${domain}`);
    // The same name before the @ at a domain one typo off: gmial.com, gmail.con, hotmial.com.
    if (local.length >= 4) for (const v of [domain, ...oneLetterOut(domain)]) keys.push(`dominio:${local}@${v}`);
  }
  return keys;
}

/** The pure part: of these carts, the people whose cart is truly abandoned, given who bought each event. */
export function trulyAbandoned(
  carts: CartRow[],
  buyers: { eventId: string; person: Who }[],
  opts: { now: Date; stages: CartStage[]; blocked: string[] }
): string[] {
  const bought = new Set(buyers.flatMap((b) => identityKeys(b.person).map((k) => `${b.eventId}|${k}`)));
  const blocked = new Set(opts.blocked.map((e) => e.trim().toLowerCase()));
  const cutoff = opts.now.getTime() - ABANDONED_AFTER_MINUTES * 60_000;
  return carts.flatMap((cart) => {
    const at = cartStage(cart);
    if (!at || at.since.getTime() > cutoff) return [];
    if (opts.stages.length && !opts.stages.includes(at.stage)) return [];
    if (blocked.has(cart.person.email.trim().toLowerCase())) return [];
    if (identityKeys(cart.person).some((k) => bought.has(`${cart.eventId}|${k}`))) return [];
    return [cart.personId];
  });
}

/** The people with a truly abandoned cart at any of these events, stopped where asked (none asked: anywhere). */
export async function abandonedCartPersonIds(eventSlugs: string[], stages: CartStage[], now = new Date()): Promise<Set<string>> {
  if (eventSlugs.length === 0) return new Set();
  const events = await db.event.findMany({ where: { slug: { in: eventSlugs } }, select: { id: true } });
  if (events.length === 0) return new Set();
  const eventId = { in: events.map((e) => e.id) };
  const who = { select: { email: true, phone: true, firstName: true, lastName: true } } as const;
  const [carts, buyers, orgSettings] = await Promise.all([
    db.registration.findMany({
      where: { eventId, status: { in: ["STARTED", "PENDING_PAYMENT"] } },
      select: {
        personId: true,
        eventId: true,
        status: true,
        createdAt: true,
        person: who,
        payments: { select: { status: true, updatedAt: true }, orderBy: { createdAt: "desc" } },
      },
    }),
    db.registration.findMany({ where: { eventId, status: "CONFIRMED" }, select: { eventId: true, person: who } }),
    getOrgSettings(),
  ]);
  return new Set(trulyAbandoned(carts, buyers, { now, stages, blocked: orgSettings.bannedEmails }));
}
