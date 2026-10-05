// The decision layer on top of lib/registrationVelocity.ts — turns "how are
// we doing" into "what do I do": are we going to hit the goal, which past
// event should we expect to resemble, when does the final push start, is
// this week better than the last one, and what does the door forecast mean
// in bags and staff. Pure functions; lib/eventReportData.ts feeds them.

import { cumulativeAt, rhythmAt, type EventCurve } from "@/lib/registrationVelocity";

const fmtDay = (d: Date, timezone: string, language: string) =>
  new Intl.DateTimeFormat(language === "en" ? "en-US" : "es-CO", { day: "numeric", month: "short", timeZone: timezone }).format(d);

// ── 1. Meta + ritmo necesario ───────────────────────────────────────────

export type Light = "green" | "yellow" | "red";
export const PACE_WORDS: Record<Light, string> = { green: "alcanza", yellow: "justo", red: "no alcanza" };

export interface GoalStatus {
  goal: number;
  current: number;
  remaining: number;
  progress: number; // 0..1+
  daysBefore: number;
  requiredPerDay: number | null; // null when already reached or no days left
  currentPerDay: number;
  light: Light;
  // Days from today until the goal is reached at the current pace, null
  // when the pace is 0 or the goal is already reached.
  etaDays: number | null;
  // Positive = reached before the event, negative = would land after it.
  etaMarginDays: number | null;
}

export function goalStatus(goal: number, current: number, daysBefore: number, currentPerDay: number): GoalStatus {
  const remaining = Math.max(0, goal - current);
  const reached = remaining === 0;
  const requiredPerDay = reached || daysBefore <= 0 ? null : remaining / daysBefore;
  const etaDays = reached ? 0 : currentPerDay > 0 ? Math.ceil(remaining / currentPerDay) : null;
  const etaMarginDays = etaDays == null ? null : daysBefore - etaDays;
  let light: Light;
  if (reached) light = "green";
  else if (requiredPerDay == null || currentPerDay <= 0) light = "red";
  else if (currentPerDay >= requiredPerDay) light = "green";
  else if (currentPerDay >= requiredPerDay * 0.85) light = "yellow";
  else light = "red";
  return { goal, current, remaining, progress: goal > 0 ? current / goal : 0, daysBefore, requiredPerDay, currentPerDay, light, etaDays, etaMarginDays };
}

// ── 2. Escenarios con nombre ────────────────────────────────────────────

export interface ScenarioInput {
  id: string;
  name: string;
  city: string;
  total: number;
  // What share of its final total this event had at the target's current
  // days-before (0..1).
  shareAtSameDaysBefore: number;
  // Tickets scanned ÷ tickets issued at the door (0..1); null = no door data.
  attendanceRate: number | null;
}

export interface Scenario {
  id: string;
  name: string;
  city: string;
  finalRegistrations: number;
  finalTickets: number;
  atDoor: number | null;
  role: "low" | "base" | "high" | "other";
  isReference: boolean;
}

/** One scenario per past event ("si Cúcuta se comporta como X"), sorted by
 * final registrations. The reference event (admin's pick) is the base;
 * without one the median scenario is. Events with too small a share at
 * this point (< 5%) are left out — dividing by 1% projects nonsense. */
export function scenarios(current: number, ticketsPerRegistration: number, past: ScenarioInput[], referenceEventId: string | null): Scenario[] {
  const list = past
    .filter((p) => p.total > 0 && p.shareAtSameDaysBefore >= 0.05)
    .map((p) => {
      const finalRegistrations = current / p.shareAtSameDaysBefore;
      const finalTickets = finalRegistrations * ticketsPerRegistration;
      return {
        id: p.id,
        name: p.name,
        city: p.city,
        finalRegistrations,
        finalTickets,
        atDoor: p.attendanceRate != null ? finalTickets * p.attendanceRate : null,
        role: "other" as Scenario["role"],
        isReference: p.id === referenceEventId,
      };
    })
    .sort((a, b) => a.finalRegistrations - b.finalRegistrations);
  if (list.length === 0) return list;
  list[0]!.role = "low";
  list[list.length - 1]!.role = "high";
  const base = list.find((s) => s.isReference) ?? list[Math.floor((list.length - 1) / 2)]!;
  base.role = "base";
  return list;
}

