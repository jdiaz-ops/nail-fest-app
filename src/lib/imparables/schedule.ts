// When Manicuristas Imparables happens, the way its page says it: "Domingo 27
// y lunes 28 de junio de 2027 · 9:00 a. m. a 2:00 p. m. · hora Colombia",
// from the event's own days (Event.scheduleDays, else startsAt–endsAt), and
// the instant of each line of its program, so a visitor in another country
// sees her own hour next to Colombia's. Names and hours are written here,
// not left to the runtime's locale data, so they read the same everywhere.

import { utcToZonedInputValue, zonedTimeToUtc } from "@/lib/dateFormat";
import { parseScheduleDays } from "@/lib/eventSchedule";

const WEEKDAYS = ["domingo", "lunes", "martes", "miércoles", "jueves", "viernes", "sábado"];
const MONTHS = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];

interface LocalTime {
  /** "2027-06-27" */
  date: string;
  year: number;
  month: number; // 0–11
  day: number;
  weekday: number; // 0 = domingo
  hour: number;
  minute: number;
}

function local(date: Date, timezone: string): LocalTime {
  const value = utcToZonedInputValue(date, timezone);
  const [y, m, d] = value.slice(0, 10).split("-").map(Number);
  const [hh, mm] = value.slice(11, 16).split(":").map(Number);
  return {
    date: value.slice(0, 10),
    year: y!,
    month: m! - 1,
    day: d!,
    weekday: new Date(Date.UTC(y!, m! - 1, d!)).getUTCDay(),
    hour: hh! % 24,
    minute: mm!,
  };
}

/** 9, 0 -> "9:00 a. m."; 14, 0 -> "2:00 p. m." */
export function clock(hour: number, minute: number): string {
  return `${hour % 12 === 0 ? 12 : hour % 12}:${String(minute).padStart(2, "0")} ${hour < 12 ? "a. m." : "p. m."}`;
}

const capitalize = (text: string) => text.charAt(0).toUpperCase() + text.slice(1);

/** The name on the cover: the public name without the date it may carry
 * ("Manicuristas Imparables - 27 & 28 Junio 2027" -> "Manicuristas
 * Imparables"), the dates being right under it. */
export function coverName(name: string): string {
  const base = name
    .trim()
    .split(/\s+[-–—|·:]\s+/)[0]!
    .replace(/\s+(19|20)\d{2}$/, "")
    .trim();
  return base || name.trim();
}

export interface EventWhen {
  /** "Domingo 27 y lunes 28 de junio de 2027" */
  dates: string;
  /** "9:00 a. m. a 2:00 p. m." when every day keeps the same hours, else null. */
  hours: string | null;
  /** "27 y 28 de junio" */
  short: string;
  /** "27 & 28 Junio 2027": the cover's, as short as it gets. */
  compact: string;
  /** Each day's date where it happens ("2027-06-27"), in order: the program's days. */
  days: string[];
  /** The first day's opening and closing instants when every day keeps the same hours: the cover shows them in a visitor's own hour. */
  span: { opensAt: string; closesAt: string } | null;
  /** When each of `days` ends, or null: how long the last line of its program lasts. */
  ends: (string | null)[];
}

