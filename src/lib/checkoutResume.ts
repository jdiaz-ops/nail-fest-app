import { createHmac, timingSafeEqual } from "crypto";

// The abandoned-cart reminder's link back into the one-page checkout, filled
// with what her draft saved (the team, 2026-11-02; lib/imparables/
// checkoutPrefill.ts): ?retomar=<registration>.<expiry>.<signature>, signed
// with APP_SECRET_KEY like the unsubscribe links (lib/unsubscribe.ts). It
// names nothing by itself and is good for 30 days, so a reminder opened late
// still works.

export const CHECKOUT_RESUME_DAYS = 30;

function sign(payload: string): string {
  const secret = process.env.APP_SECRET_KEY;
  if (!secret) throw new Error("APP_SECRET_KEY is not set.");
  return createHmac("sha256", secret).update(`retomar.${payload}`).digest("base64url");
}

export function checkoutResumeToken(registrationId: string, now = new Date()): string {
  const expires = Math.floor(now.getTime() / 1000) + CHECKOUT_RESUME_DAYS * 24 * 60 * 60;
  const payload = `${registrationId}.${expires.toString(36)}`;
  return `${payload}.${sign(payload)}`;
}

/** The registration a link names, or null: malformed, tampered with, signed with another key, or expired. */
export function readCheckoutResumeToken(token: string, now = new Date()): string | null {
  const parts = token.split(".");
  if (parts.length !== 3) return null;
  const [registrationId, expires36, signature] = parts as [string, string, string];
  if (!registrationId || !expires36 || !signature) return null;
  let expected: string;
  try {
    expected = sign(`${registrationId}.${expires36}`);
  } catch {
    return null;
  }
  const given = Buffer.from(signature);
  const wanted = Buffer.from(expected);
  if (given.length !== wanted.length || !timingSafeEqual(given, wanted)) return null;
  const expires = parseInt(expires36, 36);
  if (!Number.isFinite(expires) || expires * 1000 < now.getTime()) return null;
  return registrationId;
}
