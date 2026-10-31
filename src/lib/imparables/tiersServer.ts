import { createHmac, timingSafeEqual } from "crypto";
import type { Payment, TicketType } from "@prisma/client";
import { db } from "@/lib/db";
import { emailProvider } from "@/lib/email";
import { getOrgSettings } from "@/lib/settings";
import { buildCheckoutUrl, wompiReference, wompiWidgetParams } from "@/lib/payments/wompi";
import { publicEventName } from "@/lib/eventDisplayName";
import { dollars, pesos } from "./stages";
import {
  TIERED_VERSIONS,
  TIERS,
  TIER_EMAIL,
  fill,
  isTieredVersion,
  tierAvailable,
  tierBySlug,
  tiersAbove,
  upgradeDifference,
  type Tier,
  type TierSlug,
} from "./tiers";

// The levels' side that needs the database (lib/imparables/tiers.ts says what
// they are, 2026-10-31): their ticket types, how many each has sold, moving up
// from one to another by paying the difference, and the emails that go with
// them.

const baseUrl = () => (process.env.APP_BASE_URL || "https://nailfest.lat").replace(/\/+$/, "");

/** How many of a fixed level a ticket type can hold: none of its own — Élite's 20 count her level, upgrades
 * included (tierPaidCounts), not the type. */
const OPEN_QUANTITY = 100_000;

/** The fixed levels' ticket types for an event, made or brought in step with tiers.ts: hidden from every page's
 * list, at the file's price, one per order. What she buys at Círculo or Élite is one of them. */
export async function ensureTierTypes(eventId: string): Promise<Map<TierSlug, TicketType>> {
  const types = new Map<TierSlug, TicketType>();
  for (const tier of TIERS) {
    if (tier.priceMode !== "fixed" || tier.fixedPrice === null) continue;
    const data = {
      name: tier.name,
      price: tier.fixedPrice,
      priceUsdCents: tier.fixedUsdCents,
      status: "HIDDEN" as const,
      quantity: OPEN_QUANTITY,
      minPerOrder: 1,
      maxPerOrder: 1,
    };
    const where = { eventId_tierSlug: { eventId, tierSlug: tier.slug } };
    let type: TicketType | null = await db.ticketType.findUnique({ where });
    if (!type) {
      // Made by the first visit to the checkout; two at once, one makes it and the other finds it.
      try {
        type = await db.ticketType.create({ data: { eventId, tierSlug: tier.slug, order: 100 + tier.order, ...data } });
      } catch (err) {
        type = await db.ticketType.findUnique({ where });
        if (!type) throw err;
      }
    }
    // Brought in step with the file when it changed (its price, its name); untouched otherwise.
    const saved: TicketType = type;
    if ((Object.keys(data) as (keyof typeof data)[]).some((key) => saved[key] !== data[key])) {
      type = await db.ticketType.update({ where, data });
    }
    types.set(tier.slug, type);
  }
  return types;
}

/** Paid purchases at each level of an event: her registration confirmed at it — bought there, or moved up to it. */
export async function tierPaidCounts(eventId: string): Promise<Record<TierSlug, number>> {
  const rows = await db.registration.groupBy({
    by: ["tierSlug"],
    where: { eventId, status: "CONFIRMED", tierSlug: { not: null } },
    _count: { _all: true },
  });
  const counts: Record<TierSlug, number> = { imparable: 0, circulo: 0, elite: 0 };
  for (const row of rows) if (row.tierSlug && row.tierSlug in counts) counts[row.tierSlug as TierSlug] = row._count._all;
  return counts;
}

/** The levels with no places left (Élite at its 20). */
export async function soldOutTiers(eventId: string): Promise<TierSlug[]> {
  const counts = await tierPaidCounts(eventId);
  return TIERS.filter((t) => !tierAvailable(t, counts[t.slug])).map((t) => t.slug);
}

