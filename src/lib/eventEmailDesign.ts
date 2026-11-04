import type { Event } from "@prisma/client";
import { hasNailFestAsistire } from "@/lib/nailfest/asistire";
import { NAIL_FEST_DESIGN } from "@/lib/nailfest/confirmation";
import { nailFestEventEmailSample } from "@/lib/nailfest/eventEmailFrame";
import { imparablesEventEmailSample } from "@/lib/imparables/eventEmailFrame";

// The designs an event's emails can go in («Correos del evento», Event.broadcastDesign): Nail Fest's for its events at
// a place (2026-10-30, lib/nailfest/eventEmail.ts), and Manicuristas Imparables' for the congress (2026-11-04,
// lib/imparables/eventEmail.ts). Each event has one it can use, switched on or off for all of its emails.

export const IMPARABLES_EMAIL_DESIGN = "IMPARABLES";
export type EventEmailDesign = typeof NAIL_FEST_DESIGN | typeof IMPARABLES_EMAIL_DESIGN;

/** The design an event can use: the congress's for Manicuristas Imparables, Nail Fest's for one of its events at a place; none otherwise. */
export function eventEmailDesignOf(event: Pick<Event, "theme" | "format">): EventEmailDesign | null {
  if (event.theme === "IMPARABLES") return IMPARABLES_EMAIL_DESIGN;
  return hasNailFestAsistire(event) ? NAIL_FEST_DESIGN : null;
}

/** The design its emails go in now: the one it can use, when it's on. */
export function activeEventEmailDesign(event: Pick<Event, "theme" | "format" | "broadcastDesign">): EventEmailDesign | null {
  const design = eventEmailDesignOf(event);
  return design && event.broadcastDesign === design ? design : null;
}

/** «Diseño Nail Fest», «Diseño Imparables». */
export function eventEmailDesignName(design: EventEmailDesign): string {
  return design === IMPARABLES_EMAIL_DESIGN ? "Imparables" : "Nail Fest";
}

/** One of its emails in the design it can use, with sample data (previews and tests); null when it has none. */
export async function eventEmailSample(
  event: Event,
  mail: { subject: string; bodyHtml: string; band: string | null; asistire?: boolean; kit?: boolean; colega?: boolean; pdf?: boolean }
): Promise<{ subject: string; text: string; html: string } | null> {
  const design = eventEmailDesignOf(event);
  if (design === IMPARABLES_EMAIL_DESIGN) return imparablesEventEmailSample(event, mail);
  if (design === NAIL_FEST_DESIGN) return nailFestEventEmailSample(event, mail);
  return null;
}
