// The reference every gateway gets for one of our payments — Wompi's
// `reference`, PayPal's `custom_id` and `invoice_id`: NF- + the Payment row's
// id, unique per checkout attempt. The prefix is how marcolini.lat, which
// receives the shared Wompi comercio's events, tells ours apart (2026-10-29).

export const PAYMENT_REFERENCE_PREFIX = "NF-";

export function paymentReference(paymentId: string): string {
  return `${PAYMENT_REFERENCE_PREFIX}${paymentId}`;
}

/** The Payment row a reference names: NF-<id>, or the bare id references
 * were before 2026-10-29 (a checkout started before then can still come
 * back). Anything else names no Payment of ours. */
export function paymentIdFromReference(reference: string): string {
  return reference.startsWith(PAYMENT_REFERENCE_PREFIX) ? reference.slice(PAYMENT_REFERENCE_PREFIX.length) : reference;
}