/** What she paid in all for her purchase, as she paid it: «$190.000», or in dollars. */
export async function paidLabel(registrationId: string): Promise<string> {
  const payments = await db.payment.findMany({ where: { registrationId, status: "APPROVED" }, select: { amountInCents: true, refundedCents: true, currency: true } });
  const cents = payments.reduce((sum, p) => sum + (p.amountInCents - p.refundedCents), 0);
  return payments.some((p) => p.currency === "USD") ? dollars(cents) : pesos(cents / 100);
}

// ── Moving up (her link «Pasarme a Círculo») ───────────────────────────────

function signature(registrationId: string): string {
  const secret = process.env.APP_SECRET_KEY;
  if (!secret) throw new Error("APP_SECRET_KEY is not set.");
  return createHmac("sha256", secret).update(`mejorar:${registrationId}`).digest("base64url");
}

export function upgradeToken(registrationId: string): string {
  return `${registrationId}.${signature(registrationId)}`;
}

/** The registration a link's token is for; null for a token we didn't sign. */
export function upgradeRegistrationId(token: string): string | null {
  const at = token.lastIndexOf(".");
  if (at <= 0) return null;
  const registrationId = token.slice(0, at);
  const given = Buffer.from(token.slice(at + 1));
  const wanted = Buffer.from(signature(registrationId));
  return given.length === wanted.length && timingSafeEqual(given, wanted) ? registrationId : null;
}

/** Her page to move up: nailfest.lat/mejorar/<her registration, signed>. */
export function upgradeUrl(registrationId: string): string {
  return `${baseUrl()}/mejorar/${upgradeToken(registrationId)}`;
}

export interface UpgradeState {
  registrationId: string;
  firstName: string | null;
  eventSlug: string;
  eventId: string;
  /** Her level now. */
  current: Tier;
  /** What she paid in all, in pesos; null when she paid in dollars (then it's done with the team). */
  paidPesos: number | null;
  /** Her tickets in this purchase: a level is for one, so with more it's done with the team. */
  ticketCount: number;
  /** The levels above hers, with what each costs her now. */
  options: { tier: Tier; difference: number; available: boolean }[];
}

/** Where she stands to move up: null for a purchase that isn't a level's (or isn't paid). */
export async function upgradeState(registrationId: string): Promise<UpgradeState | null> {
  const registration = await db.registration.findUnique({
    where: { id: registrationId },
    include: { person: true, event: true, landingVersion: true, payments: { where: { status: "APPROVED" } } },
  });
  const current = tierBySlug(registration?.tierSlug);
  if (!registration || registration.status !== "CONFIRMED" || !current) return null;
  if (!isTieredVersion(registration.landingVersion?.slug)) return null;
  const usd = registration.payments.some((p) => p.currency !== "COP");
  const paidPesos = usd ? null : registration.payments.reduce((sum, p) => sum + (p.amountInCents - p.refundedCents), 0) / 100;
  const counts = await tierPaidCounts(registration.eventId);
  return {
    registrationId,
    firstName: registration.person.firstName,
    eventSlug: registration.event.slug,
    eventId: registration.eventId,
    current,
    paidPesos,
    ticketCount: registration.ticketCount,
    options: tiersAbove(current.slug).map((tier) => ({
      tier,
      difference: upgradeDifference(paidPesos ?? 0, tier),
      available: tierAvailable(tier, counts[tier.slug]),
    })),
  };
}

export type UpgradeStart =
  | { ok: true; paymentId: string; amountInCents: number; checkoutUrl: string; wompi: ReturnType<typeof wompiWidgetParams> }
  | { ok: false; error: "not_found" | "not_higher" | "sold_out" | "usd" | "tickets" | "nothing_to_pay" };

/** Her payment for the difference to `target`, in pesos through Wompi: a payment of her same purchase — no new one.
 * Her level moves up once it's approved (applyUpgrade). */
