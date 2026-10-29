import { db } from "@/lib/db";
import { eventChecksumIsValid, fetchTransaction, parseWompiEvent, relaySecretIsValid, WOMPI_REFERENCE_PREFIX } from "@/lib/payments/wompi";
import { confirmRegistrationPayment } from "@/lib/payments/confirmRegistrationPayment";

export interface WompiEventResponse {
  status: number;
  body: Record<string, unknown>;
}

/** One Wompi event, whichever door it came in through — /api/wompi/events
 * (where Marcolini relays ours, since 2026-10-29) or /api/webhooks/wompi
 * (kept for anything still arriving straight from Wompi). Nothing is
 * relayed onward from here any more: Marcolini owns the comercio's one
 * "URL de Eventos" and hands the other integrations theirs itself.
 *
 *  1. Who sent it: Marcolini's relay (`x-relay-secret` = RELAY_SHARED_SECRET,
 *     plus its Wompi checksum too whenever WOMPI_EVENTS_SECRET is loaded —
 *     the relay passes the body through untouched, so it still checks), or
 *     Wompi itself (its checksum). Neither → 401.
 *  2. Only a transaction.updated for one of ours goes on: an NF- reference,
 *     or the bare Payment id of a checkout from before 2026-10-29.
 *     Anything else → 200, nothing done.
 *  3. The transaction is read back from Wompi's API (private key) and THAT
 *     is what confirms it, never the body — through the same idempotent
 *     confirmation the return page uses (confirmRegistrationPayment) → 200.
 *     Wompi's API or the database failing → 500, so the sender retries
 *     (Marcolini, up to 4 times).
 */
export async function handleWompiEvent(rawBody: string, relaySecret: string | null): Promise<WompiEventResponse> {
  const event = parseWompiEvent(rawBody);
  const checksumOk = event ? eventChecksumIsValid(event) : false;
  const viaRelay = relaySecretIsValid(relaySecret);
  const authorized = viaRelay ? checksumOk || !process.env.WOMPI_EVENTS_SECRET : checksumOk;
  if (!authorized) {
    return { status: 401, body: { error: "invalid_signature" } };
  }

  const transaction = event?.event === "transaction.updated" ? event.data?.transaction : undefined;
  if (!transaction?.id || typeof transaction.reference !== "string") {
    return { status: 200, body: { ok: true, ignored: "not_a_transaction" } };
  }

  try {
    if (!(await isOurs(transaction.reference))) {
      return { status: 200, body: { ok: true, ignored: "not_ours" } };
    }
    const verified = await fetchTransaction(String(transaction.id));
    if (!verified) {
      return { status: 500, body: { error: "wompi_unavailable" } };
    }
    const result = await confirmRegistrationPayment(verified);
    return { status: 200, body: { ok: true, via: viaRelay ? "relay" : "wompi", result } };
  } catch (err) {
    console.error("wompi event: processing failed", transaction.id, err);
    return { status: 500, body: { error: "processing_failed" } };
  }
}

async function isOurs(reference: string): Promise<boolean> {
  if (reference.startsWith(WOMPI_REFERENCE_PREFIX)) return true;
  // A checkout started before 2026-10-29 went out with its Payment's bare id.
  return Boolean(await db.payment.findUnique({ where: { id: reference }, select: { id: true } }));
}
