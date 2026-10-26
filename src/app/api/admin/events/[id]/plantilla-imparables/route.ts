import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth/guard";
import { DEFAULT_REGISTER_BUTTON_LABEL, sanitizeLandingBlocks } from "@/lib/events";
import { sanitizeEventDescription } from "@/lib/sanitizeHtml";
import { createTicketType } from "@/lib/ticketTypes";
import { IMPARABLES_BLOCKS, IMPARABLES_FIELDS, IMPARABLES_STAGES, IMPARABLES_STAGE_QUANTITY } from "@/lib/imparables/template";

// «Usar la plantilla de Manicuristas Imparables» (EventForm.tsx): the
// event's page becomes the approved boceto in the congress's design — its
// blocks replaced by the template's (the admin confirmed that first, seeing
// how many there were), its tagline, closing line and button set only
// where it has none of its own, and its three price stages created as
// ticket types only when it has no ticket types at all. Nothing else of the
// event changes (dates, format, Zoom, the old sales page), and nothing is
// sent to anyone.
export async function POST(_req: Request, { params }: { params: { id: string } }) {
  const auth = await requireUser(["ADMIN"]);
  if ("response" in auth) return auth.response;

  const event = await db.event.findUnique({ where: { id: params.id }, include: { _count: { select: { ticketTypes: true } } } });
  if (!event) return NextResponse.json({ error: "not_found" }, { status: 404 });

  await db.event.update({
    where: { id: event.id },
    data: {
      theme: "IMPARABLES",
      useLandingBlocks: true,
      landingBlocks: sanitizeLandingBlocks(IMPARABLES_BLOCKS) as unknown as Prisma.InputJsonValue,
      subtitle: event.subtitle?.trim() ? undefined : sanitizeEventDescription(IMPARABLES_FIELDS.subtitle),
      closingText: event.closingText?.trim() ? undefined : IMPARABLES_FIELDS.closingText,
      registerButtonLabel:
        !event.registerButtonLabel?.trim() || event.registerButtonLabel === DEFAULT_REGISTER_BUTTON_LABEL ? IMPARABLES_FIELDS.registerButtonLabel : undefined,
    },
  });

  let createdStages = 0;
  if (event._count.ticketTypes === 0) {
    for (const stage of IMPARABLES_STAGES) {
      await createTicketType(event.id, {
        name: stage.name,
        quantity: IMPARABLES_STAGE_QUANTITY,
        price: stage.price,
        bookingFee: 0,
        description: "",
        status: "ON_SALE",
        minPerOrder: 1,
        // One ticket, one person: each buyer gets her own Zoom link.
        maxPerOrder: 1,
        issuance: "INDIVIDUAL",
        hideUntil: stage.opensAt ? new Date(stage.opensAt) : null,
        hideAfter: new Date(stage.closesAt),
        hideWhenSoldOut: false,
        showRemainingOnPage: false,
      });
      createdStages += 1;
    }
  }
  return NextResponse.json({ ok: true, createdStages });
}