export async function startUpgrade(registrationId: string, target: TierSlug): Promise<UpgradeStart> {
  const state = await upgradeState(registrationId);
  if (!state) return { ok: false, error: "not_found" };
  const option = state.options.find((o) => o.tier.slug === target);
  if (!option) return { ok: false, error: "not_higher" };
  if (!option.available) return { ok: false, error: "sold_out" };
  if (state.paidPesos === null) return { ok: false, error: "usd" };
  if (state.ticketCount > 1) return { ok: false, error: "tickets" };
  if (option.difference <= 0) return { ok: false, error: "nothing_to_pay" };
  const amountInCents = option.difference * 100;
  const payment = await db.payment.create({
    data: { registrationId, provider: "WOMPI", amountInCents, currency: "COP", tierSlug: target, upgradeFrom: state.current.slug },
  });
  const reference = wompiReference(payment.id);
  const redirectUrl = `${upgradeUrl(registrationId)}?pagado=1`;
  return {
    ok: true,
    paymentId: payment.id,
    amountInCents,
    checkoutUrl: buildCheckoutUrl({ reference, amountInCents, currency: "COP", redirectUrl }),
    wompi: wompiWidgetParams({ reference, amountInCents, currency: "COP", redirectUrl }),
  };
}

/** An approved payment of a difference: her level moves up — once, from the level it was paid from — and she's told.
 * Her purchase, tickets and stage stay as they were. */
export async function applyUpgrade(payment: Pick<Payment, "registrationId" | "tierSlug" | "upgradeFrom">): Promise<void> {
  const target = tierBySlug(payment.tierSlug);
  if (!target || !payment.upgradeFrom) return;
  const { count } = await db.registration.updateMany({
    where: { id: payment.registrationId, tierSlug: payment.upgradeFrom },
    data: { tierSlug: target.slug },
  });
  if (count === 0) return;
  await sendUpgraded(payment.registrationId, target);
  if (target.slug === "elite") await sendEliteWelcome(payment.registrationId);
}

/** Her purchases at a level with a level above it to move up to, for her account (nailfest.lat/cuenta): the event,
 * her level, the next one and her page. Nothing for anyone who didn't buy a level. */
export async function upgradesForEmail(email: string): Promise<{ eventName: string; current: Tier; next: Tier; url: string }[]> {
  const registrations = await db.registration.findMany({
    where: {
      status: "CONFIRMED",
      tierSlug: { not: null },
      landingVersion: { slug: { in: [...TIERED_VERSIONS] } },
      person: { email: { equals: email, mode: "insensitive" } },
    },
    select: { id: true, tierSlug: true, event: true },
  });
  return registrations.flatMap((registration) => {
    const current = tierBySlug(registration.tierSlug);
    const next = current ? tiersAbove(current.slug)[0] : undefined;
    return current && next ? [{ eventName: publicEventName(registration.event), current, next, url: upgradeUrl(registration.id) }] : [];
  });
}

/** After a purchase at a level is paid (lib/payments/confirmRegistrationPayment.ts): Heidy's welcome for an Élite. */
export async function afterTierPurchase(registrationId: string): Promise<void> {
  const registration = await db.registration.findUnique({ where: { id: registrationId }, select: { tierSlug: true } });
  if (registration?.tierSlug === "elite") await sendEliteWelcome(registrationId);
}

/** The team's WhatsApp as a link, when there's one. */
async function helpLink(): Promise<string | null> {
  const whatsapp = await db.whatsAppConnection.findFirst({ orderBy: { createdAt: "desc" }, select: { displayPhoneNumber: true } });
  const digits = whatsapp?.displayPhoneNumber?.replace(/\D/g, "") ?? "";
  return digits.length >= 8 ? `https://wa.me/${digits}` : null;
}

