import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { NextRequest } from "next/server";

// PayPal end to end on our side (2026-10-29): the order, the capture and
// the webhooks through their real routes, the real settlement and refund
// (lib/payments/confirmRegistrationPayment.ts), against a small in-memory
// database and a simulated PayPal — its REST API as documented for Orders
// v2, sandbox or live by the base it's asked at.

type Row = Record<string, any>;

const { db, store } = vi.hoisted(() => {
  const store = { payments: [] as Row[], registrations: [] as Row[] };
  const withRegistration = (payment: Row) => ({ ...payment, registration: store.registrations.find((r) => r.id === payment.registrationId) });
  const db = {
    payment: {
      findUnique: async ({ where }: { where: Row }) => {
        const payment = store.payments.find((p) => (where.id !== undefined ? p.id === where.id : p.providerReference === where.providerReference));
        return payment ? structuredClone(withRegistration(payment)) : null;
      },
      update: async ({ where, data }: { where: Row; data: Row }) => {
        const payment = store.payments.find((p) => p.id === where.id);
        if (!payment) throw new Error(`no payment ${where.id}`);
        Object.assign(payment, data);
        return { ...payment };
      },
      count: async ({ where }: { where: Row }) =>
        store.payments.filter((p) => p.registrationId === where.registrationId && p.id !== where.id?.not && p.status === where.status).length,
    },
    registration: {
      updateMany: async ({ where, data }: { where: Row; data: Row }) => {
        const matching = store.registrations.filter((r) => r.id === where.id && r.status !== where.status?.not);
        for (const registration of matching) Object.assign(registration, data);
        return { count: matching.length };
      },
      findUniqueOrThrow: async ({ where }: { where: Row }) => {
        const registration = store.registrations.find((r) => r.id === where.id);
        if (!registration) throw new Error(`no registration ${where.id}`);
        return structuredClone(registration);
      },
    },
  };
  return { db, store };
});
vi.mock("@/lib/db", () => ({ db }));

const { finalizeConfirmedRegistration, cancelRegistrant } = vi.hoisted(() => ({ finalizeConfirmedRegistration: vi.fn(), cancelRegistrant: vi.fn() }));
vi.mock("@/lib/registrationConfirmation", () => ({ finalizeConfirmedRegistration }));
vi.mock("@/lib/zoom", () => ({ cancelRegistrant }));
vi.mock("@/lib/settings", () => ({ getOrgSettings: async () => ({ name: "Nail Fest" }) }));

import { POST as createOrder } from "./orders/route";
import { POST as captureOrder } from "./orders/[orderId]/capture/route";
import { POST as paypalEvent } from "./events/route";
import { paypalApiBase, paypalCheckoutConfig } from "@/lib/payments/paypal";

const SANDBOX = "https://api-m.sandbox.paypal.com";
const LIVE = "https://api-m.paypal.com";
const WEBHOOK_ID = "8PT597110X687430LKGECATA";
// The signature PayPal's (simulated) verification endpoint takes as its own.
const PAYPAL_SIGNATURE = "valid-transmission-sig";

const PAYMENT_ID = "cmhc7q2v50003kd81xw9e2m4";
const REFERENCE = `NF-${PAYMENT_ID}`;

/** PayPal's REST API, simulated: OAuth, Orders v2, captures, refunds and webhook verification, answering at whichever
 * base it's asked — and, like PayPal, replaying the first answer to a POST that repeats a PayPal-Request-Id. */
