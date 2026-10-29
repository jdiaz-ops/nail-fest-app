import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { createHash } from "crypto";
import { NextRequest } from "next/server";

const { confirmRegistrationPayment } = vi.hoisted(() => ({ confirmRegistrationPayment: vi.fn() }));
vi.mock("@/lib/payments/confirmRegistrationPayment", () => ({ confirmRegistrationPayment }));

const { findPayment } = vi.hoisted(() => ({ findPayment: vi.fn() }));
vi.mock("@/lib/db", () => ({ db: { payment: { findUnique: findPayment } } }));

import { POST } from "./route";
import { POST as POST_BEFORE } from "../../webhooks/wompi/route";

const EVENTS_SECRET = "prod_events_EXAMPLE";
const RELAY_SECRET = "relay_secret_EXAMPLE";
const PRIVATE_KEY = "prv_prod_EXAMPLE";
const PUBLIC_KEY = "pub_prod_EXAMPLE";

const sha256 = (value: string) => createHash("sha256").update(value).digest("hex");

// The transaction as Wompi has it: what its API answers, and what its event carries.
const TRANSACTION = {
  id: "1234-1761745200-49201",
  amount_in_cents: 8000000,
  reference: "NF-cmhb2k9x40001ab12cd34ef5",
  customer_email: "maria@example.com",
  currency: "COP",
  payment_method_type: "NEQUI",
  redirect_url: "https://nailfest.lat/manicuristas-imparables/pago?registrationId=reg_1",
  status: "APPROVED",
  shipping_address: null,
  payment_link_id: null,
  payment_source_id: null,
};

/** A transaction.updated event as Wompi sends it (and Marcolini relays it,
 * untouched), its checksum exactly as specified: sha256(transaction.id +
 * transaction.status + transaction.amount_in_cents + timestamp +
 * WOMPI_EVENTS_SECRET). */
function wompiEvent(changes: { transaction?: Partial<typeof TRANSACTION>; checksum?: string } = {}) {
  const transaction = { ...TRANSACTION, ...changes.transaction };
  const timestamp = 1761745260;
  return {
    event: "transaction.updated",
    data: { transaction },
    environment: "prod",
    signature: {
      properties: ["transaction.id", "transaction.status", "transaction.amount_in_cents"],
      checksum: changes.checksum ?? sha256(`${transaction.id}${transaction.status}${transaction.amount_in_cents}${timestamp}${EVENTS_SECRET}`),
    },
    timestamp,
    sent_at: "2026-10-29T13:41:00.000Z",
  };
}

function send(handler: typeof POST, event: unknown, headers: Record<string, string> = {}) {
  return handler(
    new NextRequest("http://localhost/api/wompi/events", {
      method: "POST",
      headers: { "content-type": "application/json", ...headers },
      body: JSON.stringify(event),
    })
  );
}

const fetchMock = vi.fn();
let apiTransaction: typeof TRANSACTION;

