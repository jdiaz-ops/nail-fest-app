// Fixes a specific, confirmed-real bug: a Colombian mobile number stored
// with the wrong (or missing, or extra) country code — not a malformed
// number, a WRONG one. Found by cross-referencing a real 45k-row export
// against the Ciudad field: dozens of "+1"/"+32"/"+31"/etc numbers all
// had Colombian cities on file, and their digits (once you look past the
// wrong/missing prefix) are an exact, perfectly-shaped Colombian mobile
// (10 digits starting with 3). That shape match IS the safety net here —
// every correction below only fires when the remaining digits are
// unambiguously a real CO mobile number, never a guess at which digit is
// "probably" wrong (see personDedupe.ts's sibling caution for why a
// digit-count mismatch with no clean recoverable shape stays untouched).

export type PhoneCountryFixCategory =
  | "clean" // already a valid +57 mobile or fixed-line number, or a genuinely different country's number — no issue
  | "missing_57_entirely" // stored as bare "3XXXXXXXXX" (10 digits) — the +57 prefix was never added at all
  | "wrong_code_extra1" // "+1" glued in front of an otherwise-complete, correct "+57..." number
  | "wrong_code_swap" // some other real country code, but the remainder is a clean 10-digit CO mobile
  | "missing_57_and_truncated" // bare "3XXXXXXXX" (9 digits) — missing +57 AND one digit short; can't safely complete
  | "co_ambiguous_shape" // +57 + 10 digits, but starts with neither 3 (mobile) nor 60 (fixed) — unclear what this is
  | "ambiguous_other"; // nothing above matches — no safe read on this one

export interface PhoneFixResult {
  category: PhoneCountryFixCategory;
  /** Only set for the three auto-fixable categories. */
  correctedPhone?: string;
}

// A representative set of real calling codes this list could plausibly
// see (Europe/LatAm/common), used only to detect "this could be someone
// else's real country code" — deliberately NOT exhaustive; anything not
// listed here still gets checked against the CO-mobile-shape rules
// below, it just won't get a "wrong_code_swap" label if it doesn't also
// carry one of these prefixes. "57" is excluded — handled separately as
// the already-correct-prefix case.
const OTHER_COUNTRY_CODES = [
  "1", "20", "27", "30", "31", "32", "33", "34", "36", "39", "40", "41", "43", "44", "45", "46", "47",
  "48", "49", "51", "52", "53", "54", "55", "56", "58", "60", "61", "62", "63", "64", "65", "66", "81",
  "82", "84", "86", "90", "91", "92", "93", "94", "95", "98", "212", "213", "216", "220", "221", "222",
  "233", "234", "238", "240", "244", "249", "250", "251", "254", "255", "256", "257", "258", "260",
  "261", "262", "263", "264", "265", "266", "267", "268", "269", "291", "297", "298", "299", "350",
  "351", "352", "353", "354", "355", "356", "357", "358", "359", "370", "371", "372", "373", "374",
  "375", "376", "377", "378", "379", "380", "381", "382", "385", "386", "387", "389", "420", "421",
  "423", "500", "501", "502", "503", "504", "505", "506", "507", "508", "509", "590", "591", "592",
  "593", "594", "595", "596", "597", "598", "599", "670", "672", "673", "674", "675", "676", "677",
  "678", "679", "680", "681", "682", "683", "685", "686", "687", "688", "689", "690", "691", "692",
  "850", "852", "853", "855", "856", "880", "886", "960", "961", "962", "963", "964", "965", "966",
  "967", "968", "970", "971", "972", "973", "974", "975", "976", "977", "992", "993", "994", "995",
  "996", "998",
].sort((a, b) => b.length - a.length);

function isCoMobile(s: string): boolean {
  return /^3\d{9}$/.test(s);
}
function isCoFixed(s: string): boolean {
  return /^60[1245678]\d{7}$/.test(s);
}

export function classifyPhoneCountry(phone: string | null): PhoneFixResult {
  const trimmed = (phone ?? "").trim();
  if (!trimmed.startsWith("+")) return { category: "clean" }; // not this checker's job — phoneQuality-style checks cover format issues
  const digits = trimmed.slice(1);
  if (!/^\d+$/.test(digits) || digits.length < 6) return { category: "clean" };

  if (trimmed.startsWith("+57")) {
    const national = digits.slice(2);
    if (isCoMobile(national) || isCoFixed(national)) return { category: "clean" };
    if (national.length === 10) return { category: "co_ambiguous_shape" };
    return { category: "clean" }; // a wrong LENGTH +57 number is a phoneQuality concern (co_wrong_length), not this checker's job
  }

  // Priority 1: no country code prefix at all — the whole value IS the mobile number
  if (isCoMobile(digits)) {
    return { category: "missing_57_entirely", correctedPhone: `+57${digits}` };
  }
  // Priority 2: 9 digits starting with 3 — missing +57, AND one digit short
  if (digits.length === 9 && digits.startsWith("3")) {
    return { category: "missing_57_and_truncated" };
  }
  // Priority 3: "1" + a complete, correct "+57..." number glued together
  if (digits.startsWith("157") && isCoMobile(digits.slice(3))) {
    return { category: "wrong_code_extra1", correctedPhone: `+57${digits.slice(3)}` };
  }
  // Priority 4: some other real country code + a clean CO-mobile-shaped remainder
  for (const code of OTHER_COUNTRY_CODES) {
    if (digits.startsWith(code) && isCoMobile(digits.slice(code.length))) {
      return { category: "wrong_code_swap", correctedPhone: `+57${digits.slice(code.length)}` };
    }
  }

  return { category: "ambiguous_other" };
}