export function eventWhen(event: { startsAt: Date; endsAt: Date | null; scheduleDays?: unknown }, timezone: string): EventWhen {
  const spans = parseScheduleDays(event.scheduleDays)
    .sort((a, b) => new Date(a.opensAt).getTime() - new Date(b.opensAt).getTime())
    .map((d) => ({
      opens: local(new Date(d.opensAt), timezone),
      closes: local(new Date(d.closesAt), timezone),
      opensAt: new Date(d.opensAt).toISOString(),
      closesAt: new Date(d.closesAt).toISOString(),
    }));
  let days: LocalTime[];
  let hours: string | null = null;
  let span: EventWhen["span"] = null;
  let endOf: (date: string) => string | null;
  if (spans.length > 0) {
    days = spans.map((s) => s.opens);
    const first = spans[0]!;
    const same = spans.every((s) => s.opens.hour === first.opens.hour && s.opens.minute === first.opens.minute && s.closes.hour === first.closes.hour && s.closes.minute === first.closes.minute);
    if (same) {
      hours = `${clock(first.opens.hour, first.opens.minute)} a ${clock(first.closes.hour, first.closes.minute)}`;
      span = { opensAt: first.opensAt, closesAt: first.closesAt };
    }
    endOf = (date) => spans.find((s) => s.opens.date === date)?.closesAt ?? null;
  } else {
    const start = local(event.startsAt, timezone);
    const end = event.endsAt ? local(event.endsAt, timezone) : null;
    days = [start];
    // Every date from the first to the last (a two-day congress written as one span).
    if (end && end.date > start.date) {
      for (let t = Date.UTC(start.year, start.month, start.day) + 86_400_000; t <= Date.UTC(end.year, end.month, end.day); t += 86_400_000) {
        days.push(local(new Date(t + 12 * 3_600_000), "UTC"));
      }
    }
    // Each day closes at the hour the last one does.
    const closing = (date: string) =>
      end ? zonedTimeToUtc(`${date}T${String(end.hour).padStart(2, "0")}:${String(end.minute).padStart(2, "0")}`, timezone).toISOString() : null;
    if (end) {
      hours = `${clock(start.hour, start.minute)} a ${clock(end.hour, end.minute)}`;
      span = { opensAt: event.startsAt.toISOString(), closesAt: closing(start.date)! };
    }
    endOf = closing;
  }

  const unique = days.filter((d, i) => days.findIndex((o) => o.date === d.date) === i);
  const first = unique[0]!;
  const last = unique[unique.length - 1]!;
  const sameMonth = first.month === last.month && first.year === last.year;
  const named = (d: LocalTime) => `${WEEKDAYS[d.weekday]} ${d.day}`;
  const monthYear = `de ${MONTHS[last.month]} de ${last.year}`;
  let dates: string;
  let short: string;
  if (unique.length === 1) {
    dates = `${named(first)} ${monthYear}`;
    short = `${first.day} de ${MONTHS[first.month]}`;
  } else if (unique.length === 2) {
    dates = sameMonth ? `${named(first)} y ${named(last)} ${monthYear}` : `${named(first)} de ${MONTHS[first.month]} y ${named(last)} ${monthYear}`;
    short = sameMonth ? `${first.day} y ${last.day} de ${MONTHS[last.month]}` : `${first.day} de ${MONTHS[first.month]} y ${last.day} de ${MONTHS[last.month]}`;
  } else {
    dates = sameMonth ? `del ${named(first)} al ${named(last)} ${monthYear}` : `del ${named(first)} de ${MONTHS[first.month]} al ${named(last)} ${monthYear}`;
    short = sameMonth ? `del ${first.day} al ${last.day} de ${MONTHS[last.month]}` : `del ${first.day} de ${MONTHS[first.month]} al ${last.day} de ${MONTHS[last.month]}`;
  }
  return { dates: capitalize(dates), hours, short, compact: compactDates(unique), days: unique.map((d) => d.date), span, ends: unique.map((d) => endOf(d.date)) };
}

/** "27 Junio 2027", "27 & 28 Junio 2027", "27 – 29 Junio 2027", "30 Junio & 1 Julio 2027". */
function compactDates(days: LocalTime[]): string {
  const first = days[0]!;
  const last = days[days.length - 1]!;
  const month = (d: LocalTime) => capitalize(MONTHS[d.month]!);
  const join = days.length === 2 ? " & " : " – ";
  if (days.length === 1) return `${first.day} ${month(first)} ${first.year}`;
  if (first.year !== last.year) return `${first.day} ${month(first)} ${first.year}${join}${last.day} ${month(last)} ${last.year}`;
  if (first.month !== last.month) return `${first.day} ${month(first)}${join}${last.day} ${month(last)} ${last.year}`;
  return `${first.day}${join}${last.day} ${month(last)} ${last.year}`;
}

/** "9:15 a. m." -> [9, 15]; "12:05 p. m." -> [12, 5]; "14:30" -> [14, 30]; anything else -> null. */
export function readClock(chip: string): [number, number] | null {
  const match = /^(\d{1,2})[:.](\d{2})\s*(?:([ap])\.?\s*m\.?)?/i.exec(chip.trim());
  if (!match) return null;
  let hour = Number(match[1]);
  const minute = Number(match[2]);
  const half = match[3]?.toLowerCase();
  if (half === "p" && hour < 12) hour += 12;
  if (half === "a" && hour === 12) hour = 0;
  return hour < 24 && minute < 60 ? [hour, minute] : null;
}

/** The instant a line of the program starts: its day's date and its hour, where the event happens. */
export function agendaInstant(day: string | undefined, chip: string, timezone: string): string | null {
  const time = readClock(chip);
  if (!day || !time) return null;
  const instant = zonedTimeToUtc(`${day}T${String(time[0]).padStart(2, "0")}:${String(time[1]).padStart(2, "0")}`, timezone);
  return Number.isNaN(instant.getTime()) ? null : instant.toISOString();
}

/** When a day of the program ends by the hours its own header gives ("9:00 a. m. a 2:00 p. m." -> that day at 2:00 p. m.), or null. */
export function dayEnd(hours: string, day: string | undefined, timezone: string): string | null {
  const clocks = hours.match(/\d{1,2}[:.]\d{2}\s*(?:[ap]\.?\s*m\.?)?/gi) ?? [];
  return clocks.length >= 2 ? agendaInstant(day, clocks[clocks.length - 1]!, timezone) : null;
}
