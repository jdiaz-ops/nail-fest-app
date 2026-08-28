// Every place in the app that shows a date/time reads OrgSettings.timezone
// and .language (see /admin/settings/basic) through this one function,
// instead of each hardcoding "America/Bogota" / "es-CO" — that hardcoding
// is exactly what made those settings fields fake before they were wired
// up. "language" only changes the Intl locale (month names, 24h vs AM/PM)
// — the app's own UI copy has no translation system and stays Spanish
// regardless of this setting.

export function localeFor(language: string): string {
  return language === "en" ? "en-US" : "es-CO";
}

export function formatDateInTz(date: Date, opts: Intl.DateTimeFormatOptions, timezone: string, language: string): string {
  return new Intl.DateTimeFormat(localeFor(language), { ...opts, timeZone: timezone }).format(date);
}

// The event date/time pickers on /admin/events (EventForm.tsx) need to
// convert a bare "2026-11-07T10:00" <input type="datetime-local"> value —
// no timezone info at all — into the correct UTC instant for OrgSettings'
// configured timezone, not the browser's own. Without this, an admin
// testing from outside Colombia would create events hours off from what
// they typed. Standard "treat the string as UTC, measure the real offset
// for that instant in the target zone, then correct for it" trick — safe
// for Bogotá (no DST) and correct in general since it re-derives the
// offset from the actual instant, not a fixed constant.
export function zonedTimeToUtc(localDateTimeStr: string, timezone: string): Date {
  const asUtc = new Date(`${localDateTimeStr}Z`);
  if (Number.isNaN(asUtc.getTime())) return asUtc;
  const zonedMs = new Date(asUtc.toLocaleString("en-US", { timeZone: timezone })).getTime();
  const utcMs = new Date(asUtc.toLocaleString("en-US", { timeZone: "UTC" })).getTime();
  return new Date(asUtc.getTime() + (utcMs - zonedMs));
}

// The inverse, for pre-filling the edit form: a real UTC Date -> the
// "YYYY-MM-DDTHH:mm" string that <input type="datetime-local"> expects,
// representing that instant's wall-clock time in `timezone`.
export function utcToZonedInputValue(date: Date, timezone: string): string {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(date);
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? "00";
  return `${get("year")}-${get("month")}-${get("day")}T${get("hour")}:${get("minute")}`;
}
