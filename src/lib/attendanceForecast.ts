// Pronóstico de asistencia — "¿cuánta gente va a llegar a puerta?" for an
// upcoming event, learned from every past in-person event's real door data
// (Registration.checkedInCount — imported from Ticket Tailor's doorlist or
// counted by our own scanner).
//
// Deliberately a segment table, not a black-box model: each registration
// falls in one of six groups (ya asistió a un evento anterior × respuesta al
// "¿vienes?"), each group's rate is what really happened to that group in
// past events, and the forecast is the sum. With a handful of past events
// that's more trustworthy than anything fancier, and every number on screen
// can be traced back to "de dónde sale".
//
// Pure functions, no DB — the report page loads the rows and calls these.

export type Intent = "CONFIRMED" | "DECLINED" | null;

export interface ForecastRegistration {
  eventId: string;
  personId: string;
  // Normalized cédula (digits, no leading zeros) when we have one — links
  // the same human across events even when they used another email.
  cedula: string | null;
  ticketCount: number;
  checkedInCount: number;
  intent: Intent;
}

export interface ForecastEvent {
  id: string;
  name: string;
  startsAt: Date;
}

export type SegmentKey = `${"repeat" | "new"}:${"yes" | "no" | "none"}`;

export const SEGMENT_ORDER: SegmentKey[] = ["repeat:yes", "new:yes", "repeat:none", "new:none", "repeat:no", "new:no"];

export const SEGMENT_LABELS: Record<SegmentKey, string> = {
  "repeat:yes": "Ya asistió antes + dijo «Sí voy»",
  "new:yes": "Primera vez + dijo «Sí voy»",
  "repeat:none": "Ya asistió antes + sin respuesta",
  "new:none": "Primera vez + sin respuesta",
  "repeat:no": "Ya asistió antes + dijo «No puedo»",
  "new:no": "Primera vez + dijo «No puedo»",
};

// How many registrations' worth of "pull" the parent rate has on a small
// group: a group with 8 people and 7 attended doesn't get to claim 88% —
// it's pulled toward its parent (all repeat / all new) until it has enough
// people of its own to speak for itself.
const SHRINK = 30;

function intentKey(intent: Intent): "yes" | "no" | "none" {
  return intent === "CONFIRMED" ? "yes" : intent === "DECLINED" ? "no" : "none";
}

/** For every registration, whether that same human checked in at an EARLIER
 * past event (by startsAt) — "ya asistió antes". Identity = personId, or a
 * shared cédula. Phone is deliberately not used: families share phones. */
export function repeatFlags(regs: ForecastRegistration[], events: ForecastEvent[]): Map<ForecastRegistration, boolean> {
  const startsAt = new Map(events.map((e) => [e.id, e.startsAt.getTime()]));
  // Union-find over personId and cédula so one human = one key.
  const parent = new Map<string, string>();
  const find = (x: string): string => {
    let root = x;
    while (parent.get(root) && parent.get(root) !== root) root = parent.get(root)!;
    parent.set(x, root);
    return root;
  };
  const union = (a: string, b: string) => {
    const ra = find(a);
    const rb = find(b);
    if (ra !== rb) parent.set(ra, rb);
  };
  for (const r of regs) {
    const p = `p:${r.personId}`;
    if (!parent.has(p)) parent.set(p, p);
    if (r.cedula) {
      const c = `c:${r.cedula}`;
      if (!parent.has(c)) parent.set(c, c);
      union(p, c);
    }
  }
  // Earliest event start each human was actually at the door.
  const firstAttended = new Map<string, number>();
  for (const r of regs) {
    if (r.checkedInCount <= 0) continue;
    const t = startsAt.get(r.eventId);
    if (t == null) continue;
    const key = find(`p:${r.personId}`);
    const prev = firstAttended.get(key);
    if (prev == null || t < prev) firstAttended.set(key, t);
  }
  const out = new Map<ForecastRegistration, boolean>();
  for (const r of regs) {
    const t = startsAt.get(r.eventId);
    const first = firstAttended.get(find(`p:${r.personId}`));
    out.set(r, t != null && first != null && first < t);
  }
  return out;
}

export interface SegmentRate {
  key: SegmentKey;
  // Ticket-level: of the tickets this group held, how many were scanned.
  ticketRate: number;
  // Person-level: of the registrations, how many had at least one scan.
  personRate: number;
  // How many past registrations this rate is actually based on — 0 means
  // "no history for this group": the rate is its parent's (see SHRINK).
  historyRegistrations: number;
}

interface Tally {
  tickets: number;
  scanned: number;
  regs: number;
  attended: number;
}
const emptyTally = (): Tally => ({ tickets: 0, scanned: 0, regs: 0, attended: 0 });
function add(t: Tally, r: ForecastRegistration) {
  t.tickets += r.ticketCount;
  t.scanned += Math.min(r.checkedInCount, r.ticketCount);
  t.regs += 1;
  t.attended += r.checkedInCount > 0 ? 1 : 0;
}

/** Learns the six group rates from past registrations (each already flagged
 * repeat / not). Hierarchical: group → its repeat/new parent → global. */
