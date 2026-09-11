import { formatDateInTz } from "@/lib/dateFormat";

// "El horario es diferente según el evento, la ciudad, etc." — a
// multi-day event's Event.startsAt–endsAt alone can only describe ONE
// continuous span ("sábado 10am – domingo 5pm"), which reads as an
// overnight event when it's really two separate daily sessions with
// their OWN open/close times. This is the real, per-event-configurable
// schedule (Event.scheduleDays — see its own schema comment) that fixes
// that, used consistently everywhere a date/time gets shown: the
// confirmation email (lib/email/templates.ts, lib/confirmationTemplate.ts),
// the ticket PDF (lib/ticketPdf.ts), and the public event page
// ([eventSlug]/page.tsx). An event that hasn't configured this keeps the
// old single-range display exactly as before.

export interface EventScheduleDay {
  opensAt: string; // ISO datetime string (UTC)
  closesAt: string; // ISO datetime string (UTC)
}

/** Safe parse from Prisma's `Json?` column — never throws on malformed
 * data (a hand-edited DB row, a future schema change), just drops
 * anything that doesn't look like a real day entry. */
export function parseScheduleDays(raw: unknown): EventScheduleDay[] {
  if (!Array.isArray(raw)) return [];
  const days: EventScheduleDay[] = [];
  for (const entry of raw) {
    if (!entry || typeof entry !== "object") continue;
    const opensAt = (entry as Record<string, unknown>).opensAt;
    const closesAt = (entry as Record<string, unknown>).closesAt;
    if (typeof opensAt !== "string" || typeof closesAt !== "string") continue;
    if (Number.isNaN(new Date(opensAt).getTime()) || Number.isNaN(new Date(closesAt).getTime())) continue;
    days.push({ opensAt, closesAt });
  }
  return days;
}

/**
 * One line per real day when scheduleDays is set ("Sábado 7 de
 * noviembre, 10:00 a. m. – 7:00 p. m."), sorted chronologically — never
 * an assumption about which day is "first" beyond what's actually
 * stored. Falls back to the original single combined range
 * (startsAt–endsAt) when scheduleDays is empty/unset, so an event that
 * never configured this looks exactly like it did before.
 */
export function formatEventScheduleLines(
  event: { startsAt: Date; endsAt: Date | null; scheduleDays?: unknown },
  timezone: string,
  language: string
): string[] {
  const days = parseScheduleDays(event.scheduleDays);
  if (days.length > 0) {
    const dayOpts = { weekday: "long" as const, day: "numeric" as const, month: "long" as const };
    const timeOpts = { timeStyle: "short" as const };
    return [...days]
      .sort((a, b) => new Date(a.opensAt).getTime() - new Date(b.opensAt).getTime())
      .map((d) => {
        const opens = new Date(d.opensAt);
        const closes = new Date(d.closesAt);
        const dayLabel = formatDateInTz(opens, dayOpts, timezone, language);
        // Intl weekday/month names come back lowercase in es-CO
        // ("sábado 7 de noviembre") — capitalize the first letter to
        // read as a real sentence start, same as every other date label
        // in the app.
        const capitalized = dayLabel.charAt(0).toUpperCase() + dayLabel.slice(1);
        const openTime = formatDateInTz(opens, timeOpts, timezone, language);
        const closeTime = formatDateInTz(closes, timeOpts, timezone, language);
        return `${capitalized}, ${openTime} – ${closeTime}`;
      });
  }

  const dateOpts = { dateStyle: "full" as const, timeStyle: "short" as const };
  const single = [
    formatDateInTz(event.startsAt, dateOpts, timezone, language),
    event.endsAt ? ` – ${formatDateInTz(event.endsAt, dateOpts, timezone, language)}` : "",
  ].join("");
  return [single];
}
