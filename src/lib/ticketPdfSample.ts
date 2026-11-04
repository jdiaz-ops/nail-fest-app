import type { Event } from "@prisma/client";
import { db } from "@/lib/db";
import { getOrgSettings } from "@/lib/settings";
import { publicEventName } from "@/lib/eventDisplayName";
import { SAMPLE_QR_TOKEN, renderTicketPdfBuffer } from "@/lib/ticketPdf";
import { ticketBannerFor } from "@/lib/imparables/promo";

// The ticket's PDF with sample data (2026-10-30): what a test email carries
// when the real one carries hers — Laura's, for the event's first ticket on
// sale, its QR a string that opens nothing (never a signed ticket token).
// With Manicuristas Imparables' banner when the real one carries it — or,
// `banner` asked for, to look at it before turning it on (2026-11-04).
export async function sampleTicketPdf(event: Event, opts: { banner?: boolean; ticketCount?: number } = {}): Promise<Buffer> {
  const orgSettings = await getOrgSettings();
  const type = await db.ticketType.findFirst({ where: { eventId: event.id, status: "ON_SALE" }, orderBy: { order: "asc" }, select: { name: true } });
  return renderTicketPdfBuffer({
    firstName: "Laura",
    lastName: "Gómez",
    eventName: publicEventName(event),
    venueName: event.venueName ?? undefined,
    venueAddress: event.venueAddress ?? undefined,
    city: event.city || undefined,
    startsAt: event.startsAt,
    endsAt: event.endsAt ?? undefined,
    scheduleDays: event.scheduleDays,
    ticketTypeName: type?.name,
    ticketCount: opts.ticketCount,
    confirmationCode: "EJEMPLO1",
    qrToken: SAMPLE_QR_TOKEN,
    timezone: orgSettings.timezone,
    language: orgSettings.language,
    imparables: await ticketBannerFor(event, { force: opts.banner }),
  });
}

export const PDF_ATTACHMENT_NAME = "entrada-nailfest.pdf";
