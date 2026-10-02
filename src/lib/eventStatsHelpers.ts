import { utcToZonedInputValue } from "@/lib/dateFormat";

// Shared bucketing/grouping helpers for the two stats panels that split
// event numbers by what they're for:
//  - src/app/admin/scan/EventStatsPanel.tsx — operational, door-side
//    numbers an admin checks live, the day of the event (check-in
//    progress, hourly traffic, re-entries).
//  - src/app/admin/events/EventDecisionStats.tsx — planning numbers for
//    before/after the event (sales funnel, growth curve, attribution,
//    audience).
// Plain JS, no charting library or raw-SQL date_trunc — event-sized data
// (hundreds to a few thousand rows) makes bucketing in memory the
// simplest correct option.

// "day key" = the YYYY-MM-DD prefix of the zoned wall-clock string, so two
// timestamps on the same calendar day in the org's own timezone group
// together even though their UTC instants differ.
export function dayKey(date: Date, timezone: string): string {
  return utcToZonedInputValue(date, timezone).slice(0, 10);
}

export function hourKey(date: Date, timezone: string): string {
  return utcToZonedInputValue(date, timezone).slice(0, 13);
}

export function bucketDates(dates: Date[], timezone: string): Map<string, number> {
  const map = new Map<string, number>();
  for (const d of dates) {
    const key = dayKey(d, timezone);
    map.set(key, (map.get(key) ?? 0) + 1);
  }
  return map;
}

// Fills every day between the earliest and latest bucket with 0 where
// nothing happened — a missing day in a growth curve should read as "no
// activity that day", not silently vanish from the list.
export function fillDayRange(buckets: Map<string, number>): { key: string; count: number }[] {
  const keys = [...buckets.keys()].sort();
  if (keys.length === 0) return [];
  const out: { key: string; count: number }[] = [];
  let cursor = new Date(`${keys[0]}T00:00:00Z`);
  const end = new Date(`${keys[keys.length - 1]}T00:00:00Z`);
  while (cursor.getTime() <= end.getTime()) {
    const key = cursor.toISOString().slice(0, 10);
    out.push({ key, count: buckets.get(key) ?? 0 });
    cursor = new Date(cursor.getTime() + 24 * 60 * 60 * 1000);
  }
  return out;
}

// Groups fillDayRange's output by day of the week, Monday first — to spot
// days that are consistently stronger than others. `average` (total ÷ how
// many of that weekday the range covers) is the fair comparison: a range
// can hold five Mondays but only four Sundays. Weekdays the range doesn't
// reach yet (under a week of data) are left out instead of reading as 0.
export const WEEKDAY_NAMES_ES = ["Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado", "Domingo"];
export function weekdayTotals(days: { key: string; count: number }[]): { weekday: number; total: number; days: number; average: number }[] {
  const rows = Array.from({ length: 7 }, (_, weekday) => ({ weekday, total: 0, days: 0, average: 0 }));
  for (const d of days) {
    // The key is already the org-timezone calendar date, so its UTC weekday
    // is that date's weekday. getUTCDay(): 0 = Sunday → shift to Monday = 0.
    const row = rows[(new Date(`${d.key}T12:00:00Z`).getUTCDay() + 6) % 7]!;
    row.total += d.count;
    row.days += 1;
  }
  return rows.filter((r) => r.days > 0).map((r) => ({ ...r, average: r.total / r.days }));
}

export function bucketHours(dates: Date[], timezone: string): { key: string; count: number }[] {
  const map = new Map<string, number>();
  for (const d of dates) {
    const key = hourKey(d, timezone);
    map.set(key, (map.get(key) ?? 0) + 1);
  }
  return [...map.entries()].sort((a, b) => a[0].localeCompare(b[0])).map(([key, count]) => ({ key, count }));
}

// Only the first letter — channelKey lowercases the whole string for
// stable grouping (so "Instagram" and "instagram" count as the same
// channel), this just makes the DISPLAYED label read naturally without
// CSS text-transform, which would also wrongly capitalize "utm" to "Utm".
export function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

export function channelKey(r: { utmSource: string | null; fbclid: string | null; ttclid: string | null; gclid: string | null }): string {
  const src = r.utmSource?.trim();
  if (src) return src.toLowerCase();
  if (r.fbclid) return "meta ads (sin utm)";
  if (r.ttclid) return "tiktok ads (sin utm)";
  if (r.gclid) return "google ads (sin utm)";
  return "directo / sin datos";
}

export function topN(values: (string | null)[], n: number, fallback = "sin especificar"): { label: string; count: number }[] {
  const map = new Map<string, number>();
  for (const raw of values) {
    const key = raw?.trim() || fallback;
    map.set(key, (map.get(key) ?? 0) + 1);
  }
  const sorted = [...map.entries()].sort((a, b) => b[1] - a[1]);
  if (sorted.length <= n) return sorted.map(([label, count]) => ({ label, count }));
  const top = sorted.slice(0, n - 1);
  const restCount = sorted.slice(n - 1).reduce((sum, [, c]) => sum + c, 0);
  return [...top.map(([label, count]) => ({ label, count })), { label: "otros", count: restCount }];
}
