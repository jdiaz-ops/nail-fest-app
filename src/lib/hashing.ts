import { createHash } from "crypto";

// Meta's matching rules for Conversions API / Custom Audiences: normalize
// BEFORE hashing, exactly like this, or matching silently degrades with no
// error from the API — this is the single easiest thing to get quietly
// wrong (flagged in the build brief review).
// https://www.facebook.com/business/help/2469922623397544 (hashing guidance)

export function sha256Hex(value: string): string {
  return createHash("sha256").update(value, "utf8").digest("hex");
}

/** Lowercase + trim, per Meta's email normalization rule. */
export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

/**
 * Digits-only, E.164 without the leading "+", per Meta's phone
 * normalization rule. Assumes the number already includes a country code
 * (Colombia: 57...). Does NOT attempt to guess a missing country code —
 * validate/format that at form-submission time instead.
 */
export function normalizePhone(phone: string): string {
  return phone.replace(/[^0-9]/g, "");
}

export function hashEmail(email: string): string {
  return sha256Hex(normalizeEmail(email));
}

export function hashPhone(phone: string): string {
  return sha256Hex(normalizePhone(phone));
}
