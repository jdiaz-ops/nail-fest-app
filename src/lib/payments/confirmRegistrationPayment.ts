import { db } from "@/lib/db";
import type { PaymentProvider, Prisma } from "@prisma/client";
import type { WompiTransaction } from "@/lib/payments/wompi";
import { paymentIdFromReference } from "@/lib/payments/reference";
import { finalizeConfirmedRegistration } from "@/lib/registrationConfirmation";
import { closeStageIfFull } from "@/lib/imparables/pricing";
import { afterTierPurchase, applyUpgrade } from "@/lib/imparables/tiersServer";
import { cancelRegistrant } from "@/lib/zoom";

export type ConfirmResult = "approved" | "declined" | "voided" | "error" | "pending" | "not_found";

/** A gateway's word on one of our payments, as its own API reported it (never a browser's or an event's body):
 * Wompi's transaction, or PayPal's order (lib/payments/paypal.ts). */
export interface Settlement {
  provider: PaymentProvider;
  /** NF-<Payment id>: which payment it's about. */
  reference: string;
  /** The gateway's own id for it: Wompi's transaction, PayPal's order. */
  providerReference: string;
  status: "PENDING" | "APPROVED" | "DECLINED" | "VOIDED" | "ERROR";
  amountInCents: number;
  currency: string;
  raw: unknown;
}

/** The one place a payment turns into a real CONFIRMED registration, for
 * either gateway (Wompi, and PayPal since 2026-10-29) — called from the
 * async paths (Wompi's events, PayPal's webhooks) and the synchronous ones
 * (/[eventSlug]/pago when the buyer's browser lands back, PayPal's capture),
 * each with what the gateway's API says — whichever gets here first does
 * the real work; the others find it already done and return the same
 * result, thanks to the atomic conditional update below. A real problem
 * here (amount or currency mismatch, no matching Payment) returns
 * "error"/"not_found" for the caller to log/render, not a 500. */
export async function settlePayment(settlement: Settlement): Promise<ConfirmResult> {
  // Only the Payment its reference names — NF-<id>, or the bare id a
  // checkout from before 2026-10-29 went out with — and through the gateway
  // it was created for: anything else confirms nothing.
  const payment = await db.payment.findUnique({
    where: { id: paymentIdFromReference(settlement.reference) },
    include: { registration: { include: { person: true, event: true } } },
  });
  if (!payment || payment.provider !== settlement.provider) return "not_found";
  // Refunded in full, it stays so: a late "approved" doesn't bring it back.
  if (payment.status === "REFUNDED") return "voided";

  // Always record the latest raw payload/status we've seen, even on a
  // repeat call — the audit trail (Payment.rawPayload) should reflect
  // reality, not just the first call's snapshot.
  await db.payment.update({
    where: { id: payment.id },
    data: { providerReference: settlement.providerReference, status: settlement.status, rawPayload: settlement.raw as Prisma.InputJsonValue },
  });

  if (settlement.status !== "APPROVED") {
    return settlement.status.toLowerCase() as ConfirmResult;
  }

  // Never trust the amount blindly — a mismatch means either tampering
  // or a real bug, either way this must NOT be treated as a valid
  // payment for the ticket price we actually charged.
  if (settlement.amountInCents !== payment.amountInCents || settlement.currency !== payment.currency) {
    console.error("settlePayment: amount mismatch", payment.id, settlement.amountInCents, settlement.currency, payment.amountInCents, payment.currency);
    return "error";
  }

  const { registration } = payment;

  // The difference to move up a ticket level (lib/imparables/tiers.ts,
  // 2026-10-31): her purchase was already confirmed; only her level moves up.
  if (payment.upgradeFrom) {
    await applyUpgrade(payment);
    return "approved";
  }

  // Atomic conditional transition — closes the real race between the
  // webhook and the redirect-return page landing at nearly the same
  // moment (both reading "not yet CONFIRMED" before either writes).
  // `count === 0` means someone else already won this transition (or it
  // was already CONFIRMED before either of us got here); either way
  // there is nothing left for THIS call to do.
  const { count } = await db.registration.updateMany({
    where: { id: registration.id, status: { not: "CONFIRMED" } },
    data: { status: "CONFIRMED", confirmedAt: registration.confirmedAt ?? new Date() },
  });
  if (count === 0) return "approved";

  const updated = await db.registration.findUniqueOrThrow({ where: { id: registration.id } });
  // Its stage's cap counted again with it (2026-10-29): filled, the stage
  // closes for good — and the purchase stands at what it paid, even past
  // the cap. Before the email, so it already says the price went up.
  await closeStageIfFull(updated.ticketTypeId);
  await finalizeConfirmedRegistration({
    person: registration.person,
    event: registration.event,
    registration: updated,
    wasAlreadyConfirmed: false,
  });
  // A level's purchase: Heidy's welcome to an Élite.
  if (updated.tierSlug) await afterTierPurchase(updated.id);

  return "approved";
}

/** A Wompi transaction (from its API) — see settlePayment. */
export function confirmRegistrationPayment(transaction: WompiTransaction): Promise<ConfirmResult> {
  return settlePayment({
    provider: "WOMPI",
    reference: String(transaction.reference ?? ""),
    providerReference: transaction.id,
    status: transaction.status,
    amountInCents: transaction.amount_in_cents,
    currency: transaction.currency,
    raw: transaction,
  });
}

export type RefundResult = "revoked" | "partial" | "still_paid" | "already" | "not_found";

/** A refund of one of our payments (PayPal's, 2026-10-29). Records how much
 * went back. Refunded in full, the payment is REFUNDED and the registration
 * loses its place: cancelled — out of every send, stat and count — and off
 * the event's Zoom, so its personal link stops working. A partial refund
 * keeps the place. Idempotent: the same refund again changes nothing. */
export async function refundPayment(refund: {
  provider: PaymentProvider;
  reference: string;
  /** The total refunded so far, in the payment's own cents. */
  refundedCents: number;
  full: boolean;
  raw: unknown;
}): Promise<RefundResult> {
  const payment = await db.payment.findUnique({
    where: { id: paymentIdFromReference(refund.reference) },
    include: { registration: { include: { person: true, event: true } } },
  });
  if (!payment || payment.provider !== refund.provider) return "not_found";

  await db.payment.update({
    where: { id: payment.id },
    data: {
      refundedCents: Math.max(payment.refundedCents, refund.refundedCents),
      rawPayload: refund.raw as Prisma.InputJsonValue,
      ...(refund.full ? { status: "REFUNDED" as const } : {}),
    },
  });
  if (!refund.full) return "partial";

  const { registration } = payment;
  // Bought twice and refunded once: the other payment still holds the place.
  const otherPaid = await db.payment.count({ where: { registrationId: registration.id, id: { not: payment.id }, status: "APPROVED" } });
  if (otherPaid > 0) return "still_paid";

  // Conditional, like the confirmation: the second delivery of the same
  // refund finds it already cancelled. No cancelledAt: that's the team's
  // "no puede ir", which the door undoes on a scan (lib/scan.ts).
  const { count } = await db.registration.updateMany({ where: { id: registration.id, status: { not: "CANCELLED" } }, data: { status: "CANCELLED" } });
  if (count === 0) return "already";

  const { event, person } = registration;
  if (event.zoomMeetingId) await cancelRegistrant(event.zoomMeetingId, event.zoomIsWebinar, person.email);
  return "revoked";
}
