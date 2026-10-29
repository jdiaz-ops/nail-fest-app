import { createHash, timingSafeEqual } from "crypto";

// Wompi (Bancolombia's payment gateway) — Colombia-only, COP-only. Two
// integration surfaces, both documented at docs.wompi.co:
//  1. Web Checkout (buildCheckoutUrl below) — a plain GET redirect to
//     Wompi's OWN hosted payment page, no client JS/widget needed. Chosen
//     over the JS widget specifically so /api/register can stay a normal
//     server route that just returns a URL to redirect to (see that
//     route's own comment on the PENDING_PAYMENT branch).
//  2. Eventos — a transaction's status changes (lib/payments/wompiEvents.ts).
//     This comercio is SHARED with marcolini.lat (2026-10-29): Wompi allows
//     one "URL de Eventos" per comercio and it points at Marcolini, which
//     relays to /api/wompi/events the events whose reference starts with
//     NF- (wompiReference below). Nothing is confirmed on an event's word
//     alone: the transaction is read back from Wompi's API first
//     (fetchTransaction), same as when the customer's browser lands back on
//     our own redirect-url.
//
// Env vars (see .env.example and docs/PAYMENTS_SETUP.md — sandbox first, always):
//   WOMPI_PUBLIC_KEY / WOMPI_PRIVATE_KEY — the comercio's key pair:
//     `pub_prod_...`/`prv_prod_...` in production, `pub_test_...`/
//     `prv_test_...` in sandbox. The checkout URL is the same for both;
//     which environment applies follows from the keys themselves, and so
//     does the API base fetchTransaction hits (WOMPI_ENV isn't read any more).
//   WOMPI_INTEGRITY_SECRET — signs the checkout's own values so they can't
//     be tampered with in the browser.
//   WOMPI_EVENTS_SECRET — verifies an event's checksum. Never the same
//     value as the integrity secret, even though both are "a secret Wompi
//     gives you" — Wompi issues them separately, each for its own purpose.
//   RELAY_SHARED_SECRET — what Marcolini sends in `x-relay-secret` when it
//     relays one of our events; the same value on both sides.

