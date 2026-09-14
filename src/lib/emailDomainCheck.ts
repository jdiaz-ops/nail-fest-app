import { promises as dns } from "dns";

// Server-side, registration-time gate — different job from
// emailTypo.ts's live suggestion (which never blocks, since it can't
// tell a real unusual domain from a typo). This checks something it CAN
// be certain about: the domain has no mail server at all, so no address
// on it could ever receive anything — or it's a known disposable/temp-
// mail service, someone dodging the form with a throwaway. Both are
// "obvio que no sirve", worth a hard reject before a single DB row gets
// written; a merely typo-shaped-but-real domain still gets through here
// exactly like before, same as it always did.
//
// Deliberately FAILS OPEN: any DNS error/timeout (a resolver hiccup, a
// transient network blip) is treated as "couldn't prove it's bad" and
// lets the registration through — this only ever blocks on a CONFIRMED
// absence of mail servers, never on "couldn't check." A real paying
// customer getting rejected because of a flaky resolver would be a far
// worse bug than an occasional bad address slipping in (which the
// existing bounce-based auto-suppression in lib/email/tracking.ts still
// catches later).

const DISPOSABLE_DOMAINS = new Set([
  "mailinator.com",
  "guerrillamail.com",
  "guerrillamail.info",
  "guerrillamail.biz",
  "10minutemail.com",
  "10minutemail.net",
  "tempmail.com",
  "temp-mail.org",
  "throwawaymail.com",
  "yopmail.com",
  "yopmail.fr",
  "yopmail.net",
  "trashmail.com",
  "fakeinbox.com",
  "getnada.com",
  "dispostable.com",
  "sharklasers.com",
  "maildrop.cc",
  "mintemail.com",
  "moakt.com",
  "mailnesia.com",
  "spamgourmet.com",
  "mytemp.email",
  "emailondeck.com",
  "discard.email",
  "mohmal.com",
  "tempinbox.com",
  "mailcatch.com",
  "correotemporal.org",
  "correotemporal.com",
]);

const DNS_TIMEOUT_MS = 3000;

async function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T | "timeout"> {
  return Promise.race([promise, new Promise<"timeout">((resolve) => setTimeout(() => resolve("timeout"), ms))]);
}

export async function isObviouslyDeadEmail(email: string): Promise<boolean> {
  const at = email.lastIndexOf("@");
  if (at < 0) return false; // not shaped like an email — zod's own .email() already gates this upstream
  const domain = email
    .slice(at + 1)
    .trim()
    .toLowerCase();
  if (!domain) return false;

  if (DISPOSABLE_DOMAINS.has(domain)) return true;

  // Three lookups, each either "found something" (real domain, let it
  // through immediately), "confirmed empty" (counts toward the eventual
  // reject), or "timed out" (couldn't prove anything either way — see
  // anyTimedOut below, which overrides an all-empty result back to "let
  // it through" rather than risk rejecting a real domain a flaky
  // resolver just happened not to answer for in time).
  let anyTimedOut = false;

  try {
    const mx = await withTimeout(dns.resolveMx(domain), DNS_TIMEOUT_MS);
    if (mx === "timeout") anyTimedOut = true;
    else if (mx.length > 0) return false;
  } catch {
    /* ENOTFOUND/ENODATA — no MX record */
  }
  try {
    const a = await withTimeout(dns.resolve4(domain), DNS_TIMEOUT_MS);
    if (a === "timeout") anyTimedOut = true;
    else if (a.length > 0) return false;
  } catch {
    /* no A record */
  }
  try {
    const aaaa = await withTimeout(dns.resolve6(domain), DNS_TIMEOUT_MS);
    if (aaaa === "timeout") anyTimedOut = true;
    else if (aaaa.length > 0) return false;
  } catch {
    /* no AAAA record either — genuinely nothing found */
  }

  if (anyTimedOut) return false; // couldn't prove it — fail open
  return true; // all three genuinely came back empty: no mail server, period
}
