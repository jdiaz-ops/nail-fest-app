import { localeFor } from "@/lib/dateFormat";

export interface HeroDate {
  // "7 y 8", "7 al 9", "7", "30 – 1"
  days: string;
  // "de noviembre", "de octubre a noviembre"
  month: string;
  // "Sábado y domingo · 2026"
  detail: string;
}

// The big date block on the public event page (see [eventSlug]/page.tsx)
// — derived from startsAt/endsAt so the admin never types a date twice
// and a rescheduled event can't show a stale one in its hero.
export function formatHeroDate(startsAt: Date, endsAt: Date | null, timezone: string, language: string): HeroDate {
  const locale = localeFor(language);
  const partsOf = (d: Date) => {
    const parts = new Intl.DateTimeFormat(locale, {
      timeZone: timezone,
      day: "numeric",
      month: "long",
      weekday: "long",
      year: "numeric",
    }).formatToParts(d);
    const get = (type: string) => parts.find((p) => p.type === type)?.value ?? "";
    // Calendar-day ordinal in `timezone`, for "consecutive?" — compared
    // via numeric parts rather than the Date itself so 23:30 Bogotá on the
    // 7th and 00:30 on the 8th count as adjacent days, not the same one.
    const numeric = new Intl.DateTimeFormat("en-US", { timeZone: timezone, year: "numeric", month: "numeric", day: "numeric" }).formatToParts(d);
    const n = (type: string) => Number(numeric.find((p) => p.type === type)?.value ?? 0);
    const dayIndex = Date.UTC(n("year"), n("month") - 1, n("day")) / 86_400_000;
    return { day: get("day"), month: get("month"), weekday: get("weekday"), year: get("year"), dayIndex };
  };
  const cap = (w: string) => w.charAt(0).toUpperCase() + w.slice(1);

  const s = partsOf(startsAt);
  const e = endsAt ? partsOf(endsAt) : null;
  if (!e || e.dayIndex <= s.dayIndex) {
    return { days: s.day, month: `de ${s.month}`, detail: `${cap(s.weekday)} · ${s.year}` };
  }

  const end = e;
  const sameMonth = end.month === s.month && end.year === s.year;
  const consecutive = end.dayIndex - s.dayIndex === 1;
  const days = sameMonth ? `${s.day} ${consecutive ? "y" : "al"} ${end.day}` : `${s.day} – ${end.day}`;
  const month = sameMonth ? `de ${s.month}` : `de ${s.month} a ${end.month}`;
  const weekdays = consecutive ? `${cap(s.weekday)} y ${end.weekday}` : `${cap(s.weekday)} a ${end.weekday}`;
  const year = end.year === s.year ? s.year : `${s.year}–${end.year}`;
  return { days, month, detail: `${weekdays} · ${year}` };
}