function simulatedPayPal() {
  const calls: { method: string; url: string; body: any }[] = [];
  const orders = new Map<string, Row>();
  const replays = new Map<string, { status: number; payload: unknown }>();
  let seq = 0;
  let declineNextCapture = false;

  const captureOf = (orderId: string): Row => orders.get(orderId)!.purchase_units[0].payments.captures[0];
  const findCapture = (captureId: string) => [...orders.values()].map((o) => o.purchase_units[0].payments?.captures?.[0]).find((c) => c?.id === captureId);

  function capture(order: Row, base: string) {
    const unit = order.purchase_units[0];
    const id = `3C67${++seq}366HH908993F`;
    unit.payments = {
      captures: [
        {
          id,
          status: "COMPLETED",
          amount: { ...unit.amount },
          custom_id: unit.custom_id,
          invoice_id: unit.invoice_id,
          supplementary_data: { related_ids: { order_id: order.id } },
          links: [
            { href: `${base}/v2/payments/captures/${id}`, rel: "self", method: "GET" },
            { href: `${base}/v2/checkout/orders/${order.id}`, rel: "up", method: "GET" },
          ],
        },
      ],
    };
    order.status = "COMPLETED";
  }

  function answer(method: string, url: URL, body: any): { status: number; payload: unknown } {
    const base = url.origin;
    const path = url.pathname;
    if (path === "/v1/oauth2/token") return { status: 200, payload: { access_token: `A21AA-${base}`, token_type: "Bearer", expires_in: 32400 } };
    if (path === "/v1/notifications/verify-webhook-signature") {
      const ok = body.webhook_id === WEBHOOK_ID && body.transmission_sig === PAYPAL_SIGNATURE;
      return { status: 200, payload: { verification_status: ok ? "SUCCESS" : "FAILURE" } };
    }
    if (path === "/v2/checkout/orders" && method === "POST") {
      const id = `5O19${++seq}127TN364715T`;
      const unit = body.purchase_units[0];
      orders.set(id, { id, intent: body.intent, status: "CREATED", purchase_units: [{ ...unit }] });
      return { status: 201, payload: orders.get(id) };
    }
    const toCapture = path.match(/^\/v2\/checkout\/orders\/([^/]+)\/capture$/);
    if (toCapture && method === "POST") {
      const order = orders.get(toCapture[1]!);
      if (!order) return { status: 404, payload: { name: "RESOURCE_NOT_FOUND" } };
      if (order.status === "COMPLETED") return { status: 422, payload: { name: "UNPROCESSABLE_ENTITY", details: [{ issue: "ORDER_ALREADY_CAPTURED" }] } };
      if (declineNextCapture) {
        declineNextCapture = false;
        return { status: 422, payload: { name: "UNPROCESSABLE_ENTITY", details: [{ issue: "INSTRUMENT_DECLINED" }] } };
      }
      capture(order, base);
      return { status: 201, payload: structuredClone(order) };
    }
    const order = path.match(/^\/v2\/checkout\/orders\/([^/]+)$/);
    if (order)
      return orders.has(order[1]!)
        ? { status: 200, payload: structuredClone(orders.get(order[1]!)) }
        : { status: 404, payload: { name: "RESOURCE_NOT_FOUND" } };
    const captureRead = path.match(/^\/v2\/payments\/captures\/([^/]+)$/);
    if (captureRead) {
      const found = findCapture(captureRead[1]!);
      return found ? { status: 200, payload: structuredClone(found) } : { status: 404, payload: { name: "RESOURCE_NOT_FOUND" } };
    }
    return { status: 404, payload: { name: "NOT_FOUND" } };
  }

  const fetch = vi.fn(async (input: string | URL, init: RequestInit = {}) => {
    const url = new URL(String(input));
    const method = init.method ?? "GET";
    const body = typeof init.body === "string" && init.body.startsWith("{") ? JSON.parse(init.body) : init.body;
    calls.push({ method, url: url.toString(), body });
    const requestId = method === "POST" ? (init.headers as Record<string, string> | undefined)?.["PayPal-Request-Id"] : undefined;
    const replayed = requestId ? replays.get(requestId) : undefined;
    const result = replayed ?? answer(method, url, body);
    if (requestId && !replayed) replays.set(requestId, result);
    return new Response(JSON.stringify(result.payload), { status: result.status, headers: { "content-type": "application/json" } });
  });

  return {
    fetch,
    calls,
    orders,
    /** The buyer's card is declined on the next capture. */
    declineNextCapture: () => {
      declineNextCapture = true;
    },
    /** Captured at PayPal, the answer never reaching us (a timeout, a closed tab): only the webhook tells. */
    captureBehindOurBack: (orderId: string) => capture(orders.get(orderId)!, SANDBOX),
    /** PAYMENT.CAPTURE.COMPLETED's resource: the capture. */
    completedEvent: (orderId: string, changes: Row = {}) => ({
      id: `WH-${++seq}`,
      event_type: "PAYMENT.CAPTURE.COMPLETED",
      resource_type: "capture",
      resource: { ...structuredClone(captureOf(orderId)), ...changes },
    }),
    /** Refunds part or all of an order's capture, as the seller does from PayPal; PAYMENT.CAPTURE.REFUNDED's event —
     * its resource the refund, which carries no custom_id of its own. */
    refund: (orderId: string, cents: number) => {
      const captured = captureOf(orderId);
      const [whole, fraction] = captured.amount.value.split(".");
      const capturedCents = Number(whole) * 100 + Number(fraction);
      captured.refundedCents = (captured.refundedCents ?? 0) + cents;
      captured.status = captured.refundedCents >= capturedCents ? "REFUNDED" : "PARTIALLY_REFUNDED";
      const value = (c: number) => `${Math.floor(c / 100)}.${String(c % 100).padStart(2, "0")}`;
      const id = `1Y10${++seq}995YT783435V`;
      return {
        id: `WH-${++seq}`,
        event_type: "PAYMENT.CAPTURE.REFUNDED",
        resource_type: "refund",
        resource: {
          id,
          status: "COMPLETED",
          amount: { currency_code: "USD", value: value(cents) },
          seller_payable_breakdown: { total_refunded_amount: { currency_code: "USD", value: value(captured.refundedCents) } },
          links: [
            { href: `${SANDBOX}/v2/payments/refunds/${id}`, rel: "self", method: "GET" },
            { href: `${SANDBOX}/v2/payments/captures/${captured.id}`, rel: "up", method: "GET" },
          ],
        },
      };
    },
  };
}

