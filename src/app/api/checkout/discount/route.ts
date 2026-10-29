import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { DISCOUNT_ERROR_MESSAGES, resolveDiscount } from "@/lib/discounts";

const bodySchema = z.object({
  eventSlug: z.string().min(1),
  ticketTypeId: z.string().min(1),
  ticketCount: z.number().int().positive().max(50),
  code: z.string().min(1).max(40),
  // Pesos (Wompi) or dollars (PayPal): the subtotal is the ticket's price in that one.
  currency: z.enum(["COP", "USD"]).default("COP"),
});

// The checkout's discount box (/[eventSlug]/checkout): what a code takes off
// this ticket times how many. Only a preview — /api/register works the
// discount out again on its own before it creates the payment. A code that
// doesn't apply is a normal answer (200, ok: false, and why), not an error.
export async function POST(req: NextRequest) {
  const parsed = bodySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ ok: false, error: "invalid_body" }, { status: 400 });
  const { eventSlug, ticketTypeId, ticketCount, code, currency } = parsed.data;

  const ticketType = await db.ticketType.findUnique({ where: { id: ticketTypeId }, include: { event: { select: { slug: true, status: true } } } });
  const unitCents = currency === "USD" ? ticketType?.priceUsdCents : ticketType ? ticketType.price * 100 : 0;
  if (!ticketType || ticketType.event.slug !== eventSlug || ticketType.event.status === "DRAFT" || ticketType.price <= 0 || !unitCents) {
    return NextResponse.json({ ok: false, error: "not_found", message: DISCOUNT_ERROR_MESSAGES.not_found });
  }
  const result = await resolveDiscount({ eventId: ticketType.eventId, ticketTypeId, code, subtotalCents: unitCents * ticketCount, currency });
  if (!result.ok) return NextResponse.json({ ok: false, error: result.error, message: DISCOUNT_ERROR_MESSAGES[result.error] });
  return NextResponse.json({ ok: true, code: result.discountCode.code, label: result.label, discountCents: result.discountCents, totalCents: result.totalCents });
}
