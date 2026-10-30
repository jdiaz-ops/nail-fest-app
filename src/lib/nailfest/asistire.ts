import type { Event } from "@prisma/client";
import { db } from "@/lib/db";
import { publicEventName } from "@/lib/eventDisplayName";
import { ASISTIRE_UTM } from "@/lib/imparables/asistire";
import type { NailFestAsistireTexts } from "@/components/nailfest/asistireArt";
import { longDates } from "./confirmation";

// Nail Fest's «Asistiré» for its events at a place (2026-10-30): the same
// page and signed links as Manicuristas Imparables' (lib/imparables/
// asistire.ts), with Nail Fest's image (components/nailfest/asistireArt.ts).
// The image prints the event's own address, nailfest.lat/<event>; the link
// she copies for her story's sticker carries the tags that say the visit
// came from an image.

const baseUrl = () => (process.env.APP_BASE_URL || "https://nailfest.lat").replace(/\/+$/, "");

/** Whether an event gets Nail Fest's image: one at a place, that isn't Manicuristas Imparables. */
export function hasNailFestAsistire(event: Pick<Event, "theme" | "format">): boolean {
  return event.theme !== "IMPARABLES" && event.format !== "VIRTUAL";
}

/** What the image says for an event, and the link to paste in a story. */
export async function nailFestAsistire(event: Event, timezone: string): Promise<{ texts: NailFestAsistireTexts; linkHref: string }> {
  const base = baseUrl();
  const city = event.city?.trim() || null;
  const paid = await db.ticketType.count({ where: { eventId: event.id, status: "ON_SALE", price: { gt: 0 } } });
  const href = new URL(`${base}/${event.slug}`);
  for (const [key, value] of Object.entries(ASISTIRE_UTM)) href.searchParams.set(key, value);
  return {
    texts: {
      name: ["Nail Fest", city ?? publicEventName(event).replace(/^nail\s*fest\s*/i, "").trim()],
      date: longDates(event, timezone),
      place: [event.venueName?.trim(), city].filter(Boolean).join(" · "),
      invite: paid ? "Consigue tu entrada en " : "Inscríbete gratis en ",
      link: `${new URL(base).host.replace(/^www\./, "")}/${event.slug}`,
    },
    linkHref: href.toString(),
  };
}
