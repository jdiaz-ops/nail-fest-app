import { beforeEach, describe, expect, it, vi } from "vitest";

const db = vi.hoisted(() => ({
  ticketType: { findMany: vi.fn(), findUnique: vi.fn(), updateMany: vi.fn() },
  registration: { groupBy: vi.fn(), aggregate: vi.fn(), findUnique: vi.fn() },
}));
vi.mock("@/lib/db", () => ({ db }));

import { closeStageIfFull, getActiveStage, purchaseNote } from "./pricing";

const EVENT = { id: "ev_1", startsAt: new Date("2027-06-27T08:00:00-05:00") };
const TYPES = [
  { id: "t_cre", name: "Etapa Creyente", stageSlug: "creyente", price: 90_000, priceUsdCents: 2800, stageCap: 200, stageNote: "cierre de Nail Fest Cali", hideAfter: new Date("2027-04-18T23:59:00-05:00"), order: 1 },
  { id: "t_dec", name: "Etapa Decidida", stageSlug: "decidida", price: 120_000, priceUsdCents: 3500, stageCap: 300, stageNote: null, hideAfter: new Date("2027-05-30T23:59:00-05:00"), order: 2 },
  { id: "t_full", name: "Precio full", stageSlug: "full", price: 150_000, priceUsdCents: 4500, stageCap: null, stageNote: null, hideAfter: new Date("2027-06-27T08:00:00-05:00"), order: 3 },
].map((t) => ({ ...t, status: "ON_SALE", hideUntil: null, stageSoldOutAt: null as Date | null }));

beforeEach(() => {
  db.ticketType.findMany.mockReset().mockResolvedValue(TYPES);
  db.registration.groupBy.mockReset().mockResolvedValue([]);
  db.registration.aggregate.mockReset();
  db.ticketType.findUnique.mockReset();
  db.ticketType.updateMany.mockReset().mockResolvedValue({ count: 1 });
  db.registration.findUnique.mockReset();
});

describe("getActiveStage", () => {
  it("counts only confirmed purchases with an approved payment at the stage's price: a pending one takes no place, nor one at a version's special price", async () => {
    db.registration.groupBy.mockResolvedValue([{ ticketTypeId: "t_cre", _sum: { ticketCount: 199 } }]);
    const sales = await getActiveStage(EVENT, new Date("2027-02-01T10:00:00-05:00"));
    expect(db.registration.groupBy).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ eventId: "ev_1", status: "CONFIRMED", payments: { some: { status: "APPROVED", landingVersionId: null } } }),
      })
    );
    expect([sales.current?.slug, sales.remaining]).toEqual(["creyente", 1]);
  });

  it("moves to the next stage once the cap is paid", async () => {
    db.registration.groupBy.mockResolvedValue([{ ticketTypeId: "t_cre", _sum: { ticketCount: 200 } }]);
    expect((await getActiveStage(EVENT, new Date("2027-02-01T10:00:00-05:00"))).current?.slug).toBe("decidida");
  });
});

describe("closeStageIfFull", () => {
  it("closes a stage for good when a confirmed payment fills its cap", async () => {
    db.ticketType.findUnique.mockResolvedValue({ stageCap: 200, stageSoldOutAt: null });
    db.registration.aggregate.mockResolvedValue({ _sum: { ticketCount: 201 } });
    const now = new Date("2027-03-01T12:00:00-05:00");
    await closeStageIfFull("t_cre", now);
    expect(db.ticketType.updateMany).toHaveBeenCalledWith({ where: { id: "t_cre", stageSoldOutAt: null }, data: { stageSoldOutAt: now } });
  });

  it("leaves it open below its cap, and a stage with no cap alone", async () => {
    db.ticketType.findUnique.mockResolvedValue({ stageCap: 200, stageSoldOutAt: null });
    db.registration.aggregate.mockResolvedValue({ _sum: { ticketCount: 150 } });
    await closeStageIfFull("t_cre");
    db.ticketType.findUnique.mockResolvedValue({ stageCap: null, stageSoldOutAt: null });
    await closeStageIfFull("t_full");
    expect(db.ticketType.updateMany).not.toHaveBeenCalled();
  });
});

describe("purchaseNote", () => {
  const registration = (payment: object, ticketCount = 1) => ({
    id: "reg_1",
    ticketTypeId: "t_cre",
    ticketCount,
    event: EVENT,
    payments: [{ stageSlug: "creyente", currency: "COP", amountInCents: 9_000_000, ...payment }],
  });

  it("says the stage and what was paid, and that the price goes up next", async () => {
    db.registration.findUnique.mockResolvedValue(registration({}));
    expect(await purchaseNote("reg_1", new Date("2027-02-01T10:00:00-05:00"))).toEqual({
      bought: "Compraste en la Etapa Creyente a $90.000",
      share: "Luego sube a $120.000: compartir esto con una colega es un buen regalo.",
    });
  });

  it("once the price went up, says what it is today; in dollars, for a purchase in dollars", async () => {
    db.registration.findUnique.mockResolvedValue(registration({ currency: "USD", amountInCents: 2800 }));
    expect(await purchaseNote("reg_1", new Date("2027-04-20T10:00:00-05:00"))).toEqual({
      bought: "Compraste en la Etapa Creyente a US$28",
      share: "Hoy el precio ya es de US$35: compartir esto con una colega es un buen regalo.",
    });
  });

  it("at the full price, only what was paid; nothing for a ticket that isn't a stage's", async () => {
    db.registration.findUnique.mockResolvedValue({ ...registration({ stageSlug: "full", amountInCents: 15_000_000 }), ticketTypeId: "t_full" });
    expect(await purchaseNote("reg_1", new Date("2027-06-01T10:00:00-05:00"))).toEqual({ bought: "Compraste a $150.000, precio full", share: null });
    db.ticketType.findMany.mockResolvedValue([{ ...TYPES[0]!, stageSlug: null }]);
    db.registration.findUnique.mockResolvedValue(registration({ stageSlug: null }));
    expect(await purchaseNote("reg_1")).toBeNull();
  });
});
