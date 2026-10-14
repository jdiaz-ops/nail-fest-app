import { formatDateInTz } from "@/lib/dateFormat";

function dayKey(d: Date, timezone: string): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: timezone, year: "numeric", month: "2-digit", day: "2-digit" }).format(d);
}

/** A chat-style timestamp in the org's own timezone: "2:32 p. m." for
 * today, "ayer 2:32 p. m.", "12 oct, 2:32 p. m." this year, with the
 * year before that. The inbox used to print the server's UTC clock. */
export function chatTimeLabel(date: Date, timezone: string, language: string, now: Date = new Date()): string {
  const time = formatDateInTz(date, { hour: "numeric", minute: "2-digit" }, timezone, language);
  const key = dayKey(date, timezone);
  if (key === dayKey(now, timezone)) return time;
  if (key === dayKey(new Date(now.getTime() - 86_400_000), timezone)) return `ayer ${time}`;
  const sameYear = key.slice(0, 4) === dayKey(now, timezone).slice(0, 4);
  const day = formatDateInTz(date, sameYear ? { day: "numeric", month: "short" } : { day: "numeric", month: "short", year: "numeric" }, timezone, language).replace(/\.$/, "");
  return `${day}, ${time}`;
}
