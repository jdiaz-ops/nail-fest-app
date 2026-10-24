import { createHmac, timingSafeEqual } from "crypto";
import { cookies } from "next/headers";

// The library's free sign-up: once someone leaves their details
// (LibraryLead REGISTRO), this cookie — the lead's id, signed — opens the
// marathons' recordings and the step by steps on that browser. Not an
// account and not a secret: just enough that the sign-up is the way in.

export const LIBRARY_ACCESS_COOKIE = "nf_biblioteca";
// ~400 days, the longest Chrome honors (same as the admin session).
export const LIBRARY_ACCESS_MAX_AGE_SECONDS = 400 * 24 * 60 * 60;

function signature(leadId: string): string {
  const secret = process.env.APP_SECRET_KEY;
  if (!secret) throw new Error("APP_SECRET_KEY is not set.");
  return createHmac("sha256", secret).update(`biblioteca:${leadId}`).digest("base64url");
}

export function libraryAccessToken(leadId: string): string {
  return `${leadId}.${signature(leadId)}`;
}

export function isLibraryAccessToken(token: string | null | undefined): boolean {
  if (!token) return false;
  const dot = token.lastIndexOf(".");
  if (dot <= 0) return false;
  let expected: string;
  try {
    expected = signature(token.slice(0, dot));
  } catch {
    return false;
  }
  const given = Buffer.from(token.slice(dot + 1));
  const wanted = Buffer.from(expected);
  return given.length === wanted.length && timingSafeEqual(given, wanted);
}

/** Whether this request's browser already signed up. */
export function hasLibraryAccess(): boolean {
  return isLibraryAccessToken(cookies().get(LIBRARY_ACCESS_COOKIE)?.value);
}
