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
