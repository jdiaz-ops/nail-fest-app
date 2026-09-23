import { describe, it, expect } from "vitest";
import { COUNTRY_CODES, stripTrunkZero } from "./countryCodes";
import { WORLD_COUNTRIES, findCountry } from "./worldCountries";

// Reproduces exactly what RegistrationForm.tsx does to build the final
// E.164 phone it sends to /api/register(/draft): strip everything but
// digits, strip a leading trunk zero, then prepend the selected phone
// country's dial code. See countryCodes.ts's stripTrunkZero for why the
// zero-strip has to happen — this is the regression test for the real
// bug found testing Venezuelan registrations at nailfest.co/cucuta-2026
// (border city, real Venezuelan traffic): the placeholder for Venezuela
// shows "0412 1234567" (how a Venezuelan naturally reads their own
// number), and without this strip that produced "+5804121234567" — an
// invalid 14-digit number — instead of the real "+584121234567".
function buildPhone(iso2: string, typed: string): string {
  const country = findCountry(iso2) ?? WORLD_COUNTRIES[0]!;
  const digits = typed.replace(/[^0-9]/g, "");
  return `${country.dialCode}${stripTrunkZero(digits)}`;
}

describe("Venezuelan phone numbers", () => {
  it("produces a valid E.164 number when typed with the natural leading 0 (the placeholder's own format)", () => {
    expect(buildPhone("VE", "0412 1234567")).toBe("+584121234567");
  });

  it("produces the same correct number when typed WITHOUT the leading 0", () => {
    expect(buildPhone("VE", "412 1234567")).toBe("+584121234567");
  });

  it("never produces the old broken 14-digit number", () => {
    const phone = buildPhone("VE", "0412 1234567");
    expect(phone).not.toBe("+5804121234567");
    expect(phone.length).toBe("+584121234567".length);
  });
});

describe("stripTrunkZero is safe for every listed country (not Venezuela-specific)", () => {
  for (const c of COUNTRY_CODES) {
    it(`${c.name} (${c.iso2}): a leading 0 in the typed number never survives into the final phone`, () => {
      const digitsWithZero = `0${c.phonePlaceholder}`.replace(/[^0-9]/g, "");
      expect(stripTrunkZero(digitsWithZero)).not.toMatch(/^0/);
    });
  }
});

describe("a genuine country where the subscriber number happens to start with a real digit is untouched beyond the trunk zero", () => {
  it("Colombia: no leading zero to strip, number passes through unchanged", () => {
    expect(buildPhone("CO", "321 1234567")).toBe("+573211234567");
  });

  it("México: no leading zero to strip, number passes through unchanged", () => {
    expect(buildPhone("MX", "55 1234 5678")).toBe("+525512345678");
  });
});