// ── 3. Cuándo empujar ───────────────────────────────────────────────────

export interface PushTiming {
  // Median share of the final total that arrived in the last 14 / 7 days
  // and on the event's own first day (0..1).
  shareLast14: number;
  shareLast7: number;
  shareEventDay: number;
  // Median days-before at which past events' 7-day rhythm bottomed out
  // before climbing into the final push — "aquí arranca el repunte".
  reboundDaysBefore: number | null;
  events: number;
}

const median = (xs: number[]): number | null => {
  if (xs.length === 0) return null;
  const s = [...xs].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m]! : (s[m - 1]! + s[m]!) / 2;
};

export function pushTiming(past: EventCurve[]): PushTiming | null {
  const usable = past.filter((c) => c.total > 0 && c.openingDaysBefore >= 21);
  if (usable.length === 0) return null;
  // Share of the final total that arrived with `from` days to go or fewer.
  const share = (c: EventCurve, from: number) => (c.total - cumulativeAt(c, from + 1)) / c.total;
  const rebounds: number[] = [];
  for (const c of usable) {
    // The trough of the 7-day rhythm between a week after opening and a
    // week before the event: the final push starts after it.
    let bestD: number | null = null;
    let best = Infinity;
    for (let d = c.openingDaysBefore - 7; d >= 7; d--) {
      const r = rhythmAt(c, d);
      if (r < best) {
        best = r;
        bestD = d;
      }
    }
    if (bestD != null) rebounds.push(bestD);
  }
  return {
    shareLast14: median(usable.map((c) => share(c, 13)))!,
    shareLast7: median(usable.map((c) => share(c, 6)))!,
    shareEventDay: median(usable.map((c) => share(c, 0)))!,
    reboundDaysBefore: median(rebounds),
    events: usable.length,
  };
}

// ── 4. Semana contra semana ─────────────────────────────────────────────

export interface WeekRow {
  week: number; // 1 = opening week
  target: number;
  targetDays: number; // 7, or fewer for the current (partial) week
  othersMedian: number | null; // median of past events' same week (full weeks only)
  // target ÷ median − 1, null when no median
  diff: number | null;
}

/** Registrations per week since each event's opening — the target's own
 * weeks next to the median of past events' same week number, so a slow
 * week shows up as a slow week instead of hiding inside the cumulative
 * curve. The current week is partial and says so. */
export function weeklyMomentum(target: EventCurve, daysBefore: number, past: EventCurve[]): WeekRow[] {
  const weekSum = (c: EventCurve, week: number, stopAtDaysBefore: number) => {
    let sum = 0;
    let days = 0;
    for (let i = 0; i < 7; i++) {
      const d = c.openingDaysBefore - (week - 1) * 7 - i;
      if (d < stopAtDaysBefore || d < 0) break;
      sum += c.perDaysBefore[d] ?? 0;
      days++;
    }
    return { sum, days };
  };
  const rows: WeekRow[] = [];
  for (let week = 1; ; week++) {
    const t = weekSum(target, week, daysBefore);
    if (t.days === 0) break;
    const others = past.map((c) => weekSum(c, week, 0)).filter((w) => w.days === 7).map((w) => w.sum);
    const othersMedian = median(others);
    rows.push({ week, target: t.sum, targetDays: t.days, othersMedian, diff: othersMedian && othersMedian > 0 && t.days === 7 ? t.sum / othersMedian - 1 : null });
    if (t.days < 7) break;
  }
  return rows;
}

// ── 5. Logística de puerta ──────────────────────────────────────────────

export interface DoorPattern {
  // Share of first entries on each event day (index 0 = first day), from
  // past events scanned with the app. Null when none has scan logs.
  dayShares: number[] | null;
  // Busiest hour window(s): "10:00–12:00" style labels with their share.
  peakHours: { label: string; share: number }[];
  events: number;
}

/** From ScanLog rows of past events (local day index + hour per first
 * entry): how entries split across event days and when the peak is. */
