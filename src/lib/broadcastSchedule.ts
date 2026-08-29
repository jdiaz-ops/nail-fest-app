import type { BroadcastScheduleKind } from "@prisma/client";

// Turns a broadcast's schedule intent into "is it due yet?" — see
// BroadcastScheduleKind's own schema comment on why BEFORE_EVENT_START/
// AFTER_EVENT_END are stored as an offset and recomputed here against the
// event's CURRENT startsAt/endsAt, rather than frozen into an absolute
// instant at creation time (an admin who reschedules the event should not
// have to remember to also reschedule every broadcast tied to it).
export function resolveDueAt(
  broadcast: { scheduleKind: BroadcastScheduleKind; scheduledAt: Date | null; scheduleOffsetMinutes: number | null },
  event: { startsAt: Date; endsAt: Date | null } | null
): Date | null {
  switch (broadcast.scheduleKind) {
    case "IMMEDIATE":
      // No waiting — the caller sends it right away, this function is
      // only consulted by the cron path for the other 3 kinds.
      return null;
    case "AT_DATETIME":
      return broadcast.scheduledAt;
    case "BEFORE_EVENT_START": {
      if (!event || broadcast.scheduleOffsetMinutes == null) return null;
      return new Date(event.startsAt.getTime() - broadcast.scheduleOffsetMinutes * 60_000);
    }
    case "AFTER_EVENT_END": {
      if (!event || broadcast.scheduleOffsetMinutes == null) return null;
      // Falls back to startsAt for an event with no endsAt set — "after it
      // ends" has to mean something even for a same-day event that never
      // got a real end time filled in, rather than silently never firing.
      const base = event.endsAt ?? event.startsAt;
      return new Date(base.getTime() + broadcast.scheduleOffsetMinutes * 60_000);
    }
    default:
      return null;
  }
}

export function isDue(dueAt: Date | null, now: Date = new Date()): boolean {
  return dueAt != null && dueAt.getTime() <= now.getTime();
}