beforeEach(() => {
  vi.stubEnv("WOMPI_EVENTS_SECRET", EVENTS_SECRET);
  vi.stubEnv("RELAY_SHARED_SECRET", RELAY_SECRET);
  vi.stubEnv("WOMPI_PRIVATE_KEY", PRIVATE_KEY);
  vi.stubEnv("WOMPI_PUBLIC_KEY", PUBLIC_KEY);
  apiTransaction = { ...TRANSACTION };
  fetchMock.mockReset().mockImplementation(async () => new Response(JSON.stringify({ data: apiTransaction }), { status: 200 }));
  vi.stubGlobal("fetch", fetchMock);
  confirmRegistrationPayment.mockReset().mockResolvedValue("approved");
  findPayment.mockReset().mockResolvedValue(null);
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe("POST /api/wompi/events", () => {
  it("relayed by Marcolini with a valid x-relay-secret: read back from Wompi with the private key, then confirmed", async () => {
    const res = await send(POST, wompiEvent(), { "x-relay-secret": RELAY_SECRET });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true, via: "relay", result: "approved" });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledWith(
      "https://production.wompi.co/v1/transactions/1234-1761745200-49201",
      expect.objectContaining({ headers: { Authorization: `Bearer ${PRIVATE_KEY}` } })
    );
    expect(confirmRegistrationPayment).toHaveBeenCalledWith(apiTransaction);
  });

  it("an invalid x-relay-secret without a valid checksum: 401, nothing read nor confirmed", async () => {
    const res = await send(POST, wompiEvent({ checksum: sha256("forged") }), { "x-relay-secret": "not-the-secret" });
    expect(res.status).toBe(401);
    expect(await res.json()).toEqual({ error: "invalid_signature" });
    expect(fetchMock).not.toHaveBeenCalled();
    expect(confirmRegistrationPayment).not.toHaveBeenCalled();
  });

  it("straight from Wompi with a valid checksum: read back from Wompi, then confirmed", async () => {
    const res = await send(POST, wompiEvent());
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true, via: "wompi", result: "approved" });
    expect(confirmRegistrationPayment).toHaveBeenCalledWith(apiTransaction);
  });

  it("checks a relayed event's checksum too while WOMPI_EVENTS_SECRET is loaded — the header alone counts only without it", async () => {
    const forged = wompiEvent({ checksum: sha256("forged") });
    expect((await send(POST, forged, { "x-relay-secret": RELAY_SECRET })).status).toBe(401);
    vi.stubEnv("WOMPI_EVENTS_SECRET", "");
    expect((await send(POST, forged, { "x-relay-secret": RELAY_SECRET })).status).toBe(200);
    expect(confirmRegistrationPayment).toHaveBeenCalledTimes(1);
  });

  it("goes by what Wompi's API says, not the body", async () => {
    apiTransaction = { ...TRANSACTION, status: "DECLINED" };
    confirmRegistrationPayment.mockResolvedValue("declined");
    const res = await send(POST, wompiEvent()); // the body says APPROVED
    expect(await res.json()).toMatchObject({ result: "declined" });
    expect(confirmRegistrationPayment).toHaveBeenCalledWith(expect.objectContaining({ status: "DECLINED" }));
  });

  it("answers 500 when Wompi's API or the database fails, so Marcolini retries", async () => {
    fetchMock.mockRejectedValueOnce(new Error("network down"));
    const res = await send(POST, wompiEvent(), { "x-relay-secret": RELAY_SECRET });
    expect(res.status).toBe(500);
    expect(confirmRegistrationPayment).not.toHaveBeenCalled();

    confirmRegistrationPayment.mockRejectedValueOnce(new Error("db down"));
    expect((await send(POST, wompiEvent(), { "x-relay-secret": RELAY_SECRET })).status).toBe(500);
  });

  it("leaves an event that isn't ours alone, with a 200", async () => {
    const res = await send(POST, wompiEvent({ transaction: { reference: "MT-77812" } }));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true, ignored: "not_ours" });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("still takes a checkout from before NF- (its Payment's bare id)", async () => {
    findPayment.mockResolvedValue({ id: "cmhold0000legacy" });
    apiTransaction = { ...TRANSACTION, reference: "cmhold0000legacy" };
    const res = await send(POST, wompiEvent({ transaction: { reference: "cmhold0000legacy" } }));
    expect(res.status).toBe(200);
    expect(confirmRegistrationPayment).toHaveBeenCalledWith(apiTransaction);
  });

  it("reads with the public key, and warns, while WOMPI_PRIVATE_KEY isn't loaded", async () => {
    vi.stubEnv("WOMPI_PRIVATE_KEY", "");
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    await send(POST, wompiEvent());
    expect(fetchMock).toHaveBeenCalledWith(expect.any(String), expect.objectContaining({ headers: { Authorization: `Bearer ${PUBLIC_KEY}` } }));
    expect(warn).toHaveBeenCalledWith(expect.stringContaining("WOMPI_PRIVATE_KEY"));
    warn.mockRestore();
  });
});

describe("POST /api/webhooks/wompi (the URL from before)", () => {
  it("answers the same, and relays nothing onward any more", async () => {
    vi.stubEnv("WOMPI_SHOPIFY_RELAY_URL", "https://wompi-event-shopify.example/webhook");
    expect((await send(POST_BEFORE, wompiEvent())).status).toBe(200);
    const theirs = await send(POST_BEFORE, wompiEvent({ transaction: { reference: "SHOP-1001" } }));
    expect(await theirs.json()).toEqual({ ok: true, ignored: "not_ours" });
    // Only the read-back from Wompi's API, for ours: no relay anywhere.
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0][0]).toContain("https://production.wompi.co/v1/transactions/");
  });
});
