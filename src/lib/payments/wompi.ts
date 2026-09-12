import { createHash } from "crypto";

// Wompi (Bancolombia's payment gateway) — Colombia-only, COP-only. Two
// integration surfaces, both documented at docs.wompi.co:
//  1. Web Checkout (buildCheckoutUrl below) — a plain GET redirect to
//     Wompi's OWN hosted payment page, no client JS/widget needed. Chosen
//     over the JS widget specifically so /api/register can stay a normal
//     server route that just returns a URL to redirect to (see that
//     route's own comment on the PENDING_PAYMENT branch).
//  2. Eventos webhook (verifyEventChecksum below) — Wompi POSTs a
//     transaction's status changes here; this app also double-checks by
//     fetching the transaction directly (fetchTransaction) when the
//     customer's browser lands back on our own redirect-url, so
//     confirmation doesn't depend on the webhook alone arriving in time.
//
// Required env vars (see docs/PAYMENTS_SETUP.md — sandbox first, always):
//   WOMPI_PUBLIC_KEY / WOMPI_PRIVATE_KEY — from the Wompi merchant
//     dashboard; `pub_test_...`/`prv_test_...` in sandbox, `pub_prod_...`/
//     `prv_prod_...` in production. The checkout URL itself doesn't change
//     between environments — which one applies is entirely determined by
//     which key pair you pass.
//   WOMPI_INTEGRITY_SECRET — a THIRD secret (separate from the key pair
//     above), from the same dashboard, used only to sign the checkout
//     widget's own values so they can't be tampered with in the browser.
//   WOMPI_EVENTS_SECRET — a FOURTH secret, used only to verify the events
//     webhook's checksum. Never the same value as the integrity secret,
//     even though both are "a secret Wompi gives you" — Wompi issues them
//     separately and expects each used only for its own purpose.
//   WOMPI_ENV — "sandbox" (default) or "production" — which API base
//     fetchTransaction hits. Flip this only once real (prod) keys are in
//     the other three env vars too; a prod key against the sandbox API
//     base (or vice versa) fails outright, it doesn't silently misbehave.

function env(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Missing required env var: ${name} (see lib/payments/wompi.ts's own comment)`);
  return value;
}

function apiBase(): string {
  return process.env.WOMPI_ENV === "production" ? "https://production.wompi.co/v1" : "https://sandbox.wompi.co/v1";
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
 * determines which environment actually processes the payment. */
export function buildCheckoutUrl(params: {
  reference: string; // this Payment row's own id — unique per checkout attempt, see the model's own comment
  amountInCents: number;
  currency?: string; // Wompi only supports COP today
  redirectUrl: string; // where Wompi sends the browser back to, with ?id=<transactionId> appended
  customerEmail?: string;
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
  if (params.customerEmail) query.set("customer-data:email", params.customerEmail);
  return `https://checkout.wompi.co/p/?${query.toString()}`;
}

export interface WompiTransaction {
  id: string;
  status: "PENDING" | "APPROVED" | "DECLINED" | "VOIDED" | "ERROR";
  reference: string;
  amount_in_cents: number;
  currency: string;
}

/** Fetches a transaction directly from Wompi's API by id — the
 * defense-in-depth check run when the customer's own browser lands back
 * on our redirect-url (see /[eventSlug]/pago/page.tsx), so confirmation
 * doesn't depend solely on the async webhook having already arrived.
 * Bearer-authenticated with the PUBLIC key — reading a transaction's own
 * status is exactly what the public key is meant for in Wompi's model
 * (the private key is for privileged writes this app doesn't do). Returns
 * null on any failure (network, 404, malformed response) — the caller
 * treats that as "still don't know," never as a real error to surface to
 * the customer. */
export async function fetchTransaction(transactionId: string): Promise<WompiTransaction | null> {
  try {
    const res = await fetch(`${apiBase()}/transactions/${transactionId}`, {
      headers: { Authorization: `Bearer ${env("WOMPI_PUBLIC_KEY")}` },
    });
    if (!res.ok) return null;
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

/** Verifies an inbound Eventos webhook's checksum per Wompi's own
 * algorithm (docs.wompi.co/en/docs/colombia/eventos/): pull the dotted
 * paths listed in the event's OWN `signature.properties` (never hardcoded
 * here — Wompi's docs explicitly warn this list can vary event to event),
 * concatenate those values in order + the event's own `timestamp` + the
 * events secret, SHA256, compare to `signature.checksum`. Returns the
 * parsed event only when the checksum matches; null on any parse failure
 * or mismatch — the caller (the webhook route) treats null as
 * "reject, do not process," same posture as the WhatsApp webhook's own
 * signature check. */
export function verifyEventChecksum(rawBody: string): WompiWebhookEvent | null {
  let parsed: WompiWebhookEvent;
  try {
    parsed = JSON.parse(rawBody);
  } catch {
    return null;
  }
  const properties = parsed?.signature?.properties;
  const checksum = parsed?.signature?.checksum;
  if (!Array.isArray(properties) || typeof checksum !== "string") return null;

  // `signature.properties` entries (e.g. "transaction.id") are paths INTO
  // `data`, not into the envelope as a whole — confirmed live against a
  // real sandbox webhook (resolving from the envelope root always came up
  // empty, since the real data lives at data.transaction.*, not
  // transaction.* directly).
  const concatenated = properties
    .map((path) => path.split(".").reduce<unknown>((acc, key) => (acc && typeof acc === "object" ? (acc as Record<string, unknown>)[key] : undefined), parsed.data as unknown))
    .map((value) => String(value ?? ""))
    .join("");

  const secret = process.env.WOMPI_EVENTS_SECRET;
  if (!secret) return null; // never authorize a webhook when the secret isn't even configured
  const expected = createHash("sha256").update(`${concatenated}${parsed.timestamp}${secret}`).digest("hex");
  return expected === checksum ? parsed : null;
}

/** This Wompi comercio is SHARED with another integration (a Shopify
 * store, wired through a third party — see /api/webhooks/wompi's own
 * comment) that already owned the account's one-and-only "URL de
 * Eventos" before Nail Fest needed it too. Wompi has no concept of
 * multiple webhook URLs per comercio, so instead of losing that
 * integration's events, this app becomes the single entry point and
 * relays anything that isn't its own straight through, byte-for-byte —
 * the receiving end's own checksum check still passes, since Wompi's
 * checksum is computed over the event's own fields + the shared account
 * secret, never tied to which URL received it.
 *
 * Best-effort by design: a relay failure must never surface back to
 * Wompi as this app's own failure (that would make Wompi retry against
 * BOTH integrations for something that was never this app's event to
 * begin with) — logged, never thrown. WOMPI_SHOPIFY_RELAY_URL unset
 * means "nothing else shares this comercio," a silent no-op, not an error. */
export async function relayToOtherIntegration(rawBody: string, headers: { get(name: string): string | null }): Promise<void> {
  const url = process.env.WOMPI_SHOPIFY_RELAY_URL;
  if (!url) return;
  try {
    const checksumHeader = headers.get("x-event-checksum");
    const res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": headers.get("content-type") ?? "application/json",
        ...(checksumHeader ? { "X-Event-Checksum": checksumHeader } : {}),
      },
      body: rawBody,
    });
    if (!res.ok) {
      console.error("wompi webhook relay: downstream integration responded", res.status, await res.text().catch(() => ""));
    }
  } catch (err) {
    console.error("wompi webhook relay: failed to reach downstream integration", err);
  }
}
