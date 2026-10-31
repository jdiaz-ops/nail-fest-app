import { beforeEach, describe, expect, it, vi } from "vitest";

const db = vi.hoisted(() => ({
  registration: { groupBy: vi.fn(), findUnique: vi.fn(), updateMany: vi.fn() },
  payment: { create: vi.fn() },
  ticketType: { findUnique: vi.fn(), create: vi.fn(), update: vi.fn() },
  whatsAppConnection: { findFirst: vi.fn() },
}));
const send = vi.hoisted(() => vi.fn());
vi.mock("@/lib/db", () => ({ db }));
vi.mock("@/lib/email", () => ({ emailProvider: { sendTransactional: send } }));
vi.mock("@/lib/settings", () => ({ getOrgSettings: vi.fn().mockResolvedValue({ replyToEmail: "hola@nailfest.lat" }) }));
vi.mock("@/lib/payments/wompi", () => ({
  wompiReference: (id: string) => `NF-${id}`,
  buildCheckoutUrl: () => "https://checkout.wompi.co/p/?prueba",
  wompiWidgetParams: (p: { reference: string; amountInCents: number; currency: string; redirectUrl: string }) => ({ ...p }),
}));

import { applyUpgrade, ensureTierTypes, soldOutTiers, startUpgrade, tierPaidCounts, upgradeRegistrationId, upgradeToken } from "./tiersServer";

process.env.APP_SECRET_KEY = "solo-para-pruebas";

const registration = (tierSlug: string, payments: { amountInCents: number; currency?: string; refundedCents?: number }[], extra: Record<string, unknown> = {}) => ({
  id: "reg_1",
  eventId: "ev_1",
  status: "CONFIRMED",
  tierSlug,
  ticketCount: 1,
  person: { firstName: "Laura", email: "laura@ejemplo.com" },
  event: { slug: "manicuristas-imparables-2027", name: "Manicuristas Imparables" },
  landingVersion: { slug: "sapate" },
  payments: payments.map((p) => ({ currency: "COP", refundedCents: 0, ...p })),
  ...extra,
});

beforeEach(() => {
  db.registration.groupBy.mockReset().mockResolvedValue([]);
  db.registration.findUnique.mockReset();
  db.registration.updateMany.mockReset();
  db.payment.create.mockReset().mockImplementation(({ data }) => Promise.resolve({ id: "pay_up", ...data }));
  db.whatsAppConnection.findFirst.mockReset().mockResolvedValue(null);
  send.mockReset().mockResolvedValue(undefined);
  db.ticketType.findUnique.mockReset();
  db.ticketType.create.mockReset().mockImplementation(({ data }) => Promise.resolve({ id: `tt_${data.tierSlug}`, ...data }));
  db.ticketType.update.mockReset().mockImplementation(({ where, data }) => Promise.resolve({ id: `tt_${where.eventId_tierSlug.tierSlug}`, ...data }));
});

describe("ensureTierTypes", () => {
  const inStep = (tierSlug: string, price: number, name: string) => ({
    id: `tt_${tierSlug}`,
    tierSlug,
    name,
    price,
    priceUsdCents: null,
    status: "HIDDEN",
    quantity: 100_000,
    minPerOrder: 1,
    maxPerOrder: 1,
  });

  it("makes Círculo and Élite hidden, one per order, at the file's price — never Imparable", async () => {
    db.ticketType.findUnique.mockResolvedValue(null);
    const types = await ensureTierTypes("ev_1");
    expect([...types.keys()].sort()).toEqual(["circulo", "elite"]);
    expect(db.ticketType.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ eventId: "ev_1", tierSlug: "elite", name: "Imparable Élite", price: 390_000, status: "HIDDEN", minPerOrder: 1, maxPerOrder: 1 }),
    });
  });

  it("writes nothing when they're in step with the file", async () => {
    db.ticketType.findUnique.mockImplementation(({ where }) => {
      const slug = where.eventId_tierSlug.tierSlug;
      return Promise.resolve(slug === "circulo" ? inStep("circulo", 190_000, "Imparable Círculo") : inStep("elite", 390_000, "Imparable Élite"));
    });
    await ensureTierTypes("ev_1");
    expect(db.ticketType.create).not.toHaveBeenCalled();
    expect(db.ticketType.update).not.toHaveBeenCalled();
  });

  it("brings the price in step when it changed", async () => {
    db.ticketType.findUnique.mockImplementation(({ where }) => {
      const slug = where.eventId_tierSlug.tierSlug;
      return Promise.resolve(slug === "circulo" ? inStep("circulo", 180_000, "Imparable Círculo") : inStep("elite", 390_000, "Imparable Élite"));
    });
    await ensureTierTypes("ev_1");
    expect(db.ticketType.update).toHaveBeenCalledTimes(1);
    expect(db.ticketType.update).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ price: 190_000 }) }));
  });

  it("two first visits at once: the one that loses finds the other's", async () => {
    db.ticketType.findUnique
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(inStep("circulo", 190_000, "Imparable Círculo"))
      .mockResolvedValue(inStep("elite", 390_000, "Imparable Élite"));
    db.ticketType.create.mockRejectedValueOnce(new Error("Unique constraint failed"));
    const types = await ensureTierTypes("ev_1");
    expect(types.get("circulo")?.id).toBe("tt_circulo");
  });
});

