import { db } from "@/lib/db";
import { readCheckoutResumeToken } from "@/lib/checkoutResume";
import { WORLD_COUNTRIES } from "@/lib/worldCountries";
import type { CheckoutPrefill } from "./checkoutMemory";

// The checkout opened from the abandoned-cart reminder (?retomar=, lib/
// checkoutResume.ts; the team, 2026-11-02): what her draft saved
// (/api/register/draft), to fill the form with. Only for a registration of
// this event still waiting for its payment — a paid one has nothing to
// finish, and the checkout would say so on paying anyway.

/** A saved phone ("+573211234567") as the form takes it: its country's code and the number after it. Her own country
 * first (+1 is many countries'), else the longest code that fits. */
export function splitSavedPhone(full: string | null, country: string | null): { phoneCountry: string | null; phone: string } {
  const compact = (full ?? "").replace(/[^0-9+]/g, "");
  if (!compact) return { phoneCountry: null, phone: "" };
  const withPlus = compact.startsWith("+") ? compact : `+${compact}`;
  const fits = WORLD_COUNTRIES.filter((c) => c.dialCode && withPlus.startsWith(c.dialCode));
  const pick = fits.find((c) => c.iso2 === country) ?? [...fits].sort((a, b) => b.dialCode.length - a.dialCode.length)[0];
  if (!pick) return { phoneCountry: null, phone: compact.replace(/^\+/, "") };
  return { phoneCountry: pick.iso2, phone: withPlus.slice(pick.dialCode.length) };
}

export async function checkoutPrefill(eventId: string, token: string | null): Promise<CheckoutPrefill | null> {
  if (!token) return null;
  const registrationId = readCheckoutResumeToken(token);
  if (!registrationId) return null;
  const registration = await db.registration.findUnique({ where: { id: registrationId }, include: { person: true } });
  if (!registration || registration.eventId !== eventId) return null;
  if (registration.status !== "STARTED" && registration.status !== "PENDING_PAYMENT") return null;
  const person = registration.person;
  const country = person.country && WORLD_COUNTRIES.some((c) => c.iso2 === person.country) ? person.country : null;
  const { phoneCountry, phone } = splitSavedPhone(person.phone, country);
  return {
    email: person.email,
    firstName: person.firstName ?? "",
    lastName: person.lastName ?? "",
    city: person.city ?? "",
    profession: person.profession ?? "",
    country,
    phoneCountry,
    phone,
    qty: registration.ticketCount ?? null,
  };
}
