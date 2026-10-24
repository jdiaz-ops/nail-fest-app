import { describe, it, expect, vi, beforeEach } from "vitest";

const { findUnique, findUniqueOrThrow, updateMany, update } = vi.hoisted(() => ({
  findUnique: vi.fn(),
  findUniqueOrThrow: vi.fn(),
  updateMany: vi.fn(),
  update: vi.fn(),
}));
vi.mock("@/lib/db", () => ({ db: { registration: { findUnique, findUniqueOrThrow, updateMany, update } } }));

import { WithdrawalError, editionState, eventStillAhead, restoreRegistration, withdrawRegistration, withdrawnByLine } from "./registrationWithdrawal";

const NOW = new Date("2026-10-24T15:00:00Z");
// Nail Fest Cúcuta, 7 & 8 November.
const cucuta = { startsAt: new Date("2026-11-07T15:00:00Z"), endsAt: new Date("2026-11-08T22:00:00Z") };

function registration(overrides: Record<string, unknown> = {}) {
  return { id: "r1", status: "CONFIRMED", checkedInCount: 0, cancelledAt: null, cancelledBy: null, confirmedAt: new Date("2026-10-01T12:00:00Z"), event: { name: "Nail Fest Cúcuta", ...cucuta }, ...overrides };
}

beforeEach(() => {
  findUnique.mockReset();
  findUniqueOrThrow.mockReset();
  updateMany.mockReset();
  update.mockReset();
});

describe("eventStillAhead", () => {
  it("runs until the event's end, so the second day still counts", () => {
    expect(eventStillAhead(cucuta, NOW)).toBe(true);
    expect(eventStillAhead(cucuta, new Date("2026-11-08T12:00:00Z"))).toBe(true);
    expect(eventStillAhead(cucuta, new Date("2026-11-08T23:00:00Z"))).toBe(false);
  });

  it("gives an event without an end the day it starts", () => {
    const oneDay = { startsAt: new Date("2026-11-07T15:00:00Z"), endsAt: null };
    expect(eventStillAhead(oneDay, new Date("2026-11-08T10:00:00Z"))).toBe(true);
    expect(eventStillAhead(oneDay, new Date("2026-11-08T16:00:00Z"))).toBe(false);
  });
});

describe("editionState", () => {
  it("lets a confirmed registration of an event still ahead be taken out", () => {
    expect(editionState(registration() as never, NOW)).toBe("in");
  });

  it("lets one taken out be put back", () => {
    expect(editionState(registration({ status: "CANCELLED", cancelledAt: NOW }) as never, NOW)).toBe("out");
  });

  it("has nothing to do once they came in, once the event is over, or for an unfinished registration", () => {
    expect(editionState(registration({ checkedInCount: 1 }) as never, NOW)).toBeNull();
    expect(editionState(registration() as never, new Date("2026-11-09T12:00:00Z"))).toBeNull();
    expect(editionState(registration({ status: "STARTED" }) as never, NOW)).toBeNull();
    expect(editionState(registration({ status: "PENDING_PAYMENT" }) as never, NOW)).toBeNull();
  });

  it("leaves cancellations from before who-and-when to Entradas emitidas", () => {
    expect(editionState(registration({ status: "CANCELLED", cancelledAt: null }) as never, NOW)).toBeNull();
  });
});

describe("withdrawRegistration", () => {
  it("cancels it with who and when, only if nobody scanned it in meanwhile", async () => {
    findUnique.mockResolvedValue(registration());
    updateMany.mockResolvedValue({ count: 1 });
    findUniqueOrThrow.mockResolvedValue(registration({ status: "CANCELLED", cancelledAt: NOW }));
    const { changed } = await withdrawRegistration("r1", "admin1", NOW);
    expect(changed).toBe(true);
    expect(updateMany).toHaveBeenCalledWith({
      where: { id: "r1", status: "CONFIRMED", checkedInCount: 0 },
      data: { status: "CANCELLED", cancelledAt: NOW, cancelledById: "admin1" },
    });
  });

  it("is a no-op for a second tap", async () => {
    findUnique.mockResolvedValue(registration({ status: "CANCELLED", cancelledAt: NOW }));
    const { changed } = await withdrawRegistration("r1", "admin1", NOW);
    expect(changed).toBe(false);
    expect(updateMany).not.toHaveBeenCalled();
  });

  it("refuses, in words, someone already at the door", async () => {
    findUnique.mockResolvedValue(registration({ checkedInCount: 1 }));
    await expect(withdrawRegistration("r1", "admin1", NOW)).rejects.toThrow("Ya entró al evento");
  });

  it("refuses when a scan lands between reading and writing", async () => {
    findUnique.mockResolvedValue(registration());
    updateMany.mockResolvedValue({ count: 0 });
    await expect(withdrawRegistration("r1", "admin1", NOW)).rejects.toBeInstanceOf(WithdrawalError);
  });

  it("refuses a past event", async () => {
    findUnique.mockResolvedValue(registration());
    await expect(withdrawRegistration("r1", "admin1", new Date("2026-12-01T00:00:00Z"))).rejects.toThrow("ya pasó");
  });
});

describe("restoreRegistration", () => {
  it("confirms it again and clears who and when, keeping the first confirmation date", async () => {
    const first = new Date("2026-10-01T12:00:00Z");
    findUnique.mockResolvedValue(registration({ status: "CANCELLED", cancelledAt: NOW, confirmedAt: first }));
    update.mockResolvedValue(registration());
    const { changed } = await restoreRegistration("r1", NOW);
    expect(changed).toBe(true);
    expect(update).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: "r1" }, data: { status: "CONFIRMED", cancelledAt: null, cancelledById: null, confirmedAt: first } })
    );
  });

  it("is a no-op when it's already back", async () => {
    findUnique.mockResolvedValue(registration());
    const { changed } = await restoreRegistration("r1", NOW);
    expect(changed).toBe(false);
    expect(update).not.toHaveBeenCalled();
  });
});

describe("withdrawnByLine", () => {
  it("says who and when", () => {
    // The month's spelling depends on the ICU build ("24 oct" / "24 de oct").
    expect(withdrawnByLine({ cancelledAt: NOW, cancelledBy: { name: "Juan", username: "juan" } }, "America/Bogota", "es")).toMatch(/^Juan · 24 (de )?oct\.?$/);
    expect(withdrawnByLine({ cancelledAt: NOW, cancelledBy: { name: null, username: "caro" } }, "America/Bogota", "es")).toMatch(/^caro · 24 /);
    expect(withdrawnByLine({ cancelledAt: null, cancelledBy: null }, "America/Bogota", "es")).toBeNull();
  });
});
