// Pre-flight list hygiene for phone numbers — same spirit as
// lib/email/qualityCheck.ts (cheap, local, no paid lookup API), applied
// to the one other channel this app can suppress by purpose: WhatsApp.
// Unlike email there's no DNS-equivalent "does this number exist" check
// available for free — the only real proof a number works is an actual
// WhatsApp send coming back delivered (see lib/whatsapp/inbox.ts's own
// two-strike undeliverable handling for that). What CAN be caught for
// free, before ever spending a send on it, is the number being
// structurally impossible: missing, not in E.164 shape, the wrong
// number of digits, or an obviously fake placeholder pattern.

export type PhoneQualityReason =
  | "missing" // no phone on file at all
  | "no_plus_prefix" // raw digits, no "+" — ambiguous which country, and not what the WhatsApp API accepts
  | "invalid_characters" // letters, spaces, dashes, parentheses etc. left in the value
  | "too_short" // fewer digits than any real phone number has (E.164 floor)
  | "too_long" // more digits than E.164 allows (hard max 15 after the country code)
  | "fake_pattern" // all-same-digit or a straight ascending/descending run — placeholder data, not a real number
  | "co_length_unexpected"; // starts with +57 but isn't a plausible Colombian mobile length — SOFT, not proof, just worth a look

export interface PhoneQualityFinding {
  personId: string;
  phone: string | null;
  reasons: PhoneQualityReason[];
}

export interface PhoneQualitySummary {
  totalChecked: number;
  findings: PhoneQualityFinding[];
  countByReason: Record<PhoneQualityReason, number>;
}

const MIN_DIGITS = 8; // shortest real-world mobile numbers (a handful of small countries) run about this long
const MAX_DIGITS = 15; // E.164 hard maximum, country code included

/** All the same digit (3000000000, 5555555555) or a strict +1/-1 run
 * (1234567890, 9876543210) — real phone numbers essentially never land
 * on either by chance. */
function isUniformOrSequential(s: string): boolean {
  if (s.length < 6) return false;
  if (new Set(s).size === 1) return true;
  let ascending = true;
  let descending = true;
  for (let i = 1; i < s.length; i++) {
    const diff = s.charCodeAt(i) - s.charCodeAt(i - 1);
    if (diff !== 1) ascending = false;
    if (diff !== -1) descending = false;
  }
  return ascending || descending;
}

// The two canonical "keyboard row" sequences (and their reverses) wrap
// 9 back to 0, which isn't a strict +1/-1 run in character-code terms —
// worth matching as literal substrings since they're the single most
// common placeholder a person types, with or without a real prefix in
// front (e.g. "+57 123 456 7890").
const KNOWN_FAKE_SEQUENCES = ["0123456789", "1234567890", "9876543210", "0987654321"];

function isFakePattern(digits: string): boolean {
  if (isUniformOrSequential(digits)) return true;
  if (KNOWN_FAKE_SEQUENCES.some((seq) => digits.includes(seq))) return true;
  // A real-looking country/area-code prefix followed by an
  // all-placeholder subscriber number — e.g. Colombian "+57 300 000
  // 0000" — never reads as uniform/sequential over the FULL string
  // (the "573" at the front breaks it), only over the trailing digits,
  // which is exactly where someone fabricating a number tends to give
  // up. Checking a few trailing window sizes catches that without
  // needing a per-country subscriber-number-length table.
  for (const windowSize of [10, 9, 8, 7]) {
    if (digits.length > windowSize && isUniformOrSequential(digits.slice(-windowSize))) return true;
  }
  return false;
}

function analyzeOne(phone: string | null): PhoneQualityReason[] {
  const reasons: PhoneQualityReason[] = [];
  const trimmed = (phone ?? "").trim();

  if (!trimmed) {
    reasons.push("missing");
    return reasons;
  }

  if (!trimmed.startsWith("+")) {
    reasons.push("no_plus_prefix");
  }

  const body = trimmed.startsWith("+") ? trimmed.slice(1) : trimmed;
  if (!/^[0-9]+$/.test(body)) {
    reasons.push("invalid_characters");
    // Digit-count and fake-pattern checks below need pure digits to mean
    // anything — with junk characters mixed in, length/pattern are
    // meaningless, so stop here rather than pile on noisy secondary reasons.
    return reasons;
  }

  if (body.length < MIN_DIGITS) reasons.push("too_short");
  else if (body.length > MAX_DIGITS) reasons.push("too_long");

  if (isFakePattern(body)) reasons.push("fake_pattern");

  // Colombia-specific soft check — the large majority of this list —
  // real mobiles are +57 followed by exactly 10 digits starting with 3.
  // A mismatch here is NOT proof of anything (a landline with area code
  // has a different shape, someone may have typed a spare digit), just
  // worth a human glance, which is why it's never in the auto-
  // suppressible set below.
  if (trimmed.startsWith("+57") && !(body.length === 12 && body.slice(2).startsWith("3"))) {
    reasons.push("co_length_unexpected");
  }

  return reasons;
}

export function analyzePhoneQuality(people: { id: string; phone: string | null }[]): PhoneQualitySummary {
  const findings: PhoneQualityFinding[] = [];
  const countByReason: Record<PhoneQualityReason, number> = {
    missing: 0,
    no_plus_prefix: 0,
    invalid_characters: 0,
    too_short: 0,
    too_long: 0,
    fake_pattern: 0,
    co_length_unexpected: 0,
  };

  for (const person of people) {
    const reasons = analyzeOne(person.phone);
    if (reasons.length > 0) {
      findings.push({ personId: person.id, phone: person.phone, reasons });
      for (const reason of reasons) countByReason[reason]++;
    }
  }

  return { totalChecked: people.length, findings, countByReason };
}
