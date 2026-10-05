import { db } from "@/lib/db";
import { utcToZonedInputValue } from "@/lib/dateFormat";
import { dayKey } from "@/lib/eventStatsHelpers";
import { shortEventNames } from "@/lib/eventShortName";
import { forecastAttendance, type ForecastRegistration, type ForecastResult } from "@/lib/attendanceForecast";
import { compareVelocity, hasRealDates, type VelocityEventInput, type VelocityResult } from "@/lib/registrationVelocity";

// Loads what the event report's summary row, "Ritmo de inscripción" and
// "Pronóstico de asistencia" need — once, so the summary cards and the
// detail sections below them show the same numbers instead of computing
// them twice. Methods: lib/attendanceForecast.ts, lib/registrationVelocity.ts.

// An event counts as "done" a day after it ends — so a Sunday-night scan
// session finishes before its numbers become someone else's history.
export const doneAt = (e: { startsAt: Date; endsAt: Date | null }) => (e.endsAt ?? e.startsAt).getTime() + 24 * 60 * 60 * 1000;

function cedulaFrom(customFields: unknown): string | null {
  if (!customFields || typeof customFields !== "object" || Array.isArray(customFields)) return null;
  const raw = (customFields as Record<string, unknown>).cedula;
  const digits = typeof raw === "string" ? raw.replace(/\D/g, "").replace(/^0+/, "") : "";
  // Too short to be a real document number — a typo like "0" or "123"
  // would otherwise link strangers together.
  return digits.length >= 5 ? digits : null;
}

export type ForecastData =
  | { status: "no_history" }
  | { status: "no_registrations" }
  | { status: "ok"; result: ForecastResult; targetIsPast: boolean; actual: number | null };

/** Null for a virtual event — "attending" a Zoom isn't showing up at a venue. */
export async function loadForecastData(eventId: string, timezone: string, language: string): Promise<ForecastData | null> {
  const now = Date.now();
  const [target, eventRows, doorTotals] = await Promise.all([
    db.event.findUnique({ where: { id: eventId }, select: { id: true, format: true, startsAt: true, endsAt: true } }),
    db.event.findMany({ where: { format: { not: "VIRTUAL" } }, select: { id: true, city: true, startsAt: true, endsAt: true } }),
    db.registration.groupBy({ by: ["eventId"], where: { status: "CONFIRMED", checkedInCount: { gt: 0 } }, _sum: { checkedInCount: true } }),
  ]);
  if (!target || target.format === "VIRTUAL") return null;
  const names = shortEventNames(eventRows, timezone, language);
  const events = eventRows.map((e) => ({ ...e, name: names.get(e.id)! }));

  const scannedByEvent = new Map(doorTotals.map((d) => [d.eventId, d._sum.checkedInCount ?? 0]));
  // History = finished in-person events that actually have door data.
  const historyEventIds = events.filter((e) => e.id !== eventId && doneAt(e) < now && (scannedByEvent.get(e.id) ?? 0) > 0).map((e) => e.id);
  const targetIsPast = doneAt(target) < now && (scannedByEvent.get(eventId) ?? 0) > 0;
  if (historyEventIds.length === 0) return { status: "no_history" };

  const rows = await db.registration.findMany({
    where: { status: "CONFIRMED", eventId: { in: [...historyEventIds, eventId] } },
    select: { eventId: true, personId: true, ticketCount: true, checkedInCount: true, attendanceIntent: true, customFields: true },
  });
  const registrations: ForecastRegistration[] = rows.map((r) => ({
    eventId: r.eventId,
    personId: r.personId,
    cedula: cedulaFrom(r.customFields),
    ticketCount: Math.max(1, r.ticketCount),
    checkedInCount: r.checkedInCount,
    intent: r.attendanceIntent,
  }));
  const result = forecastAttendance({ events, registrations, historyEventIds, targetEventId: eventId });
  if (result.forecast.registrations === 0) return { status: "no_registrations" };
  return { status: "ok", result, targetIsPast, actual: targetIsPast ? (scannedByEvent.get(eventId) ?? 0) : null };
}

export interface VelocityPastEvent {
  id: string;
  name: string;
  city: string;
  startsAt: Date;
  // Door data: tickets issued and scanned (null rate when never scanned).
  tickets: number;
  scanned: number;
  attendanceRate: number | null;
}

export interface VelocityData {
  result: VelocityResult;
  // Finished events left out because their sign-up dates aren't real yet
  // (orders export not applied) — named so it's clear what's missing.
  withoutDates: string[];
  targetIsUpcoming: boolean;
  target: { id: string; city: string; startsAt: Date; endsAt: Date | null; goalRegistrations: number | null; goalAttendance: number | null; referenceEventId: string | null };
  // Every finished same-kind event (with or without real dates) — for
  // scenarios, the previous-edition comparison and the reference picker.
  pastEvents: VelocityPastEvent[];
  // First entries at the door of past events scanned with the app, per
  // event day and local hour — lib/eventDecisions.ts's doorPattern input.
  doorRows: { eventId: string; dayIndex: number; hour: number; count: number }[];
}

