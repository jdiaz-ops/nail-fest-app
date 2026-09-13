import { promises as dns } from "dns";

// Pre-flight list hygiene — checks BEFORE ever attempting to send, using
// only free/local signals (no paid verification API, nothing that costs
// money or needs a new API key). Three independent checks, each cheap
// and each catching a different kind of bad address:
//   1. Domain has no mail server at all (DNS MX/A/AAAA lookup) — the
//      closest thing to "this address cannot possibly receive mail"
//      without actually sending to it.
//   2. Domain is a well-known disposable/temp-mail service — someone
//      dodging a form gate with a throwaway address.
//   3. Domain is a likely TYPO of a major provider (gmial.com, hotmial.com,
///     etc.) — edit-distance 1-2 from gmail.com/hotmail.com/etc.
// Plus one softer, non-domain signal: a role-based local part (info@,
// admin@...) — not necessarily fake, just less likely to be a real
// individual who'll ever open a newsletter.
//
// None of this is exhaustive (there are thousands of disposable-email
// services; a domain can have MX records and still be a dead mailbox
// with no way to know without actually sending) — this catches the
// cheap, high-confidence cases before they ever cost a send attempt.

export type EmailQualityReason =
  | "no_mail_server" // no MX, no A/AAAA at all — domain can't receive mail
  | "no_mx_has_a" // has A/AAAA but no MX — unusual, softer flag
  | "disposable_domain"
  | "likely_typo"
  | "role_based";

export interface EmailQualityFinding {
  email: string;
  domain: string;
  reasons: EmailQualityReason[];
  /** Only set when reasons includes "likely_typo" — which real provider
   * this domain is probably a misspelling of. */
  typoOf?: string;
}

export interface EmailQualitySummary {
  totalChecked: number;
  totalDomains: number;
  findings: EmailQualityFinding[];
  countByReason: Record<EmailQualityReason, number>;
}

// A curated, non-exhaustive list of the disposable/temp-mail domains that
// actually show up in real signup forms — the ones a person doing a
// quick "I don't want to give my real email" search finds first.
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
  "correotemporal.org", // Spanish-language temp mail, relevant for a CO/LatAm list
  "correotemporal.com",
]);

// Major providers a Colombian sign-up form realistically sees, and their
// most common one/two-character typos — the sort of thing a person
// fat-fingers on a phone keyboard. Checked by edit distance below, not a
// fixed pairwise map, so this list only needs the CORRECT spellings.
const MAJOR_PROVIDERS = ["gmail.com", "hotmail.com", "outlook.com", "yahoo.com", "icloud.com", "live.com", "hotmail.es", "yahoo.es"];

function levenshtein(a: string, b: string): number {
  // Row-by-row, not a 2D array — sidesteps TS's noUncheckedIndexedAccess
  // flagging every dp[i][j] as possibly undefined (a plain number[][]
  // fill doesn't narrow that away), and it's the standard space
  // optimization for this algorithm anyway (only ever needs the
  // previous row, never the whole grid).
  let prevRow: number[] = Array.from({ length: b.length + 1 }, (_, j) => j);
  for (let i = 1; i <= a.length; i++) {
    const currRow: number[] = [i];
    for (let j = 1; j <= b.length; j++) {
      const costDiag = prevRow[j - 1] ?? 0;
      const costUp = prevRow[j] ?? 0;
      const costLeft = currRow[j - 1] ?? 0;
      currRow.push(a[i - 1] === b[j - 1] ? costDiag : 1 + Math.min(costUp, costLeft, costDiag));
    }
    prevRow = currRow;
  }
  return prevRow[b.length] ?? Math.max(a.length, b.length);
}

/** A domain within edit-distance 1-2 of a major provider, but not an
 * exact match to ANY major provider (so gmail.com itself never flags
 * against itself) — e.g. "gmial.com" (distance 1 from gmail.com). Real
 * distinct domains occasionally land this close by coincidence, which is
 * exactly why this is a REVIEW flag, not an automatic suppression. */
function findLikelyTypo(domain: string): string | null {
  if (MAJOR_PROVIDERS.includes(domain)) return null;
  for (const provider of MAJOR_PROVIDERS) {
    // Skip comparing wildly different lengths — cuts wasted DP work and
    // avoids nonsense matches like a 4-char domain "close" to gmail.com
    // only because both are short.
    if (Math.abs(domain.length - provider.length) > 2) continue;
    if (levenshtein(domain, provider) <= 2) return provider;
  }
  return null;
}

