import { COUNTRY_CODES } from "@/lib/countryCodes";

// Nail Fest's own Instagram — the "síguenos" invite shown right after a
// real confirmation (EventRegistration.tsx's own resumen step for the
// free/immediate path, and /[eventSlug]/pago's approved case for the
// paid one) — one place so the handle/URL can't drift between the two
// copies of that same moment.
export const INSTAGRAM_URL = "https://www.instagram.com/nailfest_co";
export const INSTAGRAM_HANDLE = "@nailfest_co";

/** Purely cosmetic — the phone a person submitted is stored/sent as raw
 * E.164 ("+573001234567", see RegistrationForm's phoneCountry.dialCode +
 * localPhone concat), so this just re-groups it for a confirmation pill:
 * country code, then the rest in groups of 3 with the last group taking
 * any remainder (so a 10-digit CO mobile reads "+57 300 123 4567",
 * matching how the app already asks for it). Falls back to the raw
 * string when the prefix isn't one of the app's own COUNTRY_CODES —
 * never throws. */
export function formatPhoneDisplay(raw: string): string {
  const country = COUNTRY_CODES.find((c) => raw.startsWith(c.code));
  if (!country) return raw;
  let rest = raw.slice(country.code.length);
  const groups: string[] = [];
  while (rest.length > 4) {
    groups.push(rest.slice(0, 3));
    rest = rest.slice(3);
  }
  if (rest) groups.push(rest);
  return [country.code, ...groups].join(" ");
}
