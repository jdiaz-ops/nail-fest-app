// What the one-page checkout (components/imparables/ImpCheckout.tsx)
// remembers between visits (the team, 2026-11-02): what the buyer typed, in
// her own browser (localStorage), so reloading the page or coming back to it
// doesn't start her over. Never anything about a card — that never passes
// through Nail Fest. Gone once her payment is confirmed (/[eventSlug]/pago,
// ForgetCheckout) or after a week. Client-only: every read and write is in a
// try, since a private window or blocked storage throws.

export const CHECKOUT_MEMORY_DAYS = 7;

export interface CheckoutMemoryForm {
  email: string;
  firstName: string;
  lastName: string;
  docNumber: string;
  company: string;
  city: string;
  phone: string;
  profession: string;
}

export interface CheckoutMemory {
  form: CheckoutMemoryForm;
  qty: number;
  country: string;
  phoneCountry: string;
  docType: string;
  currency: "COP" | "USD";
  /** Whether she chose the currency herself (then her country no longer changes it). */
  currencyPicked: boolean;
  /** A discount code she had applied, to apply again. */
  code: string | null;
  /** Her choice in «Tu entrada», on a version that sells the levels. */
  chosen: string | null;
}

/** What the abandoned-cart reminder's link brings back (lib/imparables/checkoutPrefill.ts): what her draft saved. */
export interface CheckoutPrefill {
  email: string;
  firstName: string;
  lastName: string;
  city: string;
  profession: string;
  country: string | null;
  phoneCountry: string | null;
  phone: string;
  qty: number | null;
}

export const CHECKOUT_FORM_KEYS = ["email", "firstName", "lastName", "docNumber", "company", "city", "phone", "profession"] as const;

const MAX_AGE_MS = CHECKOUT_MEMORY_DAYS * 24 * 60 * 60 * 1000;

function keyFor(eventSlug: string): string {
  return `nf-checkout:${eventSlug}`;
}

function text(value: unknown, fallback = ""): string {
  return typeof value === "string" ? value.slice(0, 200) : fallback;
}

/** What she typed before, or null: nothing saved, saved over a week ago (then it's dropped), or unreadable. */
export function readCheckoutMemory(eventSlug: string, now = Date.now()): CheckoutMemory | null {
  try {
    const raw = window.localStorage.getItem(keyFor(eventSlug));
    if (!raw) return null;
    const saved = JSON.parse(raw);
    if (!saved || saved.v !== 1 || typeof saved.savedAt !== "number" || now - saved.savedAt > MAX_AGE_MS) {
      window.localStorage.removeItem(keyFor(eventSlug));
      return null;
    }
    const form = {} as CheckoutMemoryForm;
    for (const key of CHECKOUT_FORM_KEYS) form[key] = text(saved.form?.[key]);
    return {
      form,
      qty: Number.isInteger(saved.qty) && saved.qty > 0 ? saved.qty : 1,
      country: text(saved.country, "CO") || "CO",
      phoneCountry: text(saved.phoneCountry, "CO") || "CO",
      docType: text(saved.docType),
      currency: saved.currency === "USD" ? "USD" : "COP",
      currencyPicked: saved.currencyPicked === true,
      code: text(saved.code) || null,
      chosen: text(saved.chosen) || null,
    };
  } catch {
    return null;
  }
}

export function writeCheckoutMemory(eventSlug: string, memory: CheckoutMemory, now = Date.now()): void {
  try {
    window.localStorage.setItem(keyFor(eventSlug), JSON.stringify({ v: 1, savedAt: now, ...memory }));
  } catch {
    // Storage full or blocked: she just types it again.
  }
}

export function forgetCheckoutMemory(eventSlug: string): void {
  try {
    window.localStorage.removeItem(keyFor(eventSlug));
  } catch {
    // Nothing to forget where storage is blocked.
  }
}
