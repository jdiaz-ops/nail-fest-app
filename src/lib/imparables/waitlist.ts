import { publicEventName } from "@/lib/eventDisplayName";

// An event's waiting list is a CRM label (Label, the same ones segments and
// WhatsApp broadcasts filter on): «Lista de espera · Manicuristas
// Imparables». Whoever joins it (/api/lista-de-espera) carries it, and the
// team tells them first when the sale opens — from Broadcasts, as always.
export function waitlistLabel(event: { name: string; publicName?: string | null }): string {
  return `Lista de espera · ${publicEventName(event)}`;
}
