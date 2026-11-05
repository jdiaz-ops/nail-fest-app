import { parseScheduleDays } from "@/lib/eventSchedule";

// Which events the door staff sees in the scanner (the team, 2026-11-05):
// STAFF, only the ones coming up and the ones going on — never past ones;
// ADMIN and COORDINADOR, all of them, the past ones in their own tab. An
// event stays on the staff's list until two days after its last moment (its
// end, its last day's close or its start, whichever is latest), so a missing
// end date never takes it off their phones in the middle of its second day.
export const STAFF_GRACE_MS = 2 * 86_400_000;

/** The latest moment the event says it runs to. */
export function lastMomentOf(event: { startsAt: Date; endsAt: Date | null; scheduleDays?: unknown }): number {
  const closes = parseScheduleDays(event.scheduleDays).map((d) => new Date(d.closesAt).getTime());
  return Math.max(event.startsAt.getTime(), event.endsAt?.getTime() ?? 0, ...closes.filter(Number.isFinite));
}

/** The door staff sees it: still to come, going on, or ended less than two days ago. */
export function staffSeesEvent(event: { startsAt: Date; endsAt: Date | null; scheduleDays?: unknown }, now: Date = new Date()): boolean {
  return now.getTime() <= lastMomentOf(event) + STAFF_GRACE_MS;
}
