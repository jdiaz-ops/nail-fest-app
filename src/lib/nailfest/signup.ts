import type { Event } from "@prisma/client";
import { db } from "@/lib/db";
import { asistireSampleUrl, asistireUrl } from "@/lib/imparables/asistire";
import type { NailFestSignupResult, NailFestSignupScreen } from "@/components/nailfest/SignedUp";
import { defaultNailFestShareText, NAIL_FEST_DESIGN } from "./confirmation";
import { hasNailFestAsistire } from "./asistire";

// Nail Fest's screen right after signing up (2026-10-30, components/nailfest/
// SignedUp.tsx), for an event that switched it on in «Después de la
// inscripción» (Event.signupScreenDesign): the event's part, built with the
// page, and hers, in /api/register's answer.

const baseUrl = () => (process.env.APP_BASE_URL || "https://nailfest.lat").replace(/\/+$/, "");

/** Whether an event shows it. */
export function showsNailFestSignup(event: Pick<Event, "signupScreenDesign" | "theme" | "format">): boolean {
  return event.signupScreenDesign === NAIL_FEST_DESIGN && hasNailFestAsistire(event);
}

/** The event's part: the invitation for a colleague, and whether its entry is free. */
export async function nailFestSignupScreen(event: Event, timezone: string): Promise<NailFestSignupScreen> {
  const page = new URL(`${baseUrl()}/${event.slug}`);
  page.searchParams.set("utm_source", "whatsapp");
  page.searchParams.set("utm_medium", "referido");
  page.searchParams.set("utm_campaign", "inscripcion");
  const shareText = event.shareText?.trim() || defaultNailFestShareText(event, timezone);
  const paid = await db.ticketType.count({ where: { eventId: event.id, status: "ON_SALE", price: { gt: 0 } } });
  return { shareUrl: `https://wa.me/?text=${encodeURIComponent(`${shareText} ${page.toString()}`)}`, free: paid === 0 };
}

/** Hers: her page to make her «Asistiré» image — or nothing, if it can't be signed. */
export function nailFestSignupResult(registrationId: string): NailFestSignupResult | undefined {
  try {
    return { asistire: asistireUrl(registrationId) };
  } catch (err) {
    console.error("register: Nail Fest's screen after signing up", err);
    return undefined;
  }
}

/** Laura's, for the team's preview: the sample «Asistiré». */
export function nailFestSignupSample(event: Pick<Event, "id">): NailFestSignupResult {
  return { asistire: asistireSampleUrl(event.id) };
}
