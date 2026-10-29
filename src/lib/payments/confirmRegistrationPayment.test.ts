import { describe, it, expect, vi, beforeEach } from "vitest";

const { db } = vi.hoisted(() => ({
  db: {
    payment: { findUnique: vi.fn(), update: vi.fn() },
    registration: { updateMany: vi.fn(), findUniqueOrThrow: vi.fn() },
  },
}));
vi.mock("@/lib/db", () => ({ db }));

const { finalizeConfirmedRegistration } = vi.hoisted(() => ({ finalizeConfirmedRegistration: vi.fn() }));
vi.mock("@/lib/registrationConfirmation", () => ({ finalizeConfirmedRegistration }));

import { confirmRegistrationPayment } from "./confirmRegistrationPayment";

const PAYMENT = {
  id: "cmhb2k9x40001ab12cd34ef5",
  amountInCents: 8000000,
  registration: { id: "reg_1", confirmedAt: null, person: { id: "p1" }, event: { id: "e1" } },
};
const APPROVED = { id: "1234-1761745200-49201", status: "APPROVED" as const, reference: `NF-${PAYMENT.id}`, amount_in_cents: 8000000, currency: "COP" };

beforeEach(() => {
  db.payment.findUnique.mockReset().mockResolvedValue(PAYMENT);
  db.payment.update.mockReset().mockResolvedValue({});
  db.registration.updateMany.mockReset().mockResolvedValue({ count: 1 });
  db.registration.findUniqueOrThrow.mockReset().mockResolvedValue({ id: "reg_1", status: "CONFIRMED" });
  finalizeConfirmedRegistration.mockReset().mockResolvedValue(undefined);
});

describe("confirmRegistrationPayment", () => {
  it("confirms the Payment an NF- reference names, once — the same event again changes nothing", async () => {
    expect(await confirmRegistrationPayment(APPROVED)).toBe("approved");
    expect(db.payment.findUnique).toHaveBeenCalledWith(expect.objectContaining({ where: { id: PAYMENT.id } }));
    // The first call already moved it to CONFIRMED: the conditional update finds nothing left to change.
    db.registration.updateMany.mockResolvedValue({ count: 0 });
    expect(await confirmRegistrationPayment(APPROVED)).toBe("approved");
    expect(finalizeConfirmedRegistration).toHaveBeenCalledTimes(1);
  });

  it("confirms nothing for a reference that isn't one of ours", async () => {
    db.payment.findUnique.mockResolvedValue(null);
    expect(await confirmRegistrationPayment({ ...APPROVED, reference: "MT-77812" })).toBe("not_found");
    expect(db.payment.findUnique).toHaveBeenCalledWith(expect.objectContaining({ where: { id: "MT-77812" } }));
    expect(db.registration.updateMany).not.toHaveBeenCalled();
  });

  it("confirms nothing when the amount isn't what was charged", async () => {
    expect(await confirmRegistrationPayment({ ...APPROVED, amount_in_cents: 100 })).toBe("error");
    expect(db.registration.updateMany).not.toHaveBeenCalled();
  });

  it("records a declined one without confirming it", async () => {
    expect(await confirmRegistrationPayment({ ...APPROVED, status: "DECLINED" })).toBe("declined");
    expect(db.payment.update).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ status: "DECLINED" }) }));
    expect(db.registration.updateMany).not.toHaveBeenCalled();
  });
});
