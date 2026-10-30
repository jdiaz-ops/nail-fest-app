import type { Event } from "@prisma/client";
import { db } from "@/lib/db";
import { getOrgSettings } from "@/lib/settings";
import { publicEventName } from "@/lib/eventDisplayName";
import { renderTicketPdfBuffer } from "@/lib/ticketPdf";

// The ticket's PDF with sample data (2026-10-30): what a test email carries
// when the real one carries hers — Laura's, for the event's first ticket on
// sale, its QR a string that opens nothing (never a signed ticket token).
export async function sampleTicketPdf(event: Event): Promise<Buffer> {
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
    confirmationCode: "EJEMPLO1",
    qrToken: "VISTA-PREVIA-NO-ES-UNA-ENTRADA-REAL",
    timezone: orgSettings.timezone,
    language: orgSettings.language,
  });
}

export const PDF_ATTACHMENT_NAME = "entrada-nailfest.pdf";
