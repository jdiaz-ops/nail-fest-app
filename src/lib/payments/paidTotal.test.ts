import { describe, expect, it } from "vitest";
import { formatPaid, formatUsd, paidTotal, type PaidPayment } from "./paidTotal";

const cop = (pesos: number, over: Partial<PaidPayment> = {}): PaidPayment => ({ status: "APPROVED", amountInCents: pesos * 100, refundedCents: 0, currency: "COP", ...over });
const usd = (cents: number, over: Partial<PaidPayment> = {}): PaidPayment => ({ status: "APPROVED", amountInCents: cents, refundedCents: 0, currency: "USD", ...over });

describe("what was paid", () => {
  it("adds up the approved payments, in pesos", () => {
    expect(formatPaid(paidTotal([cop(90000), cop(2000)]))).toBe("$92.000");
  });

  it("without what went back in a partial refund", () => {
    expect(paidTotal([cop(90000, { refundedCents: 10000_00 })])).toEqual({ pesos: 80000, usdCents: 0 });
  });

  it("counts nothing refunded in full, pending, declined or failed", () => {
    const none = paidTotal([cop(90000, { status: "REFUNDED", refundedCents: 90000_00 }), cop(90000, { status: "PENDING" }), cop(90000, { status: "DECLINED" }), cop(90000, { status: "ERROR" })]);
    expect(formatPaid(none)).toBeNull();
  });

  it("keeps dollars apart, with cents only when there are", () => {
    expect(formatPaid(paidTotal([cop(90000), usd(2500)]))).toBe("$90.000 + US$25");
    expect(formatUsd(2550)).toBe("US$25,50");
    expect(formatPaid(paidTotal([usd(100)]))).toBe("US$1");
  });
});
