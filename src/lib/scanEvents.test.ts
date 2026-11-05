import { describe, expect, it } from "vitest";
import { staffSeesEvent } from "./scanEvents";

const twoDays = {
  startsAt: new Date("2026-11-07T15:00:00Z"),
  endsAt: null,
  scheduleDays: [
    { opensAt: "2026-11-07T15:00:00Z", closesAt: "2026-11-07T23:00:00Z" },
    { opensAt: "2026-11-08T15:00:00Z", closesAt: "2026-11-08T23:00:00Z" },
  ],
};

describe("the events the door staff sees", () => {
  it("the ones to come and the ones going on, its second day too, even without an end date", () => {
    expect(staffSeesEvent(twoDays, new Date("2026-11-05T12:00:00Z"))).toBe(true);
    expect(staffSeesEvent(twoDays, new Date("2026-11-08T20:00:00Z"))).toBe(true);
    expect(staffSeesEvent({ startsAt: new Date("2026-11-07T15:00:00Z"), endsAt: null }, new Date("2026-11-08T20:00:00Z"))).toBe(true);
  });

  it("not past ones: two days after its last moment, it's gone", () => {
    expect(staffSeesEvent(twoDays, new Date("2026-11-10T22:00:00Z"))).toBe(true);
    expect(staffSeesEvent(twoDays, new Date("2026-11-11T00:00:00Z"))).toBe(false);
    expect(staffSeesEvent({ startsAt: new Date("2026-06-27T15:00:00Z"), endsAt: new Date("2026-06-28T23:00:00Z") }, new Date("2026-11-05T12:00:00Z"))).toBe(false);
  });
});
