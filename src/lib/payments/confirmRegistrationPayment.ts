import { db } from "@/lib/db";
import { Prisma } from "@prisma/client";
import type { WompiTransaction } from "@/lib/payments/wompi";
import { finalizeConfirmedRegistration } from "@/lib/registrationConfirmation";

export type ConfirmResult = "approved" | "declined" | "voided" | "error" | "pending" | "not_found";

/** The one place a Wompi transaction turns into a real CONFIRMED
 * registration — called from BOTH /api/webhooks/wompi (the async,
 * eventual-consistency path) and /[eventSlug]/pago's own server
 * component (the synchronous check when the customer's browser lands
 * back from Wompi) — whichever gets here first does the real work; the
 * other finds it already done and returns the same result, thanks to the
 * atomic conditional update below. Never throws: a real problem here
 * (amount mismatch, no matching Payment) returns "error"/"not_found" for
 * the caller to log/render, not a 500. */
export async function confirmRegistrationPayment(transaction: WompiTransaction): Promise<ConfirmResult> {
  const payment = await db.payment.findFirst({
    where: { OR: [{ providerReference: transaction.id }, { id: transaction.reference }] },
    include: { registration: { include: { person: true, event: true } } },
  });
  if (!payment) return "not_found";

  // Always record the latest raw payload/status we've seen, even on a
  // repeat call — the audit trail (Payment.rawPayload) should reflect
  // reality, not just the first call's snapshot.
  await db.payment.update({
    where: { id: payment.id },
    data: { providerReference: transaction.id, status: transaction.status, rawPayload: transaction as unknown as Prisma.InputJsonValue },
  });

  if (transaction.status !== "APPROVED") {
    return transaction.status.toLowerCase() as ConfirmResult;
  }

  // Never trust the amount blindly — a mismatch means either tampering
  // or a real bug, either way this must NOT be treated as a valid
  // payment for the ticket price we actually charged.
  if (transaction.amount_in_cents !== payment.amountInCents) {
    console.error("confirmRegistrationPayment: amount mismatch", payment.id, transaction.amount_in_cents, payment.amountInCents);
    return "error";
  }

  const { registration } = payment;

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
  await finalizeConfirmedRegistration({
    person: registration.person,
    event: registration.event,
    registration: updated,
    wasAlreadyConfirmed: false,
  });

  return "approved";
}