export function learnRates(training: { reg: ForecastRegistration; repeat: boolean }[]): Map<SegmentKey, SegmentRate> {
  const global = emptyTally();
  const byRepeat = { repeat: emptyTally(), new: emptyTally() };
  const bySegment = new Map<SegmentKey, Tally>(SEGMENT_ORDER.map((k) => [k, emptyTally()]));
  for (const { reg, repeat } of training) {
    const r = repeat ? "repeat" : "new";
    add(global, reg);
    add(byRepeat[r], reg);
    add(bySegment.get(`${r}:${intentKey(reg.intent)}`)!, reg);
  }
  const globalTicket = global.tickets > 0 ? global.scanned / global.tickets : 0;
  const globalPerson = global.regs > 0 ? global.attended / global.regs : 0;
  const shrink = (hits: number, n: number, prior: number) => (hits + SHRINK * prior) / (n + SHRINK);
  const parentTicket = {
    repeat: shrink(byRepeat.repeat.scanned, byRepeat.repeat.tickets, globalTicket),
    new: shrink(byRepeat.new.scanned, byRepeat.new.tickets, globalTicket),
  };
  const parentPerson = {
    repeat: shrink(byRepeat.repeat.attended, byRepeat.repeat.regs, globalPerson),
    new: shrink(byRepeat.new.attended, byRepeat.new.regs, globalPerson),
  };
  const out = new Map<SegmentKey, SegmentRate>();
  for (const key of SEGMENT_ORDER) {
    const t = bySegment.get(key)!;
    const r = key.startsWith("repeat") ? "repeat" : "new";
    out.set(key, {
      key,
      ticketRate: shrink(t.scanned, t.tickets, parentTicket[r]),
      personRate: shrink(t.attended, t.regs, parentPerson[r]),
      historyRegistrations: t.regs,
    });
  }
  return out;
}

export interface ForecastRow {
  key: SegmentKey;
  registrations: number;
  tickets: number;
  rate: SegmentRate;
  expectedTickets: number;
  expectedPeople: number;
}

export interface Forecast {
  rows: ForecastRow[];
  registrations: number;
  tickets: number;
  expectedTickets: number;
  expectedPeople: number;
}

export function applyRates(target: { reg: ForecastRegistration; repeat: boolean }[], rates: Map<SegmentKey, SegmentRate>): Forecast {
  const rows = new Map<SegmentKey, ForecastRow>(
    SEGMENT_ORDER.map((key) => [key, { key, registrations: 0, tickets: 0, rate: rates.get(key)!, expectedTickets: 0, expectedPeople: 0 }])
  );
  for (const { reg, repeat } of target) {
    const row = rows.get(`${repeat ? "repeat" : "new"}:${intentKey(reg.intent)}`)!;
    row.registrations += 1;
    row.tickets += reg.ticketCount;
    row.expectedTickets += reg.ticketCount * row.rate.ticketRate;
    row.expectedPeople += row.rate.personRate;
  }
  const list = [...rows.values()];
  return {
    rows: list,
    registrations: list.reduce((s, r) => s + r.registrations, 0),
    tickets: list.reduce((s, r) => s + r.tickets, 0),
    expectedTickets: list.reduce((s, r) => s + r.expectedTickets, 0),
    expectedPeople: list.reduce((s, r) => s + r.expectedPeople, 0),
  };
}

export interface BacktestRow {
  eventId: string;
  name: string;
  tickets: number;
  predictedTickets: number;
  actualTickets: number;
  // (predicted − actual) ÷ actual
  error: number;
}

export interface ForecastResult {
  forecast: Forecast;
  // Past events with real door data the rates were learned from.
  historyEvents: ForecastEvent[];
  backtest: BacktestRow[];
  // Mean absolute backtest error — the "± margen" shown next to the
  // forecast. Null with fewer than 2 past events (nothing to test against).
  margin: number | null;
}

/** The whole thing: learn from `historyEventIds` (past events with door
 * data, never including the target), forecast `targetEventId`, and
 * backtest — each past event predicted from all the OTHER past events, the
 * way it would have been predicted before it happened. */
export function forecastAttendance(params: {
  events: ForecastEvent[];
  registrations: ForecastRegistration[];
  historyEventIds: string[];
  targetEventId: string;
}): ForecastResult {
  const { events, registrations, targetEventId } = params;
  const historyIds = new Set(params.historyEventIds.filter((id) => id !== targetEventId));
  const flags = repeatFlags(registrations, events);
  const withFlag = (r: ForecastRegistration) => ({ reg: r, repeat: flags.get(r) ?? false });

  const history = registrations.filter((r) => historyIds.has(r.eventId)).map(withFlag);
  const target = registrations.filter((r) => r.eventId === targetEventId).map(withFlag);
  const forecast = applyRates(target, learnRates(history));

  const backtest: BacktestRow[] = [];
  if (historyIds.size >= 2) {
    for (const id of historyIds) {
      const others = history.filter((h) => h.reg.eventId !== id);
      const own = history.filter((h) => h.reg.eventId === id);
      const predicted = applyRates(own, learnRates(others));
      const actual = own.reduce((s, h) => s + Math.min(h.reg.checkedInCount, h.reg.ticketCount), 0);
      if (actual === 0) continue;
      backtest.push({
        eventId: id,
        name: events.find((e) => e.id === id)?.name ?? id,
        tickets: predicted.tickets,
        predictedTickets: predicted.expectedTickets,
        actualTickets: actual,
        error: (predicted.expectedTickets - actual) / actual,
      });
    }
  }
  const margin = backtest.length >= 2 ? backtest.reduce((s, b) => s + Math.abs(b.error), 0) / backtest.length : null;

  return {
    forecast,
    historyEvents: events.filter((e) => historyIds.has(e.id)).sort((a, b) => a.startsAt.getTime() - b.startsAt.getTime()),
    backtest: backtest.sort(
      (a, b) => (events.find((e) => e.id === a.eventId)?.startsAt.getTime() ?? 0) - (events.find((e) => e.id === b.eventId)?.startsAt.getTime() ?? 0)
    ),
    margin,
  };
}