let paypal: ReturnType<typeof simulatedPayPal>;

function newOrder(paymentId = PAYMENT_ID, extra: Row = {}) {
  return createOrder(new NextRequest("http://localhost/api/paypal/orders", { method: "POST", body: JSON.stringify({ paymentId, ...extra }) }));
}

function capture(orderId: string) {
  return captureOrder(new NextRequest(`http://localhost/api/paypal/orders/${orderId}/capture`, { method: "POST" }), { params: { orderId } });
}

/** A webhook delivery, with PayPal's transmission headers. */
function deliver(event: unknown, signature = PAYPAL_SIGNATURE) {
  return paypalEvent(
    new NextRequest("http://localhost/api/paypal/events", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "paypal-auth-algo": "SHA256withRSA",
        "paypal-cert-url": "https://api.sandbox.paypal.com/v1/notifications/certs/CERT-360caa42-fca2a594-1d93a270",
        "paypal-transmission-id": "69cd13f0-d67a-11e5-baa3-778b53f4ae55",
        "paypal-transmission-sig": signature,
        "paypal-transmission-time": "2026-10-29T18:41:00Z",
      },
      body: JSON.stringify(event),
    }),
  );
}

async function orderId(): Promise<string> {
  const res = await newOrder();
  expect(res.status).toBe(200);
  return (await res.json()).id;
}

const registration = () => store.registrations[0]!;
const payment = () => store.payments[0]!;

