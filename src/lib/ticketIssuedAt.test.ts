import { describe, expect, it } from "vitest";
import { ticketIssuedAt } from "./ticketIssuedAt";

const SEPT_12 = new Date("2026-09-12T17:12:00Z");
const NOV_2 = new Date("2026-11-02T15:56:00Z");
const NOV_2_LATER = new Date("2026-11-02T16:01:00Z");
const NOV_4 = new Date("2026-11-04T14:00:00Z");

describe("the day a ticket was issued", () => {
  it("is the day it was paid, not the day its registration was first created", () => {
    expect(ticketIssuedAt({ createdAt: SEPT_12, confirmedAt: NOV_2_LATER }, NOV_2)).toEqual(NOV_2_LATER);
  });

  it("bought again after a cancellation, is its new payment's, not the first confirmation's", () => {
    expect(ticketIssuedAt({ createdAt: SEPT_12, confirmedAt: SEPT_12 }, NOV_2)).toEqual(NOV_2);
  });

  it("paid in cash days after it started, is the day it was confirmed", () => {
    expect(ticketIssuedAt({ createdAt: NOV_2, confirmedAt: NOV_4 }, NOV_2)).toEqual(NOV_4);
  });

  it("free, or imported, is its confirmation's; never confirmed, when it was created", () => {
    expect(ticketIssuedAt({ createdAt: SEPT_12, confirmedAt: NOV_2 })).toEqual(NOV_2);
    expect(ticketIssuedAt({ createdAt: SEPT_12, confirmedAt: null }, null)).toEqual(SEPT_12);
  });
});
