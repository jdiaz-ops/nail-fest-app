// Ritmo de inscripción — "¿cómo vamos comparado con los otros eventos?"
// Every event is lined up by DAYS BEFORE THE EVENT (not calendar date —
// each one opened at a different point), so "faltan 34 días" compares
// Cúcuta at 34 days out with Cali at 34 days out, Bogotá at 34 days out…
//
// Inputs are confirmed registrations per local calendar day ("YYYY-MM-DD"
// in the org timezone) — Registration.createdAt, which for an event
// imported from Ticket Tailor is the real order date once the orders export
// has been applied (see /api/admin/import-order-dates). Pure functions.

const DAY = 24 * 60 * 60 * 1000;
const keyToMs = (key: string) => Date.UTC(Number(key.slice(0, 4)), Number(key.slice(5, 7)) - 1, Number(key.slice(8, 10)));
export const daysBetween = (fromKey: string, toKey: string) => Math.round((keyToMs(toKey) - keyToMs(fromKey)) / DAY);

export interface VelocityEventInput {
  id: string;
  name: string;
  startKey: string; // event's first day, local
  endKey: string; // event's last day, local
  daily: Map<string, number>; // local day -> confirmed registrations created that day
}

export interface EventCurve {
  id: string;
  name: string;
  total: number;
  // Index d = cumulative registrations with at least d days to go
  // (d = 0 is the event's first day, everything up to and during it).
  cumulativeAtDaysBefore: number[];
  // Registrations made on each day-before (same indexing, not cumulative).
  perDaysBefore: number[];
  // First "real" day of sales (see openingKey below) as days before the event.
  openingDaysBefore: number;
  launchDayCount: number;
}

/** The day sales really opened: the first day with at least max(5, 0.5% of
 * the total) registrations — so a couple of test orders a week earlier
 * don't count as "opening". */
export function openingKey(daily: Map<string, number>): string | null {
  const total = [...daily.values()].reduce((s, n) => s + n, 0);
  const threshold = Math.max(5, total * 0.005);
  const keys = [...daily.keys()].sort();
  return keys.find((k) => (daily.get(k) ?? 0) >= threshold) ?? keys[0] ?? null;
}

/** Whether an event's dates are real sign-up dates. An imported event whose
 * orders export hasn't been applied has everyone stamped with the import
 * day — after the event ended. More than 20% of registrations dated after
 * the event = not real yet. */
export function hasRealDates(e: VelocityEventInput): boolean {
  let total = 0;
  let after = 0;
  for (const [key, n] of e.daily) {
    total += n;
    if (daysBetween(e.endKey, key) > 1) after += n;
  }
  return total > 0 && after / total <= 0.2;
}

export function buildCurve(e: VelocityEventInput): EventCurve {
  let maxBefore = 0;
  for (const key of e.daily.keys()) maxBefore = Math.max(maxBefore, daysBetween(key, e.startKey));
  const perDaysBefore = new Array<number>(maxBefore + 1).fill(0);
  for (const [key, n] of e.daily) perDaysBefore[Math.max(0, daysBetween(key, e.startKey))]! += n;
  const cumulativeAtDaysBefore = new Array<number>(maxBefore + 1).fill(0);
  let running = 0;
  for (let d = maxBefore; d >= 0; d--) {
    running += perDaysBefore[d]!;
    cumulativeAtDaysBefore[d] = running;
  }
  const open = openingKey(e.daily);
  const openingDaysBefore = open ? Math.max(0, daysBetween(open, e.startKey)) : 0;
  return {
    id: e.id,
    name: e.name,
    total: running,
    cumulativeAtDaysBefore,
    perDaysBefore,
    openingDaysBefore,
    launchDayCount: perDaysBefore[openingDaysBefore] ?? 0,
  };
}

/** Cumulative at d days before; before the curve starts that's 0, past day 0 it's the total. */
export function cumulativeAt(c: EventCurve, d: number): number {
  if (d <= 0) return c.total;
  return d < c.cumulativeAtDaysBefore.length ? c.cumulativeAtDaysBefore[d]! : 0;
}

/** Average registrations per day over the 7 days ending d days before. */
export function rhythmAt(c: EventCurve, d: number): number {
  let sum = 0;
  for (let i = d; i < d + 7; i++) sum += i >= 0 && i < c.perDaysBefore.length ? c.perDaysBefore[i]! : 0;
  return sum / 7;
}

