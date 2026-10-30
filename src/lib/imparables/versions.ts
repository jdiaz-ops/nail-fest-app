import type { LandingVersion } from "@prisma/client";
import { db } from "@/lib/db";
import type { CheckoutTicket } from "./pricing";
import type { SalesState } from "./stages";

// «Versiones de la landing» (2026-10-30): another link to an event's page —
// nailfest.lat/v/<slug>, app/v/[slug] — with the same page, checkout and
// registrations. Where the version says so, its own cover (title, line,
// photo, button) and a special price per stage that shows nowhere else: for
// an ad testing another hero, or a flyer's QR at an in-person event. Only
// while it's on and within its dates — otherwise its link goes to the main
// page, at the normal price: a printed QR keeps working. The special price
// is charged by /api/register only to whoever came through it; such
// purchases never take a place in their stage's cap (the team, 2026-10-30)
// but count toward the version's own maximum, if it has one. Every purchase
// through it says so (Registration.landingVersionId), at its special price
// or not.

export const VERSION_PATH = "v";

/** Whether its page shows now: on, and within its dates. */
export function versionLive(v: Pick<LandingVersion, "enabled" | "startsAt" | "endsAt">, now: Date): boolean {
  return v.enabled && (!v.startsAt || v.startsAt <= now) && (!v.endsAt || now < v.endsAt);
}

/** Its special prices, in whole pesos by ticket type — whatever the column holds, read safely. */
export function specialPricesOf(v: Pick<LandingVersion, "specialPrices">): Record<string, number> {
  const raw = v.specialPrices;
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return {};
  const out: Record<string, number> = {};
  for (const [id, price] of Object.entries(raw as Record<string, unknown>)) {
    if (typeof price === "number" && Number.isInteger(price) && price > 0) out[id] = price;
  }
  return out;
}

export interface VersionPrice {
  /** What one ticket costs through it. */
  price: number;
  /** The stage's own price: what it costs without it. */
  normal: number;
  /** Struck beside it: the full price (the last stage's), as everywhere else on the page — «$80.000 en vez de
   * $150.000» (the team, 2026-10-30); the stage's own when it is the full one. */
  struck: number;
  /** «Precio Expo Belleza», or «Precio especial». */
  label: string;
  /** Until when, if it ends. */
  endsAt: Date | null;
}

/** Its price for the stage on sale, for `count` more tickets — null when none applies: no special price for this
 * stage (or not below its own), or its maximum reached. */
export function specialPriceFor(
  v: Pick<LandingVersion, "specialPrices" | "priceLabel" | "maxSpecialSales" | "endsAt">,
  sales: Pick<SalesState, "current" | "full">,
  sold: number,
  count = 1
): VersionPrice | null {
  const current = sales.current;
  if (!current) return null;
  const price = specialPricesOf(v)[current.id];
  if (!price || price >= current.price) return null;
  if (v.maxSpecialSales != null && sold + count > v.maxSpecialSales) return null;
  const struck = sales.full && sales.full.price > current.price ? sales.full.price : current.price;
  return { price, normal: current.price, struck, label: v.priceLabel?.trim() || "Precio especial", endsAt: v.endsAt };
}

/** The checkout's ticket at its special price: the full price struck beside it, and in pesos only — a special price
 * isn't paid in dollars. */
export function withVersionPrice(ticket: CheckoutTicket, p: VersionPrice): CheckoutTicket {
  return { ...ticket, price: p.price, fullPrice: p.struck, usdCents: null, fullUsdCents: null };
}

/** Tickets paid at its special price so far: what its maximum counts. */
export async function specialSold(versionId: string): Promise<number> {
  const paid = await db.registration.aggregate({
    where: { status: "CONFIRMED", payments: { some: { status: "APPROVED", landingVersionId: versionId } } },
    _sum: { ticketCount: true },
  });
  return paid._sum.ticketCount ?? 0;
}

/** A version by its link, with its event, while it shows: null when there's none, or it's paused or outside its dates. */
export async function liveVersion(slug: string, now: Date = new Date()) {
  const version = await db.landingVersion.findUnique({ where: { slug: slug.toLowerCase() }, include: { event: true } });
  if (!version) return { version: null, event: null } as const;
  return { version: versionLive(version, now) ? version : null, event: version.event } as const;
}

/** A link that's a version's: lowercase letters, digits and dashes, 2 to 60 of them. */
export function validVersionSlug(slug: string): boolean {
  return /^[a-z0-9](?:[a-z0-9-]{0,58}[a-z0-9])?$/.test(slug) && slug.length >= 2;
}

/** «Expo Belleza Cali» → «expo-belleza-cali». */
export function slugifyVersion(name: string): string {
  return name
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60)
    .replace(/-+$/g, "");
}

const baseUrl = () => (process.env.APP_BASE_URL || "https://nailfest.lat").replace(/\/+$/, "");

/** A version's link, as the team copies it — nailfest.lat/v/<slug> — or the main page's (no slug). */
export function versionUrl(eventSlug: string, slug: string | null): string {
  return slug ? `${baseUrl()}/${VERSION_PATH}/${slug}` : `${baseUrl()}/${eventSlug}`;
}

/** What its printed QR opens: its link, tagged as a print's, so every sale knows it came from the paper. */
export function versionQrUrl(eventSlug: string, slug: string | null): string {
  const url = new URL(versionUrl(eventSlug, slug));
  url.searchParams.set("utm_source", "qr");
  url.searchParams.set("utm_medium", "impreso");
  url.searchParams.set("utm_campaign", slug ?? "principal");
  return url.toString();
}
