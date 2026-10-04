import { formatDateInTz } from "@/lib/dateFormat";

// "Bogotá · mar 2025" instead of "Nail Fest Bogotá - 15 & 16 Marzo 2025" —
// for comparison tables and charts, where full names ran to four lines on a
// phone. Two events in the same city and month get the day too.
export function shortEventNames<T extends { id: string; city: string; startsAt: Date }>(
  events: T[],
  timezone: string,
  language: string
): Map<string, string> {
  const label = (e: T, withDay: boolean) =>
    `${e.city} · ${formatDateInTz(e.startsAt, withDay ? { day: "numeric", month: "short", year: "numeric" } : { month: "short", year: "numeric" }, timezone, language).replace(/ de /g, " ")}`;
  const monthNames = events.map((e) => label(e, false));
  return new Map(events.map((e, i) => [e.id, monthNames.filter((n) => n === monthNames[i]).length > 1 ? label(e, true) : monthNames[i]!]));
}
