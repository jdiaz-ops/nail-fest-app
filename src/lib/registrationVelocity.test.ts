import { describe, expect, it } from "vitest";
import { buildCurve, compareVelocity, cumulativeAt, daysBetween, hasRealDates, openingKey, rhythmAt, type VelocityEventInput } from "./registrationVelocity";

const addDays = (key: string, n: number) => new Date(Date.parse(`${key}T00:00:00Z`) + n * 864e5).toISOString().slice(0, 10);

// An event with `perDay` registrations every day for `days` days before its start.
function event(id: string, startKey: string, days: number, perDay: number, extra: Record<string, number> = {}): VelocityEventInput {
  const daily = new Map<string, number>();
  for (let d = days; d >= 1; d--) daily.set(addDays(startKey, -d), perDay);
  for (const [k, n] of Object.entries(extra)) daily.set(k, (daily.get(k) ?? 0) + n);
  return { id, name: id, startKey, endKey: addDays(startKey, 1), daily };
}

describe("curves", () => {
  it("lines up by days before the event", () => {
    const c = buildCurve(event("a", "2026-08-01", 10, 3));
    expect(daysBetween("2026-07-22", "2026-08-01")).toBe(10);
    expect(c.total).toBe(30);
    expect(cumulativeAt(c, 10)).toBe(3);
    expect(cumulativeAt(c, 1)).toBe(30);
    expect(cumulativeAt(c, 50)).toBe(0);
    expect(rhythmAt(c, 1)).toBe(3);
  });

  it("ignores a couple of test orders when finding the opening day", () => {
    const e = event("a", "2026-08-01", 40, 20, { "2026-06-01": 1, "2026-06-05": 2 });
    expect(openingKey(e.daily)).toBe(addDays("2026-08-01", -40));
  });

  it("detects an event still stamped with the import day", () => {
    const e = event("a", "2025-03-15", 3, 1, { "2026-10-04": 500 });
    expect(hasRealDates(e)).toBe(false);
    expect(hasRealDates(event("b", "2025-03-15", 30, 10))).toBe(true);
  });
});

describe("compareVelocity", () => {
  it("compares rhythm at the same days-before and projects the final total", () => {
    // Two past events, 60 days of sales: 10/day and 20/day.
    const past = [event("cali", "2025-10-04", 60, 10), event("bog", "2026-02-28", 60, 20)];
    // Target opened 30 days ago at 15/day, event in 30 days.
    const target = event("cuc", "2026-11-07", 60, 15);
    for (let d = 30; d >= 1; d--) target.daily.delete(addDays("2026-11-07", -d));
    const r = compareVelocity({ target, past, todayKey: addDays("2026-11-07", -31) });
    expect(r.daysBefore).toBe(31);
    expect(r.current).toBe(450);
    expect(r.rhythm7).toBe(15);
    expect(r.byDaysBefore.medianRhythm).toBe(15);
    expect(r.byDaysBefore.pace).toBe("on_track");
    // Past events had 30 of 60 days (half their total) at 31 days out → 900.
    expect(r.byDaysBefore.projection!.mid).toBeCloseTo(900, 0);
    expect(r.daysSinceOpening).toBe(30);
    // Day 30 of sales for the past events = 30 days × their daily rate.
    expect(r.comparisons.map((c) => c.atSameDaysSinceOpening)).toEqual([300, 600]);
    expect(r.bySinceOpening.projection!.mid).toBeCloseTo(900, 0);
  });

  it("leaves out past events without real dates", () => {
    const r = compareVelocity({
      target: event("cuc", "2026-11-07", 10, 5),
      past: [event("old", "2025-03-15", 2, 1, { "2026-10-04": 900 })],
      todayKey: "2026-10-30",
    });
    expect(r.comparisons).toHaveLength(0);
    expect(r.byDaysBefore.pace).toBeNull();
  });
});
