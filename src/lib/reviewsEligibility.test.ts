import { beforeEach, describe, expect, it, vi } from "vitest";

const db = vi.hoisted(() => ({ registration: { findUnique: vi.fn() }, scanLog: { findFirst: vi.fn() } }));
vi.mock("@/lib/db", () => ({ db }));
vi.mock("@/lib/ticket", async (original) => ({
  ...(await original<typeof import("@/lib/ticket")>()),
  verifyQrToken: (token: string) => (token === "qr-ok" ? { valid: true, registrationId: "reg1" } : { valid: false, registrationId: null }),
}));

import { reviewEligibilityForToken } from "./reviews";

const registration = (theme: string, endsAt: string, over: Record<string, unknown> = {}) => ({
  id: "reg1",
  status: "CONFIRMED",
  checkedInCount: 0,
  person: { id: "p1", firstName: "Laura" },
  event: { id: "ev1", theme, startsAt: new Date(new Date(endsAt).getTime() - 10 * 3_600_000), endsAt: new Date(endsAt), reviewRaffle: null },
  review: null,
  ...over,
});

beforeEach(() => {
  db.registration.findUnique.mockReset();
  db.scanLog.findFirst.mockReset();
});

describe("who may review", () => {
  it("at Manicuristas Imparables, every confirmed buyer — no door to be scanned at — once the congress is over", async () => {
    db.registration.findUnique.mockResolvedValueOnce(registration("IMPARABLES", "2020-07-04T23:30:00Z"));
    expect(await reviewEligibilityForToken("qr-ok")).toMatchObject({ ok: true, event: { id: "ev1" } });
    expect(db.scanLog.findFirst).not.toHaveBeenCalled();
  });

  it("not before it ends: it says when it opens", async () => {
    db.registration.findUnique.mockResolvedValueOnce(registration("IMPARABLES", "2099-07-04T23:30:00Z"));
    expect(await reviewEligibilityForToken("qr-ok")).toMatchObject({ ok: false, reason: "not_yet", event: { id: "ev1" } });
  });

  it("nor a purchase not confirmed", async () => {
    db.registration.findUnique.mockResolvedValueOnce(registration("IMPARABLES", "2020-07-04T23:30:00Z", { status: "PENDING_PAYMENT" }));
    expect(await reviewEligibilityForToken("qr-ok")).toEqual({ ok: false, reason: "not_confirmed" });
  });

  it("at a Nail Fest at a place, only who was scanned at the door, as before", async () => {
    db.registration.findUnique.mockResolvedValueOnce(registration("NAIL_FEST", "2020-11-08T23:00:00Z"));
    db.scanLog.findFirst.mockResolvedValueOnce(null);
    expect(await reviewEligibilityForToken("qr-ok")).toEqual({ ok: false, reason: "not_attended" });
    db.registration.findUnique.mockResolvedValueOnce(registration("NAIL_FEST", "2020-11-08T23:00:00Z", { checkedInCount: 1 }));
    expect(await reviewEligibilityForToken("qr-ok")).toMatchObject({ ok: true });
  });

  it("nothing for a link we didn't sign", async () => {
    expect(await reviewEligibilityForToken("qr-no")).toEqual({ ok: false, reason: "invalid_token" });
  });
});
