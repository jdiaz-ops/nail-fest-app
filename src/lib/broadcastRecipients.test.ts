import { beforeEach, describe, expect, it, vi } from "vitest";

const groupBy = vi.fn();
vi.mock("@/lib/db", () => ({ db: { registration: { groupBy: (...args: unknown[]) => groupBy(...args) } } }));

import { checkInOf, eventBroadcastAudienceCounts, eventBroadcastRecipientWhere } from "./broadcastRecipients";
import { eventBroadcastBodySchema } from "./eventBroadcastSchema";

describe("event broadcast audience by check-in", () => {
  beforeEach(() => groupBy.mockReset());

  it("reads a broadcast's two flags as one audience", () => {
    expect(checkInOf({ onlyCheckedIn: false, onlyNotCheckedIn: false })).toBe("all");
    expect(checkInOf({ onlyCheckedIn: true, onlyNotCheckedIn: false })).toBe("checkedIn");
    expect(checkInOf({ onlyCheckedIn: false, onlyNotCheckedIn: true })).toBe("notCheckedIn");
  });

  it("filters confirmed registrations by ticket type and check-in", () => {
    expect(eventBroadcastRecipientWhere("ev1", null, "all")).toEqual({ eventId: "ev1", status: "CONFIRMED" });
    expect(eventBroadcastRecipientWhere("ev1", "tt1", "notCheckedIn")).toEqual({ eventId: "ev1", status: "CONFIRMED", ticketTypeId: "tt1", checkedInCount: 0 });
    expect(eventBroadcastRecipientWhere("ev1", undefined, "checkedIn")).toEqual({ eventId: "ev1", status: "CONFIRMED", checkedInCount: { gt: 0 } });
  });

  it("counts everyone and the ones already scanned, overall and per ticket type", async () => {
    groupBy
      .mockResolvedValueOnce([
        { ticketTypeId: "gratis", _count: { _all: 6037 } },
        { ticketTypeId: "vip", _count: { _all: 12 } },
      ])
      .mockResolvedValueOnce([{ ticketTypeId: "gratis", _count: { _all: 1800 } }]);
    const counts = await eventBroadcastAudienceCounts("ev1");
    expect(counts.all).toEqual({ count: 6049, checkedIn: 1800 });
    expect(counts.byTicketType.get("gratis")).toEqual({ count: 6037, checkedIn: 1800 });
    expect(counts.byTicketType.get("vip")).toEqual({ count: 12, checkedIn: 0 });
    expect(groupBy.mock.calls[1]![0].where).toEqual({ eventId: "ev1", status: "CONFIRMED", checkedInCount: { gt: 0 } });
  });

  it("never takes both «ya hicieron» and «aún no han hecho» check-in", () => {
    const base = { subject: "Hola", bodyHtml: "<p>Hola</p>", scheduleKind: "IMMEDIATE" as const };
    expect(eventBroadcastBodySchema.safeParse({ ...base, onlyNotCheckedIn: true }).success).toBe(true);
    expect(eventBroadcastBodySchema.safeParse({ ...base, onlyCheckedIn: true, onlyNotCheckedIn: true }).success).toBe(false);
    const parsed = eventBroadcastBodySchema.parse(base);
    expect([parsed.onlyCheckedIn, parsed.onlyNotCheckedIn]).toEqual([false, false]);
  });
});
