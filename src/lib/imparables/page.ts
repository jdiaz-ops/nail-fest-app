import type { Event } from "@prisma/client";
import { db } from "@/lib/db";
import { utcToZonedInputValue } from "@/lib/dateFormat";
import { parseLandingBlocks, type LandingBlock } from "@/lib/landingBlocks/types";
import { eventWhen, type EventWhen } from "./schedule";
import { loadStages } from "./pricing";
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
  /** For the team's preview: the waiting list's last day and the first day of each stage after the first, as ?fecha= values. */
  shortcuts: { label: string; date: string }[];
}

export async function imparablesPageData(event: Event, timezone: string, now: Date): Promise<ImparablesPageData> {
  const [types, meta, whatsapp] = await Promise.all([
    loadStages(event.id),
    db.metaConnection.findFirst({ orderBy: { createdAt: "desc" }, select: { pixelId: true } }),
    db.whatsAppConnection.findFirst({ orderBy: { createdAt: "desc" }, select: { displayPhoneNumber: true } }),
  ]);
  const sales = salesState(types, now, event.startsAt);

  const day = (date: Date) => utcToZonedInputValue(date, timezone).slice(0, 10);
  // A waiting list only when even the first stage opens later; each stage
  // after it on the day after the one before closes (by its date — the
  // day one fills its cap can't be shown by a date).
  const opening = sales.stages[0]?.opensAt ?? null;
  const shortcuts = [
    ...(opening ? [{ label: "Lista de espera", date: day(new Date(opening.getTime() - 86_400_000)) }] : []),
    ...sales.stages.slice(1).flatMap((s, i) => {
      const before = sales.stages[i]!.closesAt;
      return before ? [{ label: s.name, date: day(new Date(before.getTime() + 60_000)) }] : [];
    }),
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
