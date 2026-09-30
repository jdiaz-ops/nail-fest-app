// The name people see — public page, emails, the ticket, WhatsApp — versus
// Event.name, which is the admin's own internal label (e.g. "Cúcuta 2026 —
// feria nov"). Empty publicName means both are the same, which is how
// every event worked before the split, so nothing changes until the admin
// fills it in.
export function publicEventName(event: { name: string; publicName?: string | null }): string {
  return event.publicName?.trim() || event.name;
}
