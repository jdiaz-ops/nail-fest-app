import type { Event } from "@prisma/client";
import { db } from "@/lib/db";
import { utcToZonedInputValue } from "@/lib/dateFormat";
import { parseLandingBlocks, type LandingBlock } from "@/lib/landingBlocks/types";
import { eventWhen, type EventWhen } from "./schedule";
import { salesState, type SalesState } from "./stages";

// What Manicuristas Imparables' page (components/imparables/) reads for one
// visit: its blocks, its price stages as of `now` (today, or the day the
// team asked to see), when it happens, and the few site-wide things it
// shows — the Meta Pixel and the WhatsApp to write to.

export interface ImparablesPageData {
  blocks: LandingBlock[];
  sales: SalesState;
  when: EventWhen;
  pixelId: string | null;
  whatsappUrl: string | null;
  /** For the team's preview: the waiting list's last day and each stage's first, as ?fecha= values. */
  shortcuts: { label: string; date: string }[];
}

export async function imparablesPageData(event: Event, timezone: string, now: Date): Promise<ImparablesPageData> {
  const [types, sold, meta, whatsapp] = await Promise.all([
    db.ticketType.findMany({ where: { eventId: event.id }, orderBy: { order: "asc" } }),
    // Only confirmed registrations hold a ticket, same as getPublicTicketTypes.
    db.registration.groupBy({ by: ["ticketTypeId"], where: { eventId: event.id, status: "CONFIRMED", ticketTypeId: { not: null } }, _sum: { ticketCount: true } }),
    db.metaConnection.findFirst({ orderBy: { createdAt: "desc" }, select: { pixelId: true } }),
    db.whatsAppConnection.findFirst({ orderBy: { createdAt: "desc" }, select: { displayPhoneNumber: true } }),
  ]);
  const soldBy = new Map(sold.map((row) => [row.ticketTypeId, row._sum.ticketCount ?? 0]));
  const sales = salesState(
    types.map((t) => ({
      id: t.id,
      name: t.name,
      price: t.price,
      status: t.status,
      hideUntil: t.hideUntil,
      hideAfter: t.hideAfter,
      remaining: Math.max(0, t.quantity - (soldBy.get(t.id) ?? 0)),
      order: t.order,
    })),
    now,
    event.startsAt
  );

  const day = (date: Date) => utcToZonedInputValue(date, timezone).slice(0, 10);
  // A waiting list only when even the first stage opens later (stages come in date order, no date first).
  const opening = sales.stages[0]?.opensAt ?? null;
  const shortcuts = [
    ...(opening ? [{ label: "Lista de espera", date: day(new Date(opening.getTime() - 86_400_000)) }] : []),
    ...sales.stages.filter((s) => s.opensAt).map((s) => ({ label: s.name, date: day(s.opensAt!) })),
  ];

  const digits = whatsapp?.displayPhoneNumber?.replace(/\D/g, "") ?? "";
  return {
    blocks: parseLandingBlocks(event.landingBlocks).filter((b) => !b.hidden),
    sales,
    when: eventWhen(event, timezone),
    pixelId: meta?.pixelId ?? null,
    whatsappUrl: digits.length >= 8 ? `https://wa.me/${digits}` : null,
    shortcuts,
  };
}
