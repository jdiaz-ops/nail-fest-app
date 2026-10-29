import type { Settlement } from "@/lib/payments/confirmRegistrationPayment";

// PayPal (REST API, Orders v2) — the second gateway (2026-10-29), for buyers
// who pay in US dollars, mostly from outside Colombia for the virtual
// congress. The one-page checkout shows PayPal's own buttons (its JS SDK,
// with the public client id); everything else happens here, on the server:
// /api/paypal/orders creates the order for a Payment row, /api/paypal/orders/
// <id>/capture captures it once the buyer approves, /api/paypal/events takes
// PayPal's webhooks. Nothing is confirmed on a browser's or an event's word:
// the order is read from PayPal's API.
//
// Env vars (see .env.example and docs/PAYMENTS_SETUP.md — sandbox first):
//   PAYPAL_ENV — "sandbox" (the default) or "live": which API base,
//     api-m.sandbox.paypal.com or api-m.paypal.com. Every value below must
//     be that same environment's (a sandbox app's credentials, its webhook).
//   PAYPAL_CLIENT_ID / PAYPAL_CLIENT_SECRET — the app's REST credentials.
//   PAYPAL_WEBHOOK_ID — the app's webhook, to verify each event's signature.
//   NEXT_PUBLIC_PAYPAL_CLIENT_ID — the same client id, for the browser's SDK
//     (its URL is the same for both environments: the client id decides).

export interface PayPalAmount {
  currency_code: string;
  value: string;
}

export interface PayPalCapture {
  id: string;
  status: string;
  amount?: PayPalAmount;
  custom_id?: string;
  invoice_id?: string;
  supplementary_data?: { related_ids?: { order_id?: string } };
  links?: { href: string; rel: string }[];
}

export interface PayPalRefund {
  id: string;
  status: string;
  amount?: PayPalAmount;
  custom_id?: string;
  seller_payable_breakdown?: { total_refunded_amount?: PayPalAmount };
  links?: { href: string; rel: string }[];
}

export interface PayPalOrder {
  id: string;
  status: string;
  purchase_units?: {
    reference_id?: string;
    custom_id?: string;
    invoice_id?: string;
    amount?: PayPalAmount;
    payments?: { captures?: PayPalCapture[] };
  }[];
}

export function paypalApiBase(): string {
  return process.env.PAYPAL_ENV === "live" ? "https://api-m.paypal.com" : "https://api-m.sandbox.paypal.com";
}

export function paypalConfigured(): boolean {
  return Boolean(process.env.PAYPAL_CLIENT_ID && process.env.PAYPAL_CLIENT_SECRET);
}

/** What the checkout's PayPal buttons need: the public client id, and whether it's the sandbox. Null — no PayPal on
 * the page — without the server's credentials, or when the browser's client id isn't the server's (half switched
 * between sandbox and live: the buyer would approve an order the server can't capture). */
export function paypalCheckoutConfig(): { clientId: string; sandbox: boolean } | null {
  const clientId = process.env.NEXT_PUBLIC_PAYPAL_CLIENT_ID;
  if (!paypalConfigured() || !clientId) return null;
  if (clientId !== process.env.PAYPAL_CLIENT_ID) {
    console.warn("paypal: NEXT_PUBLIC_PAYPAL_CLIENT_ID isn't PAYPAL_CLIENT_ID — PayPal stays off the checkout until both are the same app's");
    return null;
  }
  return { clientId, sandbox: process.env.PAYPAL_ENV !== "live" };
}

/** "25.00" → 2500, without going through floating point. */
export function centsFromValue(value: string): number {
  const [whole = "0", fraction = ""] = value.trim().split(".");
  return Number(whole) * 100 + Number(`${fraction}00`.slice(0, 2));
}

/** 2500 → "25.00" */
export function valueFromCents(cents: number): string {
  return `${Math.floor(cents / 100)}.${String(cents % 100).padStart(2, "0")}`;
}

let cachedToken: { token: string; expiresAt: number; base: string } | null = null;