/** Heidy's own welcome to each Élite (the team, 2026-10-31: on), in plain text. Never fails the payment it follows. */
async function sendEliteWelcome(registrationId: string): Promise<void> {
  try {
    const registration = await db.registration.findUnique({ where: { id: registrationId }, include: { person: true } });
    if (!registration) return;
    const [orgSettings, help] = await Promise.all([getOrgSettings(), helpLink()]);
    await emailProvider.sendTransactional({
      to: registration.person.email,
      subject: TIER_EMAIL.welcomeElite.subject,
      text: TIER_EMAIL.welcomeElite.text(registration.person.firstName?.trim() ?? "", help),
      replyTo: orgSettings.replyToEmail ?? undefined,
    });
  } catch (err) {
    console.error("sendEliteWelcome failed", registrationId, err);
  }
}

/** «Ya eres Imparable Círculo»: the level she moved up to, and what comes next with it. Never fails the payment. */
async function sendUpgraded(registrationId: string, target: Tier): Promise<void> {
  try {
    const registration = await db.registration.findUnique({ where: { id: registrationId }, include: { person: true } });
    if (!registration) return;
    const [orgSettings, help] = await Promise.all([getOrgSettings(), helpLink()]);
    const firstName = registration.person.firstName?.trim() ?? "";
    const next = TIER_EMAIL.next[target.slug];
    const text = [
      `Hola${firstName ? ` ${firstName}` : ""}:`,
      "",
      fill(TIER_EMAIL.upgraded.lead, { nivel: target.name }),
      "Tu entrada y tu código siguen siendo los mismos.",
      ...(next ? ["", next] : []),
      ...(help ? ["", `¿Dudas? Escríbenos por WhatsApp: ${help}`] : []),
      "",
      "Nos vemos el 27 de junio.",
    ].join("\n");
    await emailProvider.sendTransactional({
      to: registration.person.email,
      subject: fill(TIER_EMAIL.upgraded.subject, { nivel: target.name }),
      text,
      replyTo: orgSettings.replyToEmail ?? undefined,
    });
  } catch (err) {
    console.error("sendUpgraded failed", registrationId, err);
  }
}

// ── The admin's numbers (Versiones de la landing) ──────────────────────────

export interface TierStats {
  rows: { tier: Tier; sold: number; revenue: number }[];
  /** Élite's places left. */
  eliteLeft: number | null;
  /** On Élite's waiting list. */
  eliteWaitlist: number;
  upgrades: number;
}

/** Per level, for a version that sells them: paid purchases bought through it, each at the level she has now with all
 * she paid in pesos (her purchase and any difference; dollars aside), Élite's places left and waiting list, and how
 * many moved up. */
export async function tierStats(eventId: string, versionId: string, eliteWaitlistLabel: string): Promise<TierStats> {
  const [registrations, payments, counts, waitlist] = await Promise.all([
    db.registration.groupBy({
      by: ["tierSlug"],
      where: { eventId, landingVersionId: versionId, status: "CONFIRMED", tierSlug: { not: null } },
      _count: { _all: true },
    }),
    db.payment.findMany({
      where: { status: "APPROVED", currency: "COP", tierSlug: { not: null }, registration: { eventId, landingVersionId: versionId } },
      select: { amountInCents: true, refundedCents: true, upgradeFrom: true, registration: { select: { tierSlug: true, status: true } } },
    }),
    tierPaidCounts(eventId),
    db.person.count({ where: { labels: { some: { name: eliteWaitlistLabel } } } }),
  ]);
  const elite = tierBySlug("elite");
  return {
    rows: [...TIERS]
      .sort((a, b) => b.order - a.order)
      .map((tier) => ({
        tier,
        sold: registrations.find((r) => r.tierSlug === tier.slug)?._count._all ?? 0,
        revenue:
          payments
            .filter((p) => p.registration.status === "CONFIRMED" && p.registration.tierSlug === tier.slug)
            .reduce((sum, p) => sum + (p.amountInCents - p.refundedCents), 0) / 100,
      })),
    eliteLeft: elite?.cap != null ? Math.max(0, elite.cap - counts.elite) : null,
    eliteWaitlist: waitlist,
    upgrades: payments.filter((p) => p.upgradeFrom).length,
  };
}
