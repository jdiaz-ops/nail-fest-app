import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { paymentReference } from "@/lib/payments/reference";
import { capturePayPalOrder, getPayPalOrder, settlementFromOrder, type PayPalOrder } from "@/lib/payments/paypal";
import { settlePayment } from "@/lib/payments/confirmRegistrationPayment";

// Once the buyer approves in PayPal's window, the checkout asks for the
// capture here (PayPal never captures an order twice: a second try is
// refused, and the order is read instead), and confirms through the same
// idempotent settlement as Wompi's — with what PayPal's API answered:
// COMPLETED, for the payment's own amount, currency and NF- reference. A
// card PayPal declined comes back as "declined" with retry, so the buttons
// can let the buyer pick another way to pay, for the same order.
export async function POST(_req: NextRequest, { params }: { params: { orderId: string } }) {
  const payment = await db.payment.findUnique({
    where: { providerReference: params.orderId },
    select: { id: true, provider: true, registrationId: true, registration: { select: { event: { select: { slug: true } } } } },
  });
  if (!payment || payment.provider !== "PAYPAL") return NextResponse.json({ error: "not_found" }, { status: 404 });

  const captured = await capturePayPalOrder(params.orderId);
  if (!captured.ok && captured.issue === "INSTRUMENT_DECLINED") {
    return NextResponse.json({ result: "declined", retry: true });
  }
  // Already captured (the webhook, or a second tap), or the capture's answer
  // got lost on the way: the order itself says how it ended.
  const order: PayPalOrder | null = captured.ok ? captured.order : await getPayPalOrder(params.orderId);
  if (!order) return NextResponse.json({ error: "paypal_unavailable" }, { status: 502 });

  const settlement = settlementFromOrder(order);
  if (!settlement || settlement.reference !== paymentReference(payment.id)) {
    console.error("paypal capture: the order isn't this payment's", params.orderId, payment.id);
    return NextResponse.json({ error: "mismatch" }, { status: 409 });
  }
  const result = await settlePayment(settlement);
  return NextResponse.json({
    result,
    redirect: `/${payment.registration.event.slug}/pago?registrationId=${encodeURIComponent(payment.registrationId)}&paypal=${encodeURIComponent(params.orderId)}`,
  });
}
