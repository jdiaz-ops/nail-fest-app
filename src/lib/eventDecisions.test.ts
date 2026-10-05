import { describe, expect, it } from "vitest";
import { buildCurve, type VelocityEventInput } from "./registrationVelocity";
import { doorPattern, goalStatus, logistics, previousEdition, pushTiming, scenarios, weeklyMomentum } from "./eventDecisions";

const addDays = (key: string, n: number) => new Date(Date.parse(`${key}T00:00:00Z`) + n * 864e5).toISOString().slice(0, 10);
function curve(id: string, startKey: string, days: number, perDay: (d: number) => number) {
  const daily = new Map<string, number>();
  for (let d = days; d >= 0; d--) daily.set(addDays(startKey, -d), perDay(d));
  const input: VelocityEventInput = { id, name: id, startKey, endKey: addDays(startKey, 1), daily };
  return buildCurve(input);
}

describe("goalStatus", () => {
  it("says whether the current pace reaches the goal in time", () => {
    const g = goalStatus(8000, 3910, 34, 242);
    expect(g.requiredPerDay).toBeCloseTo(120.3, 0);
    expect(g.light).toBe("green");
    expect(g.etaDays).toBe(17);
    expect(g.etaMarginDays).toBe(17);
    expect(goalStatus(8000, 3910, 34, 110).light).toBe("yellow");
    expect(goalStatus(8000, 3910, 34, 60).light).toBe("red");
    expect(goalStatus(3000, 3910, 34, 60)).toMatchObject({ light: "green", remaining: 0, etaDays: 0 });
  });
});

describe("scenarios", () => {
  it("projects per past event, marks low/base/high and honors the reference pick", () => {
    const past = [
      { id: "a", name: "A", city: "Cali", total: 6000, shareAtSameDaysBefore: 0.5, attendanceRate: 0.25 },
      { id: "b", name: "B", city: "Bogotá", total: 9000, shareAtSameDaysBefore: 0.4, attendanceRate: 0.2 },
      { id: "c", name: "C", city: "Pereira", total: 4000, shareAtSameDaysBefore: 0.6, attendanceRate: null },
      { id: "d", name: "D", city: "X", total: 4000, shareAtSameDaysBefore: 0.01, attendanceRate: null },
    ];
    const s = scenarios(3000, 1.5, past, "a");
    expect(s.map((x) => x.id)).toEqual(["c", "a", "b"]);
    expect(s.map((x) => x.role)).toEqual(["low", "base", "high"]);
    expect(s[1]!.finalRegistrations).toBe(6000);
    expect(s[1]!.atDoor).toBeCloseTo(6000 * 1.5 * 0.25, 0);
    expect(s[0]!.atDoor).toBeNull();
    // No reference → the median one is the base.
    expect(scenarios(3000, 1.5, past, null).map((x) => x.role)).toEqual(["low", "base", "high"]);
  });
});

describe("pushTiming", () => {
  it("measures the final push from past curves", () => {
    // Flat 10/day for 40 days, then 50/day in the last 7 and 200 on event day.
    const c = curve("a", "2026-03-15", 40, (d) => (d === 0 ? 200 : d <= 6 ? 50 : 10));
    const t = pushTiming([c])!;
    // d = 40…7 at 10/day (34 days), d = 6…1 at 50/day, event day 200.
    const total = 34 * 10 + 6 * 50 + 200; // 840
    expect(c.total).toBe(total);
    expect(t.shareLast7).toBeCloseTo((6 * 50 + 200) / total, 3);
    expect(t.shareEventDay).toBeCloseTo(200 / total, 3);
    expect(t.reboundDaysBefore).not.toBeNull();
  });
});

describe("weeklyMomentum", () => {
  it("compares each week since opening with the median of past events, partial current week flagged", () => {
    const target = curve("t", "2026-11-07", 20, (d) => (d >= 10 ? 20 : 0)); // opened 20 days before, 10 days of data
    const past = [curve("p", "2026-02-28", 40, () => 10), curve("q", "2026-05-23", 40, () => 30)];
    const rows = weeklyMomentum(target, 10, past);
    expect(rows.map((r) => [r.week, r.target, r.targetDays, r.othersMedian])).toEqual([
      [1, 140, 7, 140],
      [2, 80, 4, 140],
    ]);
    expect(rows[0]!.diff).toBe(0);
    expect(rows[1]!.diff).toBeNull();
  });
});

describe("doorPattern + logistics", () => {
  it("splits entries per event day and finds the peak window", () => {
    const rows = [
      { eventId: "a", dayIndex: 0, hour: 10, count: 300 },
      { eventId: "a", dayIndex: 0, hour: 11, count: 300 },
      { eventId: "a", dayIndex: 1, hour: 14, count: 400 },
      { eventId: "b", dayIndex: 0, hour: 10, count: 700 },
      { eventId: "b", dayIndex: 1, hour: 15, count: 300 },
    ];
    const p = doorPattern(rows);
    expect(p.events).toBe(2);
    expect(p.dayShares![0]).toBeCloseTo((0.6 + 0.7) / 2, 3);
    expect(p.peakHours[0]!.label).toBe("10:00–12:00");
    const l = logistics({ expectedTickets: 1418, margin: 0.1, expectedPeople: 1084, companionTickets: 330, pattern: p, dayLabels: ["Sábado", "Domingo"] });
    expect(l.bagsToOrder).toBe(1600);
    expect(l.perDay![0]!.label).toBe("Sábado");
  });
  it("works without any scanned past event", () => {
    const l = logistics({ expectedTickets: 1000, margin: null, expectedPeople: 800, companionTickets: 0, pattern: null, dayLabels: [] });
    expect(l.perDay).toBeNull();
    expect(l.bagsToOrder).toBe(1100);
  });
});

describe("previousEdition", () => {
  it("finds the most recent past event in the same city", () => {
    const past = [
      { id: "c1", name: "Cali · oct 2025", city: "Cali", total: 6707, shareAtSameDaysBefore: 0.43, attendanceRate: null, atSameDaysBefore: 2883, startsAt: new Date("2025-10-04") },
      { id: "c2", name: "Cali · sept 2026", city: "cali ", total: 4495, shareAtSameDaysBefore: 0.56, attendanceRate: null, atSameDaysBefore: 2533, startsAt: new Date("2026-09-05") },
    ];
    const p = previousEdition({ city: "Cali", current: 3000 }, past)!;
    expect(p.id).toBe("c2");
    expect(p.diffAtSamePoint).toBeCloseTo(3000 / 2533 - 1, 3);
    expect(previousEdition({ city: "Cúcuta", current: 1 }, past)).toBeNull();
  });
});
