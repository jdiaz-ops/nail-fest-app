/** When a ticket was issued, for the admin's «Entradas emitidas» (2026-11-02): the day it was paid, not the day its
 * registration row was first created — that row can be weeks older (an abandoned checkout, or an earlier ticket since
 * cancelled, is the same row: one per person and event). The later of its confirmation and its last approved
 * payment, an upgrade's aside (moving up a level issues nothing new): a payment approved days after it started (cash
 * at a corresponsal) dates from its confirmation; a ticket bought again after a cancellation, from its new payment,
 * since confirmedAt keeps the first one. Never confirmed and never paid: when the row was created (an import sets
 * both dates to its order's). */
export function ticketIssuedAt(
  registration: { createdAt: Date; confirmedAt: Date | null },
  lastApprovedPaymentAt?: Date | null,
): Date {
  const confirmed = registration.confirmedAt ?? registration.createdAt;
  return lastApprovedPaymentAt && lastApprovedPaymentAt > confirmed ? lastApprovedPaymentAt : confirmed;
}
