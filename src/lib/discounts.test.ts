import { describe, it, expect, vi, beforeEach } from "vitest";
import type { DiscountCode } from "@prisma/client";

const { findCode, countPayments } = vi.hoisted(() => ({ findCode: vi.fn(), countPayments: vi.fn() }));
vi.mock("@/lib/db", () => ({ db: { discountCode: { findUnique: findCode }, payment: { count: countPayments } } }));

import { discountCentsFor, discountLabel, normalizeCode, resolveDiscount } from "./discounts";

const CODE: DiscountCode = {
  id: "dc1",
  eventId: "e1",
  code: "IMPARABLE10",
  percentOff: 10,
  amountOffCop: null,
  ticketTypeId: null,
  maxUses: null,
  expiresAt: null,
  active: true,
  note: null,
  createdAt: new Date("2026-10-29T00:00:00Z"),
};
const SUBTOTAL = 80000_00; // Etapa Creyente, one ticket

beforeEach(() => {
  findCode.mockReset().mockResolvedValue(CODE);
  countPayments.mockReset().mockResolvedValue(0);
});

describe("discount codes", () => {
  it("takes a percentage off, or a fixed amount, never more than the subtotal", () => {
    expect(discountCentsFor({ percentOff: 10, amountOffCop: null }, SUBTOTAL)).toBe(8000_00);
    expect(discountCentsFor({ percentOff: null, amountOffCop: 20000 }, SUBTOTAL)).toBe(20000_00);
    expect(discountCentsFor({ percentOff: null, amountOffCop: 500000 }, SUBTOTAL)).toBe(SUBTOTAL);
    expect(discountLabel({ percentOff: 10, amountOffCop: null })).toBe("−10%");
    expect(discountLabel({ percentOff: null, amountOffCop: 20000 })).toBe("−$20.000");
  });

  it("is typed in any case and with stray spaces", async () => {
    expect(normalizeCode(" imparable 10 ")).toBe("IMPARABLE10");
    const result = await resolveDiscount({ eventId: "e1", ticketTypeId: "t1", code: "imparable10", subtotalCents: SUBTOTAL });
    expect(findCode).toHaveBeenCalledWith({ where: { eventId_code: { eventId: "e1", code: "IMPARABLE10" } } });
    expect(result).toMatchObject({ ok: true, discountCents: 8000_00, totalCents: 72000_00, label: "−10%" });
  });

  it("doesn't apply when it's off, expired, for another ticket, used up, or would take the total under Wompi's minimum", async () => {
    const now = new Date("2026-11-01T00:00:00Z");
    const check = (changes: Partial<DiscountCode>, subtotalCents = SUBTOTAL) => {
      findCode.mockResolvedValueOnce({ ...CODE, ...changes });
      return resolveDiscount({ eventId: "e1", ticketTypeId: "t1", code: "IMPARABLE10", subtotalCents, now });
    };
    expect(await check({ active: false })).toEqual({ ok: false, error: "not_found" });
    expect(await check({ expiresAt: new Date("2026-10-31T23:59:59Z") })).toEqual({ ok: false, error: "expired" });
    expect(await check({ ticketTypeId: "t2" })).toEqual({ ok: false, error: "not_for_ticket" });
    countPayments.mockResolvedValueOnce(5);
    expect(await check({ maxUses: 5 })).toEqual({ ok: false, error: "used_up" });
    expect(await check({ percentOff: 99 })).toEqual({ ok: false, error: "too_big" });
    findCode.mockResolvedValueOnce(null);
    expect(await resolveDiscount({ eventId: "e1", ticketTypeId: "t1", code: "NOEXISTE", subtotalCents: SUBTOTAL })).toEqual({ ok: false, error: "not_found" });
  });

  it("takes a percentage off a payment in dollars too, but a fixed amount only off one in pesos", async () => {
    expect(await resolveDiscount({ eventId: "e1", ticketTypeId: "t1", code: "IMPARABLE10", subtotalCents: 25_00, currency: "USD" })).toMatchObject({
      ok: true,
      discountCents: 2_50,
      totalCents: 22_50,
    });
    findCode.mockResolvedValueOnce({ ...CODE, percentOff: null, amountOffCop: 20000 });
    expect(await resolveDiscount({ eventId: "e1", ticketTypeId: "t1", code: "MENOS20MIL", subtotalCents: 25_00, currency: "USD" })).toEqual({ ok: false, error: "not_for_currency" });
  });

  it("counts as used only the payments already approved with it", async () => {
    countPayments.mockResolvedValueOnce(4);
    findCode.mockResolvedValueOnce({ ...CODE, maxUses: 5 });
    expect((await resolveDiscount({ eventId: "e1", ticketTypeId: "t1", code: "IMPARABLE10", subtotalCents: SUBTOTAL })).ok).toBe(true);
    expect(countPayments).toHaveBeenCalledWith({ where: { discountCodeId: "dc1", status: "APPROVED" } });
  });
});