export function doorPattern(rows: { eventId: string; dayIndex: number; hour: number; count: number }[]): DoorPattern {
  const byEvent = new Map<string, { eventId: string; dayIndex: number; hour: number; count: number }[]>();
  for (const r of rows) byEvent.set(r.eventId, [...(byEvent.get(r.eventId) ?? []), r]);
  if (byEvent.size === 0) return { dayShares: null, peakHours: [], events: 0 };
  const maxDay = Math.max(...rows.map((r) => r.dayIndex));
  const dayShares = Array.from({ length: maxDay + 1 }, (_, day) => {
    const shares: number[] = [];
    for (const list of byEvent.values()) {
      const total = list.reduce((s, r) => s + r.count, 0);
      if (total > 0) shares.push(list.filter((r) => r.dayIndex === day).reduce((s, r) => s + r.count, 0) / total);
    }
    return median(shares) ?? 0;
  });
  // Two-hour windows across all events, share of all first entries.
  const total = rows.reduce((s, r) => s + r.count, 0);
  const windows = new Map<number, number>();
  for (const r of rows) {
    const w = Math.floor(r.hour / 2) * 2;
    windows.set(w, (windows.get(w) ?? 0) + r.count);
  }
  const peakHours = [...windows.entries()]
    .map(([w, n]) => ({ label: `${String(w).padStart(2, "0")}:00–${String(w + 2).padStart(2, "0")}:00`, share: n / total }))
    .sort((a, b) => b.share - a.share)
    .slice(0, 2);
  return { dayShares, peakHours, events: byEvent.size };
}

export interface Logistics {
  expectedTickets: number;
  highTickets: number;
  expectedPeople: number;
  companionTickets: number; // "+1" tickets among today's registrations
  bagsToOrder: number; // high scenario, rounded up to the next 50
  perDay: { label: string; tickets: number }[] | null;
  peakHours: DoorPattern["peakHours"];
  patternEvents: number;
}

export function logistics(params: {
  expectedTickets: number;
  margin: number | null;
  expectedPeople: number;
  companionTickets: number;
  pattern: DoorPattern | null;
  dayLabels: string[]; // e.g. ["Sábado", "Domingo"]
}): Logistics {
  const highTickets = params.expectedTickets * (1 + (params.margin ?? 0.1));
  const perDay =
    params.pattern?.dayShares && params.pattern.dayShares.length > 0
      ? params.pattern.dayShares.map((share, i) => ({ label: params.dayLabels[i] ?? `Día ${i + 1}`, tickets: params.expectedTickets * share }))
      : null;
  return {
    expectedTickets: params.expectedTickets,
    highTickets,
    expectedPeople: params.expectedPeople,
    companionTickets: params.companionTickets,
    bagsToOrder: Math.ceil(highTickets / 50) * 50,
    perDay,
    peakHours: params.pattern?.peakHours ?? [],
    patternEvents: params.pattern?.events ?? 0,
  };
}

// ── 7. Edición anterior en la misma ciudad ──────────────────────────────

export interface PreviousEdition {
  id: string;
  name: string;
  total: number;
  atSameDaysBefore: number;
  // this event's current ÷ previous edition at the same point − 1
  diffAtSamePoint: number | null;
}

export function previousEdition(target: { city: string; current: number }, past: (ScenarioInput & { atSameDaysBefore: number; startsAt: Date })[]): PreviousEdition | null {
  const same = past.filter((p) => p.city.trim().toLowerCase() === target.city.trim().toLowerCase()).sort((a, b) => b.startsAt.getTime() - a.startsAt.getTime());
  const prev = same[0];
  if (!prev) return null;
  return {
    id: prev.id,
    name: prev.name,
    total: prev.total,
    atSameDaysBefore: prev.atSameDaysBefore,
    diffAtSamePoint: prev.atSameDaysBefore > 0 ? target.current / prev.atSameDaysBefore - 1 : null,
  };
}

export function etaLabel(now: Date, etaDays: number, timezone: string, language: string): string {
  return fmtDay(new Date(now.getTime() + etaDays * 86400000), timezone, language);
}