beforeEach(() => {
  vi.stubEnv("PAYPAL_ENV", "sandbox");
  vi.stubEnv("PAYPAL_CLIENT_ID", "AZDxjDScFpQtjWTOUtWKbyN_bDt4OgqaF4eYXlewfBP4");
  vi.stubEnv("PAYPAL_CLIENT_SECRET", "EGnHDxD_qRPdaLdZz8iCr8N7_MzF-YHPTkjs6NKYQvQSBngp4PTTVWkPZRbL");
  vi.stubEnv("PAYPAL_WEBHOOK_ID", WEBHOOK_ID);
  vi.stubEnv("NEXT_PUBLIC_PAYPAL_CLIENT_ID", "AZDxjDScFpQtjWTOUtWKbyN_bDt4OgqaF4eYXlewfBP4");
  paypal = simulatedPayPal();
  vi.stubGlobal("fetch", paypal.fetch);
  vi.spyOn(console, "error").mockImplementation(() => {});
  vi.spyOn(console, "warn").mockImplementation(() => {});

  // One buyer from Mexico, registered for US$25 and not paid yet.
  store.registrations = [
    {
      id: "reg_mx1",
      status: "PENDING_PAYMENT",
      confirmedAt: null,
      person: { id: "per_mx1", email: "valeria@example.com" },
      event: {
        id: "evt_1",
        slug: "manicuristas-imparables",
        name: "Manicuristas Imparables 2027",
        publicName: null,
        zoomMeetingId: "86655570212",
        zoomIsWebinar: false,
      },
    },
  ];
  store.payments = [
    {
      id: PAYMENT_ID,
      registrationId: "reg_mx1",
      provider: "PAYPAL",
      status: "PENDING",
      currency: "USD",
      amountInCents: 2500,
      refundedCents: 0,
      providerReference: null,
      rawPayload: null,
    },
  ];
  finalizeConfirmedRegistration.mockReset().mockResolvedValue(undefined);
  cancelRegistrant.mockReset().mockResolvedValue(true);
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("the order", () => {
  it("carries the payment's own amount and NF- reference, never one from the browser — and is made once per payment", async () => {
    const res = await newOrder(PAYMENT_ID, { amount: "0.01" });
    const { id } = await res.json();
    const unit = paypal.orders.get(id)!.purchase_units[0];
    expect(unit.amount).toEqual({ currency_code: "USD", value: "25.00" });
    expect(unit.custom_id).toBe(REFERENCE);
    expect(unit.invoice_id).toBe(REFERENCE);
    expect(payment().providerReference).toBe(id);
    // Asked again (a second tap), the same order.
    expect(await (await newOrder()).json()).toEqual({ id });
    expect(paypal.orders.size).toBe(1);
  });

  it("refuses a payment that isn't a pending PayPal one in dollars", async () => {
    payment().provider = "WOMPI";
    expect((await newOrder()).status).toBe(404);
  });
});

describe("the capture", () => {
  it("confirms the registration once — a second tap on the same order changes nothing", async () => {
    const id = await orderId();
    const res = await capture(id);
    expect(await res.json()).toEqual({ result: "approved", redirect: `/manicuristas-imparables/pago?registrationId=reg_mx1&paypal=${id}` });
    expect(registration().status).toBe("CONFIRMED");
    expect(payment()).toMatchObject({ status: "APPROVED", providerReference: id });
    expect(finalizeConfirmedRegistration).toHaveBeenCalledTimes(1);

    // PayPal refuses a second capture (ORDER_ALREADY_CAPTURED): the order is read instead.
    expect((await (await capture(id)).json()).result).toBe("approved");
    expect(finalizeConfirmedRegistration).toHaveBeenCalledTimes(1);
  });

  it("a declined card: asks for another way to pay, and the next try with the same order captures", async () => {
    const id = await orderId();
    paypal.declineNextCapture();
    expect(await (await capture(id)).json()).toEqual({ result: "declined", retry: true });
    expect(registration().status).toBe("PENDING_PAYMENT");
    // A repeated PayPal-Request-Id would get the refusal back again: the retry is a capture of its own.
    expect((await (await capture(id)).json()).result).toBe("approved");
    expect(registration().status).toBe("CONFIRMED");
  });
});

describe("the webhook", () => {
  it("refuses an event PayPal doesn't verify as its own: 401, nothing confirmed", async () => {
    const id = await orderId();
    paypal.captureBehindOurBack(id);
    const res = await deliver(paypal.completedEvent(id), "forged-signature");
    expect(res.status).toBe(401);
    // Without PayPal's transmission headers it isn't even asked.
    const bare = await paypalEvent(new NextRequest("http://localhost/api/paypal/events", { method: "POST", body: JSON.stringify(paypal.completedEvent(id)) }));
    expect(bare.status).toBe(401);
    expect(registration().status).toBe("PENDING_PAYMENT");
    expect(finalizeConfirmedRegistration).not.toHaveBeenCalled();
  });

  it("confirms a capture whose answer never reached us — the same event delivered again doesn't confirm twice", async () => {
    const id = await orderId();
    paypal.captureBehindOurBack(id);
    const event = paypal.completedEvent(id);
    for (let delivery = 0; delivery < 3; delivery++) {
      const res = await deliver(event);
      expect(res.status).toBe(200);
      expect(await res.json()).toEqual({ ok: true, result: "approved" });
    }
    expect(registration().status).toBe("CONFIRMED");
    expect(finalizeConfirmedRegistration).toHaveBeenCalledTimes(1);
  });

  it("the capture and the webhook of the same order don't confirm twice, whichever comes first", async () => {
    const id = await orderId();
    await capture(id);
    expect(await (await deliver(paypal.completedEvent(id))).json()).toEqual({ ok: true, result: "approved" });
    expect(finalizeConfirmedRegistration).toHaveBeenCalledTimes(1);

    // The other way around, for a second buyer: the webhook first, then the buyer's browser asks for the capture.
    store.registrations.push({ ...structuredClone(registration()), id: "reg_mx2", status: "PENDING_PAYMENT", confirmedAt: null });
    store.payments.push({
      ...structuredClone(payment()),
      id: "cmhc7q2v50004kd81aa1b2c3",
      registrationId: "reg_mx2",
      status: "PENDING",
      providerReference: null,
    });
    const second = (await (await newOrder("cmhc7q2v50004kd81aa1b2c3")).json()).id;
    paypal.captureBehindOurBack(second);
    await deliver(paypal.completedEvent(second));
    expect((await (await capture(second)).json()).result).toBe("approved");
    expect(finalizeConfirmedRegistration).toHaveBeenCalledTimes(2);
  });

  it("acts on what PayPal's API says, not the event's body", async () => {
    const id = await orderId();
    // The event claims COMPLETED; at PayPal the order was never captured.
    const event = {
      event_type: "PAYMENT.CAPTURE.COMPLETED",
      resource: { id: "FAKE", status: "COMPLETED", custom_id: REFERENCE, supplementary_data: { related_ids: { order_id: id } } },
    };
    expect(await (await deliver(event)).json()).toEqual({ ok: true, result: "pending" });
    expect(registration().status).toBe("PENDING_PAYMENT");
  });

  it("answers 200 and does nothing for events that aren't ours", async () => {
    const theirs = { event_type: "PAYMENT.CAPTURE.COMPLETED", resource: { id: "8MC585209K746392H", status: "COMPLETED", custom_id: "MT-77812" } };
    expect(await (await deliver(theirs)).json()).toEqual({ ok: true, ignored: "not_ours" });
    expect(await (await deliver({ event_type: "CHECKOUT.ORDER.APPROVED", resource: {} })).json()).toEqual({ ok: true, ignored: "event" });
    expect(paypal.calls.some((c) => c.url.includes("/v2/"))).toBe(false);
  });
});

describe("refunds", () => {
  it("refunded in full, the registration loses its place and its Zoom registration — once", async () => {
    const id = await orderId();
    await capture(id);
    const event = paypal.refund(id, 2500);
    expect(await (await deliver(event)).json()).toEqual({ ok: true, result: "revoked" });
    expect(registration().status).toBe("CANCELLED");
    expect(payment()).toMatchObject({ status: "REFUNDED", refundedCents: 2500 });
    expect(cancelRegistrant).toHaveBeenCalledWith("86655570212", false, "valeria@example.com");

    // The same refund delivered again, and a late COMPLETED for the same capture: nothing comes back.
    expect(await (await deliver(event)).json()).toEqual({ ok: true, result: "already" });
    expect(await (await deliver(paypal.completedEvent(id))).json()).toEqual({ ok: true, result: "voided" });
    expect(registration().status).toBe("CANCELLED");
    expect(cancelRegistrant).toHaveBeenCalledTimes(1);
  });

  it("refunded in part, it's only recorded: the place stays", async () => {
    const id = await orderId();
    await capture(id);
    expect(await (await deliver(paypal.refund(id, 1000))).json()).toEqual({ ok: true, result: "partial" });
    expect(registration().status).toBe("CONFIRMED");
    expect(payment()).toMatchObject({ status: "APPROVED", refundedCents: 1000 });
    expect(cancelRegistrant).not.toHaveBeenCalled();
    // The rest refunded later: now it's in full.
    expect(await (await deliver(paypal.refund(id, 1500))).json()).toEqual({ ok: true, result: "revoked" });
    expect(payment()).toMatchObject({ status: "REFUNDED", refundedCents: 2500 });
  });
});

describe("sandbox and live", () => {
  it("PAYPAL_ENV picks PayPal's API for everything: sandbox (also when blank) or live", async () => {
    expect(paypalApiBase()).toBe(SANDBOX);
    vi.stubEnv("PAYPAL_ENV", "");
    expect(paypalApiBase()).toBe(SANDBOX);

    const id = await orderId();
    await capture(id);
    await deliver(paypal.completedEvent(id));
    expect(paypal.calls.length).toBeGreaterThan(0);
    expect(paypal.calls.every((c) => c.url.startsWith(`${SANDBOX}/`))).toBe(true);

    vi.stubEnv("PAYPAL_ENV", "live");
    expect(paypalApiBase()).toBe(LIVE);
    paypal.calls.length = 0;
    await deliver(paypal.completedEvent(id), "forged-signature");
    expect(paypal.calls.map((c) => c.url)).toEqual([`${LIVE}/v1/oauth2/token`, `${LIVE}/v1/notifications/verify-webhook-signature`]);
  });

  it("the checkout shows PayPal only with the server's credentials and the same client id for the browser", () => {
    expect(paypalCheckoutConfig()).toEqual({ clientId: "AZDxjDScFpQtjWTOUtWKbyN_bDt4OgqaF4eYXlewfBP4", sandbox: true });
    vi.stubEnv("PAYPAL_ENV", "live");
    expect(paypalCheckoutConfig()?.sandbox).toBe(false);
    // Half switched: the browser's client id from one app, the server's from another.
    vi.stubEnv("NEXT_PUBLIC_PAYPAL_CLIENT_ID", "AUv8rrc_P-EbP2E0mpb49BV7rFt3Usr-vdUZO8VGOnjRehGHBXkSzchr");
    expect(paypalCheckoutConfig()).toBeNull();
    vi.stubEnv("NEXT_PUBLIC_PAYPAL_CLIENT_ID", "AZDxjDScFpQtjWTOUtWKbyN_bDt4OgqaF4eYXlewfBP4");
    vi.stubEnv("PAYPAL_CLIENT_SECRET", "");
    expect(paypalCheckoutConfig()).toBeNull();
  });
});