describe("Élite's places", () => {
  it("count only paid purchases: a pending one takes no place", async () => {
    await tierPaidCounts("ev_1");
    expect(db.registration.groupBy).toHaveBeenCalledWith(expect.objectContaining({ where: { eventId: "ev_1", status: "CONFIRMED", tierSlug: { not: null } } }));
  });

  it("at 19 paid it's still on sale; at 20, sold out", async () => {
    db.registration.groupBy.mockResolvedValue([{ tierSlug: "elite", _count: { _all: 19 } }]);
    expect(await soldOutTiers("ev_1")).toEqual([]);
    db.registration.groupBy.mockResolvedValue([{ tierSlug: "elite", _count: { _all: 20 } }]);
    expect(await soldOutTiers("ev_1")).toEqual(["elite"]);
  });
});

describe("her link to move up", () => {
  it("is signed: only hers opens", () => {
    const token = upgradeToken("reg_1");
    expect(upgradeRegistrationId(token)).toBe("reg_1");
    expect(upgradeRegistrationId(token.replace(/.$/, (c) => (c === "a" ? "b" : "a")))).toBeNull();
    expect(upgradeRegistrationId("reg_2.abc")).toBeNull();
  });
});

describe("startUpgrade", () => {
  it("charges exactly the difference to Círculo, as a payment of her same purchase", async () => {
    db.registration.findUnique.mockResolvedValue(registration("imparable", [{ amountInCents: 9_000_000 }]));
    const started = await startUpgrade("reg_1", "circulo");
    expect(started).toMatchObject({ ok: true, amountInCents: 10_000_000 });
    expect(db.payment.create).toHaveBeenCalledWith({
      data: { registrationId: "reg_1", provider: "WOMPI", amountInCents: 10_000_000, currency: "COP", tierSlug: "circulo", upgradeFrom: "imparable" },
    });
  });

  it("from Círculo to Élite: what she paid in all counts", async () => {
    db.registration.findUnique.mockResolvedValue(registration("circulo", [{ amountInCents: 9_000_000 }, { amountInCents: 10_000_000 }]));
    expect(await startUpgrade("reg_1", "elite")).toMatchObject({ ok: true, amountInCents: 20_000_000 });
  });

  it("not to Élite once it's sold out", async () => {
    db.registration.findUnique.mockResolvedValue(registration("imparable", [{ amountInCents: 9_000_000 }]));
    db.registration.groupBy.mockResolvedValue([{ tierSlug: "elite", _count: { _all: 20 } }]);
    expect(await startUpgrade("reg_1", "elite")).toEqual({ ok: false, error: "sold_out" });
    expect(db.payment.create).not.toHaveBeenCalled();
  });

  it("not down, nor sideways", async () => {
    db.registration.findUnique.mockResolvedValue(registration("circulo", [{ amountInCents: 19_000_000 }]));
    expect(await startUpgrade("reg_1", "circulo")).toEqual({ ok: false, error: "not_higher" });
  });

  it("only for a purchase made through a version that sells the levels", async () => {
    db.registration.findUnique.mockResolvedValue(registration("imparable", [{ amountInCents: 9_000_000 }], { landingVersion: null }));
    expect(await startUpgrade("reg_1", "circulo")).toEqual({ ok: false, error: "not_found" });
  });

  it("paid in dollars, or for two tickets, it's done with the team", async () => {
    db.registration.findUnique.mockResolvedValue(registration("imparable", [{ amountInCents: 2_800, currency: "USD" }]));
    expect(await startUpgrade("reg_1", "circulo")).toEqual({ ok: false, error: "usd" });
    db.registration.findUnique.mockResolvedValue(registration("imparable", [{ amountInCents: 18_000_000 }], { ticketCount: 2 }));
    expect(await startUpgrade("reg_1", "circulo")).toEqual({ ok: false, error: "tickets" });
  });

  it("not for an unpaid purchase", async () => {
    db.registration.findUnique.mockResolvedValue(registration("imparable", [], { status: "PENDING_PAYMENT" }));
    expect(await startUpgrade("reg_1", "circulo")).toEqual({ ok: false, error: "not_found" });
  });
});

describe("applyUpgrade", () => {
  it("moves her level up once, from the level it was paid from — no new purchase", async () => {
    db.registration.updateMany.mockResolvedValue({ count: 1 });
    db.registration.findUnique.mockResolvedValue({ person: { firstName: "Laura", email: "laura@ejemplo.com" }, event: { name: "Manicuristas Imparables" } });
    await applyUpgrade({ registrationId: "reg_1", tierSlug: "circulo", upgradeFrom: "imparable" });
    expect(db.registration.updateMany).toHaveBeenCalledWith({ where: { id: "reg_1", tierSlug: "imparable" }, data: { tierSlug: "circulo" } });
  });

  it("the same payment again changes nothing and tells her nothing", async () => {
    db.registration.updateMany.mockResolvedValue({ count: 0 });
    await applyUpgrade({ registrationId: "reg_1", tierSlug: "circulo", upgradeFrom: "imparable" });
    expect(send).not.toHaveBeenCalled();
  });
});