/** Compares against finished events of the same kind (in-person with
 * in-person, virtual with virtual). */
export async function loadVelocityData(eventId: string, timezone: string, language: string): Promise<VelocityData | null> {
  const now = new Date();
  const target = await db.event.findUnique({
    where: { id: eventId },
    select: { id: true, format: true, city: true, startsAt: true, endsAt: true, goalRegistrations: true, goalAttendance: true, referenceEventId: true },
  });
  if (!target) return null;
  const virtual = target.format === "VIRTUAL";
  const eventRows = await db.event.findMany({
    where: virtual ? { format: "VIRTUAL" } : { format: { not: "VIRTUAL" } },
    select: { id: true, city: true, startsAt: true, endsAt: true },
  });
  const pastRows = eventRows.filter((e) => e.id !== eventId && doneAt(e) < now.getTime());
  const ids = [eventId, ...pastRows.map((e) => e.id)];
  // Confirmed registrations per event per LOCAL day, counted in Postgres —
  // tens of thousands of rows across all events, no need to ship them here.
  // createdAt is a UTC timestamp; AT TIME ZONE twice turns it into local
  // wall-clock time before taking the date.
  const counts = await db.$queryRaw<{ eventId: string; day: string; n: number }[]>`
    SELECT "eventId", to_char(("createdAt" AT TIME ZONE 'UTC') AT TIME ZONE ${timezone}, 'YYYY-MM-DD') AS day, COUNT(*)::int AS n
    FROM "Registration"
    WHERE status = 'CONFIRMED' AND "eventId" = ANY(${ids})
    GROUP BY 1, 2
  `;
  const daily = new Map<string, Map<string, number>>(ids.map((id) => [id, new Map()]));
  for (const c of counts) daily.get(c.eventId)?.set(c.day, c.n);
  const pastIds = pastRows.map((e) => e.id);
  const [door, scanRows] = await Promise.all([
    db.registration.groupBy({ by: ["eventId"], where: { status: "CONFIRMED", eventId: { in: pastIds } }, _sum: { ticketCount: true, checkedInCount: true } }),
    // Only events scanned with our own app have these; imported doorlists
    // carry a Yes/No per ticket and no time at all.
    pastIds.length > 0
      ? db.$queryRaw<{ eventId: string; dayIndex: number; hour: number; count: number }[]>`
          SELECT s."scannedForEventId" AS "eventId",
                 (DATE((s."scannedAt" AT TIME ZONE 'UTC') AT TIME ZONE ${timezone}) - DATE((e."startsAt" AT TIME ZONE 'UTC') AT TIME ZONE ${timezone}))::int AS "dayIndex",
                 EXTRACT(HOUR FROM (s."scannedAt" AT TIME ZONE 'UTC') AT TIME ZONE ${timezone})::int AS hour,
                 COUNT(*)::int AS count
          FROM "ScanLog" s JOIN "Event" e ON e.id = s."scannedForEventId"
          WHERE s.result = 'VALID_FIRST' AND s."scannedForEventId" = ANY(${pastIds})
          GROUP BY 1, 2, 3
        `
      : Promise.resolve([]),
  ]);
  const doorByEvent = new Map(door.map((d) => [d.eventId, { tickets: d._sum.ticketCount ?? 0, scanned: d._sum.checkedInCount ?? 0 }]));

  const names = shortEventNames([target, ...pastRows], timezone, language);
  const toInput = (e: { id: string; startsAt: Date; endsAt: Date | null }): VelocityEventInput => ({
    id: e.id,
    name: names.get(e.id)!,
    startKey: utcToZonedInputValue(e.startsAt, timezone).slice(0, 10),
    endKey: utcToZonedInputValue(e.endsAt ?? e.startsAt, timezone).slice(0, 10),
    daily: daily.get(e.id)!,
  });
  const past = pastRows.sort((a, b) => a.startsAt.getTime() - b.startsAt.getTime()).map(toInput);
  const withoutDates = past.filter((p) => p.daily.size > 0 && !hasRealDates(p)).map((p) => p.name);
  const result = compareVelocity({ target: toInput(target), past, todayKey: dayKey(now, timezone) });
  const pastEvents: VelocityPastEvent[] = pastRows.map((e) => {
    const d = doorByEvent.get(e.id) ?? { tickets: 0, scanned: 0 };
    return { id: e.id, name: names.get(e.id)!, city: e.city, startsAt: e.startsAt, tickets: d.tickets, scanned: d.scanned, attendanceRate: d.scanned > 0 && d.tickets > 0 ? d.scanned / d.tickets : null };
  });
  return {
    result,
    withoutDates,
    targetIsUpcoming: now < target.startsAt,
    target: { id: target.id, city: target.city, startsAt: target.startsAt, endsAt: target.endsAt, goalRegistrations: target.goalRegistrations, goalAttendance: target.goalAttendance, referenceEventId: target.referenceEventId },
    pastEvents,
    doorRows: scanRows.filter((r) => r.dayIndex >= 0 && r.dayIndex < 7),
  };
}