const ROLE_LOCAL_PARTS = new Set([
  "info",
  "admin",
  "administrador",
  "support",
  "soporte",
  "contact",
  "contacto",
  "sales",
  "ventas",
  "hello",
  "hola",
  "help",
  "ayuda",
  "noreply",
  "no-reply",
  "webmaster",
  "postmaster",
  "office",
  "marketing",
  "test",
  "abuse",
  "billing",
  "facturacion",
]);

// Bounded concurrency for the DNS lookups — a real Nail Fest list
// collapses to a few hundred distinct domains at most (gmail/hotmail/
// yahoo dominate), but this caps how many in-flight lookups hit the
// resolver at once regardless.
const DNS_CONCURRENCY = 20;

interface DomainDnsResult {
  hasMx: boolean;
  hasAny: boolean; // MX, or at least A/AAAA
}

async function checkDomainDns(domain: string): Promise<DomainDnsResult> {
  try {
    const mx = await dns.resolveMx(domain);
    if (mx.length > 0) return { hasMx: true, hasAny: true };
  } catch {
    // ENOTFOUND/ENODATA — no MX record, fall through to the A/AAAA check
  }
  try {
    const a = await dns.resolve4(domain);
    if (a.length > 0) return { hasMx: false, hasAny: true };
  } catch {
    // no A record either
  }
  try {
    const aaaa = await dns.resolve6(domain);
    if (aaaa.length > 0) return { hasMx: false, hasAny: true };
  } catch {
    // no AAAA either
  }
  return { hasMx: false, hasAny: false };
}

async function checkDomainsInBatches(domains: string[]): Promise<Map<string, DomainDnsResult>> {
  const results = new Map<string, DomainDnsResult>();
  for (let i = 0; i < domains.length; i += DNS_CONCURRENCY) {
    const batch = domains.slice(i, i + DNS_CONCURRENCY);
    const batchResults = await Promise.all(
      batch.map(async (domain) => {
        const result = await checkDomainDns(domain).catch(() => ({ hasMx: false, hasAny: false }));
        return [domain, result] as const;
      })
    );
    for (const [domain, result] of batchResults) results.set(domain, result);
  }
  return results;
}

export async function analyzeEmailQuality(emails: string[]): Promise<EmailQualitySummary> {
  const normalized = [...new Set(emails.map((e) => e.trim().toLowerCase()).filter(Boolean))];
  const byDomain = new Map<string, string[]>();
  for (const email of normalized) {
    const at = email.lastIndexOf("@");
    if (at < 0) continue;
    const domain = email.slice(at + 1);
    if (!byDomain.has(domain)) byDomain.set(domain, []);
    byDomain.get(domain)!.push(email);
  }

  const domains = [...byDomain.keys()];
  // Only worth a DNS round trip for domains that AREN'T already known-bad
  // by a free static check — a disposable domain's mail servers might
  // even work fine (that's not the problem with it), and a typo domain's
  // realness is exactly what the DNS check would help decide anyway, so
  // this still checks those too. Skips nothing — every distinct domain
  // gets exactly one DNS check either way.
  const dnsResults = await checkDomainsInBatches(domains);

  const findings: EmailQualityFinding[] = [];
  for (const [domain, domainEmails] of byDomain) {
    const dnsResult = dnsResults.get(domain);
    const isDisposable = DISPOSABLE_DOMAINS.has(domain);
    const typoOf = findLikelyTypo(domain);

    for (const email of domainEmails) {
      const reasons: EmailQualityReason[] = [];
      if (dnsResult && !dnsResult.hasAny) reasons.push("no_mail_server");
      else if (dnsResult && !dnsResult.hasMx) reasons.push("no_mx_has_a");
      if (isDisposable) reasons.push("disposable_domain");
      if (typoOf) reasons.push("likely_typo");
      const localPart = email.slice(0, email.lastIndexOf("@"));
      if (ROLE_LOCAL_PARTS.has(localPart)) reasons.push("role_based");

      if (reasons.length > 0) {
        findings.push({ email, domain, reasons, typoOf: typoOf ?? undefined });
      }
    }
  }

  const countByReason: Record<EmailQualityReason, number> = {
    no_mail_server: 0,
    no_mx_has_a: 0,
    disposable_domain: 0,
    likely_typo: 0,
    role_based: 0,
  };
  for (const finding of findings) {
    for (const reason of finding.reasons) countByReason[reason]++;
  }

  return { totalChecked: normalized.length, totalDomains: domains.length, findings, countByReason };
}