export interface Comparison {
  curve: EventCurve;
  // Same number of days before the event as the target today…
  atSameDaysBefore: number;
  rhythmAtSameDaysBefore: number;
  // …and, the other way to line them up, same number of days since sales opened.
  atSameDaysSinceOpening: number;
  rhythmAtSameDaysSinceOpening: number;
}

export type Pace = "ahead" | "on_track" | "behind";

// How each pace reads on screen — here (plain module) rather than in the
// client panel, so server components can use it too: a value imported from
// a "use client" file is only a reference on the server, not the object.
export const PACE_STYLE: Record<Pace, { icon: string; label: string; color: string }> = {
  ahead: { icon: "▲", label: "Acelerado", color: "#12966b" },
  on_track: { icon: "●", label: "En línea", color: "#1c1310" },
  behind: { icon: "▼", label: "Por debajo", color: "#b25e00" },
};

export interface AlignedSummary {
  medianRhythm: number | null;
  pace: Pace | null;
  paceRatio: number | null; // target rhythm ÷ median rhythm − 1
  projection: { low: number; mid: number; high: number } | null;
}

export interface VelocityResult {
  target: EventCurve;
  daysBefore: number; // days to go for the target (0 if today is event day or later)
  daysSinceOpening: number;
  current: number;
  rhythm7: number;
  comparisons: Comparison[];
  byDaysBefore: AlignedSummary;
  bySinceOpening: AlignedSummary;
}

const median = (xs: number[]) => {
  if (xs.length === 0) return null;
  const s = [...xs].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m]! : (s[m - 1]! + s[m]!) / 2;
};

function summarize(rhythm7: number, current: number, points: { at: number; rhythm: number; total: number }[], upcoming: boolean): AlignedSummary {
  const medianRhythm = median(points.map((p) => p.rhythm));
  const paceRatio = medianRhythm && medianRhythm > 0 ? rhythm7 / medianRhythm - 1 : null;
  const pace: Pace | null = paceRatio == null ? null : paceRatio > 0.1 ? "ahead" : paceRatio < -0.1 ? "behind" : "on_track";
  // "If this event keeps the shape of event X, it ends at current ÷ X's
  // share at this same point." Only events that already had ≥ 5% of their
  // total by then count — dividing by 1% would project nonsense.
  const projections = upcoming ? points.filter((p) => p.total > 0 && p.at / p.total >= 0.05).map((p) => current / (p.at / p.total)) : [];
  const projection = projections.length >= 2 ? { low: Math.min(...projections), mid: median(projections)!, high: Math.max(...projections) } : null;
  return { medianRhythm, pace, paceRatio, projection };
}

export function compareVelocity(params: { target: VelocityEventInput; past: VelocityEventInput[]; todayKey: string }): VelocityResult {
  const target = buildCurve(params.target);
  const daysBefore = Math.max(0, daysBetween(params.todayKey, params.target.startKey));
  const daysSinceOpening = Math.max(1, target.openingDaysBefore - daysBefore + 1);
  const past = params.past.filter(hasRealDates).map(buildCurve).filter((c) => c.total > 0);

  const comparisons: Comparison[] = past.map((c) => {
    // c's own days-before that is `daysSinceOpening` days into its sales.
    const d = c.openingDaysBefore - (daysSinceOpening - 1);
    return {
      curve: c,
      atSameDaysBefore: cumulativeAt(c, daysBefore),
      rhythmAtSameDaysBefore: rhythmAt(c, daysBefore),
      atSameDaysSinceOpening: cumulativeAt(c, d),
      rhythmAtSameDaysSinceOpening: rhythmAt(c, Math.max(0, d)),
    };
  });

  const rhythm7 = rhythmAt(target, daysBefore);
  const upcoming = daysBefore > 0;
  return {
    target,
    daysBefore,
    daysSinceOpening,
    current: target.total,
    rhythm7,
    comparisons,
    byDaysBefore: summarize(rhythm7, target.total, comparisons.map((c) => ({ at: c.atSameDaysBefore, rhythm: c.rhythmAtSameDaysBefore, total: c.curve.total })), upcoming),
    bySinceOpening: summarize(rhythm7, target.total, comparisons.map((c) => ({ at: c.atSameDaysSinceOpening, rhythm: c.rhythmAtSameDaysSinceOpening, total: c.curve.total })), upcoming),
  };
}
