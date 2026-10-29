import { NextRequest, NextResponse } from "next/server";
import { PAYMENT_REFERENCE_PREFIX } from "@/lib/payments/reference";
import {
  centsFromValue,
  getPayPalCapture,
  getPayPalOrder,
  settlementFromOrder,
  verifyPayPalWebhook,
  type PayPalCapture,
  type PayPalRefund,
} from "@/lib/payments/paypal";
import { refundPayment, settlePayment } from "@/lib/payments/confirmRegistrationPayment";

// PayPal's webhooks for the "Nail Fest" app — configured in both its sandbox
// and its live app, pointing here, for PAYMENT.CAPTURE.COMPLETED, .DENIED and
// .REFUNDED (2026-10-29). Each one verified first with PayPal's own endpoint
// and PAYPAL_WEBHOOK_ID (401 if it doesn't pass), then acted on with what
// PayPal's API says, never the event's body:
//   COMPLETED / DENIED — the order is read and settled like the capture
//     does (confirm, or record the decline), idempotently;
//   REFUNDED — the capture is read: refunded in full, the registration
//     loses its place (lib/payments/confirmRegistrationPayment.ts's
//     refundPayment); in part, it's only recorded.
// Not one of ours (no NF- reference): 200, nothing done. PayPal itself, or
// the database, failing: 500, and PayPal delivers it again later.
export async function POST(req: NextRequest) {
  const raw = await req.text();
  let event: { event_type?: string; resource?: unknown };
  try {
    event = JSON.parse(raw);
  } catch {
    return NextResponse.json({ error: "invalid_body" }, { status: 400 });
  }

  const verdict = await verifyPayPalWebhook(req.headers, event);
  if (verdict === "invalid") return NextResponse.json({ error: "invalid_signature" }, { status: 401 });
  if (verdict === "unavailable") return NextResponse.json({ error: "paypal_unavailable" }, { status: 500 });

  try {
    if (event.event_type === "PAYMENT.CAPTURE.COMPLETED" || event.event_type === "PAYMENT.CAPTURE.DENIED") {
      const capture = event.resource as PayPalCapture;
      if (!capture?.custom_id?.startsWith(PAYMENT_REFERENCE_PREFIX)) return NextResponse.json({ ok: true, ignored: "not_ours" });
      const orderId = capture.supplementary_data?.related_ids?.order_id;
      const order = orderId ? await getPayPalOrder(orderId) : null;
      if (!order) return NextResponse.json({ error: "paypal_unavailable" }, { status: 500 });
      const settlement = settlementFromOrder(order);
      if (!settlement || settlement.reference !== capture.custom_id) return NextResponse.json({ ok: true, ignored: "mismatch" });
      return NextResponse.json({ ok: true, result: await settlePayment(settlement) });
    }

    if (event.event_type === "PAYMENT.CAPTURE.REFUNDED") {
      const refund = event.resource as PayPalRefund;
      const captureId = refund?.links
        ?.find((link) => link.rel === "up")
        ?.href.split("/")
        .pop();
      const capture = captureId ? await getPayPalCapture(captureId) : null;
      if (!capture) return NextResponse.json({ error: "paypal_unavailable" }, { status: 500 });
      const reference = capture.custom_id ?? refund.custom_id;
      if (!reference?.startsWith(PAYMENT_REFERENCE_PREFIX)) return NextResponse.json({ ok: true, ignored: "not_ours" });
      const refunded = refund.seller_payable_breakdown?.total_refunded_amount?.value ?? refund.amount?.value ?? "0";
      const result = await refundPayment({
        provider: "PAYPAL",
        reference,
        refundedCents: centsFromValue(refunded),
        full: capture.status === "REFUNDED",
        raw: { refund, capture },
      });
      return NextResponse.json({ ok: true, result });
    }
  } catch (err) {
    console.error("paypal events: processing failed", event.event_type, err);
    return NextResponse.json({ error: "processing_failed" }, { status: 500 });
  }

  return NextResponse.json({ ok: true, ignored: "event" });
}
