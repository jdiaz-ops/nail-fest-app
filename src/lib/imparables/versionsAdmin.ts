import type { Event, LandingVersion } from "@prisma/client";
import { db } from "@/lib/db";
import { abandonedByVersion } from "@/lib/segments/abandonedCart";

// «Versiones de la landing» in the event's admin (2026-10-30): how each
// version is doing next to the main page — visits, checkouts opened, sales,
// what they brought in and the carts left behind — and how many it sold at
// its special price, against its maximum.

export interface VersionNumbers {
  visits: number;
  checkouts: number;
  sales: number;
  revenueCop: number;
  revenueUsdCents: number;
  abandoned: number;
  specialSold: number;
}

const zero = (): VersionNumbers => ({ visits: 0, checkouts: 0, sales: 0, revenueCop: 0, revenueUsdCents: 0, abandoned: 0, specialSold: 0 });

/** By version id, and "main" for the main page. */
export async function versionNumbers(
  event: Pick<Event, "id" | "checkoutOpenedCount">,
  versions: Pick<LandingVersion, "id" | "checkoutOpenedCount">[]
): Promise<Map<string, VersionNumbers>> {
  const key = (id: string | null) => id ?? "main";
  const numbers = new Map<string, VersionNumbers>([["main", zero()], ...versions.map((v) => [v.id, zero()] as [string, VersionNumbers])]);
  const of = (id: string | null) => numbers.get(key(id)) ?? numbers.get("main")!;

  const [views, payments, abandoned] = await Promise.all([
    db.landingView.groupBy({ by: ["landingVersionId"], where: { eventId: event.id }, _count: { _all: true } }),
    db.payment.findMany({
      where: { status: "APPROVED", registration: { eventId: event.id, status: "CONFIRMED" } },
      select: { amountInCents: true, currency: true, landingVersionId: true, registration: { select: { id: true, landingVersionId: true, ticketCount: true } } },
    }),
    abandonedByVersion(event.id),
  ]);
  for (const v of views) of(v.landingVersionId).visits += v._count._all;
  const counted = new Set<string>();
  for (const p of payments) {
    const n = of(p.registration.landingVersionId);
    if (!counted.has(p.registration.id)) {
      counted.add(p.registration.id);
      n.sales += p.registration.ticketCount;
      if (p.landingVersionId) of(p.landingVersionId).specialSold += p.registration.ticketCount;
    }
    if (p.currency === "USD") n.revenueUsdCents += p.amountInCents;
    else n.revenueCop += Math.round(p.amountInCents / 100);
  }
  for (const [id, count] of abandoned) of(id).abandoned += count;
  let inVersions = 0;
  for (const v of versions) {
    numbers.get(v.id)!.checkouts = v.checkoutOpenedCount;
    inVersions += v.checkoutOpenedCount;
  }
  numbers.get("main")!.checkouts = Math.max(0, event.checkoutOpenedCount - inVersions);
  return numbers;
}