async function accessToken(): Promise<string> {
  const base = paypalApiBase();
  if (cachedToken && cachedToken.base === base && cachedToken.expiresAt > Date.now()) return cachedToken.token;
  const id = process.env.PAYPAL_CLIENT_ID;
  const secret = process.env.PAYPAL_CLIENT_SECRET;
  if (!id || !secret) throw new Error("Missing PAYPAL_CLIENT_ID / PAYPAL_CLIENT_SECRET (see lib/payments/paypal.ts's own comment)");
  const res = await fetch(`${base}/v1/oauth2/token`, {
    method: "POST",
    headers: { Authorization: `Basic ${Buffer.from(`${id}:${secret}`).toString("base64")}`, "Content-Type": "application/x-www-form-urlencoded" },
    body: "grant_type=client_credentials",
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`PayPal token: ${res.status}`);
  const body = (await res.json()) as { access_token: string; expires_in?: number };
  // A minute short of PayPal's own expiry (usually 9 hours).
  cachedToken = { token: body.access_token, expiresAt: Date.now() + Math.max(0, (body.expires_in ?? 0) - 60) * 1000, base };
  return cachedToken.token;
}

/** One call to PayPal's API: its status and JSON, or null when PayPal couldn't be reached at all. */
async function paypalApi(
  path: string,
  init: { method?: string; body?: unknown; headers?: Record<string, string> } = {},
): Promise<{ status: number; body: unknown } | null> {
  try {
    const token = await accessToken();
    const res = await fetch(`${paypalApiBase()}${path}`, {
      method: init.method ?? "GET",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json", ...init.headers },
      body: init.body === undefined ? undefined : JSON.stringify(init.body),
      cache: "no-store",
    });
    return { status: res.status, body: await res.json().catch(() => null) };
  } catch (err) {
    console.error("paypal:", path, err);
    return null;
  }
}

/** Creates the order for one of our payments: its amount in USD, our NF- reference as custom_id and invoice_id
 * (unique per checkout attempt). Asked twice for the same payment, PayPal answers with the same order. */
export async function createPayPalOrder(params: { reference: string; amountInCents: number; description: string; brandName: string }): Promise<string | null> {
  const res = await paypalApi("/v2/checkout/orders", {
    method: "POST",
    headers: { "PayPal-Request-Id": `order-${params.reference}` },
    body: {
      intent: "CAPTURE",
      purchase_units: [
        {
          reference_id: params.reference,
          custom_id: params.reference,
          invoice_id: params.reference,
          description: params.description.slice(0, 127),
          amount: { currency_code: "USD", value: valueFromCents(params.amountInCents) },
        },
      ],
      application_context: { brand_name: params.brandName.slice(0, 127), shipping_preference: "NO_SHIPPING", user_action: "PAY_NOW" },
    },
  });
  const id = (res?.body as { id?: string } | null)?.id;
  if (!res || res.status >= 300 || !id) {
    console.error("paypal: createOrder failed", params.reference, res?.status, JSON.stringify(res?.body ?? null));
    return null;
  }
  return id;
}

/** Captures an approved order. PayPal captures an order once at most — a second try is refused
 * (ORDER_ALREADY_CAPTURED), never charged again — so no PayPal-Request-Id: with one, the retry after a declined
 * card (the buyer picks another way to pay, same order) would get the first refusal back instead of a capture.
 * A refusal says why (`issue`: INSTRUMENT_DECLINED, ORDER_ALREADY_CAPTURED…). */
export async function capturePayPalOrder(orderId: string): Promise<{ ok: true; order: PayPalOrder } | { ok: false; status: number | null; issue?: string }> {
  const res = await paypalApi(`/v2/checkout/orders/${encodeURIComponent(orderId)}/capture`, {
    method: "POST",
    headers: { Prefer: "return=representation" },
    body: {},
  });
  if (!res) return { ok: false, status: null };
  if (res.status === 200 || res.status === 201) return { ok: true, order: res.body as PayPalOrder };
  const issue = (res.body as { details?: { issue?: string }[] } | null)?.details?.[0]?.issue;
  return { ok: false, status: res.status, issue };
}

export async function getPayPalOrder(orderId: string): Promise<PayPalOrder | null> {
  const res = await paypalApi(`/v2/checkout/orders/${encodeURIComponent(orderId)}`);
  return res && res.status === 200 ? (res.body as PayPalOrder) : null;
}

export async function getPayPalCapture(captureId: string): Promise<PayPalCapture | null> {
  const res = await paypalApi(`/v2/payments/captures/${encodeURIComponent(captureId)}`);
  return res && res.status === 200 ? (res.body as PayPalCapture) : null;
}

/** Whether a webhook event is PayPal's own, by its verification endpoint (/v1/notifications/verify-webhook-signature)
 * with the transmission headers and PAYPAL_WEBHOOK_ID — in whichever environment PAYPAL_ENV names. "unavailable":
 * PayPal couldn't be asked (a retry may do). Never "valid" without the webhook id or any of the headers. */
export async function verifyPayPalWebhook(headers: { get(name: string): string | null }, event: unknown): Promise<"valid" | "invalid" | "unavailable"> {
  const webhookId = process.env.PAYPAL_WEBHOOK_ID;
  const fields = {
    auth_algo: headers.get("paypal-auth-algo"),
    cert_url: headers.get("paypal-cert-url"),
    transmission_id: headers.get("paypal-transmission-id"),
    transmission_sig: headers.get("paypal-transmission-sig"),
    transmission_time: headers.get("paypal-transmission-time"),
  };
  if (!webhookId || Object.values(fields).some((value) => !value)) return "invalid";
  const res = await paypalApi("/v1/notifications/verify-webhook-signature", {
    method: "POST",
    body: { ...fields, webhook_id: webhookId, webhook_event: event },
  });
  if (!res || res.status >= 500) return "unavailable";
  return res.status === 200 && (res.body as { verification_status?: string } | null)?.verification_status === "SUCCESS" ? "valid" : "invalid";
}

/** What a PayPal order says about one of our payments: its capture's status
 * and amount (Orders v2 nests them in the purchase unit). A capture refunded
 * in full confirms nothing; one refunded in part still holds the ticket. */
export function settlementFromOrder(order: PayPalOrder): Settlement | null {
  const unit = order.purchase_units?.[0];
  const capture = unit?.payments?.captures?.[0];
  const reference = unit?.custom_id ?? capture?.custom_id ?? unit?.reference_id;
  if (!reference) return null;
  const status: Settlement["status"] =
    capture?.status === "COMPLETED" || capture?.status === "PARTIALLY_REFUNDED"
      ? "APPROVED"
      : capture?.status === "DECLINED" || capture?.status === "FAILED"
        ? "DECLINED"
        : capture?.status === "REFUNDED"
          ? "VOIDED"
          : "PENDING";
  const amount = capture?.amount ?? unit?.amount;
  return {
    provider: "PAYPAL",
    reference,
    providerReference: order.id,
    status,
    amountInCents: amount ? centsFromValue(amount.value) : 0,
    currency: amount?.currency_code ?? "",
    raw: order,
  };
}
