import { publicEventName } from "@/lib/eventDisplayName";

// An event's waiting list is a CRM label (Label, the same ones segments and
// WhatsApp broadcasts filter on): «Lista de espera · Manicuristas
// Imparables». Whoever joins it (/api/lista-de-espera) carries it, and the
// team tells them first when the sale opens — from Broadcasts, as always.
export function waitlistLabel(event: { name: string; publicName?: string | null }): string {
  return `Lista de espera · ${publicEventName(event)}`;
}

/** Élite's own list once its 20 are paid (lib/imparables/tiers.ts, 2026-10-31): «Lista de espera Élite · Manicuristas
 * Imparables» — whoever is on it hears first if a place frees up. */
export function eliteWaitlistLabel(event: { name: string; publicName?: string | null }): string {
  return `Lista de espera Élite · ${publicEventName(event)}`;
}
