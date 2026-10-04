import { describe, expect, it } from "vitest";
import { forecastAttendance, learnRates, repeatFlags, type ForecastEvent, type ForecastRegistration } from "./attendanceForecast";

const ev = (id: string, day: number): ForecastEvent => ({ id, name: id, startsAt: new Date(Date.UTC(2026, 0, day)) });
const reg = (eventId: string, personId: string, checkedInCount: number, extra: Partial<ForecastRegistration> = {}): ForecastRegistration => ({
  eventId,
  personId,
  cedula: null,
  ticketCount: 1,
  checkedInCount,
  intent: null,
  ...extra,
});

describe("repeatFlags", () => {
  it("is true only when the same human checked in at an EARLIER event", () => {
    const events = [ev("a", 1), ev("b", 10), ev("c", 20)];
    const a1 = reg("a", "p1", 1);
    const b1 = reg("b", "p1", 0);
    const c1 = reg("c", "p1", 0);
    const a2 = reg("a", "p2", 0); // registered but never came
    const c2 = reg("c", "p2", 0);
    const flags = repeatFlags([a1, b1, c1, a2, c2], events);
    expect(flags.get(a1)).toBe(false);
    expect(flags.get(b1)).toBe(true);
    expect(flags.get(c1)).toBe(true);
    expect(flags.get(c2)).toBe(false);
  });

  it("links the same person across emails by cédula", () => {
    const events = [ev("a", 1), ev("b", 10)];
    const a = reg("a", "email-1", 1, { cedula: "1090123" });
    const b = reg("b", "email-2", 0, { cedula: "1090123" });
    expect(repeatFlags([a, b], events).get(b)).toBe(true);
  });
});

describe("learnRates", () => {
  it("pulls small groups toward their parent instead of trusting a handful of people", () => {
    const training = [
      // 100 first-timers without reply: 40% came.
      ...Array.from({ length: 100 }, (_, i) => ({ reg: reg("a", `n${i}`, i < 40 ? 1 : 0), repeat: false })),
      // Only 2 first-timers said "Sí voy", both came.
      ...Array.from({ length: 2 }, (_, i) => ({ reg: reg("a", `y${i}`, 1, { intent: "CONFIRMED" }), repeat: false })),
    ];
    const rates = learnRates(training);
    const yes = rates.get("new:yes")!;
    expect(yes.historyRegistrations).toBe(2);
    expect(yes.ticketRate).toBeGreaterThan(0.41);
    expect(yes.ticketRate).toBeLessThan(0.6);
    // A group with no history at all takes its parent's rate.
    expect(rates.get("repeat:no")!.historyRegistrations).toBe(0);
  });
});

describe("forecastAttendance", () => {
  it("forecasts from past events and backtests each one against the others", () => {
    const events = [ev("cali", 1), ev("bogota", 10), ev("cucuta", 30)];
    const regs: ForecastRegistration[] = [];
    // Two past events, 50% each.
    for (const id of ["cali", "bogota"]) for (let i = 0; i < 200; i++) regs.push(reg(id, `${id}-${i}`, i % 2));
    // Upcoming: 100 registrations, 2 tickets each, no door data yet.
    for (let i = 0; i < 100; i++) regs.push(reg("cucuta", `cu-${i}`, 0, { ticketCount: 2 }));

    const result = forecastAttendance({ events, registrations: regs, historyEventIds: ["cali", "bogota"], targetEventId: "cucuta" });
    expect(result.forecast.tickets).toBe(200);
    expect(result.forecast.expectedTickets).toBeCloseTo(100, 0);
    expect(result.forecast.expectedPeople).toBeCloseTo(50, 0);
    expect(result.backtest).toHaveLength(2);
    expect(result.margin).not.toBeNull();
    expect(result.margin!).toBeLessThan(0.05);
  });

  it("never learns from the target event itself", () => {
    const events = [ev("a", 1), ev("b", 10)];
    const regs = [reg("a", "x", 0), reg("b", "y", 1)];
    const result = forecastAttendance({ events, registrations: regs, historyEventIds: ["a", "b"], targetEventId: "b" });
    expect(result.historyEvents.map((e) => e.id)).toEqual(["a"]);
    expect(result.margin).toBeNull();
  });
});
