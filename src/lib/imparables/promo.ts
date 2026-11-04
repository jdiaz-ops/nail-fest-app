import { db } from "@/lib/db";
import { getOrgSettings } from "@/lib/settings";
import { getActiveStage } from "./pricing";
import { coverPill, eventWhen } from "./schedule";

// Manicuristas Imparables' banner outside its own pages (the team,
// 2026-11-04): at the bottom of the tickets of the events the team turns it
// on for (lib/ticketPdf.ts) and in the La Mesa editions that carry it
// (lib/mesa/email.ts). No prices: who they are, what it is and the day,
// to make her want to open its page (its texts: schedule.ts COVER_HOOK,
// COVER_PROMISE, PILLARS). It points at the congress on sale —
// the next one whose sales haven't closed — and shows nowhere once they
// close, switch on or not.

export interface ImparablesPromo {
  /** Its page: /<slug>. */
  slug: string;
  /** «4 de julio 2027» */
  date: string;
  /** «Congreso virtual en vivo» */
  note: string;
}

const baseUrl = () => (process.env.APP_BASE_URL || "https://nailfest.lat").replace(/\/+$/, "");

/** The congress the banners send people to: published, still to come, its sales not closed (on sale, or its
 * waiting list before the first price opens). Null when there's none. */
export async function imparablesPromo(now: Date = new Date()): Promise<ImparablesPromo | null> {
  const events = await db.event.findMany({
    where: { theme: "IMPARABLES", status: "PUBLISHED", startsAt: { gt: now } },
    orderBy: { startsAt: "asc" },
    take: 3,
  });
  for (const event of events) {
    const sales = await getActiveStage(event, now);
    if (sales.mode === "closed") continue;
    const { timezone } = await getOrgSettings();
    return { slug: event.slug, ...coverPill(event, eventWhen(event, timezone)) };
  }
  return null;
}

/** What a ticket's banner needs: its page, tagged as coming from this event's ticket, and the day. */
export interface TicketImparablesBanner {
  url: string;
  date: string;
  note: string;
}

/** An event's tickets' banner: only with its switch on (Event.imparablesTicketBanner), never on the congress's own
 * tickets, and only while there's a congress on sale. `force` shows it switch or not — the admin's look at it
 * before turning it on. */
export async function ticketBannerFor(
  event: { slug: string; theme?: string | null; imparablesTicketBanner?: boolean | null },
  opts: { now?: Date; force?: boolean } = {},
): Promise<TicketImparablesBanner | null> {
  if (event.theme === "IMPARABLES" || !(event.imparablesTicketBanner || opts.force)) return null;
  const promo = await imparablesPromo(opts.now);
  if (!promo) return null;
  const url = new URL(`/${promo.slug}`, baseUrl());
  url.searchParams.set("utm_source", "nailfest");
  url.searchParams.set("utm_medium", "pdf_entrada");
  url.searchParams.set("utm_campaign", event.slug);
  url.searchParams.set("utm_content", "banner_imparables");
  return { url: url.toString(), date: promo.date, note: promo.note };
}