function env(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Missing required env var: ${name} (see lib/payments/wompi.ts's own comment)`);
  return value;
}

/** Every reference this app sends to Wompi starts with this, so whoever
 * receives the comercio's events (Marcolini, since 2026-10-29) can tell
 * ours apart and relay them here. */
export const WOMPI_REFERENCE_PREFIX = "NF-";

/** A checkout attempt's reference: NF- + its Payment row's id — unique per
 * attempt, as Wompi requires (a declined attempt's reference can't be
 * used again; see the Payment model's own comment). */
export function wompiReference(paymentId: string): string {
  return `${WOMPI_REFERENCE_PREFIX}${paymentId}`;
}

/** The Payment row a reference names: NF-<id>, or the bare id references
 * were before 2026-10-29 (a checkout started before then can still come
 * back). Anything else names no Payment of ours. */
export function paymentIdFromReference(reference: string): string {
  return reference.startsWith(WOMPI_REFERENCE_PREFIX) ? reference.slice(WOMPI_REFERENCE_PREFIX.length) : reference;
}

/** Constant-time, and of equal length whatever the inputs (both hashed
 * first), so the comparison itself gives away nothing about how much of a
 * secret matched. */
function safeEqual(a: string, b: string): boolean {
  return timingSafeEqual(createHash("sha256").update(a).digest(), createHash("sha256").update(b).digest());
}

/** SHA256(reference + amountInCents + currency + integritySecret), exactly
 * as Wompi's Web Checkout docs specify (concatenated as plain strings, no
 * separators) — this is what proves to Wompi's hosted page that the
 * amount/reference/currency weren't tampered with in the browser before
 * the redirect. */
function computeIntegritySignature(reference: string, amountInCents: number, currency: string): string {
  const secret = env("WOMPI_INTEGRITY_SECRET");
  return createHash("sha256").update(`${reference}${amountInCents}${currency}${secret}`).digest("hex");
}

/** Builds the full URL to redirect the customer's browser to for a Wompi
 * Web Checkout payment — GET to checkout.wompi.co/p/ with the payment's
 * details as query params, integrity-signed so Wompi can trust them. Same
 * checkout.wompi.co host for sandbox and production; the public key alone
 * determines which environment actually processes the payment. Only the
 * essentials: with the buyer's details too, Wompi's firewall answered
 * marcolini.lat (the same comercio) with a 403 (2026-10-01). The checkout
 * opens Wompi's own window instead (wompiWidgetParams); this is its
 * fallback, and the old modal's way to pay. */
export function buildCheckoutUrl(params: {
  reference: string; // wompiReference(this Payment row's id) — unique per checkout attempt
  amountInCents: number;
  currency?: string; // Wompi only supports COP today
  redirectUrl: string; // where Wompi sends the browser back to, with ?id=<transactionId> appended
}): string {
  const currency = params.currency ?? "COP";
  const signature = computeIntegritySignature(params.reference, params.amountInCents, currency);
  const query = new URLSearchParams({
    "public-key": env("WOMPI_PUBLIC_KEY"),
    "currency": currency,
    "amount-in-cents": String(params.amountInCents),
    "reference": params.reference,
    "signature:integrity": signature,
    "redirect-url": params.redirectUrl,
  });
  return `https://checkout.wompi.co/p/?${query.toString()}`;
}

/** The same payment for Wompi's own window over the checkout (WidgetCheckout,
 * docs.wompi.co/docs/colombia/widget-checkout-web/): what the page needs to
 * open it — the public key, the amount, the reference and its integrity
 * signature, signed here so the secret never reaches the browser. */
export function wompiWidgetParams(params: { reference: string; amountInCents: number; currency?: string; redirectUrl: string }) {
  const currency = params.currency ?? "COP";
  return {
    publicKey: env("WOMPI_PUBLIC_KEY"),
    currency,
    amountInCents: params.amountInCents,
    reference: params.reference,
    signature: computeIntegritySignature(params.reference, params.amountInCents, currency),
    redirectUrl: params.redirectUrl,
  };
}

export type WompiWidgetParams = ReturnType<typeof wompiWidgetParams>;

export interface WompiTransaction {
  id: string;
  status: "PENDING" | "APPROVED" | "DECLINED" | "VOIDED" | "ERROR";
  reference: string;
  amount_in_cents: number;
  currency: string;
}

/** Reads a transaction straight from Wompi's API by id — what a payment is
 * confirmed on, never an event's body or a link's word: from the events
 * (lib/payments/wompiEvents.ts) and from the page the customer's browser
 * lands back on (/[eventSlug]/pago). With the PRIVATE key; until
 * WOMPI_PRIVATE_KEY is loaded, with the public one as before, and a
 * warning in the logs as a reminder. The API base is the key's own:
 * sandbox for `_test_` keys, production for the rest. Returns null on any
 * failure (no key, network, 404, malformed response) — "still don't
 * know", for the caller to retry or to tell the customer, never to
 * confirm on. */
export async function fetchTransaction(transactionId: string): Promise<WompiTransaction | null> {
  try {
    let key = process.env.WOMPI_PRIVATE_KEY;
    if (!key) {
      console.warn("wompi: falta WOMPI_PRIVATE_KEY — la transacción se consulta con la llave pública. Cárgala en Vercel.");
      key = env("WOMPI_PUBLIC_KEY");
    }
    const base = /^(pub|prv)_test_/.test(key) ? "https://sandbox.wompi.co/v1" : "https://production.wompi.co/v1";
    const res = await fetch(`${base}/transactions/${encodeURIComponent(transactionId)}`, {
      headers: { Authorization: `Bearer ${key}` },
      // Never a cached answer: a PENDING read once must not stand in for an APPROVED one later.
      cache: "no-store",
    });
    if (!res.ok) {
      // A 401 here is a key Wompi doesn't take (a typo in Vercel, a sandbox key in production).
      console.error("wompi: fetchTransaction answered", res.status, transactionId);
      return null;
    }
    const body = await res.json();
    return body?.data ?? null;
  } catch (err) {
    console.error("wompi: fetchTransaction failed", transactionId, err);
    return null;
  }
}

export interface WompiWebhookEvent {
  event: string; // e.g. "transaction.updated"
  data: { transaction: WompiTransaction };
  sent_at: string;
  timestamp: number;
  signature: { properties: string[]; checksum: string };
}

/** An event's body, parsed — null when it isn't a JSON object at all.
 * Says nothing yet about whether it's genuine (eventChecksumIsValid). */
export function parseWompiEvent(rawBody: string): WompiWebhookEvent | null {
  try {
    const parsed = JSON.parse(rawBody);
    return parsed && typeof parsed === "object" ? (parsed as WompiWebhookEvent) : null;
  } catch {
    return null;
  }
}

/** Whether an event is Wompi's own, per its algorithm
 * (docs.wompi.co/en/docs/colombia/eventos/): the values at the paths in
 * the event's OWN `signature.properties` — for transaction.updated,
 * transaction.id, transaction.status and transaction.amount_in_cents —
 * concatenated in order, then its `timestamp`, then WOMPI_EVENTS_SECRET;
 * SHA256, against `signature.checksum`. The list is read from the event
 * rather than hardcoded since Wompi's docs warn it can vary event to
 * event, and its paths go INTO `data`, not the envelope — confirmed live
 * against a real sandbox webhook. False when the secret isn't loaded:
 * never authorize on a check that can't run. */
export function eventChecksumIsValid(event: WompiWebhookEvent): boolean {
  const secret = process.env.WOMPI_EVENTS_SECRET;
  const properties = event?.signature?.properties;
  const checksum = event?.signature?.checksum;
  if (!secret || !Array.isArray(properties) || typeof checksum !== "string") return false;

  const concatenated = properties
    .map((path) =>
      String(path)
        .split(".")
        .reduce<unknown>((acc, key) => (acc && typeof acc === "object" ? (acc as Record<string, unknown>)[key] : undefined), event.data as unknown)
    )
    .map((value) => String(value ?? ""))
    .join("");
  const expected = createHash("sha256").update(`${concatenated}${event.timestamp}${secret}`).digest("hex");
  return safeEqual(expected, checksum.toLowerCase());
}

/** Whether a request comes from Marcolini's relay: its `x-relay-secret`
 * header is RELAY_SHARED_SECRET, compared in constant time. False when
 * the secret isn't loaded. */
export function relaySecretIsValid(header: string | null): boolean {
  const secret = process.env.RELAY_SHARED_SECRET;
  if (!secret || !header) return false;
  return safeEqual(header, secret);
}
