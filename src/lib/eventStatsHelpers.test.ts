import { describe, expect, it } from "vitest";
import { weekdayTotals } from "./eventStatsHelpers";

describe("weekdayTotals", () => {
  it("groups by weekday, Monday first, averaging over how many of each weekday the range has", () => {
    // 2026-08-31 is a Monday; 2026-09-07 is the next Monday.
    const days = [
      { key: "2026-08-31", count: 10 },
      { key: "2026-09-01", count: 2 },
      { key: "2026-09-02", count: 0 },
      { key: "2026-09-03", count: 0 },
      { key: "2026-09-04", count: 0 },
      { key: "2026-09-05", count: 0 },
      { key: "2026-09-06", count: 7 },
      { key: "2026-09-07", count: 4 },
    ];
    const rows = weekdayTotals(days);
    expect(rows.map((r) => r.weekday)).toEqual([0, 1, 2, 3, 4, 5, 6]);
    expect(rows[0]).toEqual({ weekday: 0, total: 14, days: 2, average: 7 });
    expect(rows[6]).toEqual({ weekday: 6, total: 7, days: 1, average: 7 });
  });

  it("leaves out weekdays the range doesn't reach", () => {
    const rows = weekdayTotals([
      { key: "2026-09-05", count: 3 },
      { key: "2026-09-06", count: 1 },
    ]);
    expect(rows.map((r) => r.weekday)).toEqual([5, 6]);
  });
});
