import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { getOrgSettings } from "@/lib/settings";
import { publicEventName } from "@/lib/eventDisplayName";
import { paymentReference } from "@/lib/payments/reference";
import { createPayPalOrder } from "@/lib/payments/paypal";

const bodySchema = z.object({ paymentId: z.string().min(1) });

// PayPal's buttons on the one-page checkout ask for their order here, right
// after /api/register created the payment (PayPal, USD): the order carries
// that payment's own amount — never one from the browser — with its NF-
// reference as custom_id and invoice_id. Asked again for the same payment,
// it answers with the order already made for it.
export async function POST(req: NextRequest) {
  const parsed = bodySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "invalid_body" }, { status: 400 });

  const payment = await db.payment.findUnique({ where: { id: parsed.data.paymentId }, include: { registration: { include: { event: true } } } });
  if (!payment || payment.provider !== "PAYPAL" || payment.currency !== "USD" || payment.status !== "PENDING") {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }
  if (payment.providerReference) return NextResponse.json({ id: payment.providerReference });

  const { name: brandName } = await getOrgSettings();
  const orderId = await createPayPalOrder({
    reference: paymentReference(payment.id),
    amountInCents: payment.amountInCents,
    description: publicEventName(payment.registration.event),
    brandName,
  });
  if (!orderId) return NextResponse.json({ error: "paypal_unavailable" }, { status: 502 });

  await db.payment.update({ where: { id: payment.id }, data: { providerReference: orderId } });
  return NextResponse.json({ id: orderId });
}
